# Worktree Adaptation Fixes

## Goal

Make existing Git Worktree sessions behave like first-class task contexts in CLI-Manager without redesigning the worktree architecture: history lookup should target the worktree, realtime stats should bind to the current CLI session/worktree, the file panel should browse/edit the worktree directory, and the finish flow should avoid redundant commit prompts and skip meaningless merges.

## Changelog Target

V1.2.6

## Requirements

- Worktree right-click menus must support opening the corresponding conversation history.
- History sessions that belong to the selected worktree must show a visible Worktree marker.
- Worktree-specific resume/continue semantics are out of scope for this task; normal existing resume/continue behavior must not be disabled, hidden, or changed.
- Realtime stats for a worktree tab must use the worktree path/current terminal cwd and must not fall back to a neighboring project session when a CLI session id is present but not found.
- The right-side file panel must open, list, preview, edit, watch, and refresh files under the active worktree path when the active tab is a worktree tab.
- Worktree finish flow must:
  - show commit input only when the worktree has uncommitted changes;
  - allow direct merge when changes were already committed;
  - block/skip merge when the worktree branch has no content diff from the base branch;
  - keep merge-conflict retry from forcing another commit-message entry.
- Update `docs/功能清单.md` because this is a functional V1.2.6 change.
- Produce a feature verification document for manual validation.
- Do not commit or push automatically.

## Acceptance Criteria

- [ ] Worktree node/tab context menu can open history filtered to the worktree path.
- [ ] History rows matching a worktree path display a Worktree marker without changing normal history resume/continue behavior.
- [ ] Worktree realtime stats binds to the current tab's `cliSessionId` and worktree path; it shows empty/loading state instead of another session's token/tool/model data.
- [ ] Worktree file panel uses `worktree.path` for `file_*`, watcher, Git changes, and save operations.
- [ ] Finish dialog opens directly at merge when `git_get_changes(worktree.path)` is empty.
- [ ] Finish dialog reports "no merge needed" and does not run merge when worktree/base content is identical.
- [ ] Merge conflicts leave the worktree available for retry without re-entering a commit message.
- [ ] `docs/功能清单.md` and a manual verification doc are updated.
- [ ] `npx tsc --noEmit` and relevant Rust checks pass or any failure is reported.

## Definition of Done

- Keep changes small and aligned with existing stores/components.
- No new dependencies.
- No database migration unless proven unavoidable.
- No automatic git commit/push.
- Manual verification document covers worktree history, realtime stats, file panel, and finish-flow edge cases.

## Technical Approach

- Reuse existing `history_list_sessions(projectPath=...)` and `HistorySessionSummary.cwd` to identify worktree history.
- Use a frontend-derived "effective project" only where UI surfaces need a worktree root while retaining the parent project identity.
- Fix current session lookup semantics at the store boundary so `cliSessionId` lookup miss does not fall back to latest project session.
- Extend `git_worktree_merge` result semantics to report a no-diff skip before running merge.
- Keep normal history resume/continue behavior untouched; do not add code TODO comments for worktree resume.

## Out of Scope

- Worktree-specific resume/continue command generation.
- New persistent history metadata schema for worktree sessions.
- Multi-instance file explorer store refactor.
- Automatic commits or pushes.

## Technical Notes

- Relevant frontend files: `src/components/TerminalTabs.tsx`, `src/components/sidebar/index.tsx`, `src/components/history/HistoryListPane.tsx`, `src/components/terminal/TerminalStatsPanel.tsx`, `src/stores/historyStore.ts`, `src/stores/fileExplorerStore.ts`, `src/components/worktree/WorktreeFinishDialog.tsx`.
- Relevant backend file: `src-tauri/src/commands/git_worktree.rs`.
- Relevant docs: `.trellis/spec/backend/worktree-isolation-contracts.md`, `.trellis/spec/backend/history-stats-contracts.md`, `.trellis/spec/backend/project-file-command-contracts.md`, `.trellis/spec/frontend/history-session-contracts.md`, `.trellis/spec/frontend/state-management.md`, `.trellis/spec/frontend/component-guidelines.md`.
