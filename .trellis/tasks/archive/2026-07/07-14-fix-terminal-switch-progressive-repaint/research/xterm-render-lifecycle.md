# xterm Render Lifecycle

## Sources

- Context7 library: `/xtermjs/xterm.js`
- xterm API documentation: `Terminal.refresh`, `Terminal.onRender`
- xterm RenderService source: hidden/off-screen refresh suppression

## Findings

- `Terminal.refresh(start, end)` schedules a redraw at the next rendering opportunity; it does not mean pixels are already complete when the method returns.
- `Terminal.onRender` is a public disposable event and reports the start/end rows that were rendered.
- xterm pauses rendering while its viewport is hidden/off-screen and records a pending full refresh for visibility restoration.
- Therefore a fixed number of animation frames is not a reliable completion signal. The public `onRender` row range is the appropriate primary signal, with a timeout fallback for paused/missing events.

## Repository Mapping

- `XTermTerminal` already hides the terminal container while inactive output is replayed.
- The same container-level `visibility` mechanism can cover a visibility-restoration refresh without recreating the terminal or touching PTY state.
- A full viewport completion event must cover row `0` through the current `terminal.rows - 1`; row counts may change during fit, so the check should use the current row count.
- Listener and timeout cleanup is required on repeated refreshes, visibility loss, and component unmount.
