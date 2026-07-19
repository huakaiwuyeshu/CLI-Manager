# fix-claude-context-limit-resolution

## Goal

Fix context window display for Claude Code and Codex statistics by using one resolver chain instead of relying only on log-provided `context_window`.

## Requirements

- Backend history parsing keeps Codex `payload.info.model_context_window` support.
- Backend Claude parsing scans explicit context limit fields when present, including `context_window`, `max_input_tokens`, `max_context_tokens`, and `model_context_window`.
- Backend does not guess a Claude limit when logs do not contain an explicit field.
- Frontend exposes one `resolveContextLimit(model, exactLimit?)` path:
  exact log value, then cached model metadata, then local model-name rules, then unknown.
- Model pricing sync stores explicit context metadata from LiteLLM/OpenRouter when present.
- History stats and realtime stats use the shared resolver for context limits.
- Realtime context usage remains tied to the token-bound current terminal session; only model name and limit display may fall back to loaded session/model metadata.

## Acceptance Criteria

- [ ] Codex sessions still show exact context limits from token count events.
- [ ] Claude sessions can show exact limits when logs include explicit context limit fields.
- [ ] Models with cached metadata can show context limits even when logs omit them.
- [ ] Unknown models without metadata remain unknown instead of guessed beyond local rules.
- [ ] Realtime stats do not show current context usage unless tokens are bound to the current terminal.
- [ ] TypeScript and Rust checks pass, or any pre-existing blockers are reported.

## Out of Scope

- Adding a database migration solely for context metadata.
- Broad refactors of stats UI, pricing sync, or history parsing.
- Guessing unknown remote provider fields.

## Technical Notes

- User provided the implementation plan and requested direct repair.
- Expected files: `src-tauri/src/commands/history.rs`, `src/lib/modelPricing.ts`, `src/stores/modelPricingStore.ts`, `src/components/stats/termStatsCards.tsx`, `src/components/terminal/TerminalStatsPanel.tsx`, and possibly `src/lib/types.ts`.
