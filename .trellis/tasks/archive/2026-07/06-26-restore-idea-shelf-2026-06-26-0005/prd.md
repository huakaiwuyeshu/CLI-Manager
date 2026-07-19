# Restore IDEA Shelf 2026-06-26 00:05

## Goal

Restore the IDEA shelf named `在进行更新之前于_2026-06-26_00_05_取消提交了更改_[更改]` into the current working tree after the latest pull caused patch conflicts.

## Requirements

* Apply the shelf changes from `.idea/shelf/在进行更新之前于_2026-06-26_00_05_取消提交了更改_[更改]/shelved.patch`.
* Preserve existing working tree changes that are not part of this shelf.
* Manually merge files where `git apply --check` fails.
* Do not delete the IDEA shelf unless explicitly requested.

## Acceptance Criteria

* [x] Shelf changes are present in the relevant source files.
* [x] No `<<<<<<<`, `=======`, or `>>>>>>>` conflict markers remain.
* [x] TypeScript check is run or skipped with a stated reason.
* [x] Final status clearly lists modified files.

## Technical Notes

* The shelf touches `HistoryListPane.tsx`, `AGENTS.md`, `TerminalStatsPanel.tsx`, `settingsStore.ts`, `TerminalTabs.tsx`, `components.css`, and `GeneralSettingsPage.tsx`.
* Direct `git apply --check` fails for `HistoryListPane.tsx`, `TerminalStatsPanel.tsx`, and `components.css`.
* `HistoryListPane.tsx` and `components.css` already contain most of the shelf UI styling changes in the working tree.
* GitNexus upstream impact for `HistoryListPane` and `TerminalStatsPanel` is LOW.
