# fix-history-session-review

## Goal
Fix all approved history session review findings from `.claude/plan/review-history-session.md` with minimal changes.

## Scope
- Harden `history_get_session` path/source/project validation in Rust.
- Remove duplicate global search trigger on source changes.
- Refresh search results after manual session refresh.
- Reload stats and reset stale filters when source changes.
- Clarify load-more states and Markdown link preview behavior.
- Reuse existing history index for search/prompt hot paths where practical.
- Add minimal backend regression coverage for path validation.

## Validation
- `npx tsc --noEmit`
- `cd src-tauri && cargo check`
- `cd src-tauri && cargo test`
