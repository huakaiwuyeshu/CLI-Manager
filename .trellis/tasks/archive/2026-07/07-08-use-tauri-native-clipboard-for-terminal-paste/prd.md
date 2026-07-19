# use-tauri-native-clipboard-for-terminal-paste

## Goal

Use Tauri's native clipboard plugin for terminal paste reads so terminal paste actions no longer depend on WebView clipboard permission prompts.

Changelog Target: [TEMP]

## Requirements

- Add the Tauri clipboard manager plugin on both frontend and Rust sides.
- Grant only the text-read clipboard capability needed for terminal paste.
- Replace terminal paste paths that actively read the clipboard with the native plugin API.
- Keep the existing xterm native paste path (`terminal.paste`) and paste event handling behavior unchanged.
- Do not change terminal copy behavior unless required by compilation.

## Acceptance Criteria

- [x] Terminal context-menu paste reads text through Tauri clipboard manager.
- [x] `Ctrl+V` reads text through Tauri clipboard manager.
- [x] `Ctrl+Shift+V` reads text through Tauri clipboard manager and preserves existing wrapping behavior.
- [x] Browser/WebView clipboard permission prompt is no longer used for these terminal paste paths.
- [x] `npx tsc --noEmit` passes.
- [x] `cd src-tauri && cargo check` passes.

## Notes

- User confirmed the dependency/config multi-file change.
- Current branch is aligned with `origin/master` after `git fetch --prune` (`0 0`).
- `CHANGELOG.md` already had unrelated local edits before implementation; preserve them and add this task's note under `[TEMP]`.
