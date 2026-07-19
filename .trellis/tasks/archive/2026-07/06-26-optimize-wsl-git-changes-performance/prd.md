# Optimize WSL Git Changes Performance

## Goal

Improve Git changes panel performance, especially when the project path is a WSL UNC path (`\\wsl.localhost\...`), without changing the existing frontend response contract.

## What I Already Know

- The Git changes panel currently calls `git_get_changes` through `useGitStore.fetchChanges`.
- `git_get_changes` returns `GitFileChange { path, status, staged, added, deleted }`; this shape is also reused by the file explorer Git status path.
- The backend currently uses libgit2 for status and diff line statistics.
- WSL UNC paths are already detected in `wsl.rs`; the project spec says WSL filesystem-heavy operations should use `wsl.exe` instead of Windows native filesystem APIs when possible.
- The Git watcher already uses `notify` with 400 ms debounce and falls back to 15 s polling when watcher setup fails.
- GitNexus impact checks for `git_get_changes`, `compute_diff_line_stats`, `git_watch_start`, `GitChangesPanel`, and `useGitStore` returned LOW risk; `fetchChanges` is not indexed as a standalone symbol, so direct `rg` references were used.

## Assumptions

- Keep the existing `git_get_changes` Tauri command name and response fields.
- Avoid adding dependencies.
- Prefer graceful degradation over blocking UI when WSL, large untracked trees, or large diffs are slow.

## Requirements

- Detect WSL UNC project paths and route status/diff-summary work through `wsl.exe -d <distro> --cd <linux_path>`.
- Avoid expensive full patch traversal when only line totals are needed; use summary-style stats where possible.
- Coalesce overlapping frontend refreshes for the same project so watcher/focus/user actions do not launch redundant concurrent `git_get_changes` calls.
- Preserve existing behavior for normal Windows paths.
- Keep large-repository safeguards: if status or line-stat work is too large or fails, return the file list with `added/deleted = 0` instead of blocking/failing the panel.
- Avoid changing user-facing copy unless required.

## Acceptance Criteria

- [ ] Normal Windows project paths still return tracked and untracked Git changes.
- [ ] WSL UNC project paths can return Git changes without libgit2 scanning the UNC tree for the hot path.
- [ ] Repeated refresh triggers while a request is already running do not create unbounded concurrent backend calls.
- [ ] Large status/diff cases still load the file list even when line stats are skipped.
- [ ] `npx tsc --noEmit` passes.
- [ ] `cd src-tauri && cargo check` passes.
- [ ] Relevant Rust unit tests pass or are added for new pure parsing/path logic.

## Definition of Done

- Tests/static checks pass where runnable.
- No dependency changes.
- No Tauri command contract break for current consumers.
- Manual verification items are listed for the desktop UI.

## Technical Approach

- Backend: add a WSL-specific `git_get_changes` path that parses `git status --porcelain=v1 -z` and `git diff --numstat -z`, using existing WSL path helpers.
- Backend: keep libgit2 path for non-WSL projects, but make line-stat collection cheaper/fail-open where possible.
- Frontend store: add in-flight/coalescing logic around `fetchChanges` and stale-result guards.
- Watcher: for WSL UNC paths, avoid relying on recursive Windows notify over UNC; allow the existing fallback poll path to handle it.

## Out of Scope

- Replacing all Git commands with a new abstraction layer.
- Changing the Git panel UI layout.
- Adding a background daemon or persistent Git cache.
- Adding new dependencies.

## Technical Notes

- Relevant files:
  - `src-tauri/src/commands/git.rs`
  - `src-tauri/src/git_watcher.rs`
  - `src-tauri/src/wsl.rs`
  - `src/stores/gitStore.ts`
  - `src/components/git/GitChangesPanel.tsx`
  - `src/stores/fileExplorerStore.ts`
- Relevant specs:
  - `.trellis/spec/backend/wsl-path-contracts.md`
  - `.trellis/spec/frontend/state-management.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/frontend/component-guidelines.md`

