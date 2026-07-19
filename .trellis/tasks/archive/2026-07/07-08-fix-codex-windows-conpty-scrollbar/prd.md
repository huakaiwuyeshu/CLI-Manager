# Fix Codex Windows ConPTY Scrollbar

## Goal

Fix Codex CLI scrollback/scrollbar behavior on older Windows builds by making CLI-Manager prefer a bundled Windows Terminal ConPTY/OpenConsole runtime for internal PTY sessions.

## Changelog Target

[TEMP]

## Requirements

- Bundle Microsoft Windows Terminal ConPTY resources with the app: `conpty.dll` and `OpenConsole.exe`.
- On Windows, initialize the app so `portable-pty` can load the bundled `conpty.dll` before creating the first PTY.
- Keep existing xterm behavior: `scrollOnEraseInDisplay: true` and `windowsPty: { backend: "conpty" }`.
- Do not simulate scrolling by writing extra ANSI/newline sequences.
- Do not add a user-facing setting in this version.
- Fall back to system ConPTY if bundled resources are missing.

## Acceptance Criteria

- [ ] Windows internal PTY logs whether bundled ConPTY was enabled or unavailable.
- [ ] `conpty.dll` and `OpenConsole.exe` are included in Tauri resources.
- [ ] Existing Tauri command signatures remain unchanged.
- [ ] TypeScript check passes.
- [ ] Rust check/tests pass or failures are reported.
- [ ] `CHANGELOG.md` and `docs/功能清单.md` mention the shipped behavior.

## Definition of Done

- Tests/static checks run.
- Behavior changes documented.
- No unrelated refactor.
- No dependency upgrade unless required.

## Technical Approach

Use `portable-pty` 0.8.1's existing sideload path: it checks `ConPtyFuncs::open(Path::new("conpty.dll"))` before falling back to `kernel32.dll`. CLI-Manager will prepend the bundled ConPTY resource directory to the process `PATH` before `PtyManager::new()` and before any PTY is opened.

Resources are sourced from Microsoft Windows Terminal release `v1.24.11321.0`, asset `Microsoft.Windows.Console.ConPTY.1.24.260512001.nupkg`, with architecture-specific files copied from:

- `runtimes/win-x64/native/conpty.dll`
- `build/native/runtimes/x64/OpenConsole.exe`
- `runtimes/win-x86/native/conpty.dll`
- `build/native/runtimes/x86/OpenConsole.exe`
- `runtimes/win-arm64/native/conpty.dll`
- `build/native/runtimes/arm64/OpenConsole.exe`

## Out of Scope

- Custom xterm.js ED2/ED3 internals.
- Compatibility toggle or UI setting.
- Filtering Codex output globally.
- Changing Codex launch commands.

## Technical Notes

- Current xterm instance already sets `scrollOnEraseInDisplay: true` and `windowsPty: { backend: "conpty" }`.
- Tauri 2 supports `bundle.resources` and Rust resource resolution via `app.path().resolve(..., BaseDirectory::Resource)`.
- GitNexus index was stale during planning; run/update before symbol edits if available.
