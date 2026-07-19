# Merge History Context Token Trends

## Goal

Merge the history session context "request token trend" and "input/output/cache trend" into one Recharts-based chart so the session context view shows total request tokens and token breakdown in a single visual.

## Requirements

* Replace the two current Sparkline trend sections in `SessionContextView` with one combined chart.
* Use existing `session.usage.token_trend` data; do not change backend payloads.
* Show total request tokens plus input, output, cache read, and cache write series in the same chart.
* Reuse existing i18n labels and shared chart palette where possible.
* Do not add dependencies; `recharts` already exists in `package.json`.

## Acceptance Criteria

* [x] History session context renders one combined trend chart instead of two separate trend chart sections.
* [x] Chart uses Recharts and follows current theme colors.
* [x] Empty/insufficient trend data still shows the existing empty state.
* [x] `npx tsc --noEmit` passes.

## Definition of Done

* Typecheck passes.
* No backend contract or dependency change.
* Manual UI verification items are listed for the desktop app.

## Technical Approach

Use `ResponsiveContainer` with a Recharts `ComposedChart`: area/line for total request tokens and lines for input, output, cache read, and cache write tokens. Keep the component local to `src/components/history/SessionContextView.tsx` unless the implementation becomes meaningfully reusable.

## Decision

Context: The existing view renders total request token trend and input/output/cache trends as separate custom sparklines, which duplicates vertical space and makes cross-series comparison harder.

Decision: Consolidate the two sections into one Recharts chart backed by the same `token_trend` array.

Consequences: This changes only visual presentation in the history context view. Data parsing and aggregate stats remain unchanged.

## Out of Scope

* Backend history parsing/stat aggregation changes.
* Adding or changing dependencies.
* Reworking the global historical stats dashboard.

## Technical Notes

* Inspected `src/components/history/SessionContextView.tsx`.
* Inspected `src/components/stats/StatsPanel.tsx` for Recharts usage.
* Inspected `src/components/stats/statsPalette.ts` for shared chart colors.
* GitNexus impact for `SessionContextView`: LOW, 0 direct callers/processes reported.
