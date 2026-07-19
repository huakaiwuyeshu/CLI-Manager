# Model Pricing Remote Sync Scope

## Goal

Limit model pricing remote sync to the currently selected model-pricing tab scope, and add a row-level sync action for individual saved models.

## What I Already Know

- The settings page is `src/components/settings/pages/ModelPricingSettingsPage.tsx`.
- The store method `sync(targets?: string[])` in `src/stores/modelPricingStore.ts` already accepts target model ids.
- The backend command `model_prices_sync(targets)` already matches only the supplied targets and enforces a 500 target limit.
- Current page-level `handleSync` always sends saved prices plus discovered models, regardless of the active filter tab.
- GitNexus impact for `ModelPricingSettingsPage` and page-local `handleSync` is LOW.

## Requirements

- Top-level "Sync Remote Prices" must use the active segmented tab as its sync scope.
- When the active tab is "All", sync all known models currently used by the page.
- When the active tab is "Missing", sync only missing local models.
- Add a row-level sync button in the table action column for one saved model.
- Center-align table header text.
- Keep existing Chinese/English visible copy behavior.

## Acceptance Criteria

- [ ] Clicking top-level sync on "All" syncs saved plus discovered model ids.
- [ ] Clicking top-level sync on "Missing" syncs only models without saved prices.
- [ ] Clicking row-level sync sends only that row's model id.
- [ ] Existing candidate handling still switches to the candidates tab when candidates are returned.
- [ ] Table header text is visually centered.
- [ ] `npx tsc --noEmit` passes.

## Definition of Done

- Minimal code changes only.
- No dependency, schema, or backend command changes.
- Type-check passes.
- Manual desktop verification items are listed for tab-specific sync and row sync.

## Out of Scope

- Changing remote price matching algorithm.
- Adding new remote price sources.
- Refactoring the model pricing store.
- Runtime-starting the Tauri desktop app.

## Technical Notes

- Relevant specs read:
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/frontend/state-management.md`
- Relevant files inspected:
  - `src/components/settings/pages/ModelPricingSettingsPage.tsx`
  - `src/stores/modelPricingStore.ts`
  - `src-tauri/src/commands/model_pricing.rs`
