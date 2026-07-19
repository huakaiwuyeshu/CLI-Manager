# Implementation Checklist

1. Load frontend and delivery specs with `trellis-before-dev`.
2. Remove terminal-side manual sync button wiring from `TerminalTabs`.
3. Update `externalSessionSyncStore.openInitialDialog()` to skip startup scanning when maintained projects already exist.
4. Wire `HistoryWorkspace.handleRefreshSessions` to call `openManualDialog()` after refreshing sessions/search.
5. Add or adjust i18n keys for sync dialog/toasts touched by the change.
6. Update `CHANGELOG.md` under `V1.2.5`.
7. Update `docs/功能清单.md` if the feature inventory references the old standalone sync entry.
8. Run `npx tsc --noEmit`.
9. Run GitNexus `detect-changes`.
