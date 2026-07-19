# Replay Snapshot File Storage

## Changelog Target

[TEMP]

## Goal

Move AI Replay code snapshot patch content out of SQLite and into files under the CLI-Manager data directory, then clean existing large snapshot patch payloads from the current local database.

## Requirements

- New AI Replay code snapshots must not persist large `patch` text inside `ai_replay_events.payload_json`.
- Snapshot patch files must be stored under the app-owned `.cli-manager` data directory, not inside user project repositories.
- Existing snapshots that currently have `payload.patch` in SQLite must be migrated to files before clearing the DB field.
- Existing Replay actions must keep working after migration:
  - view snapshot diff
  - rollback to snapshot
  - fork snapshot
- Existing old-format rows that still contain `payload.patch` must remain readable.
- Missing snapshot files should degrade safely: keep metadata visible, but disable diff/rollback/fork for that snapshot.

## Acceptance Criteria

- [ ] New snapshot DB payloads contain file metadata such as `patchPath` and `patchBytes`, but not the full `patch` text.
- [ ] Loading Replay events hydrates snapshot `patch` from the stored file path when available.
- [ ] Current DB snapshot rows are migrated to files and have `payload.patch` removed.
- [ ] DB file size is reduced after cleanup and vacuum.
- [ ] `npx tsc --noEmit` passes.

## Definition of Done

- Project conventions are followed.
- Existing unrelated dirty files are preserved.
- Changelog notes are added under `[TEMP]`.
- Product functionality list is updated if the user-facing Replay behavior changes.

## Technical Approach

Use existing app path and file commands from the WebView side instead of adding a new backend API. Store snapshot patches at `dataDir/replay-snapshots/<sessionKey>/<checkpointId>.patch`, save only `patchPath` and metadata in SQLite, and hydrate `event.payload.patch` when Replay events are read.

For cleanup, run a one-time local SQLite migration script that:

1. Creates a DB backup.
2. Writes each existing snapshot `payload.patch` to the same file layout.
3. Replaces `payload.patch` with `patchPath` metadata in `payload_json`.
4. Runs `VACUUM` to reclaim SQLite space.

## Out of Scope

- Adding a new DB table or schema migration.
- Moving non-snapshot Replay event payloads out of SQLite.
- Adding user-facing snapshot retention settings.
- Deleting snapshot files automatically.

## Technical Notes

- Main code file: `src/stores/replayStore.ts`.
- Replay UI consumes hydrated `event.payload.patch` in `src/components/terminal/SessionReplayPanel.tsx`.
- App data path comes from `src/lib/appPaths.ts` via `app_get_data_paths`.
- Existing file commands are available: `file_create_dir`, `file_write_text`, `file_read_text`.
- GitNexus impact for `persistReplayEvent`, `mapEvent`, and `SessionReplayPanel` was LOW.
