# Remove Terminal Padding

## Goal

Remove oversized padding/margins around the embedded terminal while keeping a small framed gap and rounded border.

## What I already know

* The user said the terminal does not need inner padding.
* `src/components/XTermTerminal.tsx` conditionally adds `p-2` to the terminal wrapper when no background image is active.
* Background-image mode already removes this padding to avoid visible image strips around the xterm container.
* `src/components/SplitTerminalView.tsx` does not add terminal padding.
* `src/components/TerminalTabs.tsx` added non-fullscreen content padding/insets around the terminal well.
* `src/App.css` added `margin: 12px` and rounded corners to both terminal chrome and terminal well.

## Requirements

* The embedded terminal wrapper should not add broad inner padding, but should keep a small 6px left padding so glyphs do not touch the window edge.
* The terminal content well must not keep non-fullscreen padding/inset offsets, but should keep a small 6px framed margin and 8px radius.
* The terminal tab chrome should keep a small 6px outer margin and 8px radius, not the previous oversized spacing.
* Keep terminal background image layering behavior intact.
* Keep terminal search overlay behavior intact.

## Acceptance Criteria

* [x] `XTermTerminal` no longer applies all-around `p-2` to `.ui-terminal-bg-layer`, and instead applies left-only `pl-1.5`.
* [x] `TerminalTabs` no longer offsets the terminal well in non-fullscreen mode.
* [x] `.ui-terminal-chrome` uses 6px outer margin and 8px radius.
* [x] `.ui-terminal-well` uses 6px outer margin and 8px radius.
* [x] Terminal avoids large all-around gaps in normal and split terminal views.
* [x] Type checking passes or any verification limitation is reported.

## Definition of Done

* Minimal scoped code change.
* No unrelated refactor or dependency/config change.
* Verification performed with an appropriate frontend check.

## Out of Scope

* Changing terminal tab layout, split divider sizing, search overlay spacing, or settings UI spacing.
* Changing xterm theme colors or background image settings.

## Technical Notes

* Relevant files inspected: `src/components/XTermTerminal.tsx`, `src/components/SplitTerminalView.tsx`, `src/App.css`.
* GitNexus upstream impact for `XTermTerminal`: LOW; direct callers/processes reported as 0.
* Frontend quality guideline has no special styling constraint for this change; avoid runtime overhead in terminal hot paths.
