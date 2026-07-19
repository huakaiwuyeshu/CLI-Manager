# Design

## Data Model

Add a pure `buildReplayProgressModel(events, historyDetail)` transformation. It emits latest-first turns while keeping steps inside each turn chronological.

- History messages define conversation turns when available.
- Replay `UserPromptSubmit` events provide live/fallback turn boundaries.
- History tool events provide paired input/output; Replay events overlay live status and add missing actions.
- History file changes attach by `message_index`; snapshots attach by Replay event order.
- Validation steps are shell-like tool calls whose input contains known test, type-check, check, lint, or build commands.

## UI

- Compact header: session title, current status/action, elapsed time, and one-line counts.
- Two modes: `progress` and `log`.
- Progress: collapsible turn cards with conversation, tools, file changes, validation, subtasks/errors, and checkpoints.
- Log: searchable/filterable raw events with inline detail.
- Remove the fixed bottom detail panel.

## Failure Behavior

- Only load history detail when project path, source, and exact CLI session id exist.
- If detail lookup fails or lags, keep hook-only progress and show detail unavailable/syncing state.
- Unpaired starts remain running for active sessions and incomplete for historical/completed sessions.
- Large transcript text, outputs, patches, and payloads remain collapsed until requested.
