# fix realtime stats stale context model

## Goal

Fix the realtime terminal stats panel so a newly opened terminal does not display the previous terminal/session's model context model or context limit before it is bound to its own CLI session.

## Requirements

* When the active terminal has no matching `cliSessionId`, session-level token/context data must render as empty placeholders.
* The model context card must not reuse `dominantModel` or `context_window` from the fallback latest project history session.
* Keep project/session metadata fallback behavior unchanged for non-token cards where it is already intentional.

## Acceptance Criteria

* [ ] Open a new terminal in the same project after another terminal has history: model and context limit show empty placeholders until the new terminal reports its own CLI session.
* [ ] Existing bound terminal sessions still show model, reasoning effort, current context, context limit, remaining context, and progress normally.
* [ ] Type check passes.

## Definition of Done

* Typecheck passes.
* Changes are limited to the minimal affected frontend code.
* No unrelated dirty worktree changes are reverted.

## Technical Approach

Gate model-context display fields with the same `tokensBound` condition already used for token/trend/tool cards. Keep `latestSession` fallback for project/session metadata and today usage.

## Out of Scope

* Changing backend history parsing.
* Changing model price/context lookup tables.
* Refactoring realtime stats panel layout.

## Technical Notes

* Candidate implementation file: `src/components/terminal/TerminalStatsPanel.tsx`.
* `ModelContextCard` currently receives `session={boundSession}` but still receives `displayModel={stats.dominantModel}` and `exactContextLimit={session.usage?.context_window ?? null}` from `latestSession`, which can be the previous/latest project history session.
* GitNexus impact for `TerminalStatsPanel`: LOW, 0 direct callers, 0 affected processes.
