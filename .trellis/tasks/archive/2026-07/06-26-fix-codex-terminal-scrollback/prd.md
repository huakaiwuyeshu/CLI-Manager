# Fix Codex Terminal Scrollback Behavior

## Goal

Make Codex terminals opened or restored by CLI-Manager consistently preserve usable scrollback where Codex supports it, without changing PTY internals or redesigning terminal rendering.

## What I already know

* Codex default TUI behavior can use alternate screen and redraw/clear the viewport, so xterm scrollback rows alone cannot preserve all visible frames.
* The installed `codex-cli 0.142.1` supports `--no-alt-screen`, documented as inline mode that preserves terminal scrollback history.
* New project launches already use `src/lib/projectStartupCommand.ts` to append `--no-alt-screen` when `cli_tool` is Codex and `startup_cmd` is empty.
* History resume already uses `codex resume --no-alt-screen <session_id>`.
* Restored persisted terminal sessions reuse the stored `startupCmd` directly, so old saved Codex sessions can still run plain `codex`.
* Hidden terminal tabs currently buffer only 256KB of output before truncating the head, which can make long Codex output reappear with only partial scrollback.

## Requirements

* Normalize restored and duplicated Codex terminal startup commands so legacy plain `codex` sessions get `--no-alt-screen`.
* Do not rewrite explicit user-defined non-Codex commands.
* Avoid adding dependencies.
* Increase or derive hidden-tab output buffering so Codex output is not cut to a tiny tail before xterm receives it.
* Keep xterm normal scrollback behavior and IME scroll protections intact.

## Acceptance Criteria

* [ ] New Codex project sessions still start with `codex --no-alt-screen`.
* [ ] Restored persisted sessions whose command is plain `codex` restart with `codex --no-alt-screen`.
* [ ] Duplicated Codex sessions preserve or add `--no-alt-screen`.
* [ ] Explicit non-Codex startup commands are unchanged.
* [ ] Hidden Codex tab output can exceed 256KB without immediately losing most scrollback before render.
* [ ] TypeScript check passes, or failure is reported with exact reason.

## Definition of Done

* Frontend type-check passes or has a concrete documented blocker.
* GitNexus impact analysis is run before source edits.
* Changes are scoped to command normalization and hidden-output buffering.

## Out of Scope

* Guaranteeing scrollback for every Codex TUI redraw frame.
* Changing Codex config files, hooks, history files, or backend PTY behavior.
* Redesigning terminal scrollbar CSS.
* Adding unlimited scrollback.

## Technical Approach

Use the existing project startup command helper as the single normalization point, extend it to safely normalize Codex command strings beyond `Project`, and call it from restore/duplicate paths. Replace the fixed hidden-output buffer cap with a cap derived from configured terminal scrollback rows, bounded to avoid unbounded memory growth.

## Technical Notes

* Relevant files inspected:
  * `src/lib/projectStartupCommand.ts`
  * `src/stores/terminalStore.ts`
  * `src/components/TerminalTabs.tsx`
  * `src/components/XTermTerminal.tsx`
  * `src/components/HistoryWorkspace.tsx`
  * `src/stores/settingsStore.ts`
* xterm scrollback is configured in `XTermTerminal`, but alternate screen and TUI redraws are outside normal scrollback semantics.
* Existing setting tooltip already warns that Codex TUI clear/redraw content is not guaranteed to enter scrollback.
