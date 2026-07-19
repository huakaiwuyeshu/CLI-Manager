# Realtime Token Trend No Limit

## Goal

Show all Token trend points in the realtime statistics Token trend card instead of truncating the chart to the latest 40 points.

## Requirements

* Remove the 40-point display limit from the Token trend card data path.
* Keep the existing chart UI, tooltip behavior, and data source selection unchanged.
* Update stale comments that assume the trend has at most 40 points.

## Acceptance Criteria

* [x] `TrendCard` uses every valid token trend point from `session.usage.token_trend`.
* [x] Message-level fallback trend also uses every valid point when backend trend data is unavailable.
* [x] The displayed trend point count reflects the full plotted point count.
* [x] Frontend type checking passes.

## Definition of Done

* Minimal frontend-only change.
* No dependency or configuration changes.
* Existing realtime stats and history session stats continue to render.

## Out of Scope

* Redesigning the sparkline chart.
* Adding pagination, downsampling, or a new user setting.
* Changing backend history parsing or token aggregation.

## Technical Notes

* Candidate files found by semantic search and `rg`.
* Main limit is `TREND_POINT_LIMIT = 40` plus `trend.slice(-TREND_POINT_LIMIT)` in `src/components/stats/termStatsCards.tsx`.
* `src/components/stats/termStatsUi.tsx` has a hover comment that still says points are `<= 40`.
* `TrendCard` is used by `src/components/terminal/TerminalStatsPanel.tsx` and `src/components/history/SessionStatsPanel.tsx`.
* GitNexus impact for `TrendCard`: LOW, direct callers 0, affected processes 0.
* GitNexus impact for `Sparkline`: LOW, direct callers 0, affected processes 0.
