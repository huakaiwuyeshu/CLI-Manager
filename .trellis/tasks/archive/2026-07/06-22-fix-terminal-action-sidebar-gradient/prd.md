# Fix Terminal Action Sidebar Gradient

## Goal

Prevent terminal action sidebar buttons from inheriting global primary gradient backgrounds, so icon buttons keep the intended flat terminal-style color treatment.

## Requirements

* Terminal action sidebar active/primary buttons must not show the global primary gradient.
* Drag overlay buttons for the same toolbar must keep the same flat visual treatment.
* Keep the fix scoped to terminal action sidebar styles; do not change global button behavior.

## Acceptance Criteria

* [ ] `src/App.css` explicitly clears inherited gradient background image for terminal action sidebar active/primary buttons.
* [ ] Existing global `.ui-primary-action` and `.ui-icon-action[data-active="true"]` behavior outside the terminal action sidebar remains unchanged.
* [ ] `npx tsc --noEmit` passes.
* [ ] Human manual UI check confirms the terminal action sidebar buttons no longer show light-to-dark gradient pollution.

## Definition of Done

* Static/type check runs successfully where relevant.
* Runtime desktop UI verification is left to human review per project guideline.
* Scope remains limited to the CSS selector fix.

## Technical Approach

Add `background-image: none;` to the existing terminal action sidebar scoped selector that already resets `background-color`, `color`, and `border-color` for primary/active buttons.

## Decision (ADR-lite)

**Context**: Global action button styles use gradient backgrounds for primary/active states. Terminal action sidebar buttons are intended to look like terminal-native flat icon actions and already override most global styling, but did not clear `background-image`.

**Decision**: Use the existing scoped override in `src/App.css` and add `background-image: none;` there.

**Consequences**: Minimal CSS-only fix. It avoids changing shared button classes and therefore limits visual impact to terminal action sidebar and drag overlay.

## Out of Scope

* Redesigning terminal toolbar buttons.
* Changing global primary/active button styles.
* Starting the desktop app for AI-side visual verification.

## Technical Notes

* `src/App.css:1767` defines global `.ui-icon-action[data-active="true"]` gradient.
* `src/App.css:3265` defines global `.ui-primary-action` gradient.
* `src/App.css:2823` scopes terminal action sidebar primary/active styles but only resets `background-color`, leaving inherited `background-image` active.
* Similar prior pattern exists around `src/App.css:2754`, where terminal pane chrome primary action clears `background-image`.
* Relevant guidelines: `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/quality-guidelines.md`, `.trellis/spec/guides/code-reuse-thinking-guide.md`.
