# SSH Agent Contracts

## 1. Scope / Trigger

Apply this contract when changing `cli-manager-ssh-agent`, shared SSH transport generation, one-shot Agent probes, Agent installation metadata, bridge framing, or the SSH Host CLI Integration status UI.

The current delivered scope is the standalone Agent protocol skeleton plus explicit one-shot `version/status/doctor` probing. Probe availability does not imply that install, Hook, history, files, Git, stats, or a persistent bridge is already delivered.

## 2. Signatures

### Shared transport

```rust
pub struct SshTransportSpec {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub config_alias: String,
    pub auth_mode: String,
    pub identity_file: String,
    pub credential_ref: String,
    pub jump_target: String,
    pub proxy_type: String,
    pub proxy_host: String,
    pub proxy_port: u16,
    pub proxy_command: String,
    pub connect_timeout_sec: u64,
    pub server_alive_interval_sec: u64,
    pub server_alive_count_max: u32,
}

pub fn build_interactive_launch(remote_command: String) -> Result<SshTransportLaunch, String>;
pub fn build_one_shot_launch(
    remote_command: String,
    options: SshOneShotOptions,
) -> Result<SshTransportLaunch, String>;
```

### Tauri command

```rust
pub async fn ssh_agent_probe(
    host_id: String,
    spec: SshTransportSpec,
    agent_path: Option<String>,
) -> Result<SshAgentProbeResult, String>;
```

`SshAgentProbeResult` contains `status`, stable `code`, sanitized executable/version/protocol/target metadata, `supported`, and an ephemeral diagnostic `detail`. Only metadata fields enter `ssh_agent_installations`; `detail` is never persisted.

### Agent CLI and bridge

```text
cli-manager-ssh-agent version
cli-manager-ssh-agent status
cli-manager-ssh-agent doctor
cli-manager-ssh-agent bridge --stdio --protocol 1
```

Bridge output begins with:

```text
CLI_MANAGER_SSH_AGENT/1 <nonce>\n
```

Frames use a four-byte big-endian length followed by UTF-8 JSON. The maximum frame size is 1 MiB.

## 3. Contracts

- Interactive PTY and one-shot execution must share authentication, port, config alias, timeout, KeepAlive, identity, AskPass, ProxyJump, and ProxyCommand generation.
- Interactive launches use `ssh -tt`; one-shot probe/install/doctor launches use `ssh -T`, `ConnectionAttempts=1`, and `BatchMode=yes`, except saved credential mode uses one-shot AskPass with `BatchMode=no` and one password prompt.
- Saving or opening SSH Host settings never probes automatically. Only the explicit Probe Agent action creates the one-shot SSH process.
- Password-prompt and multi-round interactive authentication return `authenticationRequired`; background retries must stop.
- Probe discovery accepts a previously persisted explicit path, `PATH`, `$HOME/.local/bin/cli-manager-ssh-agent`, or the standard XDG data `current` path. Explicit paths accept only absolute POSIX or `~/...` syntax.
- Probe stdout may contain at most 8 KiB of login banner before `CLI_MANAGER_SSH_AGENT_PROBE/1`. Total retained stdout is 64 KiB and stderr is 8 KiB; readers continue draining excess bytes without growing retained memory.
- After the probe marker, stdout is strict: state line, absolute executable path, then exactly one doctor JSON document. Extra text, invalid UTF-8, unsafe paths, oversized output, or malformed identity is rejected.
- Protocol major mismatch is incompatible. Protocol minor differences are handled later through capabilities. The first supported Agent target matrix is Linux `x86_64` and `aarch64`.
- `ssh_agent_installations` preserves last-known sanitized metadata on unreachable/authentication-required probes, but a confirmed `notInstalled` result clears stale version/path metadata.
- Bridge `--protocol` is mandatory. A clean EOF before a frame starts is normal; a partial four-byte length or payload is a protocol error.

## 4. Validation & Error Matrix

| Condition | Required result |
|---|---|
| Host ID is not a UUID | `ssh_host_id_invalid` |
| Background probe uses password-prompt/interactive auth | status `authenticationRequired`, code `ssh_agent_authentication_required` |
| Explicit Agent path is relative, contains expansion syntax, backslash, NUL/CR/LF | `ssh_agent_path_invalid` |
| Explicit Agent path contains a `..` segment | `ssh_agent_path_parent_forbidden` |
| No candidate executable exists | status `notInstalled`, code `ssh_agent_not_installed` |
| SSH exits with transport status 255 | status `unreachable`, code `ssh_agent_unreachable` |
| Probe process cannot start or times out | status `unreachable`, code `ssh_agent_probe_failed` |
| Banner exceeds 8 KiB | `ssh_agent_probe_banner_too_large` |
| Retained stdout exceeds 64 KiB | `ssh_agent_probe_output_too_large` |
| Marker is missing/invalid or stdout is contaminated | corresponding stable `ssh_agent_probe_*` code |
| Agent name is not `cli-manager-ssh-agent` | status `corrupt`, code `ssh_agent_identity_invalid` |
| Protocol major is not 1 | status `incompatible`, code `ssh_agent_protocol_incompatible` |
| OS/architecture is outside Linux x64/arm64 | status `unsupported`, code `unsupported_target` |
| Supported target has no usable HOME/XDG layout | status `corrupt`, code `home_directory_unavailable` |
| `bridge --stdio` omits `--protocol` | `bridge_protocol_required` |
| Frame length is zero or over 1 MiB | `frame_size_invalid` |
| EOF occurs after only part of the length prefix | `frame_length_read_failed:*` |

## 5. Good / Base / Bad Cases

- Good: four PTYs on one Host retain independent interactive SSH processes while an explicit Agent probe uses one short-lived `ssh -T` process.
- Good: a login banner precedes the marker by less than 8 KiB; the doctor report is parsed and only sanitized metadata is stored.
- Base: the Agent is absent; the UI records `notInstalled` without installing anything or modifying Hook configuration.
- Base: MFA authentication requires an interactive terminal; the probe reports `authenticationRequired` and does not retry.
- Bad: reuse the `-tt` terminal launch to run doctor, causing PTY/profile output to contaminate protocol stdout.
- Bad: cache remote stderr, proxy credentials, AskPass tokens, or arbitrary doctor JSON in SQLite.
- Bad: treat partial frame headers as clean disconnects; this hides protocol truncation and corrupt streams.

## 6. Tests Required

- Run `npx tsc --noEmit`.
- Run `cargo check --manifest-path src-tauri/Cargo.toml` with no warnings.
- Run `cargo test --manifest-path src-tauri/Cargo.toml --lib`.
- Run `cargo test --manifest-path src-tauri/ssh-agent/Cargo.toml`.
- Assert transport parity for config alias, Agent, identity-file, credential reference, interactive auth, ProxyJump, and direct proxy precedence.
- Assert explicit path validation and safe HOME expansion.
- Assert bounded banner/report parsing, invalid UTF-8/contamination, protocol mismatch, identity mismatch, unsupported target, clean EOF, partial frame length, oversized frame, and mandatory bridge protocol.
- Manually verify the CLI Integration page opens without SSH traffic and only Probe Agent starts a one-shot connection.

## 7. Wrong vs Correct

### Wrong: reuse the terminal PTY launch

```rust
ssh_launch.build_process_launch(); // emits -tt and enters the project shell
```

### Correct: share transport settings, select the correct launch mode

```rust
transport.build_interactive_launch(project_command);
transport.build_one_shot_launch(agent_probe_script, SshOneShotOptions::default());
```

The shared transport owns authentication and routing; the caller owns whether the process is an interactive PTY or a bounded one-shot operation.
