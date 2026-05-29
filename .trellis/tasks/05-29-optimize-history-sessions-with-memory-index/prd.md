# optimize history sessions with memory index

## Goal

Improve history session loading performance by avoiding repeated full directory scans and JSONL parsing when opening the history workspace or loading history stats.

## Requirements

- Build a process-local Rust in-memory summary index for Claude/Codex history session files.
- Index only session summaries in the first implementation: source, project key, file path, session id, title, timestamps, message count, branch, token stats, dominant model, file size, and file mtime.
- Use `mtime + size` to skip unchanged files during refresh.
- Make `history_list_sessions` read from the in-memory index instead of rebuilding summaries from JSONL every call.
- Make `history_get_stats` aggregate from the in-memory index instead of rescanning JSONL files.
- Keep `history_get_session` reading a single JSONL file on demand.
- Keep the existing frontend invoke contract unless a small backend-only status field becomes necessary.
- Avoid adding SQLite or search-engine dependencies for this phase.

## Acceptance Criteria

- [ ] Opening history no longer reparses all JSONL files after the in-memory index is warm.
- [ ] `history_list_sessions` preserves existing filtering by source, query, sorting by `updated_at desc`, and limit behavior.
- [ ] `history_get_stats` returns the same payload shape and equivalent aggregate semantics as before.
- [ ] Changed/new JSONL files are picked up by refresh using file metadata.
- [ ] Session detail still loads full messages from the original JSONL file.
- [ ] Existing history search and prompt listing behavior remain unchanged unless explicitly included later.
- [ ] Rust checks/tests pass.

## Definition of Done

- Rust implementation is minimal and contained primarily in `src-tauri/src/commands/history.rs`.
- No new database layer is introduced.
- No frontend UI behavior changes unless required by backend contract.
- Relevant checks are run: at minimum `cargo check`; add focused tests if practical.
- GitNexus change detection is run before any commit.

## Technical Approach

Use a `OnceLock` + `RwLock`/`Mutex`-guarded Rust in-memory index containing sorted `IndexedSession` records and file fingerprints. The index is refreshed before list/stats commands; unchanged files reuse existing computed summaries, changed/new files are parsed once, and removed files disappear from the index. Stats are computed from indexed summaries.

## Decision (ADR-lite)

**Context**: History loading is slow because the backend recursively scans Claude/Codex history directories and parses JSONL files to rebuild summaries and stats.

**Decision**: Use a pure Rust process-local summary index instead of an in-memory SQLite database.

**Consequences**: This avoids dependency and SQL complexity while addressing the main bottleneck. The index is rebuilt after app restart, so cold-start cost is reduced only if warmup runs before the user opens history. Full-message search remains file-based in this phase.

## Out of Scope

- Persisting a disk-backed history index across app restarts.
- Full-text search acceleration.
- Indexing all message bodies in memory.
- Changing the history UI layout or filters.
- Replacing CLI-Manager's existing `cli-manager.db` application database.

## Technical Notes

- Current application data uses `sqlite:cli-manager.db` via `@tauri-apps/plugin-sql`; see `src/lib/db.ts` and migrations in `src-tauri/src/lib.rs`.
- Current history sessions are read from JSONL files under `~/.claude/projects` and `~/.codex/sessions` in `src-tauri/src/commands/history.rs`.
- Existing backend already has short-lived caches: `SESSION_FILES_CACHE` and `SESSION_STATS_CACHE`.
- GitNexus index was reported stale by 10 commits during exploration; implementation should rely on current source reads and run impact analysis before editing symbols.
