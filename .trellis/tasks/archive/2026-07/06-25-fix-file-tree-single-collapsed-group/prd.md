# Fix File Tree Single Collapsed Group

## Goal

File explorer should show only one auto-collapsed files group, and that group should appear after normal visible entries.

## Requirements

* Render a single "已折叠文件" group for the file tree instead of one group per recursive directory level.
* Keep the group at the end of the visible tree.
* Preserve current file row behavior: open, rename, context menu, drag/drop, git status color, manual ignore/unignore.
* Keep the change in the frontend render layer; do not alter backend file tree data or settings schema.

## Acceptance Criteria

* [ ] The file explorer displays at most one "已折叠文件" group.
* [ ] The group is rendered after all normal visible file tree rows.
* [ ] Expanding the group still lists all default-collapsed and manually ignored directories.
* [ ] `npx tsc --noEmit` passes.

## Definition of Done

* Static typecheck passes.
* Existing user WIP in `FileExplorerSidebar.tsx` is preserved.
* Manual UI check is listed because the desktop app should not be auto-started by the agent.

## Technical Approach

Keep `splitAutoCollapsedEntries` as the classifier, but aggregate collapsed entries at the root render pass. Nested `FileTreeRows` should render normal entries only and append their collapsed entries into a shared accumulator. The single `AutoCollapsedGroupRow` is then rendered once at the root after all normal rows.

## Out of Scope

* No new settings.
* No backend command changes.
* No redesign of file tree styling.
* No changes to search result rendering.

## Technical Notes

* Main file: `src/components/files/FileExplorerSidebar.tsx`.
* Root cause: `FileTreeRows` currently emits `AutoCollapsedGroupRow` inside every recursive call.
* GitNexus index did not contain `FileExplorerSidebar.tsx` or `FileTreeRows`; direct source inspection is the source of truth for this task.
* Relevant specs read: `.trellis/spec/frontend/index.md`, `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/quality-guidelines.md`, `.trellis/spec/guides/index.md`.
