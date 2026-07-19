# VS Code 1.130 Terminal Architecture Research

Source root: `D:/work/pythonProject/vscode-main`

## Source Snapshot

- VS Code `1.130.0`
- `@xterm/xterm` `6.1.0-beta.288`
- `@xterm/addon-webgl` `0.20.0-beta.287`
- `node-pty` `1.2.0-beta.13`

## Adopted Patterns

- `terminalProcessManager.ts`: process lifecycle, pre-launch input queue, process properties, ACK buffering and seamless relaunch.
- `terminalProcess.ts`: 100000/5000 flow-control watermarks, 5000-char ACKs, ConPTY kill/spawn throttle, delayed shutdown and DA1 readiness handling.
- `terminalDataBuffering.ts`: per-terminal 5ms data coalescing before IPC.
- `localTerminalBackend.ts`: renderer direct connection to PtyHost, bypassing the main-process proxy for high-frequency events.
- `ptyHostService.ts`: lazy host startup, heartbeat, create timeout, listener ownership and bounded restart attempts.
- `ptyService.ts`: persistent process ownership, replay, reconnect state, serialized terminal layout and orphan detection.
- `terminalRecorder.ts`: resize-aware replay entries instead of concatenated raw output.
- `terminalResizeDebouncer.ts`: immediate small-buffer resize; hidden idle resize; vertical immediate and horizontal 100ms debounce for large buffers.
- `xtermTerminal.ts`: lazy addons, WebGL fallback, context-loss handling, physical-wheel smooth scrolling and pixel-aware grid sizing.
- `terminalCapabilityStore.ts` / `shellIntegrationAddon.ts`: typed capability registration and nonce-backed shell integration trust.

## CLI-Manager Gaps

- PTY output currently passes daemon TCP → Tauri main → Base64 event → WebView.
- No character ACK flow control; active write queue may trim and discard output.
- Hidden terminals stash raw output and replay it later, which is unsafe for TUI incremental redraw sequences.
- daemon replay is a raw byte ring and does not preserve resize boundaries.
- PTY calls are scattered across Store, components and hooks.
- xterm addons are eagerly constructed and loaded.
- PtyHost responsiveness and listener restart ownership are incomplete.
- Current resize path uses FitAddon/double RAF rather than horizontal reflow-aware debouncing.

## Rust Mapping

- VS Code MessagePort → authenticated loopback binary WebSocket.
- node-pty → direct Windows ConPTY and Unix PTY adapters.
- XtermSerializer in Node PtyHost → resize-aware recorder + xterm checkpoints + disk spool.
- Workbench services → small project-local controllers and Zustand-facing adapters.
