# Fix Stats and Git Scrollbar Theme

## Goal

Keep the scrollbars in the terminal-side "实时统计" and "Git 变更" panels fixed to a dark terminal-style appearance instead of inheriting the current app/system scrollbar theme.

## Requirements

* The realtime stats panel scrollbar must stay dark.
* The Git changes panel scrollbar must stay dark.
* The change must not alter global scrollbar behavior outside these panels.
* The change must not alter panel layout, data flow, or business logic.

## Acceptance Criteria

* [ ] Realtime stats scrollable content uses a fixed dark scrollbar.
* [ ] Git changes scrollable content uses a fixed dark scrollbar.
* [ ] Existing app/system themed scrollbars elsewhere remain unchanged.
* [ ] Frontend type-check passes.

## Definition of Done

* Minimal frontend-only change.
* No dependency or config changes.
* Static verification through type-check or targeted inspection.

## Technical Approach

Set fixed scrollbar CSS custom properties only on the terminal stats and Git changes panel roots, so their existing `ui-thin-scroll` descendants render with dark thumb/track colors while global scrollbar variables remain untouched.

## Decision

Context: `ui-thin-scroll` currently consumes global `--ui-scrollbar-*` variables, which follow the app theme.

Decision: Override those variables locally on the two panel containers.

Consequences: The fix is scoped and low-risk, but it intentionally keeps these two scrollbars dark even under a light application theme.

## Out of Scope

* Re-theming the panels themselves.
* Changing global scrollbar styling.
* Changing Diff viewer, markdown, settings, terminal xterm, or file browser scrollbars.

## Technical Notes

* Relevant files inspected:
  * `src/components/terminal/TerminalStatsPanel.tsx`
  * `src/components/git/GitChangesPanel.tsx`
  * `src/components/terminal/TerminalSidePanel.tsx`
  * `src/styles/components.css`
  * `src/components/stats/termStatsUi.tsx`
