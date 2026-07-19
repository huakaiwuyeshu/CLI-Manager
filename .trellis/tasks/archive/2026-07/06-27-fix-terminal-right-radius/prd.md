# Fix Terminal Right Radius

## Goal

Restore the visible rounded corners on the terminal content area when the right action sidebar is present.

## What I already know

* The screenshot shows the black terminal content area has rounded corners on the left, but its top-right and bottom-right edge next to the right action sidebar appears square.
* `src/components/TerminalTabs.tsx` renders `.ui-terminal-well` as a flex container.
* The main terminal content is the first `.flex-1` child under `.ui-terminal-well`; `renderToolbarActions()` renders `nav.ui-terminal-action-sidebar` as a sibling.
* `src/styles/components.css` gives `.ui-terminal-well` `border-radius: 8px` and `overflow: hidden`, but the main terminal content child does not inherit that radius.

## Requirements

* Keep the fix visual-only and local to terminal shell styling.
* Preserve right action sidebar layout, button order, drag behavior, side panels, and fullscreen mode.
* Do not add dependencies or change terminal runtime behavior.

## Acceptance Criteria

* [ ] Normal terminal view shows visible top-right and bottom-right rounded corners on the terminal content area next to the right action sidebar.
* [ ] Fullscreen terminal keeps square edges.
* [ ] Terminal side panels and right toolbar remain usable and aligned.
* [ ] Frontend type-check passes.

## Definition of Done

* `npx tsc --noEmit` passes, or any failure is reported with cause.
* Manual desktop verification items are listed because this project does not rely on AI-started Tauri runtime verification.

## Technical Approach

Add a small CSS rule for the first content child of `.ui-terminal-well` so it inherits the terminal well radius and clips its own content. Keep existing fullscreen overrides.

## Out of Scope

* Reworking terminal layout structure.
* Changing the action sidebar appearance beyond what is needed to reveal the terminal content radius.
* Changing terminal theme, xterm rendering, tabs, or panel behavior.

## Technical Notes

* Relevant code: `src/components/TerminalTabs.tsx`, `src/styles/components.css`.
* Relevant spec: `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/quality-guidelines.md`.
