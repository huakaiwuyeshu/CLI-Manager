# Remove Project Tree Badge Setting

## Goal

Remove the "项目树徽章" control from General Settings so users no longer see this option in the settings UI.

## Requirements

* Remove the "项目树徽章" card/switch from `src/components/settings/pages/GeneralSettingsPage.tsx`.
* Keep existing project tree badge behavior unchanged.
* Do not remove the persisted setting or sidebar rendering logic in this task.

## Acceptance Criteria

* [x] General Settings no longer displays the "项目树徽章" setting.
* [x] Existing project tree badges still render according to the existing stored/default setting.
* [x] Frontend type-check passes.

## Definition of Done

* Code change is minimal and localized.
* Type-check or equivalent verification has been run.
* No unrelated files are modified.

## Out of Scope

* Removing `showProjectTreeBadges` from the settings store.
* Changing sidebar badge rendering behavior.
* Adding a replacement setting elsewhere.

## Technical Notes

* Setting UI found in `src/components/settings/pages/GeneralSettingsPage.tsx`.
* Store key found in `src/stores/settingsStore.ts`.
* Sidebar consumers found in `src/components/sidebar/TreeNodeItem.tsx`.
* GitNexus impact for `GeneralSettingsPage`: LOW, 0 direct callers, 0 affected processes.
