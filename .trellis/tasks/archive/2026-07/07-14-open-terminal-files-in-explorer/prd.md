# Open terminal files in Explorer

## Goal

When a user clicks a recognized file path in the terminal, open Windows File Explorer at the file's containing folder and select the file instead of opening the internal file browser/editor.

## Requirements

- Keep the existing terminal file-link recognition and path resolution behavior.
- Strip source-location suffixes such as `:396`, `:396:12`, and `:396:pub` before opening the resolved path.
- For a resolved file path, invoke the existing `open_folder_in_explorer` command without requesting default-application opening.
- Do not open or switch the internal file explorer/editor from terminal file links.
- Preserve existing error logging and localized failure toast behavior.

## Changelog Target

- `[TEMP]`

## Acceptance Criteria

- [ ] Clicking a valid terminal file link opens Windows File Explorer and selects that file.
- [ ] Clicking a terminal file link does not open the internal file editor pane.
- [ ] Invalid or missing paths continue to fail through the existing localized error path.
- [ ] A link such as `C:\\path\\lib.rs:396:pub` resolves to `C:\\path\\lib.rs`.
- [ ] Frontend type checking passes.

## Out of Scope

- Changing file links in Git, history, Markdown, or the internal file explorer.
- Adding a user setting to choose between internal and external opening.
- Changing terminal file-path detection or path normalization.

## Technical Notes

- Target function: `src/components/XTermTerminal.tsx` `openTerminalFilePath`.
- Existing backend command already selects files in Explorer when `openFile` is omitted or false.
- GitNexus upstream impact: LOW; one direct caller (`XTermTerminal`) and one affected module.
- Preserve unrelated existing changes in `XTermTerminal.tsx` and `CHANGELOG.md`.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
