# xterm terminal search

## Goal
Add search inside the built-in xterm terminal using the official xterm search addon for terminal buffer search and highlighting.

## Requirements
- Terminal focus + `Ctrl+F` opens an in-terminal search overlay.
- Search uses `@xterm/addon-search`; do not implement manual terminal buffer scanning.
- `Enter` moves to next match, `Shift+Enter` moves to previous match, `Escape` closes search and returns focus to terminal.
- Search overlay must look like terminal UI: monospace, terminal-derived colors, compact border, low-distraction translucent background.
- Do not reuse generic application input/button styles inside the terminal overlay.
- Keep scope local to `XTermTerminal`; do not add toolbar buttons, global Zustand search state, backend changes, or persisted search terms.

## Verification
- TypeScript check passes.
- Frontend build passes.
- Manual app check covers normal terminal, split terminal, and existing history search shortcut behavior.
