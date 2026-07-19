# cc-switch 历史用量分析口径对比

## Source

Reference repo: <https://github.com/farion1231/cc-switch>

Local clone inspected at:

`C:\Users\Administrator\AppData\Local\Temp\cc-switch-4b98a5b78a7b495082bf61d5da259bd3`

## cc-switch relevant files

* `src-tauri/src/services/session_usage.rs`
  * Scans `~/.claude/projects`.
  * Includes main session JSONL, `SESSION_ID/subagents/*.jsonl`, and `SESSION_ID/subagents/workflows/wf_*/*.jsonl`.
  * Parses assistant usage per message.
  * Deduplicates by `message.id`.
  * Imports a row when any billable token dimension is positive; it does not require `stop_reason`.
  * Persists each billable usage item with its own `timestamp` / `created_at`.
* `src-tauri/src/services/usage_stats.rs`
  * Aggregates usage by request/log row timestamp (`created_at`).
  * Daily trend uses local date buckets from `created_at`.
  * Summary derives real token total as `fresh_input + output + cache_creation + cache_read`.
  * Cache hit rate uses `cache_read / (fresh_input + cache_creation + cache_read)`.

## CLI-Manager current behavior

Relevant files:

* `src-tauri/src/commands/history.rs`
  * `scan_session_inner` already handles:
    * Claude streamed duplicate usage dedup by `(message.id, requestId)`.
    * Codex cumulative `total_token_usage` adjacent diff.
    * Codex cached input normalization into `input + cache_read`.
    * Usage without `stop_reason` as long as token totals are positive.
  * `collect_claude_session_files` recursively scans local Claude project directories, so nested subagent/workflow files should be included locally.
  * WSL Claude scanning uses `find <root> -name "*.jsonl"`, so nested subagent/workflow files should also be included.
  * `build_history_stats_daily_index` buckets a whole session by `summary.updated_at`.
  * `build_history_stats_response` filters and assigns all tokens in a session by `summary.updated_at`.

## Likely root cause

CLI-Manager currently aggregates history stats at session-file granularity. A session that spans multiple hours or days has all tokens counted at the file's final `updated_at`.

This makes these views inaccurate:

* `daily_series`
* `heatmap`
* `hourly_activity`
* date-range totals when the range overlaps only part of a long session
* model distribution for sessions containing multiple models, because the current path increments `sessions` only for the dominant model and gives non-dominant models token totals with `sessions = 0`

## Proposed minimal alignment

Keep the public `history_get_stats` response shape stable, but change backend aggregation to use per-usage events:

1. During `scan_session_inner`, record each deduped positive usage item with:
   * usage timestamp parsed from JSONL (`timestamp`, `time`, `created_at`, `createdAt`, or `message.timestamp`)
   * fallback timestamp = file `updated_at` during aggregation if the line has no timestamp
   * model attribution already determined by current logic
   * token/cost/unpriced usage already normalized by current logic
2. In stats aggregation, bucket token/cost/model usage by event timestamp instead of session `updated_at`.
3. Count sessions per bucket/range by unique session key, not by duplicated event rows.
4. Keep frontend payload fields unchanged.

## Impact notes

GitNexus impact:

* `build_history_stats_daily_index`: LOW, direct caller `history_get_stats`.
* `build_history_stats_response`: LOW, direct caller `history_get_stats`.
* `scan_session_inner`: CRITICAL, used by list/detail/stats/search-related flows through session computation.
* `HistoryTokenTrendPoint` type change would be CRITICAL. Avoid frontend type changes unless necessary.
