# Remove terminal empty state gradient

## Goal

Remove the decorative gradient color from the terminal empty state so the no-active-terminal view uses a plain terminal background.

## Requirements

* Remove the gradient/glow visible behind the terminal empty state.
* Keep the existing empty-state copy, icon, and "Open Terminal" action unchanged.
* Keep the change scoped to the terminal area; do not alter non-terminal empty states.

## Acceptance Criteria

* [ ] The terminal empty state no longer shows the colored radial glow behind the center content.
* [ ] The terminal empty state no longer shows the terminal well top bridge gradient.
* [ ] Other empty states outside the terminal keep their existing appearance.
* [ ] Type-check passes or the change is verified as CSS-only with direct inspection.

## Definition of Done

* The smallest necessary CSS change is applied.
* Existing unrelated working-tree changes are preserved.
* Verification result is reported.

## Technical Approach

Update terminal-scoped CSS in `src/styles/components.css` instead of changing the shared `EmptyState` component.

## Out of Scope

* Redesigning terminal themes.
* Changing text, icon, spacing, or button behavior.
* Touching existing `src/components/XTermTerminal.tsx` changes.

## Technical Notes

* `src/components/TerminalTabs.tsx` renders the no-active-terminal view inside `.ui-terminal-well` and uses `EmptyState` at lines 2433-2441.
* `src/styles/components.css` defines the shared empty-state radial glow at lines 53-67.
* Terminal-specific overrides are at lines 104-125; `.ui-terminal-well .ui-empty-state::before` changes the glow to terminal accent color.
* `.ui-terminal-well::before` at lines 2705-2715 adds a top bridge gradient when terminal theme mode is independent.
* `src/components/XTermTerminal.tsx` has pre-existing uncommitted changes unrelated to this task and must not be touched.
