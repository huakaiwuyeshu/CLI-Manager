# Debug settings command template buttons invisible

## Goal

Find the real root cause for why the settings command template UI does not show confirm/save/delete buttons, then apply the smallest fix.

## What I already know

* User reports that after the prior change, the expected confirm/save/delete buttons are still not visible.
* Prior change modified `src/components/settings/pages/TemplateSettingsPage.tsx` only.
* There is another command template UI: `src/components/CommandTemplatePanel.tsx`, used from terminal toolbar.
* Settings modal renders `TemplateSettingsPage` only when active tab is `templates`.
* Need verify actual visible entry and layout, not assume button placement.

## Assumptions (temporary)

* Possible root causes:
  * User is viewing `CommandTemplatePanel`, not `TemplateSettingsPage`.
  * The right-side form/action area is off-screen due to responsive/grid layout.
  * Button styles are being overridden by shared `.ui-interactive` CSS.
  * There is no existing template selected, so edit-only delete buttons are not expected.

## Requirements

* The command template management UI must show an obvious confirm/save action.
* Existing templates must expose delete and delete confirmation clearly.
* Fix must target the actual UI path the user sees.
* Settings command template layout should show the template list and editor side-by-side in the normal desktop settings window, not hide the editor below a long list.

## Acceptance Criteria

* [x] Command template create flow shows a visible save/confirm button.
* [x] Existing template edit flow shows a visible delete button.
* [x] Delete requires a second explicit confirmation.
* [x] TypeScript check passes or unrelated blockers are documented.

## Definition of Done

* Root cause identified.
* Minimal code change only.
* Diff format check passes.
* Typecheck passes where possible.
* Manual UI verification if user allows launching app.

## Out of Scope

* Reworking template persistence or variables.
* Adding a new dialog framework.
* Refactoring unrelated terminal tab work.

## Technical Notes

* Root cause: `TemplateSettingsPage` used `grid-cols-1` until `xl`, so inside the settings modal the editor column could be pushed below the template list. If the list is tall, users see only the list and miss the editor action buttons.
* Fix: use a two-column grid in the settings page itself: `grid-cols-[280px_minmax(0,1fr)]`, add `min-w-0` to both cards, and keep save/delete actions in the editor header.
* Suspect files:
  * `src/components/settings/pages/TemplateSettingsPage.tsx`
  * `src/components/CommandTemplatePanel.tsx`
  * `src/components/SettingsModal.tsx`
  * `src/components/settings/SettingsLayout.tsx`
  * `src/App.css`
