# Hide Terminal Tab Status Text

## Goal

Remove visible Chinese status text such as `运行中` and `已完成` from terminal tab labels while keeping hover/status tooltip information available.

## Requirements

* Terminal tabs should still show the colored runtime/status dot.
* Visible status text beside tab titles should be removed.
* Hover tooltip/status title should keep the status label, session title, and updated time.
* The overflow terminal tab list should follow the same visible-label behavior.
* Do not change status tracking, hook behavior, shell runtime detection, or terminal session state.

## Acceptance Criteria

* [ ] A running/done/failed/attention terminal tab does not visibly render `运行中`, `已完成`, `异常`, or `待处理` beside the tab title.
* [ ] Hovering the tab or status dot still shows status details.
* [ ] Drag overlay and overflow tab list do not show the visible status label.
* [ ] `npx tsc --noEmit` passes or any failure is reported.

## Definition of Done

* Keep the change scoped to existing terminal tab rendering.
* Preserve accessibility labels on the runtime dot.
* Run frontend type-check.

## Technical Approach

Update `src/components/TerminalTabs.tsx` only: remove visible `statusLabel` spans from normal tabs, drag overlay tabs, and overflow tab-list rows; keep existing `statusTitle`, `title`, and `aria-label` usage.

## Out of Scope

* Changing tab status state semantics.
* Changing hook/shell runtime event mapping.
* Redesigning terminal tab layout.

## Technical Notes

* `src/components/TerminalTabs.tsx` contains `TAB_NOTIFICATION_LABELS`, `SortableTab`, `DragOverlayTab`, and overflow list rendering.
* GitNexus impact analysis for `SortableTab`, `DragOverlayTab`, and `PaneTabBar`: LOW risk, no upstream impacted flows reported.
