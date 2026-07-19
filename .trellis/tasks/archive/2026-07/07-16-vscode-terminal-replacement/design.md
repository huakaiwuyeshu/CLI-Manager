# Technical Design

## Architecture

```text
TerminalTabs / SplitTerminalView
        |
XTermTerminal (thin React host)
        |
TerminalInstanceController
        |
TerminalProcessManager ---- TerminalCapabilityStore
        |
PtyHostSocket (one connection per WebView)
        |
cli-manager-daemon / PtyHost
        |
WindowsConPtyAdapter | UnixPtyAdapter
```

## Transport

- Tauri command `pty_host_get_endpoint` bootstraps `{url, token, protocolVersion, daemonVersion}`.
- WebSocket text frames carry low-frequency requests/responses.
- Binary frames carry output and replay with version, kind, session id, sequence, dimensions and raw bytes.
- Each request has an id; each session output stream has a monotonically increasing sequence.
- xterm write callback acknowledges parsed characters in 5000-char chunks.

## Flow Control

- daemon tracks unacknowledged characters per client/session.
- Above 100000 chars: pause PTY reader delivery.
- Below 5000 chars: resume delivery.
- daemon coalesces data for up to 5ms and flushes on size, resize, exit and attach.
- no active-session output trimming is allowed.

## Replay

- Recorder entry: `{cols, rows, sequence, data}`.
- Resize without data replaces the previous empty resize entry.
- Attach snapshots replay and subscription atomically.
- Frontend applies dimensions and awaits xterm parse commit per replay entry.
- Live frames received during replay are buffered and sequence-deduplicated.
- In-memory replay spills to an app-data spool file instead of dropping active-session output.

## Platform PTY

- Windows: direct ConPTY API, bundled DLL resolution, Job Object, delayed kill/spawn, delayed Git Bash initial resize.
- Unix: `openpty`, controlling terminal, process group, signal and resize ioctl.
- Existing shell resolution, WSLENV, hook env and provider env remain shared launch-policy inputs.

## Frontend Lifecycle

- Hidden terminals remain attached to xterm and keep parsing output.
- Renderer/GPU resources may be downgraded while hidden, but terminal state is not replayed later.
- Resize follows VS Code's normal-buffer threshold and horizontal reflow debounce.
- addons are loaded lazily and disposed symmetrically.

## Rollback

- No runtime old/new switch. Rollback is performed by reverting the implementation commits before release.
- Existing snapshot/resume data remains readable throughout migration.
