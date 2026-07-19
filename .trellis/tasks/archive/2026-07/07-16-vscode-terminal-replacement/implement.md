# Implementation Plan

1. Add regression tests and shared protocol/types without changing runtime behavior.
2. Align xterm packages and introduce XtermTerminal/XtermAddonLoader/ResizeDebouncer.
3. Add TerminalProcessManager and route all frontend PTY access through it while retaining the current bridge.
4. Add authenticated WebSocket transport and binary output/replay frames.
5. Add flow control, sequence tracking, heartbeat and resize-aware recorder to daemon.
6. Implement direct Windows ConPTY and Unix PTY adapters behind PtyHost.
7. Switch terminal runtime to WebSocket/PtyHost, remove inactive replay and Base64 event hot path.
8. Migrate all remaining direct invoke/listen call sites.
9. Remove `portable-pty`, old manager path and obsolete protocol code.
10. Run static/Rust/script tests, update specs/docs/NOTICE/CHANGELOG and perform change-impact review.

## Verification

- `git diff --check`: passed.
- `npx tsc --noEmit`: passed.
- `cargo fmt --check`: passed after formatting.
- `cargo check`: passed on Windows 11.
- `cargo test`: 418 passed, 0 failed, including direct ConPTY spawn/write/read/resize, ConPTY Ctrl+C flag regression, binary WebSocket output, replay ordering data structures, flow-control cleanup and protocol tests.
- GitNexus `detect_changes(scope="all")`: CRITICAL, expected for the intentional terminal transport/PTY architecture replacement; reviewed core `PtyManager.create`, `DaemonServer.handle_frame`, `run` and `XTermTerminal` contexts.

## Remaining Manual / Platform Validation

- Do not claim macOS/Linux build verification from this Windows host; Unix PTY code still requires real macOS/Linux CI or a machine with the required GTK/WebKit sysroot.
- Tauri GUI, production bundle, 100 MiB output hash, daemon restart/attach, shell matrix, fullscreen/split/Workspan, tray/background and hook-installed/uninstalled scenarios require human desktop verification.
