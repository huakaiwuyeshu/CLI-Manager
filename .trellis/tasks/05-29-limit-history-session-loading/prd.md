# Limit History Session Loading

## Goal

Reduce freezes when opening or refreshing the history workspace by preventing the app from loading and processing too many history sessions at once.

## What I already know

- User reported that history session loading is still busy and the app can freeze when too much is loaded at once.
- `src/components/HistoryWorkspace.tsx` already limits rendered session rows with `SESSION_PAGE_SIZE = 200` and only increases visible rows on scroll/load-more.
- `src/stores/historyStore.ts` calls `history_list_sessions` with `DEFAULT_SESSION_LIMIT = 500` on normal session loading.
- `src-tauri/src/commands/history.rs` accepts a `limit` in `history_list_sessions`, but calls `refresh_history_index(false)` before applying the limit.
- `refresh_history_index(false)` can rebuild an index by collecting all session files and scanning each file to compute title/message count/stats before returning sorted entries.
- GitNexus impact checks for `history_list_sessions`, `loadSessions`, and `HistoryWorkspace` returned LOW risk and no upstream affected flows.

## Assumptions (temporary)

- The main freeze risk is backend/index work and frontend state normalization for large session sets, not only DOM row rendering.
- The MVP should avoid broad redesign of the stats/search/index system.
- Existing command names and returned summary shape should stay compatible unless explicitly approved.

## Open Questions

- None for MVP.

## Requirements (evolving)

- Use backend-backed batch loading for the normal history session list.
- Initial history workspace load must request/process a bounded number of sessions.
- The user must still be able to load more sessions intentionally.
- Existing source filter, session open, and search behavior should remain understandable and not silently break.
- Avoid broad redesign of stats/search; this task focuses on normal list loading.

## Acceptance Criteria (evolving)

- [ ] Opening history does not process an unbounded session list in the normal list-load path.
- [ ] The list initially shows a smaller bounded batch.
- [ ] The UI provides a way to request more sessions if available.
- [ ] Source filtering still applies to loaded sessions.
- [ ] TypeScript check passes for frontend changes.
- [ ] `cargo check` passes if backend code changes.

## Definition of Done (team quality bar)

- Tests/checks run where practical: `npx tsc --noEmit`; `cd src-tauri && cargo check` if Rust changes.
- Existing Tauri command signatures remain stable unless the final plan explicitly changes them.
- No broad refactor or new dependency.
- Cross-layer data shape stays explicit between Rust command and Zustand store.

## Out of Scope (explicit)

- Full virtualized list rewrite unless the selected approach requires it.
- Rebuilding the whole history analytics/statistics architecture.
- Changing global history search semantics unless explicitly chosen.
- Adding new dependencies.

## Technical Notes

- Relevant files inspected:
  - `src/components/HistoryWorkspace.tsx`
  - `src/components/history/HistoryListPane.tsx`
  - `src/stores/historyStore.ts`
  - `src-tauri/src/commands/history.rs`
- Relevant guidelines read:
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/backend/index.md`
  - `.trellis/spec/guides/index.md`
  - `.trellis/spec/guides/cross-layer-thinking-guide.md`
  - `.trellis/spec/guides/code-reuse-thinking-guide.md`
- Current data flow: HistoryWorkspace opens → Zustand `loadSessions` → Tauri `history_list_sessions` → Rust history index/file scan → summary array → frontend normalize/meta sort/render.

## Feasible approaches

### Approach A: Reduce frontend requested batch only

- How it works: lower `DEFAULT_SESSION_LIMIT` and possibly align visible page size.
- Pros: smallest code change.
- Cons: may not fix freezes if `refresh_history_index` still scans all files before limiting.

### Approach B: Add bounded list loading with backend offset/limit metadata (Recommended)

- How it works: make `history_list_sessions` support bounded slices and let the store append batches via “load more”. Keep existing summary shape stable or add minimal pagination metadata if needed.
- Pros: aligns with user request, keeps UI predictable, avoids loading hundreds/thousands at once.
- Cons: touches Rust command contract and Zustand state; needs typecheck + cargo check.

### Approach C: Keep backend list as-is, only virtualize/render less

- How it works: keep all summaries in memory but render a smaller window.
- Pros: avoids backend contract changes.
- Cons: does not solve backend/file-scan or frontend normalization cost, so likely insufficient.

## Expansion Sweep

- Future evolution: history list may need true cursor pagination and stale-index refresh indicators.
- Related scenarios: stats/search may still intentionally scan broadly; this task should focus on normal session list loading.
- Failure/edge cases: source switching, refresh, active session disappearing from current loaded batch, and empty results need clear behavior.

## Decision (ADR-lite)

**Context**: The current UI only limits rendered rows, while the backend may still refresh/scan a large history index before applying the list limit.

**Decision**: Use backend-backed batch loading for the normal history session list MVP.

**Consequences**: This should reduce one-shot loading pressure, but it touches both Rust and Zustand and needs `npx tsc --noEmit` plus `cd src-tauri && cargo check`.
