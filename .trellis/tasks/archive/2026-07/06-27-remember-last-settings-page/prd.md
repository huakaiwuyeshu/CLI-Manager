# Remember Last Settings Page

## Goal

When the settings modal is reopened, default to the last settings page the user selected, so terminal/theme/settings workflows resume where the user left off.

## What I Already Know

* User wants reopening settings to return to the previously used settings page.
* `src/App.tsx` currently resets no-argument settings opens to `general`.
* `src/components/SettingsModal.tsx` owns `activeTab` locally and only applies `initialTab` when the modal opens.
* `src/stores/settingsStore.ts` already persists user preferences through `settings.json` with Tauri `Store`.
* Explicit settings jumps already exist for `general`, `sync`, and `hooks`; those should keep working.

## Requirements

* Persist the last selected settings tab.
* When settings is opened with no explicit tab, use the persisted last tab instead of always using `general`.
* When settings is opened with an explicit tab, open that tab and update the remembered tab.
* Reset per-page search input when tab changes, as it does today.
* Do not add dependencies or change settings page layout.

## Acceptance Criteria

* [ ] Open settings, switch to Terminal, close settings, reopen from the sidebar gear: Terminal is shown.
* [ ] Open settings from Sync or Hook shortcuts: the explicit target page still opens.
* [ ] After app restart, no-argument settings open restores the last persisted settings tab.
* [ ] TypeScript check passes.

## Definition of Done

* Minimal scoped code change.
* Existing explicit settings links preserved.
* Typecheck or equivalent verification run.
* No unrelated dirty files modified.

## Technical Approach

Add a `lastSettingsTab` preference to the existing settings store and wire `SettingsModal` tab changes back to `App`. `App` decides the initial tab: explicit argument wins; otherwise use `lastSettingsTab`.

## Decision (ADR-lite)

**Context**: The current active settings tab is local modal state, so closing/reopening or restarting loses it.

**Decision**: Persist the last selected tab using the existing settings store rather than a separate localStorage path.

**Consequences**: This touches the settings store schema and settings modal props, but keeps behavior centralized with the app's other preferences.

## Out of Scope

* Per-project or per-window settings tab memory.
* Changing the order, labels, or layout of settings tabs.
* Persisting search text inside settings pages.

## Technical Notes

* Candidate files inspected:
  * `src/App.tsx`
  * `src/components/SettingsModal.tsx`
  * `src/components/settings/SettingsLayout.tsx`
  * `src/components/settings/SettingsNav.tsx`
  * `src/stores/settingsStore.ts`
  * `src/components/sidebar/SidebarFooter.tsx`
  * `src/components/sidebar/SyncStatusIndicator.tsx`
* GitNexus upstream impact:
  * `SettingsModal`: LOW, no direct callers/processes reported.
  * `SettingsLayout`: LOW, no direct callers/processes reported.
  * `useSettingsStore`: LOW, no direct callers/processes reported.
  * `App`: LOW, no direct callers/processes reported.
