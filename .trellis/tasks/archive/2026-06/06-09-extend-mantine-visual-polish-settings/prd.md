# Extend Mantine Visual Polish To Remaining Settings Pages

## Goal

Continue the Mantine/new-visual migration beyond `GeneralSettingsPage` so the remaining settings pages feel consistent with the current settings shell without changing setting semantics or backend behavior.

## What I already know

* The app already imports `@mantine/core/styles.css` and wraps `App` with `AppMantineThemeProvider`.
* `GeneralSettingsPage` is already migrated to Mantine controls for the current trial scope.
* `SettingsModal`, `SettingsLayout`, `SettingsTopBar`, and `SettingsNav` already use the new settings shell.
* Remaining settings pages still use a mix of custom `Card`, custom `Input`/`Select`, handmade buttons, and old surface classes:
  * `ThemeSettingsPage`
  * `ShortcutSettingsPage`
  * `TemplateSettingsPage`
  * `SyncSettingsPage`
  * `HookSettingsPage`
* Runtime desktop UI verification is manual by project rule. AI should run static/build checks and provide exact manual checks.

## Requirements

* Extend the new visual language to remaining settings pages with minimal, page-local changes.
* Prefer Mantine standard controls where they fit existing semantics.
* Preserve existing settings store fields, IPC commands, database access, and user-visible behavior.
* Avoid broad refactors, dependency changes, or backend changes.
* Remove leftover temporary `*.tmp.*` files from the repo.
* Produce current unfinished-task and unverified-task reports.

## Acceptance Criteria

* [x] `ThemeSettingsPage` uses the same visual density, cards, controls, spacing, and selected-state language as `GeneralSettingsPage`.
* [x] `ShortcutSettingsPage` uses the same new settings card/control style while preserving filtering and shortcut recording behavior.
* [x] `TemplateSettingsPage` keeps list/editor behavior but aligns cards, inputs, selects, and action buttons with the new style.
* [x] `SyncSettingsPage` keeps all WebDAV/local sync behavior but aligns panels, conflict dialogs, inputs, selects, and action buttons with the new style.
* [x] `HookSettingsPage` keeps hook install/remove/status behavior but aligns cards, switches, number input, paths, status rows, and action buttons with the new style.
* [x] No settings tab id changes.
* [x] No settings storage schema changes.
* [x] No new dependencies.
* [x] No `*.tmp.*` files remain outside ignored dependency/build directories.
* [x] `npx tsc --noEmit` passes.
* [x] `npm run build` passes.
* [x] Manual settings UI checklist is provided for human desktop verification.

## Manual Settings UI Checklist

AI did not launch the Tauri desktop app. Human verification should check:

* [ ] Open Settings → Terminal Settings, verify terminal behavior, terminal theme library, terminal preview, and terminal background controls are visually consistent and still update values.
* [ ] Open Settings → Shortcuts, verify search filtering, newline shortcut selection, tab-switch modifier selection, shortcut recording, clear, cancel, conflict warning, and reset defaults.
* [ ] Open Settings → Command Templates, verify template filtering, create/edit/delete confirmation, global/project/session scope behavior, and locked scope during edit.
* [ ] Open Settings → Sync, verify cloud/local mode switch, WebDAV save/test/password visibility, cloud upload/download preview modal, local export/import confirmation modal, and conflict banner actions.
* [ ] Open Settings → Hooks, verify Claude/Codex status refresh, directory selection, install/uninstall buttons, path rows, status rows, notification switches, and auto-close seconds commit.

## Definition of Done

* TypeScript and production build pass.
* Current dirty state is understood and unrelated user changes are not reverted.
* Manual verification items are explicit because AI must not start the Tauri desktop app.
* Any reusable setting-page pattern learned during implementation is recorded in frontend specs if it should guide future work.

## Technical Approach

Use the existing Mantine provider and `GeneralSettingsPage` as the style baseline. Convert the remaining settings pages incrementally and locally, replacing old custom cards/buttons/inputs only where it reduces visual drift without changing behavior. Keep specialized UI such as terminal preview, sync conflict details, and hook status summaries as small local compositions.

## Out of Scope

* Reworking settings navigation or tab ids.
* Changing persisted settings names or migrations.
* Changing Rust/Tauri backend commands.
* Redesigning non-settings UI such as terminal tabs, project tree, command palette, stats panels, or history workspace.
* Automatically launching the Tauri desktop app for visual verification.

## Technical Notes

* Relevant specs:
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
* Relevant current files inspected:
  * `src/main.tsx`
  * `src/components/ui/MantineThemeProvider.tsx`
  * `src/components/SettingsModal.tsx`
  * `src/components/settings/SettingsLayout.tsx`
  * `src/components/settings/SettingsTopBar.tsx`
  * `src/components/settings/SettingsNav.tsx`
  * `src/components/settings/pages/GeneralSettingsPage.tsx`
  * `src/components/settings/pages/ThemeSettingsPage.tsx`
  * `src/components/settings/pages/ShortcutSettingsPage.tsx`
  * `src/components/settings/pages/TemplateSettingsPage.tsx`
  * `src/components/settings/pages/SyncSettingsPage.tsx`
  * `src/components/settings/pages/HookSettingsPage.tsx`
