# Fix light terminal empty-state contrast

## Goal

Fix the terminal empty state so the icon, title, description, and action stay readable when the app is in a light theme and the terminal uses a light terminal palette.

## Requirements

* The empty terminal screen must use colors that contrast with the current terminal background in light terminal themes.
* Dark theme behavior must not regress.
* Keep the fix scoped to the empty terminal state; do not redesign the shared empty-state component.
* Do not change user-facing copy or translation keys.

## Acceptance Criteria

* [ ] In a light app theme with a light terminal palette, the terminal icon and text are readable and no longer washed into the background.
* [ ] In a dark app theme with a dark terminal palette, the empty state remains readable.
* [ ] `npx tsc --noEmit` passes.

## Definition of Done

* Minimal frontend style/code change.
* Static verification run.
* Manual verification items listed for the desktop UI.

## Technical Approach

Use the existing terminal theme CSS variables exposed by `TerminalTabs` (`--terminal-theme-background`, `--terminal-theme-foreground`, `--terminal-theme-muted`) to style the empty state inside `.ui-terminal-well`.

## Decision (ADR-lite)

**Context**: `TerminalTabs` currently renders the no-session state with `EmptyState tone="inverse"`. That works on dark backgrounds but becomes too light on light terminal backgrounds.

**Decision**: Override the empty-state colors in the terminal well using terminal theme variables instead of adding new state or changing translations.

**Consequences**: The fix is narrow and follows the active terminal palette. Shared empty states outside the terminal are unaffected.

## Out of Scope

* Changing terminal theme presets.
* Reworking the shared `EmptyState` API.
* Adding new settings.

## Technical Notes

* Empty terminal rendering: `src/components/TerminalTabs.tsx`
* Shared empty state: `src/components/ui/EmptyState.tsx`
* Empty-state styling: `src/styles/components.css`
* Frontend spec: `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/quality-guidelines.md`
