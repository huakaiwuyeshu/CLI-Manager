# Session History Transcript Rendering

## Goal

Improve CLI-Manager session history detail rendering so long Claude/Codex session context logs are easier to scan, with structural blocks, semantic highlights, and controlled expansion for noisy sections.

## Requirements

- Keep the existing `SessionDetailPane` virtualized message list and history data model.
- Add a history-specific transcript content renderer for message bodies.
- Continue using shared `MarkdownContent` for normal Markdown rendering; do not import `react-markdown` directly from history components.
- Detect and visually separate XML-ish transcript blocks such as `<session-context>`, `<current-state>`, `<workflow>`, and `<system-reminder>`.
- Highlight semantic tokens in transcript content:
  - workflow/status tokens: `no_task`, `planning`, `in_progress`, `completed`, `failed`.
  - Git status prefixes: `M`, `??`, `A`, `D`, `R`.
  - paths such as `src/...`, `.trellis/...`, `C:\...`, `D:\...`.
  - short commit hashes.
- Collapse noisy long content where useful, especially workflow/system reminder blocks and long lists, while keeping quick access to full content.
- Preserve existing search highlighting through the existing `query` prop path.
- Do not add dependencies.
- Do not change backend parsing, database schema, or history storage.

## Acceptance Criteria

- [ ] Session history detail renders normal Markdown content through the existing shared Markdown component.
- [ ] Sample transcript sections like `<session-context>`, `<current-state>`, and `<workflow>` are visually distinguishable.
- [ ] Workflow/status tokens have readable colored badges.
- [ ] Git changes and paths are easier to scan than plain text.
- [ ] Long workflow/system reminder style blocks can be collapsed/expanded.
- [ ] Existing message search highlighting still works inside rendered content.
- [ ] No new runtime dependency is added.
- [ ] `npx tsc --noEmit` passes.

## Definition of Done

- Frontend typecheck passes.
- GitNexus impact is checked before editing touched symbols.
- Current diff is reviewed with `gitnexus_detect_changes` before final reporting.
- Manual UI verification checklist is provided because this project requires human runtime UI validation.

## Technical Approach

Add a small render-layer adapter:

- `SessionTranscriptContent.tsx`: splits message text into lightweight transcript sections, renders structural cards, and delegates ordinary Markdown to `MarkdownContent`.
- `sessionTranscriptHighlighter.tsx`: renders inline semantic highlights using React nodes, without `dangerouslySetInnerHTML`.
- `SessionDetailPane.tsx`: replaces direct `MarkdownContent` usage for history messages with `SessionTranscriptContent`.
- `App.css`: adds `ui-history-transcript-*` styles aligned with the existing terminal/developer UI visual language.

The parser stays intentionally simple: regex-based block boundaries and line-level rendering only. No new AST parser, no backend changes, no data model changes.

## Decision (ADR-lite)

**Context**: Session history content is not just Markdown. It contains structured logs, XML-ish tags, workflow states, task lists, paths, and git changes. Plain Markdown rendering loses that structure.

**Decision**: Keep the existing Markdown renderer for normal content, but add a history-only transcript render layer that detects common session-log structures and applies semantic styling.

**Consequences**:

- Better readability with minimal architecture change.
- Low compatibility risk because storage/parsing data remains unchanged.
- Regex block detection may not understand every future transcript format; unsupported content still falls back to Markdown/plain text.

## Out of Scope

- Backend history parser changes.
- SQLite migrations.
- New markdown/highlight dependencies.
- Opening local file paths from transcript content.
- AI summaries or automatic session summarization.
- Full JSONL viewer or line-numbered log viewer.
- Starting the Tauri desktop app for AI-side visual verification.

## Technical Notes

- Sample file inspected: `C:\Users\Administrator\.claude\projects\D--work-pythonProject-CLI-Manager\0a35c52e-377a-4516-bac0-23ad047b3e0c\tool-results\hook-35e6ecd1-f213-4a47-8c8f-ffc1f5640307-1-additionalContext.txt`.
- Current direct render site: `src/components/history/SessionDetailPane.tsx` uses `MarkdownContent` for each message.
- Shared Markdown convention: `.trellis/spec/frontend/component-guidelines.md` requires feature components to use `src/components/ui/MarkdownContent.tsx` and keep `skipHtml` safety policy.
- Frontend quality guideline: `.trellis/spec/frontend/quality-guidelines.md` requires type/static checks and manual runtime UI verification for visual changes.
- GitNexus impact for `SessionDetailPane`: LOW, 0 direct callers/processes affected.
- `MarkdownContent` was not found by GitNexus symbol lookup; this task avoids changing it.

## Research Notes

### UI/UX findings

- Developer tools/IDE products fit dark mode + minimalism, with terminal/real-time monitor visual patterns.
- Dark OLED style should use high contrast and restrained glow rather than heavy neon effects.
- Developer typography works best with mono for code/log tokens and readable sans for surrounding UI.
- Long React lists should remain virtualized; this task keeps the existing virtualized message list.

### Repo constraints

- Existing history detail already uses `@tanstack/react-virtual`.
- Shared Markdown renderer already supports GFM, code highlighting, safe HTML skipping, and query highlights.
- The app has no frontend test framework; `npx tsc --noEmit` is the required static check.
