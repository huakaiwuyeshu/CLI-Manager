# Research: cmux Agent Panes

- **Query**: Research https://github.com/manaflow-ai/cmux for how it implements multi-agent / Claude Code pane launching. Focus on whether panes are real processes/terminals, how agents are launched, how sessions are tracked, UI model, and what CLI-Manager would need to implement a similar built-in feature.
- **Scope**: mixed (external cmux source + local CLI-Manager specs/code contracts)
- **Date**: 2026-06-22

## Findings

### Files Found

| File Path | Description |
|---|---|
| `manaflow-ai/cmux:Sources/AgentSessionProvider.swift` | Defines built-in agent providers, executable names, launch argv, transport kind, and auto-start behavior. |
| `manaflow-ai/cmux:Sources/AgentExecutableResolver.swift` | Resolves provider executables from configured paths/PATH and builds `AgentSessionLaunchPlan`. |
| `manaflow-ai/cmux:Sources/AgentSessionLaunchPlan.swift` | Holds executable URL, arguments, environment, and working-directory env overrides. |
| `manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift` | Starts provider subprocesses, wires stdin/stdout/stderr pipes, tracks running sessions, parses provider output, emits UI events. |
| `manaflow-ai/cmux:Sources/Panels/AgentSessionRunningSession.swift` | Per-running-session state: UUID, provider, executable path, argv, `Process`, pipes, Codex/OpenCode helper state, stdout/stderr buffers. |
| `manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift` | Owns the `WKWebView` bridge, loads bundled web UI, handles JS bridge methods (`provider.start`, `provider.writeLine`, `provider.stop`). |
| `manaflow-ai/cmux:Sources/Panels/AgentSessionPanel.swift` | Native panel model for an agent session; distinct `PanelType.agentSession`, display title, dirty/running flag. |
| `manaflow-ai/cmux:Sources/Panels/AgentSessionPanelView.swift` | SwiftUI view that renders agent panels through `AgentSessionWebRenderer`, not a terminal component. |
| `manaflow-ai/cmux:webviews/src/agent-session/shared/bridge.ts` | Browser-side bridge to native `webkit.messageHandlers.agentSession` and native-to-web event fanout. |
| `manaflow-ai/cmux:webviews/src/agent-session/shared/types.ts` | Webview types for providers, app context, attachments, and provider events. |
| `manaflow-ai/cmux:webviews/src/agent-session/shared/sessionModel.ts` | Webview reducer/state machine for provider list, start/write/stop, transcript, status, logs, and auto-start. |
| `manaflow-ai/cmux:Sources/Panels/CodexAppServerSession.swift` | Codex app-server JSON-RPC/session/thread adapter used after launching `codex app-server --listen stdio://`. |
| `manaflow-ai/cmux:Sources/Panels/ClaudeStreamJSONAccumulator.swift` | Parses Claude Code `stream-json` lines into assistant text deltas and turn-complete markers. |
| `manaflow-ai/cmux:Sources/RestorableAgentTypes.swift` | Enumerates restorable agent kinds and hook-state file naming. |
| `manaflow-ai/cmux:Sources/RestorableAgentSession.swift` | Builds resume/fork commands for agents, including Claude `--resume <id> --fork-session`. |
| `manaflow-ai/cmux:Sources/SessionIndexStore.swift` | Index/cache for historical Claude/session metadata and drag registry for session entries. |
| `manaflow-ai/cmux:docs/agent-hooks.md` | cmux documentation for agent hook concepts. |
| `.trellis/spec/backend/cli-hook-contracts.md` | CLI-Manager hook/subagent transcript contracts relevant to built-in agent pane session binding. |
| `.trellis/spec/backend/terminal-runtime-monitoring-contracts.md` | CLI-Manager PTY/session status contracts. |
| `.trellis/spec/frontend/state-management.md` | CLI-Manager pane-tree/session state contracts, including split moves that must not duplicate PTYs. |
| `src-tauri/src/commands/terminal.rs` | Existing CLI-Manager Tauri command boundary for PTY creation/writes/resizes/closes. |
| `src-tauri/src/pty/manager.rs` | Existing CLI-Manager PTY process/session manager and `pty-output-{sessionId}` events. |
| `src/App.tsx` | Existing CLI-Manager hook event listener for `claude-hook-notification` and subagent transcript handling. |
| `src/stores/terminalPaneTree.ts` | Existing CLI-Manager pane-tree primitives for split layout and session placement. |

### Code Patterns

#### Are cmux agent panes real processes/terminals?

cmux agent panes are **real provider subprocesses**, but they are **not ordinary terminal/PTY panes** in the built-in agent UI path.

- Provider processes are launched with `Foundation.Process`, not a terminal emulator or PTY. `AgentSessionProcessStore.start` creates a UUID `sessionId`, a `Process`, `Pipe`s for stdin/stdout/stderr, assigns `process.executableURL`, `process.arguments`, `process.environment`, and optional `process.currentDirectoryURL`, then calls `process.run()` (`manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:19`, `manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:23`, `manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:36`, `manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:41`, `manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:103`).
- The per-session state explicitly stores `process: Process`, `stdin: Pipe`, an input writer, output buffers, and provider-specific adapters (`CodexAppServerSession`, Claude stream accumulator, OpenCode loopback IDs) (`manaflow-ai/cmux:Sources/Panels/AgentSessionRunningSession.swift:3`, `manaflow-ai/cmux:Sources/Panels/AgentSessionRunningSession.swift:9`, `manaflow-ai/cmux:Sources/Panels/AgentSessionRunningSession.swift:13`, `manaflow-ai/cmux:Sources/Panels/AgentSessionRunningSession.swift:24`).
- The UI is a native `AgentSessionPanel` rendered through `AgentSessionWebRenderer`/`WKWebView`, not a terminal component. `AgentSessionPanel` has `panelType: .agentSession` and a `rendererSession`; `AgentSessionPanelView` shows `AgentSessionWebRenderer` when visible (`manaflow-ai/cmux:Sources/Panels/AgentSessionPanel.swift:5`, `manaflow-ai/cmux:Sources/Panels/AgentSessionPanel.swift:7`, `manaflow-ai/cmux:Sources/Panels/AgentSessionPanel.swift:12`, `manaflow-ai/cmux:Sources/Panels/AgentSessionPanelView.swift:13`, `manaflow-ai/cmux:Sources/Panels/AgentSessionPanelView.swift:14`).
- Native code emits structured events (`provider.started`, `provider.output`, `provider.activity`, `provider.turnComplete`, `provider.exit`) to the webview; the web UI renders a transcript/log, not raw terminal output (`manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:614`, `manaflow-ai/cmux:webviews/src/agent-session/shared/types.ts:132`).

#### How agents are launched

cmux models agent providers as a small enum for the built-in pane path:

- `AgentSessionProviderID` cases are `codex`, `claude`, and `opencode` (`manaflow-ai/cmux:Sources/AgentSessionProvider.swift:3`).
- Executable names are direct CLI executable names: `codex`, `claude`, `opencode` (`manaflow-ai/cmux:Sources/AgentSessionProvider.swift:21`).
- Launch arguments differ by provider:
  - Codex: `app-server --listen stdio://` (`manaflow-ai/cmux:Sources/AgentSessionProvider.swift:34`).
  - Claude Code: `-p --output-format stream-json --input-format stream-json --include-partial-messages --verbose` (`manaflow-ai/cmux:Sources/AgentSessionProvider.swift:36`).
  - OpenCode: `serve --hostname 127.0.0.1 --port 0 --print-logs` (`manaflow-ai/cmux:Sources/AgentSessionProvider.swift:44`).
- Transport kind is provider-specific: Codex uses `stdio-jsonrpc`, Claude uses `stdio-jsonl`, OpenCode uses `http-loopback` (`manaflow-ai/cmux:Sources/AgentSessionProvider.swift:49`).
- Auto-start is disabled for Claude but enabled for Codex/OpenCode (`manaflow-ai/cmux:Sources/AgentSessionProvider.swift:60`).
- `AgentExecutableResolver.resolve` checks configured executable path first, then PATH/search directories, skips cmux app-bundled provider binaries/shims/wrappers, and returns a launch plan with executable URL, provider launch args, and a runtime PATH with the executable directory first (`manaflow-ai/cmux:Sources/AgentExecutableResolver.swift:28`, `manaflow-ai/cmux:Sources/AgentExecutableResolver.swift:35`, `manaflow-ai/cmux:Sources/AgentExecutableResolver.swift:56`, `manaflow-ai/cmux:Sources/AgentExecutableResolver.swift:155`).
- The launch plan can override `PWD` with the pane working directory and injects random OpenCode server credentials when needed (`manaflow-ai/cmux:Sources/AgentSessionLaunchPlan.swift:9`, `manaflow-ai/cmux:Sources/AgentSessionLaunchPlan.swift:11`, `manaflow-ai/cmux:Sources/AgentSessionLaunchPlan.swift:23`).
- The JS/web UI calls `provider.start`; the native coordinator resolves the executable and calls `processStore.start(plan:workingDirectory:)`, returning `sessionId`, `providerId`, `executablePath`, and `arguments` (`manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:572`, `manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:587`, `manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:595`, `manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:599`).

#### Input/output protocol per provider

- Claude Code: cmux writes JSONL user messages to stdin. `writeClaudeStreamJSON` wraps prompt text as `{ type: "user", message: { role: "user", content: [{ type: "text", text }] } }` plus newline (`manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:596`). Claude stdout is parsed by `ClaudeStreamJSONAccumulator`, which consumes JSON lines, emits text deltas from `content_block_delta.delta.text` or full assistant messages, and treats `result`, `message_stop`, or `done` as turn completion (`manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:297`, `manaflow-ai/cmux:Sources/Panels/ClaudeStreamJSONAccumulator.swift:16`, `manaflow-ai/cmux:Sources/Panels/ClaudeStreamJSONAccumulator.swift:31`, `manaflow-ai/cmux:Sources/Panels/ClaudeStreamJSONAccumulator.swift:74`).
- Codex: cmux launches the Codex app-server over stdio JSON-RPC. After `process.run()`, it starts `CodexAppServerSession`, sends `initialize`, then starts/drains a Codex thread and maps notifications such as `item/agentMessage/delta` to stdout deltas and `item/...completed`/`turn/...` to turn completion (`manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:55`, `manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:105`, `manaflow-ai/cmux:Sources/Panels/CodexAppServerSession.swift:48`, `manaflow-ai/cmux:Sources/Panels/CodexAppServerSession.swift:65`, `manaflow-ai/cmux:Sources/Panels/CodexAppServerSession.swift:202`).
- OpenCode: cmux launches a loopback HTTP server, parses the provider output for the server URL, creates an OpenCode session over HTTP, posts prompts to `/session/{id}/prompt_async`, and consumes an event stream from `/event` (`manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:275`, `manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:360`, `manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:401`, `manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:430`, `manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:461`).

#### How sessions are tracked

- Built-in pane runtime tracking is in-memory per panel: `AgentSessionWebRendererCoordinator` owns an `AgentSessionProcessStore`; the store has `sessions: [String: AgentSessionRunningSession]` and currently rejects starting more than one provider process in that pane (`guard sessions.isEmpty else throw sessionAlreadyRunning`) (`manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:23`, `manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:15`, `manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:19`).
- Session IDs are native UUID strings created at process start, not necessarily provider-native IDs. Provider-specific IDs are stored separately when available, e.g. `threadID` for Codex and `openCodeSessionID` for OpenCode (`manaflow-ai/cmux:Sources/Panels/AgentSessionProcessStore.swift:23`, `manaflow-ai/cmux:Sources/Panels/CodexAppServerSession.swift:24`, `manaflow-ai/cmux:Sources/Panels/AgentSessionRunningSession.swift:16`).
- The webview reducer tracks `runningSessionId`, `status`, `log`, `transcript`, `seenSessionIds`, and `requestedStopSessionId` (`manaflow-ai/cmux:webviews/src/agent-session/shared/sessionModel.ts:35`).
- The native-to-web event stream drives reducer transitions: `provider.started` sets `runningSessionId` and `status: "running"`; `provider.output` appends logs/transcript; `provider.turnComplete` marks assistant transcript complete; `provider.exit` returns to idle or failed depending state/status (`manaflow-ai/cmux:webviews/src/agent-session/shared/sessionModel.ts:353`, `manaflow-ai/cmux:webviews/src/agent-session/shared/sessionModel.ts:377`, `manaflow-ai/cmux:webviews/src/agent-session/shared/sessionModel.ts:398`, `manaflow-ai/cmux:webviews/src/agent-session/shared/sessionModel.ts:415`, `manaflow-ai/cmux:webviews/src/agent-session/shared/sessionModel.ts:423`).
- Historical/resumable sessions are a separate system: cmux has `RestorableAgentKind` for many CLIs (Claude, Codex, OpenCode, etc.), hook-state JSON filenames under `~/.cmuxterm` or `CMUX_AGENT_HOOK_STATE_DIR`, and command builders for resume/fork (`manaflow-ai/cmux:Sources/RestorableAgentTypes.swift:4`, `manaflow-ai/cmux:Sources/RestorableAgentTypes.swift:146`, `manaflow-ai/cmux:Sources/RestorableAgentTypes.swift:163`).
- Fork/resume support includes Claude `claude --resume <sessionId> --fork-session` and Codex `codex fork <sessionId>` patterns. For Claude forks, cmux routes through the `claude` wrapper so hooks fire on the forked session (`manaflow-ai/cmux:Sources/RestorableAgentSession.swift:544`, `manaflow-ai/cmux:Sources/RestorableAgentSession.swift:548`, `manaflow-ai/cmux:Sources/RestorableAgentSession.swift:551`, `manaflow-ai/cmux:Sources/RestorableAgentSession.swift:553`).

#### UI model

- cmux uses a bundled web UI inside `WKWebView`; native code loads a renderer-specific HTML file from app resources and only trusts calls from that exact file URL (`manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:99`, `manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:109`, `manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:120`, `manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:312`).
- The JS-to-native bridge is `window.webkit.messageHandlers.agentSession.postMessage({ id, method, params })`; native replies with `{ok,value}` or `{ok:false,error}` (`manaflow-ai/cmux:webviews/src/agent-session/shared/bridge.ts:17`, `manaflow-ai/cmux:webviews/src/agent-session/shared/bridge.ts:62`).
- Native-to-web events call `window.cmuxAgentBridge?.receive(event)`; the web bridge fans events to listeners and applies theme updates (`manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:686`, `manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:692`, `manaflow-ai/cmux:webviews/src/agent-session/shared/bridge.ts:39`, `manaflow-ai/cmux:webviews/src/agent-session/shared/bridge.ts:44`).
- Web UI loads initial native context and provider list in parallel via `app.context` and `provider.list`; provider info includes `displayName`, `executableName`, `transportKind`, `arguments`, and `autoStart` (`manaflow-ai/cmux:webviews/src/agent-session/shared/sessionModel.ts:187`, `manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:345`, `manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:552`).
- Web UI actions call `provider.select`, `provider.start`, `provider.writeLine`, and `provider.stop`; the native coordinator enforces one running provider and rejects provider switching while a process is active (`manaflow-ai/cmux:webviews/src/agent-session/shared/sessionModel.ts:201`, `manaflow-ai/cmux:webviews/src/agent-session/shared/sessionModel.ts:267`, `manaflow-ai/cmux:webviews/src/agent-session/shared/sessionModel.ts:309`, `manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:563`, `manaflow-ai/cmux:Sources/Panels/AgentSessionWebRendererCoordinator.swift:572`).
- The UI has transcript and activity concepts, not just lines. `TranscriptEntry` roles include `user`, `assistant`, `notice`, and `activity`; activity entries carry kind/status/action/detail/output (`manaflow-ai/cmux:webviews/src/agent-session/shared/sessionModel.ts:19`).

### What CLI-Manager Would Need For A Similar Built-In Feature

This section describes required implementation surfaces, based on cmux patterns and current CLI-Manager contracts.

1. **Define an agent pane/session domain separate from PTY terminal tabs**
   - cmux separates `AgentSessionPanel` from `TerminalPanel`; CLI-Manager currently treats visible panes as terminal session IDs in `terminalPaneTree.ts` and live processes as PTYs via `pty_create`/`pty-output-{sessionId}`.
   - CLI-Manager would need either a new pane item type (e.g. terminal vs agent pane vs transcript pane) or a second store/tree layer that can place non-PTY agent sessions in the split layout without calling `pty_create`.

2. **Add a backend process runner for structured agent CLIs**
   - Existing CLI-Manager PTY manager launches shells through PTY (`src-tauri/src/commands/terminal.rs:9`, `src-tauri/src/pty/manager.rs:267`). cmux's built-in agent pane uses ordinary subprocess pipes and provider-specific protocols.
   - Similar support would require Tauri commands such as `agent_provider_list`, `agent_start`, `agent_write`, `agent_stop`, plus emitted events such as `agent-output-{id}` or a single typed `agent-session-event` channel.
   - The runner should store provider process state, stdin writer, stdout/stderr read tasks, termination handling, provider-native IDs, and working directory.

3. **Implement provider adapters**
   - Claude Code adapter: launch `claude -p --output-format stream-json --input-format stream-json --include-partial-messages --verbose`; send JSONL user messages; parse stream-json deltas and `message_stop`/`result`/`done` turn completion.
   - Codex adapter: choose between current CLI-Manager hook-based Codex visibility and cmux-like `codex app-server --listen stdio://` JSON-RPC. If using app-server, implement initialize/thread/start-turn and notification parsing.
   - Optional future providers: OpenCode loopback pattern or user-configured custom providers.

4. **Add frontend agent-pane UI/state**
   - cmux uses a dedicated webview reducer with statuses `loading | idle | starting | running | stopping | failed`, provider list, logs, transcript, current running ID, activity rows, and attachment handling.
   - CLI-Manager could implement this in React directly rather than nested webview, but would still need a store for provider metadata, active agent sessions, transcript entries, tool/activity rows, send/stop state, and pane binding.

5. **Reuse existing hooks but do not rely on hooks alone**
   - CLI-Manager already has hook contracts for Claude/Codex events and subagent transcript panes (`.trellis/spec/backend/cli-hook-contracts.md:5`) and runtime status via hook + shell sources.
   - cmux's built-in agent pane does not depend only on external hooks: it owns the process and protocol stream. CLI-Manager would need the same ownership if the feature is a built-in interactive agent pane rather than just a hook-driven transcript/sidebar.

6. **Integrate with pane tree and tab lifecycle**
   - Current pane-tree contract says moving a terminal tab must not create a new PTY (`.trellis/spec/frontend/state-management.md:141`). For agent panes, the equivalent contract should preserve the existing agent process/session when dragging/splitting.
   - Need close/stop behavior rules: closing an agent pane should stop or detach the subprocess; stopping should not necessarily close the pane; workspace close should drain/terminate all owned agent processes.

7. **Persist/resume/fork story**
   - cmux has a separate restorable-agent path driven by agent kind, hook-state files, and resume/fork command builders.
   - CLI-Manager already indexes history/session logs; to match cmux, it would need mapping among pane session ID, provider-native session ID, cwd/project, transcript path/log path, launch command snapshot, and resume/fork command.

8. **Security/permissions and capability declarations**
   - cmux avoids raw arbitrary webview access by trusting only the bundled file URL and validating bridge frame origin.
   - CLI-Manager Tauri implementation would need explicit invoke command registration in `src-tauri/src/lib.rs` and capability permissions in `src-tauri/capabilities/default.json` for any new command/event/file access.
   - File attachments or local file previews would need scope checks similar to existing asset/file capability rules.

### External References

- [manaflow-ai/cmux GitHub repository](https://github.com/manaflow-ai/cmux) — primary source; repository description reports it as a Ghostty-based macOS terminal with vertical tabs and AI coding agent programmability.
- [Claude Code CLI stream-json usage in cmux](https://github.com/manaflow-ai/cmux/blob/main/Sources/AgentSessionProvider.swift) — cmux launches Claude Code in print/stream JSON mode for the built-in pane.
- [cmux agent webview source](https://github.com/manaflow-ai/cmux/tree/main/webviews/src/agent-session) — bundled pane UI/reducer/bridge implementation.
- Claude/Anthropic context from local `claude-api` skill: Managed Agents are server-managed API sessions and are separate from cmux's local CLI subprocess approach. cmux's implementation here launches local CLI executables (`claude`, `codex`, `opencode`) and parses their protocols rather than using Anthropic Managed Agents API sessions.

### Related Specs

- `.trellis/spec/backend/cli-hook-contracts.md` — Existing CLI-Manager hook bridge and subagent transcript contracts. Relevant if built-in panes should coexist with hook-driven notifications/transcript panes.
- `.trellis/spec/backend/terminal-runtime-monitoring-contracts.md` — Existing PTY/runtime status contracts. Relevant for deciding whether agent pane state feeds the same tab notification priority or a separate status source.
- `.trellis/spec/frontend/state-management.md` — Existing pane-tree split/move contract. Relevant because agent panes should be movable without duplicating live processes, analogous to terminal PTY sessions.
- `.trellis/spec/frontend/directory-structure.md` — Sparse, but indicates there is no detailed frontend module placement guidance yet for a new agent-pane feature.

## Caveats / Not Found

- GitHub code search API returned `401 Unauthorized`, so searches used GitHub contents/tree/raw-file APIs and targeted source reads instead of authenticated GitHub code search.
- cmux is macOS/Swift/AppKit/WebKit; CLI-Manager is Tauri/Rust/React/xterm. The architecture maps conceptually, but implementation primitives differ.
- cmux's built-in agent pane path inspected here is not the same as Anthropic Managed Agents API. It is local CLI process orchestration.
- I did not clone cmux locally or run it; findings are from source/document inspection.
- Some cmux source fetches timed out intermittently; the report cites successfully fetched line ranges only.
- I did not find evidence in the inspected built-in pane path that Claude panes use a PTY. They use `Process` plus pipes. cmux still has separate terminal/PTY/tmux code for ordinary terminal panes, but that is not the built-in `AgentSessionPanel` path.
