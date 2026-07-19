# Fix Settings Model Pricing And Provider Visual Consistency

## Goal

Make Settings > Model Pricing and Settings > Providers visually consistent with the rest of the settings shell. The immediate bug is that candidate price Select controls and their Apply buttons are not aligned; the broader polish is reducing oversized and overly bold typography on both pages.

## Requirements

* Align each candidate price Select and its Apply button on the same row baseline.
* Reduce Model Pricing page title, stat chips, section titles, row titles, and buttons to the existing settings visual density.
* Reduce Providers page oversized detail title, section titles, list item labels, tabs, badges, and icon sizes where they currently feel heavier than the settings shell.
* Keep existing data flow, commands, storage, i18n behavior, and candidate apply behavior unchanged.
* Do not add dependencies or rename settings tabs.

## Acceptance Criteria

* [ ] Candidate price dropdowns and Apply buttons are visually aligned in candidate cards.
* [ ] Model Pricing page no longer uses obviously oversized/heavy display styling compared with other settings pages.
* [ ] Providers page no longer uses large editorial title treatment or extra-heavy segmented/tab text.
* [ ] `npx tsc --noEmit` passes.

## Definition Of Done

* Static type check passes.
* Manual UI verification items are listed for desktop inspection.

## Technical Approach

Use minimal local style changes in the two settings page components. Prefer Mantine sizing props and existing theme tokens. Avoid touching stores, backend commands, shared persistence, or translation keys because the text itself is unchanged.

## Decision

Context: Both pages already use localized inline text and Mantine controls, but they override the system style with large titles, bold labels, and custom cards.

Decision: Keep page structure and behavior intact. Normalize typography and spacing locally.

Consequences: Visual risk is limited to two settings tabs. No runtime data behavior should change.

## Out Of Scope

* Rebuilding settings navigation or top bar.
* Replacing all custom CSS with shared components.
* Changing model pricing sync/apply logic.
* Changing cc-switch provider parsing.

## Technical Notes

* Relevant files:
  * `src/components/settings/pages/ModelPricingSettingsPage.tsx`
  * `src/components/settings/pages/ProviderSettingsPage.tsx`
* Candidate row issue is around `ModelPricingSettingsPage.tsx` candidate card layout.
* GitNexus impact:
  * `ModelPricingSettingsPage`: LOW, 0 direct upstream impacts.
  * `ProviderSettingsPage`: LOW, 0 direct upstream impacts.
  * Shared `Select`: LOW, but no shared change is planned unless local page styles are insufficient.
* Frontend guideline: settings pages should prefer Mantine controls and stay visually consistent with the settings shell.
