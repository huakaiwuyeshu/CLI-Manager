# Fix Rust unused warnings

## Goal

Remove the Rust compiler warnings reported by `cargo check` in `src-tauri/src/lib.rs` without changing application startup behavior.

## Confirmed Facts

- `RunEvent` is imported in the shared `tauri` import list but is only referenced inside a macOS-only `#[cfg(target_os = "macos")]` block.
- The `.run(|app, event| { ... })` closure uses `app` and `event` only inside that same macOS-only block, so Windows builds report them as unused.
- The affected startup symbol is `src-tauri/src/lib.rs:run`; GitNexus upstream impact is LOW with one direct caller, `src-tauri/src/main.rs:main`.

## Requirements

- Remove the unused `RunEvent` import warning.
- Remove the unused `app` and `event` closure parameter warnings on non-macOS builds.
- Preserve the macOS reopen behavior that shows the main window when the dock icon is reopened and no visible windows exist.
- Avoid broad refactors or unrelated behavior changes.

## Acceptance Criteria

- `cd src-tauri && cargo check` completes without the three reported unused warnings.
- The diff is limited to the warning fix and task planning artifact.

## Out of Scope

- Changing Tauri startup flow.
- Changing command registration, migrations, tray behavior, or frontend code.
