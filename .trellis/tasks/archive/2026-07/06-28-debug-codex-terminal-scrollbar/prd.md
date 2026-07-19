# Fix Codex Terminal Scrollbar

## Goal

Prevent Codex terminals from clipping long output inside Codex's own fixed-height TUI area when launched by CLI-Manager.

## Requirements

* Keep the fix scoped to Codex terminal launches.
* Preserve the existing `--no-alt-screen` command normalization.
* Inject `TERM=dumb` only for PTY sessions identified as Codex launches, so Codex avoids rich fixed-height TUI rendering.
* Force mouse-wheel scrolling in Codex sessions to move xterm scrollback instead of being consumed by Codex's fixed-height TUI mouse mode.
* Cover new sessions, split sessions, and restored sessions.
* Do not change xterm container CSS, xterm scrollback settings, PTY backend behavior, or non-Codex terminal launches.
* Avoid logging raw PTY content or secrets.

## Acceptance Criteria

* [ ] Codex PTY creation passes `TERM=dumb` through frontend env vars.
* [ ] New Codex sessions, split Codex sessions, and restored Codex sessions use the same Codex launch detection.
* [ ] In Codex sessions, mouse wheel scrolls xterm history; Ctrl + wheel still adjusts font size.
* [ ] Non-Codex terminal env vars are unchanged except for existing shell runtime monitoring behavior.
* [ ] `--no-alt-screen` normalization remains intact.
* [ ] No dependencies or config changes.
* [ ] `npx tsc --noEmit` passes, or failure is reported with the exact blocker.

## Definition of Done

* Changes are scoped to Codex launch env handling.
* Non-Codex terminal behavior is unchanged.
* TypeScript check is run.

## Technical Approach

Export the existing Codex startup-command detector from `src/lib/projectStartupCommand.ts`, reuse it from `src/stores/terminalStore.ts`, and pass `{ codexLaunch: true }` into `buildPtyEnvVars` so it sets `TERM=dumb` only for Codex PTY launches. In `XTermTerminal`, attach a Codex-only custom wheel handler that calls `terminal.scrollLines(...)` and returns `false` so xterm does not forward the wheel event to Codex mouse mode.

## Out of Scope

* Changing Codex startup command normalization.
* Changing xterm scrollback, CSS, PTY, or hidden-buffer limits.
* Starting the Tauri desktop app for manual runtime verification.

## Technical Notes

* Existing Codex startup normalization is in `src/lib/projectStartupCommand.ts`.
* Existing xterm scrollback and hidden-tab buffering are in `src/components/XTermTerminal.tsx`.
* GitNexus impact analysis for `XTermTerminal.tsx` returned LOW risk.
