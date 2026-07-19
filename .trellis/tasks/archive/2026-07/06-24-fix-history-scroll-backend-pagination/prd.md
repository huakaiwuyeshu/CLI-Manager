# Fix History Scroll Backend Pagination

## Goal

Restore infinite scroll behavior in the history session list so scrolling to the bottom continues loading backend pages after the locally visible sessions are exhausted.

## Requirements

* Keep existing local pagination behavior unchanged.
* When local visible sessions are exhausted but the backend has more sessions, bottom scroll must trigger the same backend load path as the manual load-more action.
* Keep the change scoped to the history workspace scroll/load-more logic.

## Acceptance Criteria

* [ ] `handleSessionListScroll` does not return early while backend pagination still has more sessions.
* [ ] Scroll-triggered loading and manual load-more use the same load-more logic.
* [ ] `npx tsc --noEmit` passes.

## Definition of Done

* Typecheck passes.
* No unrelated files are modified.
* Manual UI check is documented because the Tauri desktop app is not started by agents.

## Technical Approach

Use the existing `handleLoadMoreSessions` callback from the scroll handler after the bottom threshold is reached. This preserves the established local-first, backend-next branching and avoids duplicating pagination conditions.

## Out of Scope

* Backend pagination changes.
* History list UI redesign.
* New tests or runtime automation for the Tauri desktop window.

## Technical Notes

* Target file: `src/components/HistoryWorkspace.tsx`.
* GitNexus impact for `handleSessionListScroll`: LOW, 0 direct callers, 0 affected processes.
