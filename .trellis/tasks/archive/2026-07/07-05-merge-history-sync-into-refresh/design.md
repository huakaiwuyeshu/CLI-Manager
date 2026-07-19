# Design

## Boundaries

- Frontend only.
- Reuse `externalSessionSyncStore` for all candidate scan and dialog behavior.
- Do not add a new Tauri command or database migration.

## Data Flow

1. User opens history workspace.
2. User clicks the existing refresh button in `HistoryListPane`.
3. `HistoryWorkspace.handleRefreshSessions` reloads sessions and reruns active global search.
4. The same handler calls `useExternalSessionSyncStore.getState().openManualDialog()`.
5. `openManualDialog()` scans history files, filters already handled/synced candidates, and opens `ExternalSessionSyncDialog` when candidates exist.

## Startup Detection

`openInitialDialog()` should load both external sync state and project state before deciding to scan. If the maintained project list is non-empty, it should mark the initial prompt handled and return without calling `scanProjectCandidates()`.

## UI Changes

- Remove the standalone terminal-side sync button and related store subscriptions/import usage from `TerminalTabs`.
- Keep the history refresh icon unchanged, but its action now covers both history list reload and sync candidate detection.
- Prefer i18n keys for any newly touched visible sync copy.

## Risk Notes

- Manual refresh should continue to refresh history even if sync scanning fails.
- Sync scanning can be slower than list refresh, so run it after the list refresh/search path and preserve the existing store-level loading state.
