# fix settings persistence after update

## Changelog Target

[TEMP]

## Goal

Prevent CLI-Manager updates, repair installs, or quick relaunches from resetting user custom settings and configuration data.

## Requirements

* Persist settings writes immediately enough that confirmed UI changes survive updater install/relaunch.
* Keep store files in the stable `.cli-manager` data directory, including external session sync state.
* Recover legacy Tauri app-data store files and database safely without overwriting newer user data.
* Move terminal side-panel width preferences out of WebView `localStorage` into the settings store, with one-time legacy localStorage fallback.
* Validate persisted primitive settings on load so malformed or stale values cannot leak into runtime state.

## Acceptance Criteria

* [ ] Existing `settings.json`, `sessions.json`, `sync-config.json`, and `external-session-sync.json` survive an app update.
* [ ] Current `.cli-manager` values are not overwritten by older legacy values.
* [ ] Empty/new `.cli-manager` store files can recover values from legacy app data.
* [ ] Project/template SQLite data is recovered only when the current DB has no user rows and the legacy DB has user rows.
* [ ] Terminal side-panel widths survive restart/update through `settings.json`.
* [ ] TypeScript and Rust checks pass.

## Technical Approach

Use the existing custom data directory contract in `app_paths.rs`. Extend it to cover external session sync state, harden legacy migration as non-destructive merge/copy with backups, switch Tauri store use to immediate save, and add focused validation/migration in `settingsStore.ts`.

## Out of Scope

* No updater protocol/config changes.
* No dependency changes.
* No destructive cleanup of old app-data files.

## Technical Notes

* `migrate_legacy_app_files` impact analysis returned HIGH because it runs on app startup.
* `getCliManagerDataPaths` impact analysis returned HIGH because many stores and DB helpers depend on it.
* Existing frontend test framework is absent; use `npx tsc --noEmit` plus Rust unit tests for migration helpers.
