use cli_manager_ssh_agent::layout::{path_state, resolve_layout};
use cli_manager_ssh_agent::protocol::run_bridge;
use cli_manager_ssh_agent::target_supported;
use cli_manager_ssh_agent::version_report;
use serde_json::json;
use std::io::{self, BufReader, BufWriter};
use uuid::Uuid;

fn print_json(value: serde_json::Value) {
    println!(
        "{}",
        serde_json::to_string(&value).expect("serialize agent output")
    );
}

fn status_report() -> serde_json::Value {
    match resolve_layout() {
        Ok(layout) => json!({
            "version": version_report(),
            "layout": layout,
            "state": {
                "dataDir": path_state(&layout.data_dir),
                "stateDir": path_state(&layout.state_dir),
                "runtimeDir": path_state(&layout.runtime_dir),
                "installationRecord": if layout.installation_record.is_file() { "available" } else { "missing" },
            }
        }),
        Err(code) => json!({
            "version": version_report(),
            "layout": null,
            "state": { "layout": "unavailable" },
            "diagnostic": code,
        }),
    }
}

fn doctor_report() -> serde_json::Value {
    let mut report = status_report();
    let supported = target_supported();
    let layout_diagnostic = report
        .get("diagnostic")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    report["supported"] = json!(supported);
    report["code"] = json!(if !supported {
        "unsupported_target".to_string()
    } else {
        layout_diagnostic.unwrap_or_else(|| "ok".to_string())
    });
    report
}

fn bridge_protocol(options: &[String]) -> Result<&str, String> {
    let index = options
        .iter()
        .position(|value| value == "--protocol")
        .ok_or_else(|| "bridge_protocol_required".to_string())?;
    options
        .get(index + 1)
        .map(String::as_str)
        .ok_or_else(|| "bridge_protocol_required".to_string())
}

fn run() -> Result<(), String> {
    let mut args = std::env::args().skip(1);
    let command = args.next().unwrap_or_else(|| "version".to_string());
    match command.as_str() {
        "version" => {
            print_json(serde_json::to_value(version_report()).map_err(|error| error.to_string())?)
        }
        "status" => print_json(status_report()),
        "doctor" => print_json(doctor_report()),
        "bridge" => {
            let options: Vec<String> = args.collect();
            if !options.iter().any(|value| value == "--stdio") {
                return Err("bridge_stdio_required".to_string());
            }
            if bridge_protocol(&options)? != "1" {
                return Err("bridge_protocol_incompatible".to_string());
            }
            let nonce = Uuid::new_v4().simple().to_string();
            let stdin = io::stdin();
            let stdout = io::stdout();
            run_bridge(
                &mut BufReader::new(stdin.lock()),
                &mut BufWriter::new(stdout.lock()),
                &nonce,
            )?;
        }
        _ => return Err(format!("unknown_command:{command}")),
    }
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(2);
    }
}

#[cfg(test)]
mod tests {
    use super::{bridge_protocol, doctor_report, status_report};

    #[test]
    fn bridge_requires_an_explicit_compatible_protocol() {
        assert_eq!(
            bridge_protocol(&["--stdio".into()]).unwrap_err(),
            "bridge_protocol_required"
        );
        assert_eq!(
            bridge_protocol(&["--stdio".into(), "--protocol".into(), "1".into()]).unwrap(),
            "1"
        );
    }

    #[test]
    fn status_and_doctor_remain_structured_without_a_layout() {
        assert_eq!(
            status_report()["version"]["agentName"],
            "cli-manager-ssh-agent"
        );
        let doctor = doctor_report();
        assert!(doctor["supported"].is_boolean());
        assert!(doctor["code"].is_string());
    }
}
