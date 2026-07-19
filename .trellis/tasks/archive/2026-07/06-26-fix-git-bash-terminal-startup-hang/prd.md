# Fix Git Bash terminal startup hang

## Goal

When a project terminal uses Git Bash on Windows, opening the terminal should reliably reach an interactive prompt on the first window instead of appearing stuck until the user opens additional terminal windows.

## What I Already Know

* User reports that project terminals with shell type Git Bash can get stuck immediately after opening.
* The terminal becomes normal only after opening several windows.
* Frontend session creation resolves Git Bash to the `"gitbash"` shell key and invokes Rust `pty_create`.
* Rust `PtyManager::resolve_shell` currently launches Git Bash as the resolved `bash.exe` with no arguments when shell runtime monitoring is disabled.
* When shell runtime monitoring is enabled, `PtyManager::build_shell_args` launches Git Bash as `bash.exe --rcfile <temp> -i`.
* Git Bash normal interactive startup commonly depends on an interactive login shell path (`--login -i`) so Git for Windows profile initialization runs.
* User screenshot after the first fix still shows a completely blank PTY area with no error text, which points to the first PTY output being emitted before `XTermTerminal` has subscribed to `pty-output-<sessionId>`.
* GitNexus MCP tools are not exposed in this Codex session. The local `.gitnexus/lbug` index binary cannot execute under the current Linux shell, and `npx gitnexus --help` / `npm exec gitnexus -- --help` returned no usable output. Impact analysis must be approximated with source inspection unless tools become available.

## Requirements

* Git Bash PTY sessions must be launched with stable interactive initialization on Windows.
* Project `cwd` must continue to be respected instead of Git Bash login initialization forcing the session to home.
* Shell runtime monitoring, when enabled, must continue to inject the bash integration rcfile for Git Bash.
* Git Bash's first prompt/output must not be lost if it appears before the React terminal component subscribes to the output event.
* The change must not alter PowerShell, pwsh, cmd, WSL, or non-Windows shell behavior.
* Errors for missing Git Bash must keep the existing user-facing failure path.

## Acceptance Criteria

* [ ] Creating a project terminal with shell `gitbash` starts an interactive Git Bash prompt on the first window.
* [ ] `pty_create` still succeeds for Git Bash when shell runtime monitoring is disabled.
* [ ] `pty_create` still succeeds for Git Bash when shell runtime monitoring is enabled.
* [ ] Git Bash sessions opened for a project remain in the requested project directory.
* [ ] `cd src-tauri && cargo check` passes.
* [ ] `npx tsc --noEmit` passes or any unrelated pre-existing failures are documented.

## Definition of Done

* Code changes are scoped to Git Bash PTY startup.
* Backend compile check passes.
* Frontend typecheck is run because the terminal creation path crosses the frontend/backend boundary.
* Any new durable convention discovered during the fix is considered for `.trellis/spec/`.

## Technical Approach

Adjust the Git Bash launch arguments in `src-tauri/src/pty/manager.rs` so Windows Git Bash starts as an interactive login shell while preserving project `cwd`. For the monitoring path, keep the temporary rcfile integration and verify argument ordering is compatible with the intended bash startup behavior. Also defer the initial Git Bash reader loop briefly so fast prompt output is emitted after the frontend output listener has had time to mount.

## Decision (ADR-lite)

**Context**: Git Bash is currently spawned as bare `bash.exe` or `bash.exe --rcfile <temp> -i`, which bypasses the standard Git for Windows login initialization path.

**Decision**: Fix Git Bash startup in the backend PTY boundary instead of adding frontend retries or opening extra sessions.

**Consequences**: This keeps session creation deterministic and avoids masking the startup issue with UI behavior. The main compatibility risk is startup-file ordering when combining login shell behavior with runtime-monitoring rcfile injection, so validation should cover both monitoring on and off.

## Out of Scope

* Changing user-visible shell settings UI.
* Retrying terminal creation from the frontend.
* Changing PowerShell, pwsh, cmd, WSL, macOS, or Linux shell startup behavior.
* Reworking generic shell runtime monitoring beyond the Git Bash startup bug.

## Technical Notes

* Relevant files inspected:
  * `src-tauri/src/pty/manager.rs`
  * `src-tauri/src/commands/terminal.rs`
  * `src-tauri/src/shell_resolver.rs`
  * `src/stores/terminalStore.ts`
  * `src/lib/shell.ts`
  * `.trellis/spec/backend/terminal-runtime-monitoring-contracts.md`
* `PtyManager::create` resolves the shell key, adjusts selected env vars, builds shell args, then spawns the PTY command through `portable_pty::CommandBuilder`.
* `terminalStore.buildPtyEnvVars` adds `CLI_MANAGER_SHELL_RUNTIME_MONITORING=1` only when the setting is enabled and the shell supports injection.
* The existing terminal runtime monitoring spec says unsupported shells must preserve normal launch behavior; this task narrows the Git Bash normal launch behavior.
