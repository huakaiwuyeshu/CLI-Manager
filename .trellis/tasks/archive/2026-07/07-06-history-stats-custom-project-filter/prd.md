# History Stats Custom Project Filter

## Changelog Target

[TEMP]

## Goal

Make the historical usage analysis project filter use the user's custom project list/tree instead of raw history project keys, and make filtering actually match the selected custom project.

## Requirements

* StatsPanel project filter uses `projectStore` projects and groups in a tree-style dropdown consistent with the history sidebar.
* Selecting "All Projects" clears the filter.
* Selecting a custom project filters stats by that project's path.
* Existing raw `project_key` filtering remains available for chart project-rank clicks as a fallback.
* No new dependencies.

## Acceptance Criteria

* [ ] The history usage analysis project dropdown shows custom groups and projects.
* [ ] Selecting a custom project filters Claude/Codex stats to that project.
* [ ] Switching source/time range and manual refresh still work.
* [ ] Existing project-ranking chart click behavior still works.
* [ ] `npx tsc --noEmit` passes.
* [ ] `cd src-tauri && cargo check` passes, unless blocked by pre-existing unrelated issues.

## Definition of Done

* Code follows existing frontend/backend patterns.
* User-visible behavior is recorded in `CHANGELOG.md`.
* Product functionality inventory is updated in `docs/功能清单.md`.
* GitNexus change detection is reviewed before final response.

## Technical Approach

* Reuse project/group data from `useProjectStore`.
* Convert selected project path to a `projectPath` request parameter.
* Extend `history_get_stats` to filter with the existing `session_matches_project_path` matcher when `project_path` is provided.
* Keep `projectKey` as the existing exact-key path for raw project ranking interactions.

## Out of Scope

* No redesign of history stats charts.
* No migration or schema change.
* No changes to realtime stats or ccusage analysis.

## Technical Notes

* Relevant files inspected:
  * `src/components/stats/StatsPanel.tsx`
  * `src/stores/historyStore.ts`
  * `src-tauri/src/commands/history.rs`
  * `src/components/history/HistoryListPane.tsx`
  * `src/stores/projectStore.ts`
* GitNexus impact:
  * `StatsPanel`: LOW.
  * `fetchHistoryStatsPayload`: LOW.
  * `history_get_stats`: LOW.
  * `build_history_stats_daily_index`: HIGH; direct callers include `history_get_stats` and stats tests, so validation must include Rust check/tests where practical.
