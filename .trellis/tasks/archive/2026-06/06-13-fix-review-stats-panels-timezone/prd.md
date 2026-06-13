# Fix review findings for stats panels timezone

## Goal

Resolve the review findings for the analytics/session stats work with the smallest safe change: ensure newly referenced stats panel components are included in the worktree submission, and make hourly activity buckets match the local date range sent by the frontend.

## Requirements

* Keep `HistoryWorkspace.tsx` and `TerminalTabs.tsx` imports valid by including the untracked stats panel component files and their dependencies in the final submission.
* Change history stats hourly bucketing so explicit frontend date ranges use the same local-day boundary as `startAt/endAt`.
* Do not change the `history_get_stats` Tauri command signature.
* Do not add dependencies.

## Acceptance Criteria

* [ ] `git status --short` shows the stats panel component files as present and ready to include.
* [ ] A session at local 10:00 in a non-UTC timezone buckets into hour `10`, not its UTC hour.
* [ ] `cd src-tauri && cargo check` passes after the backend change.

## Definition of Done

* Rust compile check passes.
* Frontend referenced component files remain present in the worktree.
* Final response lists verification results and any remaining commit/staging action.

## Technical Approach

Use the explicit stats range start as the local-day anchor for hourly activity when `startAt/endAt` are provided. Keep the existing UTC behavior for non-explicit `rangeDays` calls, because those bounds are currently generated on the Rust side with UTC day starts.

## Decision

Context: Frontend date inputs are converted with browser-local `new Date(...)`, then passed as millisecond `startAt/endAt`. Existing daily stats already use explicit range-relative day bucketing.

Decision: Replace the fixed UTC hour helper at the stats aggregation call site with a helper that computes hour relative to `bounds.start_day` for explicit ranges, falling back to UTC for implicit ranges.

Consequences: The chart aligns with the selected local date range without adding a new timezone argument or changing IPC payload shape.

## Out of Scope

* Redesigning the stats panel UI.
* Changing date range controls or frontend payload types.
* Committing or pushing changes.

## Technical Notes

* Review finding P1 maps to untracked files already present under `src/components/history/SessionStatsPanel.tsx`, `src/components/terminal/TerminalStatsPanel.tsx`, `src/components/stats/termStatsCards.tsx`, `src/components/stats/termStatsUi.tsx`, and `src/lib/modelPricing.ts`.
* Review finding P2 maps to `src-tauri/src/commands/history.rs`, where `build_history_stats_response` currently calls `hour_of_day_utc(summary.updated_at)`.
* GitNexus impact: `hour_of_day_utc` upstream risk LOW, direct caller `history_get_stats`; `history_get_stats` upstream risk LOW.
