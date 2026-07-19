# Fix Codex Subagent Output Parsing

## Goal

When Codex auto-splits a sub-agent transcript pane, the pane must parse and display the child agent's final output even when Codex only provides the independent child transcript path on `SubagentStop`.

## Confirmed Facts

- The user reproduced a Codex sub-agent run where auto split succeeded but no child output appeared in the transcript pane.
- App log `C:\Users\Admini\AppData\Local\com.cli-manager.app\logs\cli-manager.log` shows:
  - `SubagentStart` for agent `019efa2a-f97d-7953-930b-43a12e7a3ab1` had `hasAgentTranscriptPath=false` and `hasTranscriptPath=true`.
  - Frontend resolved the source as `parent-jsonl` with reason `missing child transcript path`.
  - Frontend correctly skipped tailing the full parent transcript.
  - `SubagentStop` for the same agent later had `hasAgentTranscriptPath=true`.
  - Current frontend resolved the stop target, but only marked it finished; it did not upgrade/subscribe to the child transcript path from the stop payload.
- `src/App.tsx` routes `AgentToolStop` through `openSubagentTranscript(...).finally(finishSubagentTranscript(...))`, but routes `SubagentStop` directly to `finishSubagentTranscript(...)`.
- `src/stores/terminalStore.ts` can already dedupe an existing pseudo-session by `agentId`, merge a new `child-jsonl` source, and subscribe to that child transcript.
- `.trellis/spec/backend/cli-hook-contracts.md` already requires stop routing by `agentId` and allows stop events to finish matching panes without guessing.

## Requirements

- Codex `SubagentStop` payloads that include an independent `agentTranscriptPath` must be allowed to update the existing sub-agent pseudo-session before finish handling.
- The existing protection against rendering the full parent transcript as child output must remain intact.
- Existing Claude behavior and AgentTool fallback behavior must remain unchanged.
- The fix should be minimal and avoid unrelated UI or backend refactors.

## Acceptance Criteria

- [x] Given a Codex `SubagentStart` without `agentTranscriptPath`, the pane may open in `parent-jsonl` degraded state and must not tail the parent transcript.
- [x] Given a later matching Codex `SubagentStop` with `agentTranscriptPath`, the existing pane upgrades to `child-jsonl` and subscribes to that path before it is marked ended.
- [x] The transcript parser can render the child Codex final output from the subscribed JSONL content.
- [x] `npx tsc --noEmit` passes.
- [x] If backend code is touched, `cd src-tauri && cargo check` passes.

## Out of Scope

- Changing hook installation format.
- Rendering full parent Codex transcripts as child output.
- Changing pane layout behavior.
- Broad parser rewrites beyond what is needed for the reproduced output shape.

## Validation Notes

- GitNexus MCP tools were not available in the current session. `npx gitnexus analyze` failed on Windows with a missing native build for `tree-sitter-dart`, so symbol-level GitNexus impact analysis is unavailable. Local blast radius will be constrained to the hook event listener and transcript store path.
- 2026-06-25 follow-up: user verified auto split still opened empty. Latest log showed `SubagentStop` now resolved `child-jsonl`, but no subscribe/append log followed. Root cause: Stop-only child transcript subscription was fire-and-forget and the pane could be finished/closed before the initial existing JSONL content reached the store.
- Fix: `subagent_transcript_subscribe` now returns `path` plus `initialContent`, starts tailing from the consumed offset, and frontend awaits subscription before finishing Stop handling. Codex late transcript panes stay open for 10 seconds after Stop so the recovered final output is visible.
- Verified with real Codex child JSONL `C:\Users\Admini\.codex\sessions\2026\06\24\rollout-2026-06-24T23-55-13-019efa57-b95e-7723-8b6e-2b818e17722c.jsonl`: existing parser extracts the assistant final output from `response_item.payload.content[output_text]`.
- Checks passed: `npx tsc --noEmit`; `cd src-tauri && cargo check`; `cd src-tauri && cargo test subagent_transcript -- --nocapture`; `git diff --check -- src-tauri/src/commands/subagent_transcript.rs src/stores/terminalStore.ts src/App.tsx`.
- Changelog updated under `V1.1.9` with the Codex sub-agent split-pane empty-output fix.
- Code-spec updated in `.trellis/spec/backend/cli-hook-contracts.md` to document subscribe `{ path, initialContent }`, late `SubagentStop` child transcript upgrades, and the complete-line offset regression test.
