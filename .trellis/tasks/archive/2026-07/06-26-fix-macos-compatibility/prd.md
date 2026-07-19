# Fix macOS Compatibility

## Goal

Fix the macOS-specific design and runtime issues found in the project-wide review, using the smallest changes that make the existing Windows-first app behave correctly on macOS without adding new dependencies or redesigning unrelated UI.

## What I Already Know

* The embedded PTY path already has partial Unix shell support: zsh/bash/fish/sh are recognized in `src-tauri/src/pty/manager.rs`.
* Several frontend paths still treat PowerShell/Windows Terminal as the default user-facing model.
* The user asked to fix all issues from the review.
* The user added three concrete bug classes to include in the same pass: close button no response, hook callback risk, and wrong scan/file path resolution.
* The repository currently has unrelated dirty files; implementation must preserve existing user changes and only touch files needed for this task.
* `subagent_transcript.rs` currently treats every explicit `/...` transcript path as WSL/Linux; this breaks native macOS paths such as `/Users/...`.
* `hook_settings.rs` writes hook commands through shell strings; Windows native paths are PowerShell-escaped, but POSIX paths still need shell-safe quoting.
* `history.rs`, `historyStore.ts`, and `HistoryWorkspace.tsx` contain path identity normalization that lowercases paths; that is unsafe on Unix-like case-sensitive volumes.

## Requirements

* Prevent macOS terminal creation from resolving to `powershell.exe` when Shell runtime monitoring is enabled.
* Replace the Windows-only external terminal flow with a platform-aware external terminal command.
* Make project folder opening cross-platform, including macOS Finder.
* Normalize or migrate invalid Windows shell defaults on macOS/Linux to platform defaults.
* Keep project shell display consistent with the actual shell used on macOS.
* Make window controls and titlebar behavior less Windows-only on macOS.
* Make window close/exit reliable when the close button or tray quit path is used; do not leave the UI in a state where click appears to do nothing.
* Keep hook callback command generation safe on Windows, WSL, macOS, and Linux.
* Resolve explicit native macOS/Linux transcript paths as native paths unless a WSL distro is explicitly present.
* Prefer `HOME` over `USERPROFILE` on Unix-like platforms when scanning Claude/Codex history and subagent transcript directories.
* Provide macOS-friendly shortcut defaults or shortcut preset handling where practical.
* Avoid rejecting Unix-valid relative path segments solely because they contain backslashes, unless the path is a normalized app-internal path where `/` is required.
* Avoid case-folding filesystem paths where path identity matters on Unix-like platforms.

## Acceptance Criteria

* [ ] On macOS, creating a new terminal with runtime monitoring enabled does not try to spawn `powershell.exe`.
* [ ] On macOS, external terminal launch no longer calls Windows Terminal `wt.exe`.
* [ ] On macOS, opening a project folder from stats/sidebar opens Finder or the system file manager path successfully.
* [ ] Clicking close and confirming exit actually terminates the app; tray quit uses the same reliable exit path.
* [ ] Hook command strings correctly quote POSIX executable paths and keep existing Windows/WSL behavior.
* [ ] Native macOS `/Users/...` transcript paths are not converted through WSL or rejected for missing WSL distro.
* [ ] History/session file matching does not lowercase full filesystem paths.
* [ ] Settings default shell options do not show stale Windows defaults as the active macOS value for new installs.
* [ ] Existing Windows behavior remains supported: PowerShell/CMD/WSL/Git Bash external and embedded flows continue to resolve as before.
* [ ] TypeScript check passes.
* [ ] Rust `cargo check` passes.

## Definition of Done

* Code changes are scoped to platform compatibility.
* No new dependency is added.
* Existing public Tauri command names are kept stable where possible, or frontend callers are updated together.
* Verification commands are run and reported.

## Technical Approach

Use platform detection in existing Rust and frontend helper layers:

* Backend shell commands: make external terminal and file-manager open commands platform-aware.
* Frontend shell defaults: resolve platform defaults before persisting or displaying shell values.
* PTY monitoring: only inject monitoring for shells that the backend can actually instrument on the current platform.
* UI copy/titlebar/shortcut defaults: use platform-specific wording and behavior with small conditional branches.

## Out of Scope

* Full macOS-native redesign.
* Adding support for custom external terminal apps such as iTerm2 or Warp.
* Changing app packaging/signing/notarization.
* Reworking WSL behavior beyond avoiding accidental use on macOS.

## Technical Notes

Relevant files from the review:

* `src-tauri/src/pty/manager.rs`
* `src-tauri/src/commands/shell.rs`
* `src/lib/externalTerminal.ts`
* `src/stores/terminalStore.ts`
* `src/stores/settingsStore.ts`
* `src/stores/projectStore.ts`
* `src/components/TerminalTabs.tsx`
* `src/components/terminal/TerminalStatsPanel.tsx`
* `src/components/WindowTitleBar.tsx`
* `src/hooks/useKeyboardShortcuts.ts`
* `src-tauri/src/commands/fs.rs`
* `src-tauri/src/commands/history.rs`
* `src-tauri/src/commands/hook_settings.rs`
* `src-tauri/src/commands/subagent_transcript.rs`
* `src-tauri/src/hook_client.rs`
* `src/App.tsx`
* `src/stores/historyStore.ts`
* `src/components/HistoryWorkspace.tsx`
