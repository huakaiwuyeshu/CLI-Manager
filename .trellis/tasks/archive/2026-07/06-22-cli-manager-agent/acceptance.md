# Acceptance: CLI-Manager Agent 分屏

## Scope

本验收文件用于锁定当前开发阶段的目标：**Phase 1 — 修正 Claude Code 内部 subagent 镜像能力**。

本阶段不实现 CLI-Manager 原生 Agent Runner，不启动新的 `claude`/`codex` 子进程，只修正现有 hook 驱动的 `subagent-transcript` 伪会话行为。

## User-Visible Goal

当 Claude Code 内部启动一个或多个 sub-agent/background task 时，CLI-Manager 应自动打开可追踪视图，并准确说明该视图的数据源：

- 有独立 child transcript 时：实时显示该子 Agent 的 transcript。
- 没有独立 child transcript 时：显示生命周期/有限父 transcript 信息，不能把父会话完整 transcript 伪装成子 Agent 实时输出。
- 多个并发子 Agent 不能再因为共用父 `transcriptPath` 而显示完全相同的主会话内容。

## Functional Acceptance Criteria

### 1. Source Resolution

- [ ] `SubagentStart` payload 中 `agentTranscriptPath` 存在、非空，且不同于 `transcriptPath` 时，pane 使用 `child-jsonl` 数据源。
- [ ] `child-jsonl` 数据源订阅的路径必须是 `agentTranscriptPath`，不能被父 `transcriptPath` 覆盖。
- [ ] `agentTranscriptPath` 缺失、为空，或等于 `transcriptPath` 时，不能无提示地订阅完整父 transcript 并当作子 Agent 实时输出显示。
- [ ] 没有独立 child transcript 时，pane 必须进入 `pending`、`parent-jsonl` filtered mode 或 `lifecycle-only` mode。
- [ ] `AgentToolStart` 只能创建/更新 pending 子 Agent 视图，不得订阅父 transcript 作为 child 输出。
- [ ] `AgentToolStop` 若拿到 `agentId` 或独立 child path，可按需绑定/订阅 child JSONL；订阅范围仅限该相关 session/pane。
- [ ] 解析逻辑应兼容 hook payload 中已存在的 camelCase 字段；若后端已标准化 snake_case，则前端只消费标准化后的字段。

### 2. Pane Identity and Concurrency

- [x] 多个并发 `SubagentStart` 事件必须创建或更新不同的子 Agent pane，不得互相覆盖。
- [x] pane key 优先级应避免只使用父 `sessionId`；推荐优先使用 `agentId` 或独立 `agentTranscriptPath`，缺失时使用父 tab + timestamp/sequence 的稳定组合。
- [x] 同一个 `agentId` 的重复 `SubagentStart` 应幂等更新已有 pane/订阅，而不是创建重复 pane。
- [ ] 两个没有独立 child transcript 的并发子 Agent 不应显示两份完全相同的父会话完整内容。

### 3. UI Source Disclosure

- [ ] `SubagentTranscriptView` 或等价 UI 必须显示数据源 badge：`Child JSONL`、`Parent JSONL`、`Lifecycle only` 之一。
- [ ] `Child JSONL` 模式显示实时 transcript 内容。
- [ ] `Parent JSONL` 模式必须说明这是父 transcript 的有限/过滤信息，不代表完整实时子 Agent transcript。
- [ ] `Lifecycle only` 模式必须说明 Claude Code 当前没有暴露独立子 Agent transcript，只显示启动/运行/完成/失败状态。
- [ ] 降级提示应保持简洁，不阻塞主终端交互，不触发额外 toast 噪音。

### 4. Lifecycle Handling

- [ ] `SubagentStop` 携带 `agentId` 时，应优先匹配对应子 Agent pane。
- [ ] `SubagentStop` 缺少 `agentId` 且同一父 tab 下存在多个子 Agent pane 时，不得猜测关闭多个 pane。
- [ ] 子 Agent 完成后，pane 状态应更新为 ended/done/failed 等可见状态，再按现有 grace delay 关闭或保留。
- [ ] `SubagentStop` 的处理不得影响父终端 tab 的 hook status、toast 或 shell runtime status。

### 5. Diagnostics

- [ ] 开发/调试日志中能看到 `SubagentStart` 的 source resolution 结果：source kind、agentId、agentTranscriptPath、transcriptPath 是否相同。
- [ ] 当降级为 `parent-jsonl` 或 `lifecycle-only` 时，日志应说明降级原因。
- [ ] 原始 hook payload 诊断应覆盖 `SubagentStart` / `SubagentStop` / `Notification`，以及 `PreToolUse`/`PostToolUse` 中 matcher 为 `Task` / `Agent` 的 Agent tool fallback 事件。
- [ ] 诊断日志不得泄露 token/password/api key 等明显敏感字段；若记录 raw payload，需要走已有日志脱敏策略或仅在 debug 模式启用。

### 6. Backend Boundary

- [ ] `subagent_transcript_subscribe` 的 Tauri command 签名保持兼容，除非明确同步更新所有前端调用点和 spec。
- [ ] Rust 边界继续校验空 key、空 transcript path、缺失推导字段。
- [ ] 后端 tail 仍只按完整 JSONL 行推送，不发送残行。
- [ ] 如果前端不应订阅父 transcript，后端不需要猜测业务语义；source resolution 由前端/store 层决定。

### 7. Existing Behavior Preservation

- [ ] 普通 PTY terminal session 的创建、切换、分屏、关闭不受影响。
- [ ] 现有 pane tree 拖拽/分屏语义保持：移动已有 session 不创建新 PTY。
- [ ] `subagent-transcript` 伪会话仍不持久化到 session restore。
- [ ] Hook-driven tab status priority 保持：`attention > failed > running > done > none`。
- [ ] `SessionStart` / `UserPromptSubmit` / `Notification` / `Stop` / `StopFailure` / `PermissionRequest` 的现有 toast/status 行为不被 transcript 改动破坏。

## Manual Verification Scenarios

### Scenario A: Unique Child Transcript

Given a `SubagentStart` payload with:

- `agentId = a1`
- `agentTranscriptPath = /path/to/agent-a1.jsonl`
- `transcriptPath = /path/to/parent.jsonl`

Expected:

- [ ] CLI-Manager opens one `subagent-transcript` pane.
- [ ] Source badge is `Child JSONL`.
- [ ] Pane content follows `/path/to/agent-a1.jsonl` only.
- [ ] Parent transcript content does not appear unless it is also present in child JSONL.

### Scenario B: Missing Child Transcript

Given a `SubagentStart` payload with:

- `agentId = a2`
- no `agentTranscriptPath`
- `transcriptPath = /path/to/parent.jsonl`

Expected:

- [ ] CLI-Manager opens a visible child task pane/card.
- [ ] It does not display the full parent transcript as if it were child output.
- [ ] Source badge is `Parent JSONL` or `Lifecycle only`.
- [ ] UI explains the limitation clearly.

### Scenario C: Two Concurrent Subagents With Same Parent Transcript

Given two `SubagentStart` payloads sharing the same `transcriptPath`, and neither has a unique `agentTranscriptPath`:

Expected:

- [ ] Two child task views can be tracked separately by identity/status.
- [ ] They do not both render identical full parent transcript content.
- [ ] `SubagentStop` for one agent does not close or mark the other agent finished.

### Scenario D: Repeated Start For Same Agent

Given two `SubagentStart` payloads with the same `agentId`:

Expected:

- [ ] Existing pane is reused or refreshed.
- [ ] Duplicate panes are not created.
- [ ] Existing transcript subscription is replaced idempotently if needed.

### Scenario E: Ambiguous Stop

Given multiple child panes under the same parent tab and `SubagentStop` without `agentId`:

Expected:

- [ ] CLI-Manager does not guess.
- [ ] No unrelated child pane is closed.
- [ ] Debug log explains the ambiguous stop target.

### Scenario F: Agent Tool Hook Fallback

Given Claude emits `PreToolUse` for `Agent`/`Task` and later `PostToolUse`:

Expected:

- [ ] Hook installation registers `PreToolUse` and `PostToolUse` matcher entries for Agent/Task without removing existing `SubagentStart`/`SubagentStop` support.
- [ ] `AgentToolStart` opens a pending `subagent-transcript` pane only for the bound tab/session.
- [ ] `AgentToolStart` does not subscribe or render the full parent transcript.
- [ ] `AgentToolStop` with a usable child path or `agentId` upgrades/binds that pane to `Child JSONL` and subscribes only that derived child JSONL.
- [ ] Watcher/subscription cleanup still follows existing close/end behavior.

## Static Verification

- [ ] Run `npx tsc --noEmit` after frontend/type changes.
- [ ] Run `cd src-tauri && cargo check` after Rust/Tauri changes.
- [ ] If only task docs are updated, static verification may be skipped with reason.

## Out Of Scope For This Acceptance File

- [ ] Starting a new local Claude/Codex process from CLI-Manager.
- [ ] Implementing stream-json provider runner.
- [ ] Adding a general multi-provider agent orchestration UI.
- [ ] Guaranteeing full child Agent real-time output when Claude Code does not expose an independent child transcript source.
