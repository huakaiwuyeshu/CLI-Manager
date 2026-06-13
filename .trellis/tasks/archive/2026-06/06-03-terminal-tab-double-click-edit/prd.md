# Terminal Tab Double Click Edit

## Goal

Enable terminal tabs to open the existing edit-title flow by double-clicking the tab, reducing friction when renaming a terminal session.

## What I already know

* User requested: terminal tabs should support double-click to open editing.
* Project is a Tauri 2 + React frontend; this is a frontend interaction change.
* Relevant frontend guideline: avoid unnecessary allocations in hot UI scans; this task is not a hot scan.
* Likely impacted file from semantic search: `src/components/TerminalTabs.tsx`.

## Assumptions (temporary)

* Double-clicking the visible tab label should enter the same editing mode currently available from the tab edit control, if such a control exists.
* Single-click tab selection and existing close/edit controls should remain unchanged.

## Open Questions

* None.

## Requirements

* Double-clicking a terminal tab opens inline title editing for that tab.
* The inline input should focus and select the current title.
* Enter or blur saves a non-empty trimmed title.
* Escape cancels editing.
* Existing single-click tab activation remains unchanged.
* Existing close, right-click menu, drag, split, and history tab interactions remain unchanged.

## Acceptance Criteria

* [x] Double-clicking a terminal tab enters inline edit mode for that tab.
* [x] Enter or blur saves a non-empty trimmed title and persists it in session storage.
* [x] Escape cancels without changing the title.
* [x] Empty or whitespace-only input cancels instead of saving an empty title.
* [x] Single-click activation, close button, right-click menu, and drag behavior are not affected.
* [x] TypeScript check passes.

## Definition of Done (team quality bar)

* Tests or equivalent verification completed where appropriate.
* Typecheck/lint checks green where practical.
* UI behavior manually verified if the app can be run locally.

## Technical Approach

Use the existing sidebar inline rename pattern as the UX baseline, but keep the implementation local to terminal tabs. Add a small terminal-store action to update a session title and reuse the existing session persistence path.

## Decision (ADR-lite)

**Context**: Terminal tabs currently support activation, close, drag, and right-click actions, but no title editing entry exists.
**Decision**: Use inline rename on double-click.
**Consequences**: Minimal UI surface and no new dialog dependency; editing state stays in `TerminalTabs.tsx`, while persistence is handled by the terminal store.

## Out of Scope (explicit)

* Adding a modal rename UI.
* Changing terminal session creation or restore semantics beyond persisted title updates.
* Refactoring tab layout or styling beyond what the double-click interaction requires.

## Technical Notes

* Inspected `src/components/TerminalTabs.tsx` and `src/stores/terminalStore.ts`.
* Similar existing inline rename pattern: `src/components/sidebar/TreeNodeItem.tsx`.
* `TerminalSession.title` is defined in `src/lib/types.ts` and sessions are persisted through `useSessionStore.saveSessions`.
* GitNexus impact analysis before edits: `SortableTab`, `TerminalTabs`, and `useTerminalStore` are LOW risk with no upstream impacted symbols reported.
