# Fix WSL Claude Stats and Git Loading

## Goal

Reduce UI stalls caused by WSL Claude history statistics and prevent complex Git repositories from staying in loading state when showing changes.

## What I Already Know

* User reports that starting Claude session statistics for a WSL terminal can make the computer stutter.
* The statistics path scans `.claude/projects`.
* User has SSD storage, but it is QLC, so write/read amplification and many small operations are especially painful.
* Lightweight Git projects load normally.
* Complex multi-branch Git projects can stay loading.
* `history_get_stats` builds a history index through `refresh_history_index_snapshot` and `build_history_index`.
* WSL Claude scanning uses `wsl.exe find` to enumerate JSONL files under `.claude/projects`.
* After enumeration, `session_file_fingerprint` calls `wsl_session_fingerprint`, which shells out to `wsl.exe stat` per file.
* `git_get_changes` waits for both `repo.statuses(...)` and `compute_diff_line_stats(...)`.
* `compute_diff_line_stats` constructs a repo-wide diff and iterates diff lines to calculate added/deleted counts.
* Frontend `fetchChanges` keeps `loading=true` until `git_get_changes` returns.

## Assumptions

* The immediate fix should prioritize responsiveness over exact first-paint totals.
* It is acceptable for expensive counts, such as Git added/deleted line totals, to be degraded or deferred for pathological repos.
* The WSL stats fix should avoid launching one `wsl.exe` process per session file.

## Requirements

* WSL Claude stats must avoid per-file `wsl.exe stat` calls during normal full-history indexing.
* History stats should return cached or partial data where possible instead of blocking the UI for full cold scans.
* Git changes list should show file-level changes quickly even when line-count stats are expensive.
* Complex Git repos must not leave the Git panel stuck in loading indefinitely.
* Existing IPC command names should stay stable unless explicitly approved.

## Acceptance Criteria

* [ ] Opening stats for a WSL Claude history root does not spawn one `wsl.exe stat` process per JSONL file.
* [ ] `history_get_stats` remains compatible with existing frontend callers.
* [ ] Git changes panel can render file entries even if line-count calculation is skipped or fails.
* [ ] `git_get_changes` has a bounded or degraded path for expensive repositories.
* [ ] Frontend loading state is cleared on backend error or timeout-like degradation.
* [ ] Rust `cargo check` passes.
* [ ] Frontend `npx tsc --noEmit` passes if TypeScript is changed.

## Out of Scope

* Rebuilding the whole history storage/index architecture.
* Adding a database for Claude/Codex history.
* Changing the visual design of the stats or Git panels.
* Network Git operations such as push, pull, fetch, or branch switching.

## Technical Notes

* `src-tauri/src/commands/history.rs:1006` contains `history_get_stats`.
* `src-tauri/src/commands/history.rs:1866` contains `build_history_index`.
* `src-tauri/src/commands/history.rs:2041` routes WSL file fingerprints through `wsl_session_fingerprint`.
* `src-tauri/src/commands/history.rs:2498` contains `collect_wsl_claude_session_files`.
* `src-tauri/src/commands/git.rs:105` contains `git_get_changes`.
* `src-tauri/src/commands/git.rs:236` contains `compute_diff_line_stats`.
* `src/stores/gitStore.ts:201` keeps loading until `git_get_changes` resolves.

## Open Questions

* None.

## Decision

* MVP includes both WSL Claude history stats load reduction and Git changes loading degradation.
* Keep the fix small: reduce cross-boundary process spawning, avoid mandatory full diff line scans, and keep existing IPC command names stable.
