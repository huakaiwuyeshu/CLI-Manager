# process ranking app names and icons

## Changelog Target

[TEMP]

## Goal

Improve the system resource process ranking so users can recognize processes by software/app name first, with the app icon shown inline in the software column, while preserving a command fallback and keeping Windows, macOS, and Linux compatible.

## Requirements

* Process ranking display should prefer software/app display name.
* If display name is unavailable, fall back to command, then process name.
* Show the process icon inside the software/app column.
* Use real extracted process icons where the OS support is available.
* Keep macOS and Linux compatible with safe fallback icons when native extraction is unavailable.
* Do not add a new Rust dependency unless unavoidable.

## Acceptance Criteria

* [x] Process rows expose display name and optional icon data through `system_resources_get_snapshot`.
* [x] Frontend type definitions match the backend payload.
* [x] Process ranking table shows the icon inside the software/display-name column.
* [x] Windows builds can extract executable metadata/icons when available.
* [x] macOS/Linux builds do not fail because of Windows-only APIs and show fallback icons.
* [x] `npx tsc --noEmit` passes.
* [x] `cd src-tauri && cargo check` passes.

## Definition of Done

* Typecheck and cargo check pass.
* CHANGELOG is updated under `[TEMP]`.
* Product feature list is updated if this changes visible functionality.
* No unrelated changes are reverted.

## Technical Approach

Extend `ProcessSnapshot` with `display_name` and `icon_data_url`. Use `sysinfo::Process::exe()` as the source path when available. On Windows, read product/file description from executable version resources and extract a small executable icon into a data URL. On non-Windows targets, return `None` for native icon data and use existing process metadata fallbacks.

## Out of Scope

* Full native app bundle icon extraction for macOS.
* Linux desktop-file icon theme lookup.
* User-configurable process ranking columns.

## Technical Notes

* Main frontend files: `src/components/terminal/SystemResourcesPanel.tsx`, `src/hooks/useSystemResources.ts`, `src/lib/i18n.ts`.
* Main backend file: `src-tauri/src/commands/system_resources.rs`.
* Existing dependency `windows-sys` can expose the required Windows APIs via features; no new crate is planned.
* GitNexus index did not include the new system resource panel symbols, so source inspection is the authority for this task.
