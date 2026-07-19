# Technical Design

## 1. Protocol and compatibility

- Control protocol version becomes 2; binary header stays version 1 and adds feature-gated kinds for input, checkpoint, and replay reset.
- `DaemonInfo` and `AuthOk` include protocol versions and string features with serde defaults for old files/daemons.
- `pty_host_get_endpoint` returns `websocket` only when the daemon advertises required features, otherwise `legacy`.
- Legacy transport proxies attach/write/resize/close/ack through the existing main-process NDJSON connection and Tauri events. It cannot create new sessions.

## 2. Replay model

- `SessionReplayState` owns an optional serialized checkpoint, a 2 MiB memory tail, a disk spool, oldest/latest sequence and truncation metadata.
- Frontend creates a checkpoint after an xterm write barrier. The checkpoint sequence is the latest output sequence whose write callback completed.
- Accepting a checkpoint discards stored raw frames at or before that sequence while retaining later frames.
- Attach with `afterSequence` sends only a contiguous delta when possible; otherwise it sends replay-reset, checkpoint, then raw delta.
- Attach captures spool length, memory frames and latest sequence under the per-session lock, releases the lock, then streams frames. Concurrent live frames are held in a bounded per-client attach queue.
- Raw delta quota is 10 MiB per session and 128 MiB total. Quota loss is represented explicitly in attach metadata and localized UI output.

## 3. Flow control

- PTY reader never waits on a global condition variable.
- ACK accounting remains per client/session. Replay producer may wait for only that client to reach the low watermark.
- Live pending data over 2 MiB disconnects only the slow client. Reconnect uses `afterSequence` and reset/delta attach.

## 4. Process traits and platform behavior

- Create/attach return OS and optional Windows PTY traits: backend, build number, ConPTY DLL usage.
- xterm starts without `windowsPty`; controller applies traits after process ready.
- DA1 handler is registered only for ConPTY. `reflowCursorLine` is enabled only for ConPTY DLL.
- Binary xterm input is sent as byte-oriented WebSocket frames.
- Resize carries cols/rows and optional pixel dimensions; platform implementations validate bounds.
- Native Windows ConPTY spawn/kill operations share a 300 ms throttle window; DLL mode skips it.

## 5. Frontend ownership

- `TerminalProcessManager` selects transport and owns process/output contracts.
- `TerminalInstanceController` owns the xterm instance boundary, process traits, input, output commits, checkpoint barriers and visibility behavior.
- `XTermTerminal` remains the React/UI wrapper. The unused capability store is removed.
- Fit/Unicode are base addons; Search and Image load on demand; Serialize preloads during idle and loads on first snapshot as fallback.

## 6. Rollout

- Land protocol compatibility before changing replay format.
- New protocol fields remain optional for old NDJSON peers.
- Each phase keeps existing WebSocket output behavior testable and reversible.
