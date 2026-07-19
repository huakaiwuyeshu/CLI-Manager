# add oom diagnostics logs

## Goal

Add low-risk OOM diagnostic logs to the V1.2.3 high-memory investigation path so backend logs and WebView console can show whether Replay snapshots, history detail payloads, or sub-agent transcripts are causing memory spikes.

## Changelog Target

[TEMP]

## What I already know

* User reports V1.2.2 was normal and V1.2.3 can OOM.
* The project has no V1.2.2 tag; `a4548a6 chore(version): bump to V1.2.2` is the V1.2.2 baseline.
* The strongest V1.2.3 risk is AI Replay storing hook payloads and complete worktree patch snapshots in SQLite and frontend memory.
* Secondary risks are full token trend rendering, history detail payload size, and sub-agent transcript growth.

## Requirements

* Add WebView console diagnostics for Replay event recording, snapshot capture, session loading, and snapshot diff viewing.
* Add Rust backend diagnostics for git worktree snapshot size, history detail/stats response size, and sub-agent transcript tailing size.
* Log only counts, byte sizes, durations, ids, and threshold flags; never log raw patch, message content, or transcript content.
* Keep existing command signatures, storage schema, and user-facing behavior unchanged.

## Acceptance Criteria

* [ ] WebView console contains `[oom-diagnostics:webview]` entries on Replay capture/load/diff paths.
* [ ] Backend logs contain `[oom-diagnostics:backend]` entries on git/history/transcript paths.
* [ ] Large payloads produce warn-level logs using conservative thresholds.
* [ ] `npx tsc --noEmit` passes.
* [ ] `cd src-tauri && cargo check` passes.

## Definition of Done

* TypeScript type-check passes.
* Rust compile check passes.
* `CHANGELOG.md` includes this diagnostic change under `[TEMP]`.

## Technical Approach

Add small local helper functions in the touched modules to estimate UTF-8 byte sizes and emit structured logs. Keep all logs diagnostic-only and avoid new dependencies.

## Decision (ADR-lite)

**Context**: OOM root cause is still under investigation and changing Replay retention immediately could alter product behavior.

**Decision**: First add targeted diagnostics without changing persistence, loading, or rendering behavior.

**Consequences**: Logs may be noisy on hook-heavy sessions, but the change is reversible and should expose the real memory pressure source before mitigation.

## Out of Scope

* Do not truncate Replay events or patches in this task.
* Do not change history pagination or payload contracts.
* Do not add dependencies or runtime UI.

## Technical Notes

* Relevant specs read: frontend component/state/quality guidelines, backend CLI Hook contracts, backend History Stats contracts, task delivery checklist.
* Repo update check completed: upstream `origin/master`, local/remote count `0 0`.
