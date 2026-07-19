# ccusage WSL Analysis Logging

## Goal

When usage analysis runs the ccusage dashboard with WSL analysis enabled, add backend logs around the WSL ccusage execution path so failures can be traced from runtime resolution through each ccusage report command.

## What I Already Know

* User wants logs for the full WSL ccusage usage flow.
* Relevant backend command is `src-tauri/src/commands/ccusage.rs`.
* The ccusage contract is `.trellis/spec/backend/ccusage-contracts.md`.
* Existing Rust logging uses `log::info!`, `log::warn!`, and `log::debug!` with scoped prefixes such as `[wsl]` and `[git:wsl]`.
* `ccusage_refresh_report` runs three report commands: `daily`, `session`, and `blocks`.
* Current contract requires report execution via `bun x ccusage ...`, not `bunx ccusage ...`.

## Requirements

* Add logs only around the WSL ccusage path, gated by WSL runtime / WSL analysis intent.
* Log the important steps: refresh start, runtime resolution, WSL default distro probing/fallback, config path resolution, WSL command construction/execution, per-report success/failure, and refresh completion.
* Do not change ccusage runtime selection, command arguments, cache keys, or UI behavior.
* Avoid logging large JSON payloads or noisy stdout content.

## Acceptance Criteria

* [ ] WSL-enabled refresh emits enough backend logs to identify selected source, target distro, env path scope, and report step.
* [ ] Failed WSL command execution logs include report kind and trimmed error output.
* [ ] Host-only ccusage refresh behavior remains unchanged.
* [ ] `cd src-tauri && cargo check` passes.

## Definition of Done

* Backend code follows the existing logging style.
* Relevant ccusage contract remains satisfied.
* Verification commands are run or blockers are reported.

## Out of Scope

* No UI log viewer.
* No frontend toast or i18n text changes.
* No changes to ccusage install behavior.
* No dependency changes.

## Technical Notes

* Candidate symbols: `ccusage_refresh_report`, `resolve_runtime_for_source`, `ccusage_report_payload`, `command_output`, `wsl_command_output`, `wsl_command_with_bun_path_output`, `detect_default_wsl_context`.
* Existing tests only cover command construction and config fallback helpers; this task is expected to verify with Rust compile check unless a small unit-testable helper becomes useful.
