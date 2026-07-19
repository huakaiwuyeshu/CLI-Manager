# Replace History Stats Charts With Recharts And React Query

## Goal

Replace the historical usage analytics charts with Recharts and move historical stats fetching to TanStack React Query, while keeping realtime stats charts unchanged.

## What I already know

* User wants to introduce `recharts` for stats charts.
* User wants all charts replaced except realtime stats charts.
* User wants TanStack React Query to fetch stats data.
* Current `package.json` has `echarts` but not `recharts` or `@tanstack/react-query`.
* Current package manager lockfile is `package-lock.json`.
* `StatsPanel` is the historical usage analytics dashboard.
* `CcusageStatsPanel`, `TerminalStatsPanel`, `termStatsCards.tsx`, and `termStatsUi.tsx` are realtime stats-related and must not be replaced in this task.
* `StatsPanel` currently uses `EChart`/ECharts for trend and model charts, plus custom SVG/HTML charts for heatmap, hourly activity, project/source charts.
* `EChart.tsx` is still used by `CcusageStatsPanel`, so it cannot be removed unless realtime charts are also migrated later.

## Requirements

* Add `recharts` and `@tanstack/react-query` as frontend dependencies.
* Add one app-level `QueryClientProvider` so React Query hooks work inside the app.
* Refactor historical stats data loading in `StatsPanel` away from manual `useEffect + useHistoryStore.loadStats/loadStatsProjectOptions` to React Query.
* Keep the backend IPC commands and payload shape unchanged.
* Keep existing filters and interactions:
  * project filter
  * time window filter
  * manual refresh
  * project bar click filters all charts
  * heatmap/date-hour selection opens bucket sessions
* Replace historical usage analytics visual charts with Recharts:
  * token/cost trend
  * model ranking
  * project ranking
  * source comparison
  * hourly activity
  * heatmap-like activity view if feasible with Recharts primitives
  * token composition if still present in current dashboard
* Do not replace realtime stats charts:
  * `CcusageStatsPanel`
  * `TerminalStatsPanel`
  * `termStatsCards.tsx`
  * `termStatsUi.tsx`

## Acceptance Criteria

* [x] Historical stats dashboard no longer imports `echarts` or uses `EChart`.
* [x] Realtime stats components continue to use existing implementation.
* [x] `@tanstack/react-query` wraps the app and drives historical stats loading.
* [x] Existing stats filters, refresh, loading, and error states still work.
* [x] `npm run build` passes.
* [x] No backend API changes.

## Out of Scope

* Do not redesign realtime stats.
* Do not remove `echarts` if it is still required by realtime stats.
* Do not change Rust stats aggregation or IPC response contracts.
* Do not add chart export/image features.

## Technical Notes

* Latest npm versions checked on 2026-06-26:
  * `recharts`: `3.9.0`
  * `@tanstack/react-query`: `5.101.1`
* Context7 docs:
  * Recharts library: `/recharts/recharts`
  * TanStack Query library: `/tanstack/query`
* Relevant files inspected:
  * `package.json`
  * `src/main.tsx`
  * `src/components/stats/StatsPanel.tsx`
  * `src/components/stats/EChart.tsx`
  * `src/components/stats/CcusageStatsPanel.tsx`
  * `src/components/stats/StatsHourlyActivityChart.tsx`
  * `src/components/stats/TimelineHeatmap.tsx`
  * `src/stores/historyStore.ts`
