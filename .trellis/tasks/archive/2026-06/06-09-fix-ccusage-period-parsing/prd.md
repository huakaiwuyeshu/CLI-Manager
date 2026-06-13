# Fix ccusage period parsing

## Goal

Fix ccusage daily parsing so reports using `period` as the day field are recognized by the visualization panel.

## Requirements

* `CcusageStatsPanel` must accept `period` as a daily date field in addition to `date` and `day`.
* Existing `date` and `day` behavior must remain unchanged.
* No backend, dependency, or cache schema changes.

## Acceptance Criteria

* [ ] A ccusage payload with `daily[].period` produces daily chart data.
* [ ] Daily model breakdowns inside those rows are parsed normally.
* [ ] TypeScript check passes.

## Definition of Done

* Static checks pass.
* User manually verifies desktop UI after refresh.

## Out of Scope

* New chart types.
* Additional ccusage report commands.

## Technical Notes

* Local ccusage output showed top-level `daily` and `totals`, with daily row key `period` plus `modelBreakdowns` and `modelsUsed`.
