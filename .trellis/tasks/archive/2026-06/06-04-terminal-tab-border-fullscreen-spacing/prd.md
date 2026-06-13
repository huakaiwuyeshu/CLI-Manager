# terminal tab border fullscreen spacing

## Goal

Improve the terminal workspace visual fit with the smallest UI change: make terminal tabs visually bounded again, and remove the terminal content top offset in fullscreen mode so the terminal surface sits flush under the toolbar.

## What I already know

* User feedback: tabs without borders look unfinished.
* User feedback: after fullscreen, the terminal top margin should be removed for a tighter fit.
* `src/components/TerminalTabs.tsx` controls terminal tab markup and fullscreen layout classes.
* `src/App.css` defines `.ui-tab-trigger`, `.ui-terminal-tabs-shell`, `.ui-terminal-well`, and fullscreen terminal well overrides.
* GitNexus impact for `TerminalTabs` upstream is LOW: 0 direct callers and 0 affected processes reported.

## Requirements

* Add a subtle visible border/outline to terminal tabs in normal and active states.
* Keep active tab state visually clear.
* In fullscreen mode, remove the top padding/offset above terminal and history workspace content.
* Avoid changing terminal behavior, state, data flow, shortcuts, or persistence.

## Acceptance Criteria

* [x] Terminal tabs have a visible boundary in the tab bar.
* [x] Active terminal tab remains distinguishable from inactive tabs.
* [x] Fullscreen terminal content starts at the top of the content area without the current 12px top gap.
* [x] Non-fullscreen spacing stays unchanged.
* [x] Typecheck or targeted verification is run before completion.

## Definition of Done

* Minimal code changes only.
* Existing style system and variables are reused.
* No new dependencies.
* Verification result is reported.

## Technical Approach

Use existing CSS variables and existing `fullscreen` prop. Add border styling to `.ui-tab-trigger` / selected state in `src/App.css`, and change fullscreen-only `pt-3/top-3` classes in `src/components/TerminalTabs.tsx` to `pt-0/top-0` while leaving non-fullscreen classes unchanged.

## Decision (ADR-lite)

**Context**: User confirmed tabs need visible borders and fullscreen terminal content should sit flush under the toolbar.
**Decision**: Apply the minimal two-file visual adjustment.
**Consequences**: Terminal chrome appearance changes slightly; terminal behavior and persisted settings stay untouched.

## Out of Scope

* Redesigning the whole terminal chrome.
* Changing tab size, drag behavior, close button behavior, or toolbar visibility settings.
* Changing app/window fullscreen permissions or shortcuts.

## Technical Notes

* Inspected `src/components/TerminalTabs.tsx:553`, `src/components/TerminalTabs.tsx:765`, `src/components/TerminalTabs.tsx:775`.
* Inspected `src/App.css:755`, `src/App.css:797`, `src/App.css:1953`.
