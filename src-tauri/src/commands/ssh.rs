use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::Duration;
use uuid::Uuid;

use crate::shell_resolver::{output_with_timeout, silent_command};
use crate::ssh_transport::{
    format_remote_home_path, posix_quote, validate_remote_home_path, SshOneShotOptions,
    SshRemoteHomePathError, SshTransportLaunch, SshTransportSpec,
};

const AGENT_PROBE_MAGIC: &str = "CLI_MANAGER_SSH_AGENT_PROBE/1";
const AGENT_PROTOCOL_MAJOR: u16 = 1;
const MAX_AGENT_PROBE_BANNER_BYTES: usize = 8 * 1024;
const MAX_AGENT_PROBE_REPORT_BYTES: usize = 64 * 1024;
const MAX_AGENT_PROBE_STDERR_BYTES: usize = 8 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshClientStatus {
    available: bool,
    version: Option<String>,
    error: Option<String>,
}

pub type SshConnectionSpec = SshTransportSpec;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshDiagnosticStage {
    key: String,
    status: String,
    detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConnectionTestResult {
    success: bool,
    stages: Vec<SshDiagnosticStage>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshPathCheckResult {
    exists: bool,
    accessible: bool,
    git_repository: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshDirectoryEntry {
    name: String,
    path: String,
}

struct SshAuthProbeOutput {
    authenticated: bool,
    timed_out: bool,
    status_success: bool,
    status_code: Option<i32>,
    stderr: String,
}

struct AgentProbeProcessOutput {
    status_success: bool,
    status_code: Option<i32>,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
    stdout_truncated: bool,
}

fn single_line(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or_default()
        .to_string()
}

fn host_key_fingerprint(stderr: &str) -> Option<String> {
    stderr.lines().find_map(|line| {
        line.split_once("Server host key:")
            .map(|(_, value)| value.trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

fn is_authenticated_log(line: &str) -> bool {
    line.contains("Authenticated to ")
}

fn run_ssh_auth_probe(
    mut command: Command,
    timeout: Duration,
) -> std::io::Result<SshAuthProbeOutput> {
    use std::io::{BufRead, BufReader};
    use std::process::Stdio;
    use std::sync::{mpsc, Arc, Mutex};
    use std::time::Instant;

    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    let mut child = command.spawn()?;
    let stderr_pipe = child.stderr.take();
    let lines = Arc::new(Mutex::new(Vec::<String>::new()));
    let reader_lines = Arc::clone(&lines);
    let (authenticated_tx, authenticated_rx) = mpsc::channel();
    let (reader_done_tx, reader_done_rx) = mpsc::channel();
    let _reader = std::thread::spawn(move || {
        if let Some(pipe) = stderr_pipe {
            for line in BufReader::new(pipe).lines().map_while(Result::ok) {
                let trimmed = line.trim().to_string();
                if trimmed.is_empty() {
                    continue;
                }
                let authenticated = is_authenticated_log(&trimmed);
                if let Ok(mut output) = reader_lines.lock() {
                    if output.len() < 256 {
                        output.push(trimmed);
                    }
                }
                if authenticated {
                    let _ = authenticated_tx.send(());
                }
            }
        }
        let _ = reader_done_tx.send(());
    });
    let collect_log = || {
        lines
            .lock()
            .map(|output| output.join("\n"))
            .unwrap_or_default()
    };

    let deadline = Instant::now() + timeout;
    let wait_for_reader = || {
        let _ = reader_done_rx.recv_timeout(Duration::from_millis(100));
    };
    loop {
        if authenticated_rx.try_recv().is_ok() {
            let _ = child.kill();
            let _ = child.wait();
            wait_for_reader();
            return Ok(SshAuthProbeOutput {
                authenticated: true,
                timed_out: false,
                status_success: true,
                status_code: Some(0),
                stderr: collect_log(),
            });
        }
        if let Some(status) = child.try_wait()? {
            wait_for_reader();
            let stderr = collect_log();
            return Ok(SshAuthProbeOutput {
                authenticated: stderr.lines().any(is_authenticated_log),
                timed_out: false,
                status_success: status.success(),
                status_code: status.code(),
                stderr,
            });
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            wait_for_reader();
            return Ok(SshAuthProbeOutput {
                authenticated: false,
                timed_out: true,
                status_success: false,
                status_code: None,
                stderr: collect_log(),
            });
        }
        std::thread::sleep(Duration::from_millis(30));
    }
}

fn read_bounded(mut reader: impl std::io::Read, limit: usize) -> (Vec<u8>, bool) {
    let mut output = Vec::with_capacity(limit.min(8 * 1024));
    let mut truncated = false;
    let mut buffer = [0u8; 8 * 1024];
    loop {
        let read = match reader.read(&mut buffer) {
            Ok(0) | Err(_) => break,
            Ok(read) => read,
        };
        let remaining = limit.saturating_sub(output.len());
        let retained = remaining.min(read);
        output.extend_from_slice(&buffer[..retained]);
        if retained < read {
            truncated = true;
        }
    }
    (output, truncated)
}

fn run_agent_probe_process(
    mut command: Command,
    timeout: Duration,
) -> std::io::Result<AgentProbeProcessOutput> {
    use std::process::Stdio;
    use std::time::Instant;

    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn()?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_reader = std::thread::spawn(move || {
        stdout
            .map(|pipe| read_bounded(pipe, MAX_AGENT_PROBE_REPORT_BYTES))
            .unwrap_or_default()
    });
    let stderr_reader = std::thread::spawn(move || {
        stderr
            .map(|pipe| read_bounded(pipe, MAX_AGENT_PROBE_STDERR_BYTES))
            .unwrap_or_default()
    });
    let deadline = Instant::now() + timeout;
    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stdout_reader.join();
            let _ = stderr_reader.join();
            return Err(std::io::Error::new(
                std::io::ErrorKind::TimedOut,
                "ssh_agent_probe_timeout",
            ));
        }
        std::thread::sleep(Duration::from_millis(25));
    };
    let (stdout, stdout_truncated) = stdout_reader.join().unwrap_or_default();
    let (stderr, _) = stderr_reader.join().unwrap_or_default();
    Ok(AgentProbeProcessOutput {
        status_success: status.success(),
        status_code: status.code(),
        stdout,
        stderr,
        stdout_truncated,
    })
}

fn validate_spec(spec: &SshConnectionSpec) -> Result<(), String> {
    spec.validate()
}

fn ssh_password_account(host_id: &str) -> Result<String, String> {
    let id = Uuid::parse_str(host_id.trim()).map_err(|_| "ssh_host_id_invalid".to_string())?;
    Ok(format!("ssh:{id}:password"))
}

#[tauri::command]
pub async fn ssh_save_password(host_id: String, password: String) -> Result<String, String> {
    if password.is_empty() {
        return Err("ssh_password_required".to_string());
    }
    let account = ssh_password_account(&host_id)?;
    let account_for_store = account.clone();
    tokio::task::spawn_blocking(move || {
        crate::credential_store::set(&account_for_store, &password)
    })
    .await
    .map_err(|err| format!("ssh credential task failed: {err}"))??;
    Ok(account)
}

#[tauri::command]
pub async fn ssh_password_status(host_id: String) -> Result<bool, String> {
    let account = ssh_password_account(&host_id)?;
    tokio::task::spawn_blocking(move || {
        crate::credential_store::get(&account)
            .map(|value| value.is_some_and(|item| !item.is_empty()))
    })
    .await
    .map_err(|err| format!("ssh credential task failed: {err}"))?
}

#[tauri::command]
pub async fn ssh_delete_password(host_id: String) -> Result<(), String> {
    let account = ssh_password_account(&host_id)?;
    tokio::task::spawn_blocking(move || crate::credential_store::delete(&account))
        .await
        .map_err(|err| format!("ssh credential task failed: {err}"))?
}

fn validate_remote_path(path: &str) -> Result<&str, String> {
    let path = path.trim();
    if !path.starts_with('/') || path.contains('\0') || path.contains('\n') || path.contains('\r') {
        return Err("ssh_remote_path_invalid".to_string());
    }
    if path.split('/').any(|part| part == "..") {
        return Err("ssh_remote_path_parent_forbidden".to_string());
    }
    Ok(path)
}

fn ensure_non_interactive(spec: &SshConnectionSpec) -> Result<(), String> {
    if matches!(spec.auth_mode.as_str(), "password_prompt" | "interactive") {
        return Err("ssh_interactive_auth_required".to_string());
    }
    Ok(())
}

fn ssh_remote_command_with_options(
    spec: &SshConnectionSpec,
    remote_command: &str,
    verbose: bool,
    accept_new_host_key: bool,
) -> Result<Command, String> {
    let launch = spec.build_one_shot_launch(
        remote_command.to_string(),
        SshOneShotOptions {
            verbose,
            accept_new_host_key,
        },
    )?;
    Ok(command_from_transport_launch(launch))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshAgentProbeResult {
    status: String,
    code: String,
    install_path: String,
    agent_version: String,
    protocol_version: String,
    target: String,
    supported: bool,
    detail: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentVersionProbe {
    agent_name: String,
    agent_version: String,
    protocol_major: u16,
    protocol_minor: u16,
    target_os: String,
    target_arch: String,
}

#[derive(Debug, Clone, Deserialize)]
struct AgentDoctorProbe {
    version: AgentVersionProbe,
    supported: bool,
    code: String,
}

#[derive(Debug)]
enum ParsedAgentProbe {
    NotInstalled,
    Report {
        install_path: String,
        report: AgentDoctorProbe,
    },
}

fn command_from_transport_launch(launch: SshTransportLaunch) -> Command {
    let mut command = silent_command(&launch.executable);
    command.args(launch.args).envs(launch.env);
    command
}

fn ssh_remote_command(spec: &SshConnectionSpec, remote_command: &str) -> Result<Command, String> {
    ssh_remote_command_with_options(spec, remote_command, false, false)
}

fn ssh_probe_command(
    spec: &SshConnectionSpec,
    accept_new_host_key: bool,
) -> Result<Command, String> {
    ssh_remote_command_with_options(spec, "true", true, accept_new_host_key)
}

fn build_agent_probe_script(agent_path: Option<&str>) -> Result<String, String> {
    let explicit = match agent_path.map(str::trim).filter(|path| !path.is_empty()) {
        Some(path) => {
            validate_remote_home_path(path).map_err(|error| match error {
                SshRemoteHomePathError::Invalid => "ssh_agent_path_invalid".to_string(),
                SshRemoteHomePathError::ParentTraversal => {
                    "ssh_agent_path_parent_forbidden".to_string()
                }
            })?;
            Some(format_remote_home_path(path))
        }
        None => None,
    };
    let explicit_probe = explicit
        .map(|path| format!("if [ -x {path} ]; then agent={path}; fi\n"))
        .unwrap_or_default();
    Ok(format!(
        "set -eu\nagent=''\n{explicit_probe}\
         if [ -z \"$agent\" ] && command -v cli-manager-ssh-agent >/dev/null 2>&1; then agent=$(command -v cli-manager-ssh-agent); fi\n\
         if [ -z \"$agent\" ] && [ -x \"${{HOME}}/.local/bin/cli-manager-ssh-agent\" ]; then agent=\"${{HOME}}/.local/bin/cli-manager-ssh-agent\"; fi\n\
         data_agent=\"${{XDG_DATA_HOME:-${{HOME}}/.local/share}}/cli-manager-ssh-agent/current/cli-manager-ssh-agent\"\n\
         if [ -z \"$agent\" ] && [ -x \"$data_agent\" ]; then agent=\"$data_agent\"; fi\n\
         if [ -z \"$agent\" ]; then printf '{AGENT_PROBE_MAGIC} notInstalled\\n'; exit 127; fi\n\
         printf '{AGENT_PROBE_MAGIC} found\\n%s\\n' \"$agent\"\n\
         exec \"$agent\" doctor"
    ))
}

fn parse_agent_probe_stdout(stdout: &[u8]) -> Result<ParsedAgentProbe, String> {
    if stdout.len() > MAX_AGENT_PROBE_REPORT_BYTES {
        return Err("ssh_agent_probe_output_too_large".to_string());
    }
    let text =
        std::str::from_utf8(stdout).map_err(|_| "ssh_agent_probe_output_invalid".to_string())?;
    let marker_offset = text
        .find(AGENT_PROBE_MAGIC)
        .ok_or_else(|| "ssh_agent_probe_magic_missing".to_string())?;
    if marker_offset > MAX_AGENT_PROBE_BANNER_BYTES {
        return Err("ssh_agent_probe_banner_too_large".to_string());
    }
    let marker_remainder = &text[marker_offset..];
    let (marker_line, payload) = marker_remainder
        .split_once('\n')
        .ok_or_else(|| "ssh_agent_probe_output_invalid".to_string())?;
    match marker_line.trim_end_matches('\r') {
        line if line == format!("{AGENT_PROBE_MAGIC} notInstalled") => {
            if payload.trim().is_empty() {
                Ok(ParsedAgentProbe::NotInstalled)
            } else {
                Err("ssh_agent_probe_stdout_contaminated".to_string())
            }
        }
        line if line == format!("{AGENT_PROBE_MAGIC} found") => {
            let (install_path, json_payload) = payload
                .split_once('\n')
                .ok_or_else(|| "ssh_agent_probe_output_invalid".to_string())?;
            let install_path = install_path.trim_end_matches('\r').to_string();
            validate_remote_home_path(&install_path)
                .map_err(|_| "ssh_agent_probe_path_invalid".to_string())?;
            let report = serde_json::from_str::<AgentDoctorProbe>(json_payload.trim())
                .map_err(|_| "ssh_agent_probe_stdout_contaminated".to_string())?;
            Ok(ParsedAgentProbe::Report {
                install_path,
                report,
            })
        }
        _ => Err("ssh_agent_probe_magic_invalid".to_string()),
    }
}

fn agent_probe_result(status: &str, code: &str, detail: String) -> SshAgentProbeResult {
    SshAgentProbeResult {
        status: status.to_string(),
        code: code.to_string(),
        install_path: String::new(),
        agent_version: String::new(),
        protocol_version: String::new(),
        target: String::new(),
        supported: false,
        detail,
    }
}

fn result_from_agent_report(install_path: String, report: AgentDoctorProbe) -> SshAgentProbeResult {
    let version = report.version;
    let protocol_version = format!("{}.{}", version.protocol_major, version.protocol_minor);
    let target = format!("{}/{}", version.target_os, version.target_arch);
    let (status, code, supported) = if version.agent_name != "cli-manager-ssh-agent" {
        ("corrupt", "ssh_agent_identity_invalid", false)
    } else if version.protocol_major != AGENT_PROTOCOL_MAJOR {
        ("incompatible", "ssh_agent_protocol_incompatible", false)
    } else if !report.supported {
        ("unsupported", report.code.as_str(), false)
    } else if report.code != "ok" {
        ("corrupt", report.code.as_str(), false)
    } else {
        ("installed", report.code.as_str(), true)
    };
    SshAgentProbeResult {
        status: status.to_string(),
        code: code.to_string(),
        install_path,
        agent_version: version.agent_version,
        protocol_version,
        target,
        supported,
        detail: String::new(),
    }
}

#[tauri::command]
pub async fn ssh_client_status() -> SshClientStatus {
    tauri::async_runtime::spawn_blocking(|| {
        let mut command = silent_command("ssh");
        command.arg("-V");
        match output_with_timeout(command, Duration::from_secs(5)) {
            Ok(output) => {
                let stderr = single_line(&output.stderr);
                let stdout = single_line(&output.stdout);
                let version = if stderr.is_empty() { stdout } else { stderr };
                SshClientStatus {
                    available: output.status.success() || !version.is_empty(),
                    version: (!version.is_empty()).then_some(version),
                    error: None,
                }
            }
            Err(error) => SshClientStatus {
                available: false,
                version: None,
                error: Some(error.to_string()),
            },
        }
    })
    .await
    .unwrap_or_else(|error| SshClientStatus {
        available: false,
        version: None,
        error: Some(error.to_string()),
    })
}

#[tauri::command]
pub async fn ssh_test_connection(
    spec: SshConnectionSpec,
    accept_new_host_key: Option<bool>,
) -> Result<SshConnectionTestResult, String> {
    validate_spec(&spec)?;
    let client = ssh_client_status().await;
    let mut stages = vec![SshDiagnosticStage {
        key: "client".to_string(),
        status: if client.available { "passed" } else { "failed" }.to_string(),
        detail: client
            .version
            .or(client.error)
            .unwrap_or_else(|| "ssh_client_unavailable".to_string()),
    }];
    if !client.available {
        return Ok(SshConnectionTestResult {
            success: false,
            stages,
        });
    }

    if matches!(spec.auth_mode.as_str(), "password_prompt" | "interactive") {
        stages.push(SshDiagnosticStage {
            key: "authentication".to_string(),
            status: "interactive_required".to_string(),
            detail: "ssh_interactive_auth_required".to_string(),
        });
        return Ok(SshConnectionTestResult {
            success: false,
            stages,
        });
    }

    if matches!(spec.proxy_type.as_str(), "http" | "socks5") {
        let proxy_type = spec.proxy_type.clone();
        let proxy_host = spec.proxy_host.clone();
        let proxy_port = spec.proxy_port;
        let target_host = spec.host.clone();
        let target_port = spec.port;
        let proxy_timeout = Duration::from_secs(spec.connect_timeout_sec.min(300));
        let proxy_label = format!(
            "{}://{}:{} → {}:{}",
            proxy_type, proxy_host, proxy_port, target_host, target_port
        );
        let proxy_result = tauri::async_runtime::spawn_blocking(move || {
            crate::ssh_proxy::probe_proxy(
                &proxy_type,
                &proxy_host,
                proxy_port,
                &target_host,
                target_port,
                proxy_timeout,
            )
        })
        .await
        .map_err(|error| error.to_string())?;
        match proxy_result {
            Ok(()) => stages.push(SshDiagnosticStage {
                key: "proxy".to_string(),
                status: "passed".to_string(),
                detail: proxy_label,
            }),
            Err(error) => {
                stages.push(SshDiagnosticStage {
                    key: "proxy".to_string(),
                    status: "failed".to_string(),
                    detail: format!("{proxy_label}\n{error}"),
                });
                return Ok(SshConnectionTestResult {
                    success: false,
                    stages,
                });
            }
        }
    }

    let timeout = Duration::from_secs(spec.connect_timeout_sec.saturating_add(5).min(305));
    let command = ssh_probe_command(&spec, accept_new_host_key.unwrap_or(false))?;
    let output = tauri::async_runtime::spawn_blocking(move || run_ssh_auth_probe(command, timeout))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())?;

    let stderr = output.stderr;
    let success = output.authenticated || output.status_success;
    if !success && stderr.contains("REMOTE HOST IDENTIFICATION HAS CHANGED") {
        stages.push(SshDiagnosticStage {
            key: "host_key".to_string(),
            status: "failed".to_string(),
            detail: format!("ssh_host_key_changed\n{stderr}"),
        });
    } else if !success && stderr.contains("Host key verification failed") {
        let fingerprint = host_key_fingerprint(&stderr).unwrap_or_default();
        stages.push(SshDiagnosticStage {
            key: "host_key".to_string(),
            status: "confirmation_required".to_string(),
            detail: format!("ssh_host_key_confirmation_required\n{fingerprint}\n{stderr}"),
        });
    } else if output.timed_out {
        stages.push(SshDiagnosticStage {
            key: "authentication".to_string(),
            status: "failed".to_string(),
            detail: format!("ssh_authentication_timeout\n{stderr}"),
        });
    } else {
        stages.push(SshDiagnosticStage {
            key: "connection".to_string(),
            status: if success { "passed" } else { "failed" }.to_string(),
            detail: if success {
                "ssh_connection_ready".to_string()
            } else if stderr.is_empty() {
                format!("ssh_exit_status_{}", output.status_code.unwrap_or(-1))
            } else {
                stderr
            },
        });
    }
    Ok(SshConnectionTestResult { success, stages })
}

#[tauri::command]
pub async fn ssh_agent_probe(
    host_id: String,
    spec: SshConnectionSpec,
    agent_path: Option<String>,
) -> Result<SshAgentProbeResult, String> {
    Uuid::parse_str(host_id.trim()).map_err(|_| "ssh_host_id_invalid".to_string())?;
    validate_spec(&spec)?;
    if matches!(spec.auth_mode.as_str(), "password_prompt" | "interactive") {
        return Ok(agent_probe_result(
            "authenticationRequired",
            "ssh_agent_authentication_required",
            String::new(),
        ));
    }
    let script = build_agent_probe_script(agent_path.as_deref())?;
    let launch = spec.build_one_shot_launch(script, SshOneShotOptions::default())?;
    let timeout = Duration::from_secs(spec.connect_timeout_sec.saturating_add(15).min(315));
    let output = tauri::async_runtime::spawn_blocking(move || {
        run_agent_probe_process(command_from_transport_launch(launch), timeout)
    })
    .await
    .map_err(|error| error.to_string())?;
    let output = match output {
        Ok(output) => output,
        Err(error) => {
            return Ok(agent_probe_result(
                "unreachable",
                "ssh_agent_probe_failed",
                error.to_string(),
            ));
        }
    };
    if output.stdout_truncated {
        return Ok(agent_probe_result(
            "corrupt",
            "ssh_agent_probe_output_too_large",
            single_line(&output.stderr),
        ));
    }
    match parse_agent_probe_stdout(&output.stdout) {
        Ok(ParsedAgentProbe::NotInstalled) => Ok(agent_probe_result(
            "notInstalled",
            "ssh_agent_not_installed",
            single_line(&output.stderr),
        )),
        Ok(ParsedAgentProbe::Report {
            install_path,
            report,
        }) => Ok(result_from_agent_report(install_path, report)),
        Err(code) => Ok(agent_probe_result(
            if output.status_success {
                "corrupt"
            } else {
                "unreachable"
            },
            if output.status_code == Some(255) {
                "ssh_agent_unreachable"
            } else {
                &code
            },
            single_line(&output.stderr),
        )),
    }
}

#[tauri::command]
pub async fn ssh_check_path(
    spec: SshConnectionSpec,
    path: String,
) -> Result<SshPathCheckResult, String> {
    validate_spec(&spec)?;
    ensure_non_interactive(&spec)?;
    let path = validate_remote_path(&path)?.to_string();
    let quoted = posix_quote(&path);
    let script = format!(
        "if [ ! -d {quoted} ]; then printf 'missing'; \
         elif [ ! -x {quoted} ]; then printf 'inaccessible'; \
         elif git -C {quoted} rev-parse --is-inside-work-tree >/dev/null 2>&1; then printf 'git'; \
         else printf 'ok'; fi"
    );
    let timeout = Duration::from_secs(spec.connect_timeout_sec.saturating_add(5).min(305));
    let command = ssh_remote_command(&spec, &script)?;
    let output =
        tauri::async_runtime::spawn_blocking(move || output_with_timeout(command, timeout))
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(single_line(&output.stderr));
    }
    Ok(match String::from_utf8_lossy(&output.stdout).trim() {
        "git" => SshPathCheckResult {
            exists: true,
            accessible: true,
            git_repository: true,
        },
        "ok" => SshPathCheckResult {
            exists: true,
            accessible: true,
            git_repository: false,
        },
        "inaccessible" => SshPathCheckResult {
            exists: true,
            accessible: false,
            git_repository: false,
        },
        _ => SshPathCheckResult {
            exists: false,
            accessible: false,
            git_repository: false,
        },
    })
}

#[tauri::command]
pub async fn ssh_list_directories(
    spec: SshConnectionSpec,
    path: String,
) -> Result<Vec<SshDirectoryEntry>, String> {
    validate_spec(&spec)?;
    ensure_non_interactive(&spec)?;
    let path = validate_remote_path(&path)?.to_string();
    let script = format!(
        "find -- {} -mindepth 1 -maxdepth 1 -type d -print0",
        posix_quote(&path)
    );
    let timeout = Duration::from_secs(spec.connect_timeout_sec.saturating_add(10).min(310));
    let command = ssh_remote_command(&spec, &script)?;
    let output =
        tauri::async_runtime::spawn_blocking(move || output_with_timeout(command, timeout))
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(single_line(&output.stderr));
    }
    let mut entries: Vec<SshDirectoryEntry> = output
        .stdout
        .split(|byte| *byte == 0)
        .filter(|value| !value.is_empty())
        .filter_map(|value| String::from_utf8(value.to_vec()).ok())
        .map(|entry_path| {
            let normalized = entry_path.trim_end_matches('/').to_string();
            let name = normalized
                .rsplit('/')
                .next()
                .unwrap_or(&normalized)
                .to_string();
            SshDirectoryEntry {
                name,
                path: normalized,
            }
        })
        .collect();
    entries.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::{
        build_agent_probe_script, host_key_fingerprint, is_authenticated_log,
        parse_agent_probe_stdout, posix_quote, read_bounded, result_from_agent_report,
        ssh_password_account, ssh_probe_command, validate_remote_path, validate_spec,
        AgentDoctorProbe, AgentVersionProbe, ParsedAgentProbe, SshConnectionSpec,
    };

    fn spec() -> SshConnectionSpec {
        SshConnectionSpec {
            host: "example.com".to_string(),
            port: 2222,
            username: "dev".to_string(),
            config_alias: String::new(),
            auth_mode: "identity_file".to_string(),
            identity_file: "/home/dev/.ssh/id_ed25519".to_string(),
            credential_ref: String::new(),
            jump_target: "bastion".to_string(),
            proxy_type: "none".to_string(),
            proxy_host: String::new(),
            proxy_port: 0,
            proxy_command: String::new(),
            connect_timeout_sec: 12,
            server_alive_interval_sec: 30,
            server_alive_count_max: 3,
        }
    }

    #[test]
    fn builds_safe_structured_probe_arguments() {
        let spec = spec();
        validate_spec(&spec).unwrap();
        assert_eq!(spec.target(), "dev@example.com");
        let command = ssh_probe_command(&spec, false).unwrap();
        let args: Vec<String> = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();
        assert!(args.windows(2).any(|pair| pair == ["-p", "2222"]));
        assert!(args.windows(2).any(|pair| pair == ["-J", "bastion"]));
        assert!(args.iter().any(|arg| arg == "BatchMode=yes"));
        assert_eq!(args.last().map(String::as_str), Some("true"));
    }

    #[test]
    fn agent_probe_script_rejects_unsafe_explicit_paths() {
        assert_eq!(
            build_agent_probe_script(Some("$HOME/agent")).unwrap_err(),
            "ssh_agent_path_invalid"
        );
        assert_eq!(
            build_agent_probe_script(Some("~/../agent")).unwrap_err(),
            "ssh_agent_path_parent_forbidden"
        );
        let script = build_agent_probe_script(Some("~/bin/cli-manager-ssh-agent")).unwrap();
        assert!(script.contains("agent=\"${HOME}\"/'bin/cli-manager-ssh-agent'"));
    }

    #[test]
    fn agent_probe_parser_allows_bounded_login_banner() {
        let stdout = b"Welcome to server\nCLI_MANAGER_SSH_AGENT_PROBE/1 found\n/usr/bin/cli-manager-ssh-agent\n{\"version\":{\"agentName\":\"cli-manager-ssh-agent\",\"agentVersion\":\"0.1.0\",\"protocolMajor\":1,\"protocolMinor\":0,\"targetOs\":\"linux\",\"targetArch\":\"x86_64\"},\"supported\":true,\"code\":\"ok\"}\n";
        let ParsedAgentProbe::Report {
            install_path,
            report,
        } = parse_agent_probe_stdout(stdout).unwrap()
        else {
            panic!("expected report");
        };
        assert_eq!(install_path, "/usr/bin/cli-manager-ssh-agent");
        let result = result_from_agent_report(install_path, report);
        assert_eq!(result.status, "installed");
        assert_eq!(result.protocol_version, "1.0");
        assert_eq!(result.target, "linux/x86_64");
    }

    #[test]
    fn agent_probe_parser_rejects_banner_over_limit() {
        let mut stdout = vec![b'x'; super::MAX_AGENT_PROBE_BANNER_BYTES + 1];
        stdout.extend_from_slice(b"CLI_MANAGER_SSH_AGENT_PROBE/1 notInstalled\n");
        assert_eq!(
            parse_agent_probe_stdout(&stdout).unwrap_err(),
            "ssh_agent_probe_banner_too_large"
        );
    }

    #[test]
    fn agent_probe_classifies_protocol_mismatch() {
        let result = result_from_agent_report(
            "/opt/agent".into(),
            AgentDoctorProbe {
                version: AgentVersionProbe {
                    agent_name: "cli-manager-ssh-agent".into(),
                    agent_version: "2.0.0".into(),
                    protocol_major: 2,
                    protocol_minor: 0,
                    target_os: "linux".into(),
                    target_arch: "aarch64".into(),
                },
                supported: true,
                code: "ok".into(),
            },
        );
        assert_eq!(result.status, "incompatible");
        assert_eq!(result.code, "ssh_agent_protocol_incompatible");
        assert!(!result.supported);
    }

    #[test]
    fn agent_probe_does_not_mark_failed_doctor_as_usable() {
        let result = result_from_agent_report(
            "/opt/agent".into(),
            AgentDoctorProbe {
                version: AgentVersionProbe {
                    agent_name: "cli-manager-ssh-agent".into(),
                    agent_version: "0.1.0".into(),
                    protocol_major: 1,
                    protocol_minor: 0,
                    target_os: "linux".into(),
                    target_arch: "x86_64".into(),
                },
                supported: true,
                code: "home_directory_unavailable".into(),
            },
        );
        assert_eq!(result.status, "corrupt");
        assert_eq!(result.code, "home_directory_unavailable");
        assert!(!result.supported);
    }

    #[test]
    fn bounded_probe_reader_drains_without_growing_past_the_limit() {
        let input = vec![b'x'; 128];
        let (output, truncated) = read_bounded(std::io::Cursor::new(input), 32);
        assert_eq!(output.len(), 32);
        assert!(truncated);
    }

    #[test]
    fn config_alias_owns_address_and_port_resolution() {
        let mut spec = spec();
        spec.config_alias = "gpu-dev".to_string();
        spec.host.clear();
        spec.port = 0;
        spec.auth_mode = "ssh_config".to_string();
        validate_spec(&spec).unwrap();
        assert_eq!(spec.target(), "gpu-dev");
        let command = ssh_probe_command(&spec, false).unwrap();
        let args: Vec<String> = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();
        assert!(!args.iter().any(|arg| arg == "-p"));
        assert!(!args.iter().any(|arg| arg == "-i"));
    }

    #[test]
    fn quotes_remote_paths_and_rejects_parent_traversal() {
        assert_eq!(posix_quote("/srv/team's app"), "'/srv/team'\\''s app'");
        assert_eq!(validate_remote_path("/srv/app").unwrap(), "/srv/app");
        assert!(validate_remote_path("srv/app").is_err());
        assert!(validate_remote_path("/srv/../etc").is_err());
    }

    #[test]
    fn password_probe_does_not_include_stale_identity_file() {
        let mut spec = spec();
        spec.auth_mode = "password_prompt".to_string();
        let command = ssh_probe_command(&spec, false).unwrap();
        let args: Vec<String> = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();
        assert!(!args.iter().any(|arg| arg == "-i"));
        assert!(args
            .iter()
            .any(|arg| arg == "PreferredAuthentications=password,keyboard-interactive"));
        assert!(args.iter().any(|arg| arg == "NumberOfPasswordPrompts=1"));
    }

    #[test]
    fn interactive_probe_does_not_include_stale_identity_file() {
        let mut spec = spec();
        spec.auth_mode = "interactive".to_string();
        let command = ssh_probe_command(&spec, false).unwrap();
        let args: Vec<String> = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();
        assert!(!args.iter().any(|arg| arg == "-i"));
        assert!(args
            .iter()
            .any(|arg| arg == "PreferredAuthentications=keyboard-interactive"));
    }

    #[test]
    fn credential_account_is_scoped_to_valid_host_uuid() {
        assert_eq!(
            ssh_password_account("550e8400-e29b-41d4-a716-446655440000").unwrap(),
            "ssh:550e8400-e29b-41d4-a716-446655440000:password"
        );
        assert!(ssh_password_account("../webdav").is_err());
    }

    #[test]
    fn accept_new_probe_never_disables_changed_host_protection() {
        let command = ssh_probe_command(&spec(), true).unwrap();
        let args: Vec<String> = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-o", "StrictHostKeyChecking=accept-new"]));
        assert!(!args.iter().any(|arg| arg == "StrictHostKeyChecking=no"));
    }

    #[test]
    fn extracts_server_host_key_fingerprint_from_verbose_output() {
        let stderr = "debug1: Connecting\ndebug1: Server host key: ssh-ed25519 SHA256:abc123";
        assert_eq!(
            host_key_fingerprint(stderr).as_deref(),
            Some("ssh-ed25519 SHA256:abc123")
        );
    }

    #[test]
    fn detects_openssh_authenticated_verbose_output() {
        assert!(is_authenticated_log(
            "debug1: Authenticated to example.com ([203.0.113.10]:22) using \"password\"."
        ));
        assert!(!is_authenticated_log(
            "debug1: Authentication succeeded (password)."
        ));
    }
}
