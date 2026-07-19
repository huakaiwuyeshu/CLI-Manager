# Merge History Sync Into Refresh

## Changelog Target

V1.2.5

## Goal

Move the manual Codex/Claude history project sync entry out of the terminal-side tool menu and into the history session list refresh action.

## User Value

Users refresh history from one place. If refreshed history contains projects that are not already maintained in CLI-Manager, the existing sync dialog prompts them to add those projects.

## Confirmed Facts

- The terminal-side sync button is rendered in `src/components/TerminalTabs.tsx` and calls `useExternalSessionSyncStore().openManualDialog()`.
- The history list refresh button is rendered by `src/components/history/HistoryListPane.tsx` and calls `HistoryWorkspace`'s `handleRefreshSessions`.
- External history project scanning and sync dialog state live in `src/stores/externalSessionSyncStore.ts`.
- Startup currently calls `startMonitor()`, which calls `openInitialDialog()` after a delay.
- `scanProjectCandidates()` already compares history candidates against the maintained project list when grouping candidates.
- GitNexus impact analysis for affected symbols reported LOW risk.

## Requirements

1. Remove the manual Codex/Claude history sync button from the terminal-side tool menu.
2. Make the history session list refresh action also trigger manual Codex/Claude history project scanning.
3. When manual refresh finds syncable history projects that are not already maintained, show the existing project sync dialog.
4. On first-run/startup automatic detection, skip scanning and prompting when the maintained project list is already non-empty.
5. Manual refresh must still scan and prompt regardless of whether the maintained project list is empty or non-empty.
6. Keep user-visible text compatible with `zh-CN` and `en-US` through the i18n layer when adding or changing visible copy.

## Acceptance Criteria

- The terminal-side tool menu no longer shows the standalone sync button from Image #1.
- Clicking the history list refresh button refreshes the history session list and runs manual project-sync detection.
- If detection finds history projects not maintained in CLI-Manager, the sync dialog opens with those candidates.
- Startup automatic detection does not scan or prompt when `projects.length > 0`.
- Startup automatic detection still works when no projects are maintained and the initial prompt has not been handled.
- Type checking passes for changed frontend code.

## Out of Scope

- Backend history parser changes.
- Database schema changes.
- Redesigning the sync dialog beyond required i18n and behavior wiring.
