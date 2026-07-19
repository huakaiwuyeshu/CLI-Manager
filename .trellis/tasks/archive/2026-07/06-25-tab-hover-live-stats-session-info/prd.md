# Tab hover setting and live stats session info

## Goal

Add a user setting to disable terminal tab hover info cards, and enrich the realtime terminal stats session card with Shell and Session ID information.

## What I Already Know

* User wants tab hover info cards to be closable from Settings.
* User wants the realtime stats session card to show Shell and Session ID.
* User wants double-click on Session ID to copy it.
* `src/components/TerminalTabs.tsx` owns the terminal tab hover card.
* `src/components/terminal/TerminalStatsPanel.tsx` owns the realtime stats session card.
* `src/stores/settingsStore.ts` persists app settings through `settings.json`.
* `src/components/settings/pages/GeneralSettingsPage.tsx` already contains terminal behavior toggles.
* `src/components/stats/termStatsUi.tsx` `Row` already supports `onDoubleClick`.

## Requirements

* Add a persisted boolean setting for terminal tab hover info cards.
* Default behavior remains unchanged: hover info cards are enabled by default.
* Add a Settings switch to disable or enable terminal tab hover info cards.
* Realtime stats session card shows Shell.
* Realtime stats session card shows Session ID.
* Double-clicking Session ID copies the full ID to clipboard.

## Acceptance Criteria

* [ ] With the setting enabled, hovering a terminal tab still shows the info card.
* [ ] With the setting disabled, hovering a terminal tab does not show the info card.
* [ ] Existing settings load correctly when the new setting is absent.
* [ ] Realtime stats session card displays Shell and Session ID.
* [ ] Double-clicking Session ID copies the full value and shows copy feedback.
* [ ] `npx tsc --noEmit` passes.

## Definition of Done

* Static type check passes.
* No dependency changes.
* No backend changes unless inspection proves frontend data is insufficient.
* Manual verification items are listed for desktop UI behavior.

## Technical Approach

Use the existing settings store migration pattern for a new boolean field. Read that field in the terminal tab component before scheduling the hover card. Reuse the existing realtime stats row component for Shell and Session ID, with clipboard copy on the Session ID value.

## Decision (ADR-lite)

**Context**: The hover card is frontend-only UI state, and realtime stats already has the current terminal session plus loaded history session data.

**Decision**: Keep the change in frontend code only. Store the hover-card preference in `settings.json`.

**Consequences**: Old installs keep current behavior because the new setting defaults to enabled. Runtime UI verification remains manual per project guidelines.

## Out of Scope

* Redesigning the terminal tab hover card.
* Changing history parsing or backend session models.
* Adding new dependencies.

## Technical Notes

* GitNexus impact analysis: `SortableTab`, `SessionInfoCard`, `GeneralSettingsPage`, and `useSettingsStore` all returned LOW risk.
* Relevant specs read: `.trellis/spec/frontend/index.md`, `component-guidelines.md`, `state-management.md`, `quality-guidelines.md`.
