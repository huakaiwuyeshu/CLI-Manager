use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use log::{debug, error, info, warn};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex, RwLock};
use std::thread::JoinHandle;
use tauri::{AppHandle, Emitter};

use crate::pty::boundary::safe_emit_boundary;
use crate::shell_resolver::{resolve_git_bash_exe, GIT_BASH_NOT_FOUND_MESSAGE};

/// Reader 累积阈值：达到该阈值或下游显式没有更多数据时才 emit，避免高吞吐时
/// 每次 read 都触发一次 IPC + Base64 编码。
const READER_FLUSH_THRESHOLD: usize = 32 * 1024;
const READER_BUF_SIZE: usize = 16 * 1024;
const MIN_PTY_COLS: u16 = 40;
const MIN_PTY_ROWS: u16 = 8;

pub struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
    diagnostics: Arc<Mutex<PtySessionDiagnostics>>,
    reader_handle: Option<JoinHandle<()>>,
}

#[derive(Clone)]
struct PtySessionDiagnostics {
    session_id: String,
    shell: String,
    exe: String,
    cwd: Option<String>,
    last_resize_cols: Option<u16>,
    last_resize_rows: Option<u16>,
}

#[derive(Clone, Serialize)]
pub struct PtyProcessStatus {
    pub status: String,
    pub exit_code: Option<i32>,
}

pub struct PtyManager {
    sessions: RwLock<HashMap<String, Arc<Mutex<PtySession>>>>,
    statuses: Arc<Mutex<HashMap<String, PtyProcessStatus>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            statuses: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn resolve_shell(shell: &str) -> Result<(String, Vec<String>), String> {
        match shell {
            "cmd" => Ok(("cmd.exe".to_string(), vec!["/Q".to_string()])),
            "pwsh" => Ok(("pwsh.exe".to_string(), vec!["-NoLogo".to_string()])),
            "wsl" => Ok(("wsl.exe".to_string(), Vec::new())),
            "gitbash" => resolve_git_bash_exe()
                .map(|path| (path.to_string_lossy().into_owned(), Vec::new()))
                .ok_or_else(|| GIT_BASH_NOT_FOUND_MESSAGE.to_string()),
            "bash" => Ok(("bash.exe".to_string(), Vec::new())),
            _ => Ok(("powershell.exe".to_string(), vec!["-NoLogo".to_string()])),
        }
    }

    fn shell_runtime_monitoring_enabled(env_vars: Option<&HashMap<String, String>>) -> bool {
        env_vars
            .and_then(|vars| vars.get("CLI_MANAGER_SHELL_RUNTIME_MONITORING"))
            .map(|value| value == "1")
            .unwrap_or(false)
    }

    fn powershell_runtime_monitor_args() -> Vec<String> {
        // 标准 FinalTerm OSC 133 shell integration（前端 XTermTerminal 原始流解析）：
        //   D[;exit] = 命令结束（无 exit 表示没跑命令：空回车 / prompt 处 Ctrl+C）
        //   A = prompt 开始；B = prompt 结束
        //   C = 命令开始执行（PSConsoleHostReadLine 提交非空行时发出）
        // 是否真的跑过命令用 history id 判断，避免空回车误报 command_finished。
        let script = r#"
$global:CliManagerLastHistoryId = $null
$global:CliManagerPreviousPrompt = if (Test-Path function:\prompt) { (Get-Command prompt).ScriptBlock } else { $null }
function global:prompt {
  $success = $?
  $nativeExitCode = $global:LASTEXITCODE
  $esc = [char]27
  $bel = [char]7
  $lastHistory = Get-History -Count 1
  $lastId = if ($lastHistory) { $lastHistory.Id } else { -1 }
  $out = ""
  if (($null -ne $global:CliManagerLastHistoryId) -and ($lastId -ne $global:CliManagerLastHistoryId)) {
    $exitCode = if ($success) { 0 } elseif ($nativeExitCode -is [int] -and $nativeExitCode -ne 0) { $nativeExitCode } else { 1 }
    $out += "$esc]133;D;$exitCode$bel"
  } else {
    $out += "$esc]133;D$bel"
  }
  $global:CliManagerLastHistoryId = $lastId
  $out += "$esc]133;A$bel"
  $promptText = if ($global:CliManagerPreviousPrompt) { & $global:CliManagerPreviousPrompt } else { 'PS ' + (Get-Location) + '> ' }
  "$out$promptText$esc]133;B$bel"
}
if (-not (Get-Module -Name PSReadLine)) { Import-Module PSReadLine -ErrorAction SilentlyContinue }
if (Test-Path function:\PSConsoleHostReadLine) {
  $global:CliManagerOriginalReadLine = $function:PSConsoleHostReadLine
  function global:PSConsoleHostReadLine {
    $line = & $global:CliManagerOriginalReadLine
    if (($null -ne $line) -and ($line.Trim().Length -gt 0)) {
      [Console]::Write("$([char]27)]133;C$([char]7)")
    }
    $line
  }
}
"#;
        vec![
            "-NoLogo".to_string(),
            "-NoExit".to_string(),
            "-Command".to_string(),
            script.to_string(),
        ]
    }

    /// Git Bash 的 OSC 133 集成 rcfile：先加载用户 ~/.bashrc 再追加我们的钩子，
    /// 保证 PROMPT_COMMAND / PS0 不被用户配置覆盖。
    /// PS0 仅在交互式命令真正执行前展开（bash 4.4+），用 `${PS0:0:$((var=1,0))}`
    /// 技巧完成无输出赋值，替代 DEBUG trap（trap 会被 PROMPT_COMMAND 自身误触发）。
    fn write_bash_integration_rcfile() -> Result<String, String> {
        let script = r#"[ -f ~/.bashrc ] && . ~/.bashrc
__cli_manager_prompt() {
  local exit_code=$?
  if [ "${__cli_manager_ran:-0}" = "1" ]; then
    printf '\033]133;D;%s\007' "$exit_code"
    __cli_manager_ran=0
  else
    printf '\033]133;D\007'
  fi
  printf '\033]133;A\007'
}
PROMPT_COMMAND="__cli_manager_prompt${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
PS0='\e]133;C\a${PS0:0:$((__cli_manager_ran=1,0))}'
"#;
        let path = std::env::temp_dir().join("cli-manager-bash-integration.bashrc");
        std::fs::write(&path, script).map_err(|e| e.to_string())?;
        Ok(path.to_string_lossy().replace('\\', "/"))
    }

    /// cmd 经 PROMPT 环境变量注入 133 标记（$E=ESC，$E\ = ST 终止符）。
    /// cmd 拿不到上一条命令的 exit code，D 恒不带参数；running 由前端输入侧
    /// 猜测提供，prompt 重现（A）时收口为 done。
    fn apply_cmd_prompt_integration(env_vars: &mut HashMap<String, String>) {
        let base = env_vars
            .get("PROMPT")
            .cloned()
            .or_else(|| std::env::var("PROMPT").ok())
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "$P$G".to_string());
        env_vars.insert(
            "PROMPT".to_string(),
            format!("$E]133;D$E\\$E]133;A$E\\{base}$E]133;B$E\\"),
        );
    }

    fn build_shell_args(
        shell: &str,
        env_vars: Option<&HashMap<String, String>>,
    ) -> Result<(String, Vec<String>), String> {
        let monitoring_enabled = Self::shell_runtime_monitoring_enabled(env_vars);
        if !monitoring_enabled {
            return Self::resolve_shell(shell);
        }
        match shell {
            "powershell" | "pwsh" => {
                let exe = if shell == "pwsh" {
                    "pwsh.exe"
                } else {
                    "powershell.exe"
                };
                Ok((exe.to_string(), Self::powershell_runtime_monitor_args()))
            }
            // gitbash 是确定的 Windows 原生 bash，可安全注入 rcfile；
            // "bash"（System32 的 WSL 启动器）与 wsl 一样无法可靠注入，
            // 仅依赖前端识别用户自带的 OSC 133/633 集成。
            "gitbash" => {
                let (exe, args) = Self::resolve_shell(shell)?;
                match Self::write_bash_integration_rcfile() {
                    Ok(rcfile) => Ok((exe, vec!["--rcfile".to_string(), rcfile, "-i".to_string()])),
                    Err(err) => {
                        warn!("bash integration rcfile write failed, fallback to plain shell: {err}");
                        Ok((exe, args))
                    }
                }
            }
            _ => Self::resolve_shell(shell),
        }
    }

    pub fn create(
        &self,
        session_id: &str,
        cwd: Option<&str>,
        env_vars: Option<HashMap<String, String>>,
        shell: Option<&str>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let env_count = env_vars.as_ref().map(|vars| vars.len()).unwrap_or(0);
        info!(
            "pty session create: id={}, shell={:?}, cwd={:?}, env_vars={}",
            session_id, shell, cwd, env_count
        );
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| {
                error!("pty openpty failed: id={}, error={}", session_id, e);
                e.to_string()
            })?;

        let shell_key = shell.unwrap_or("powershell");
        let mut env_vars = env_vars;
        if shell_key == "cmd" && Self::shell_runtime_monitoring_enabled(env_vars.as_ref()) {
            Self::apply_cmd_prompt_integration(env_vars.get_or_insert_with(HashMap::new));
        }
        let (exe, args) = Self::build_shell_args(shell_key, env_vars.as_ref()).map_err(|e| {
            error!(
                "pty resolve shell failed: id={}, shell={}, error={}",
                session_id, shell_key, e
            );
            e
        })?;
        let mut cmd = CommandBuilder::new(&exe);
        for arg in args {
            cmd.arg(arg);
        }

        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }
        if let Some(vars) = env_vars {
            for (k, v) in vars {
                cmd.env(k, v);
            }
        }

        let child = pair.slave.spawn_command(cmd).map_err(|e| {
            error!(
                "pty spawn failed: id={}, exe={}, error={}",
                session_id, exe, e
            );
            e.to_string()
        })?;
        drop(pair.slave);

        let writer = pair.master.take_writer().map_err(|e| {
            error!("pty take_writer failed: id={}, error={}", session_id, e);
            e.to_string()
        })?;
        let mut reader = pair.master.try_clone_reader().map_err(|e| {
            error!("pty clone_reader failed: id={}, error={}", session_id, e);
            e.to_string()
        })?;

        let child = Arc::new(Mutex::new(child));
        let diagnostics = Arc::new(Mutex::new(PtySessionDiagnostics {
            session_id: session_id.to_string(),
            shell: shell.unwrap_or("powershell").to_string(),
            exe: exe.to_string(),
            cwd: cwd.map(str::to_string),
            last_resize_cols: None,
            last_resize_rows: None,
        }));
        let output_event = format!("pty-output-{session_id}");
        let status_event = format!("pty-status-{session_id}");
        let status_map = self.statuses.clone();
        let child_for_thread = child.clone();
        let diagnostics_for_thread = diagnostics.clone();
        let session_id_owned = session_id.to_string();

        self.statuses.lock().unwrap().insert(
            session_id.to_string(),
            PtyProcessStatus {
                status: "running".to_string(),
                exit_code: None,
            },
        );

        let reader_handle = std::thread::spawn(move || {
            let mut buf = [0u8; READER_BUF_SIZE];
            let mut pending: Vec<u8> = Vec::with_capacity(READER_FLUSH_THRESHOLD * 2);
            let mut reader_end_reason = "eof".to_string();
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        pending.extend_from_slice(&buf[..n]);
                        // 动态批量：buffer 被读满意味着可能还有更多数据，先累积；
                        // 反之或累计已超阈值就立即 emit，避免延迟。
                        let likely_more = n == buf.len();
                        if !likely_more || pending.len() >= READER_FLUSH_THRESHOLD {
                            // 关键：仅 emit 处于 UTF-8 + ANSI 序列边界的安全前缀，
                            // 残尾保留到下一轮拼接，避免前端 xterm 把残字节解读为 SGR 参数。
                            let safe = safe_emit_boundary(&pending);
                            if safe > 0 {
                                let encoded = STANDARD.encode(&pending[..safe]);
                                let _ = app_handle.emit(&output_event, encoded);
                                pending.drain(..safe);
                            } else if pending.len() > READER_FLUSH_THRESHOLD * 8 {
                                // 极端兜底：未终结序列超 256KB（远大于任何正常 OSC/CSI），
                                // 说明源端格式异常，强制 emit 避免内存无限增长。
                                debug!(
                                    "pty pending buffer overflowed boundary protection: id={}, len={}",
                                    session_id_owned, pending.len()
                                );
                                let encoded = STANDARD.encode(&pending);
                                let _ = app_handle.emit(&output_event, encoded);
                                pending.clear();
                            }
                        }
                    }
                    Err(e) => {
                        reader_end_reason = format!("read_error: {e}");
                        break;
                    }
                }
            }
            // 进程退出，把剩余数据全部发出去（不再保护边界，最后一帧）
            if !pending.is_empty() {
                let encoded = STANDARD.encode(&pending);
                let _ = app_handle.emit(&output_event, encoded);
                pending.clear();
            }

            // Process exited — check exit status
            let (new_status, child_exit_status, child_exit_code_raw, child_wait_error) =
                match child_for_thread.lock().unwrap().try_wait() {
                    Ok(Some(exit)) => {
                        let exit_code = exit.exit_code();
                        (
                            PtyProcessStatus {
                                status: "exited".to_string(),
                                exit_code: Some(exit_code as i32),
                            },
                            Some(format!("{exit:?}")),
                            Some(exit_code),
                            None,
                        )
                    }
                    Ok(None) => (
                        PtyProcessStatus {
                            status: "exited".to_string(),
                            exit_code: None,
                        },
                        None,
                        None,
                        None,
                    ),
                    Err(e) => (
                        PtyProcessStatus {
                            status: "error".to_string(),
                            exit_code: None,
                        },
                        None,
                        None,
                        Some(e.to_string()),
                    ),
                };
            let diagnostics = diagnostics_for_thread.lock().unwrap().clone();
            info!(
                "pty reader ended: reason={}, id={}, status={}, exit_code={:?}, child_exit_status={:?}, child_exit_code_raw={:?}, shell={}, exe={}, cwd={:?}, last_resize_cols={:?}, last_resize_rows={:?}, child_wait_error={:?}",
                reader_end_reason,
                diagnostics.session_id,
                new_status.status,
                new_status.exit_code,
                child_exit_status,
                child_exit_code_raw,
                diagnostics.shell,
                diagnostics.exe,
                diagnostics.cwd,
                diagnostics.last_resize_cols,
                diagnostics.last_resize_rows,
                child_wait_error
            );

            if let Ok(mut statuses) = status_map.lock() {
                if let Some(entry) = statuses.get_mut(&session_id_owned) {
                    *entry = new_status.clone();
                }
            }

            let _ = app_handle.emit(&status_event, new_status);
        });

        let session = Arc::new(Mutex::new(PtySession {
            writer,
            master: pair.master,
            child,
            diagnostics,
            reader_handle: Some(reader_handle),
        }));
        self.sessions
            .write()
            .unwrap()
            .insert(session_id.to_string(), session);
        info!("pty session ready: id={}", session_id);
        Ok(())
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let session_arc = {
            let sessions = self.sessions.read().unwrap();
            sessions.get(session_id).cloned()
        }
        .ok_or_else(|| {
            let msg = format!("Session {session_id} not found");
            error!("pty write failed: {}", msg);
            msg
        })?;
        let mut session = session_arc.lock().unwrap();
        session.writer.write_all(data.as_bytes()).map_err(|e| {
            error!("pty write failed: session_id={}, error={}", session_id, e);
            e.to_string()
        })?;
        session.writer.flush().map_err(|e| {
            error!("pty flush failed: session_id={}, error={}", session_id, e);
            e.to_string()
        })?;
        Ok(())
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let session_arc = {
            let sessions = self.sessions.read().unwrap();
            sessions.get(session_id).cloned()
        }
        .ok_or_else(|| {
            let msg = format!("Session {session_id} not found");
            error!("pty resize failed: {}", msg);
            msg
        })?;
        let session = session_arc.lock().unwrap();
        let cols = cols.max(MIN_PTY_COLS);
        let rows = rows.max(MIN_PTY_ROWS);
        debug!(
            "pty resize: session_id={}, cols={}, rows={}",
            session_id, cols, rows
        );
        if let Ok(mut diagnostics) = session.diagnostics.lock() {
            diagnostics.last_resize_cols = Some(cols);
            diagnostics.last_resize_rows = Some(rows);
        }
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| {
                error!("pty resize failed: session_id={}, error={}", session_id, e);
                e.to_string()
            })
    }

    pub fn close(&self, session_id: &str) -> Result<(), String> {
        let session_arc = {
            let mut sessions = self.sessions.write().unwrap();
            sessions.remove(session_id)
        };
        if let Some(session_arc) = session_arc {
            // Kill child first, take reader handle out, then drop the Arc.
            // Dropping the last Arc releases the master PTY, which causes the
            // reader thread to observe EOF and exit promptly.
            let reader_handle = {
                let mut session = session_arc.lock().unwrap();
                let _ = session.child.lock().unwrap().kill();
                session.reader_handle.take()
            };
            drop(session_arc);
            if let Some(handle) = reader_handle {
                let _ = handle.join();
            }
            info!("pty session killed: id={}", session_id);
        } else {
            debug!("pty close requested for missing session: id={}", session_id);
        }
        self.statuses.lock().unwrap().remove(session_id);
        Ok(())
    }

    pub fn status_all(&self) -> HashMap<String, PtyProcessStatus> {
        self.statuses.lock().unwrap().clone()
    }
}
