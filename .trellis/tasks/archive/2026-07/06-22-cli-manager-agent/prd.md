# 实现 CLI-Manager 内置 Agent 自动分屏

## Goal

让 CLI-Manager 原生支持两类 Agent 可视化能力：

1. **镜像 Claude Code 内部 subagent/background task**：当前 Claude Code 会话内部通过 `Agent` 工具派发的子任务，在 CLI-Manager 中自动出现可追踪的只读视图。
2. **CLI-Manager 原生 Agent 分屏**：由 CLI-Manager 自己作为 orchestrator 创建 pane、启动本地 `claude`/`codex` 等 agent CLI 子进程，并接管实时输出。

两者需要作为可组合但不同的能力处理，避免把 Claude Code 内部 subagent 误认为 CLI-Manager 自己启动和管理的真实进程。

## What I already know

* 用户明确不要依赖外部分屏工具，希望能力内置在 CLI-Manager。
* 现有 CLI-Manager 已有 Claude/Codex Hook 桥接：后端接收 Hook 上报并转发到前端 `claude-hook-notification`。
* 现有自动分屏更适合真实 CLI 终端会话，因为它依赖 session/start 类事件或终端会话信息。
* Claude Code 内部 `Agent` 工具启动的 subagent/background task 不是新的 PTY 终端进程，通常不会天然对应一个 CLI-Manager 终端 pane。
* 当前实现已经能在 `SubagentStart` 时打开 `subagent-transcript` 伪会话并 tail JSONL，但如果没有真正独立的 child transcript path，就会 fallback 到父会话 JSONL，导致多个子 Agent pane 显示同一份主 transcript。

## Current Problem

现在版本中，通过 hook 创建 sub-agent 后可以自动分屏，但多个分屏展示的内容可能完全一样。原因是：

* `SubagentStart` payload 里如果没有独立 `agentTranscriptPath`，当前逻辑会 fallback 到 `transcriptPath`。
* `transcriptPath` 通常是父 Claude Code 会话的主 JSONL。
* 两个并发 sub-agent 如果都 tail 父 JSONL，就会显示一模一样的主 agent 会话内容。

因此，现有行为的核心问题不是分屏失败，而是**没有区分数据源类型**：child JSONL、parent JSONL、lifecycle-only 被混在了一条路径上处理。

## Assumptions

* Claude Code 内部 `Agent` 工具已经启动的 subagent，本质上不是 CLI-Manager 管理的 PTY/子进程；CLI-Manager 可以通过 hook 把它镜像成 transcript/status pane，但不能把这个已存在的内部 subagent 变成真实终端进程。
* `SubagentStart` 不应被视为“必然有独立实时 transcript”的保证；它首先是生命周期信号。
* 如果 hook payload 提供了独立且可访问的 `agentTranscriptPath`，CLI-Manager 可以 tail 该文件并显示实时 child transcript。
* 如果没有独立 child transcript，CLI-Manager 不应无提示地显示父 transcript，否则会误导用户以为多个 pane 是独立子 Agent 输出。
* CMUX 风格的“分屏启动 Claude”必须由 CLI-Manager 自己作为 orchestrator：创建 pane、启动本地 `claude`/`codex` 进程、保存会话状态、接管输入输出。

## Open Questions

* Claude Code 当前版本在 `SubagentStart` / `SubagentStop` / `PostToolUse(Task|Agent)` 中实际提供哪些字段？是否稳定提供独立 `agentTranscriptPath`？
* 当 `agentTranscriptPath` 缺失或等于 `transcriptPath` 时，UI 是显示 lifecycle-only pane，还是显示经过过滤的 parent transcript？
* 原生 Agent Runner 第一版优先走普通 PTY pane，还是直接做 CMUX-style stream-json 结构化 pane？
* 是否需要在设置页暴露 provider executable/path、默认启动参数和默认启动模式？

## Requirements

### Phase 1 — 修正内部 subagent 镜像能力

* 不依赖额外外部分屏工具。
* `SubagentStart` 继续能自动打开可见 pane/视图。
* 数据源必须显式区分：
  * `child-jsonl`：存在独立 `agentTranscriptPath`，且与父 `transcriptPath` 不同。
  * `parent-jsonl`：只有父 transcript，可选做过滤展示。
  * `lifecycle-only`：没有可靠 transcript 数据源，只显示启动/运行/完成/失败状态。
* 不允许在没有独立 child transcript 时静默 fallback 到父 transcript 并当作子 Agent 实时输出展示。
* UI 应显示 source badge，例如 `Child JSONL` / `Parent JSONL` / `Lifecycle only`。
* 多个并发 sub-agent 必须有稳定且互不覆盖的 pane key。不能只依赖父 `sessionId`。
* 增加 raw hook payload 诊断日志，至少覆盖：
  * `SubagentStart`
  * `SubagentStop`
  * `Notification`
  * `PostToolUse` 中 tool name 为 `Task` / `Agent` 的情况

### Phase 2 — CLI-Manager 原生 Agent 分屏

* 模仿 CMUX 的“分屏启动对应 agent”体验，由 CLI-Manager 自己创建 pane 并启动本地 `claude`/`codex` 进程。
* 每个 agent pane 必须对应 CLI-Manager 管理的独立运行状态、stdin/stdout/stderr 或结构化事件流。
* 优先复用现有 Hook 通道、Tab 状态与通知机制，但不把内部 subagent 镜像和原生 agent runner 混为一种 session。
* 新增 `agent-session` 或等价 session kind 时，应明确它与 `pty`、`subagent-transcript` 的生命周期差异。

## Acceptance Criteria

### Phase 1

* [ ] 用户发起内部 sub-agent 后，CLI-Manager 能在当前工作区自动打开对应只读视图。
* [ ] 如果 hook payload 提供独立 `agentTranscriptPath`，pane 显示该 child JSONL 的实时内容。
* [ ] 如果没有独立 child transcript，pane 不再重复显示父 transcript 并伪装成子 Agent 输出。
* [ ] UI 能明确提示当前数据源是 `Child JSONL`、`Parent JSONL` 还是 `Lifecycle only`。
* [ ] 同时开启两个 sub-agent 时，不会因为共用父 `transcriptPath` 而展示两份完全相同的主会话内容。
* [ ] `SubagentStop` 能更新对应 pane 的完成/失败状态。
* [ ] 现有真实终端会话自动分屏逻辑不被破坏。

### Phase 2

* [ ] CLI-Manager 能在当前 pane 旁边创建一个原生 agent pane。
* [ ] 新 pane 能启动本地 `claude` 或后续支持的 agent CLI。
* [ ] 每个原生 agent pane 有独立运行状态和输出流。
* [ ] 不要求用户安装额外分屏工具。

## Definition of Done (team quality bar)

* 前端类型检查通过（`npx tsc --noEmit`）。
* Rust 编译检查通过或说明未运行原因（`cd src-tauri && cargo check`）。
* 相关行为说明/设置文案更新（如有 UI 设置）。
* 回滚/兼容性风险已说明。

## Out of Scope (explicit)

* 不要求用户安装或配置额外分屏工具。
* 不把当前需求绑定到特定本机私有 skill。
* Phase 1 不要求完整重放 Claude Code 内部 subagent 的全部实时 JSONL transcript；没有独立 child transcript 时应降级展示。
* Phase 1 不实现 CLI-Manager 自己启动 agent 进程。
* Phase 2 不要求兼容所有第三方 agent CLI，先支持 Claude/Codex provider 形态即可。

## Research References

* [`research/cmux-agent-panes.md`](research/cmux-agent-panes.md) — CMUX 的内置 agent pane 是应用自己启动并管理本地 CLI 子进程，Claude 使用 stream-json/stdin-stdout 协议，UI 是专门的 agent transcript pane，而不是普通 PTY 终端。
* [`research/current-findings-summary.md`](research/current-findings-summary.md) — 当前结论与推荐分阶段方案。

## Research Notes

### CMUX 可借鉴点

* 应用内置 provider 概念，直接解析本机 `claude`、`codex` 等可执行文件。
* Claude provider 启动参数为 `-p --output-format stream-json --input-format stream-json --include-partial-messages --verbose`。
* 每个 agent pane 有独立运行状态、stdin/stdout/stderr、transcript、停止/完成事件。
* UI 上表现为“一个 pane 里启动了对应的 agent”，但内核是应用自己管理本地 CLI 子进程，不依赖用户额外安装分屏工具。

### CLI-Manager 现状

* `src/App.tsx` 已监听 `claude-hook-notification`，并对 `SubagentStart` 调用 `openSubagentTranscript`、对 `SubagentStop` 调用 `finishSubagentTranscript`。
* `src/App.tsx` 已监听 `subagent-transcript-append`，并路由到 `appendSubagentTranscript`。
* `src-tauri/src/claude_hook.rs` 的 payload 校验已允许 Claude/Codex 来源的 `SubagentStart` 与 `SubagentStop`。
* `src/stores/terminalStore.ts` 已有 `subagent-transcript` 伪会话：能分屏显示内部子任务 transcript，但它不是新启动的真实 Claude 进程。
* `src-tauri/src/commands/subagent_transcript.rs` 已能 tail 子任务 jsonl 并推送到前端。
* 当前 `openSubagentTranscript` 对 transcript path 的选择是 `agentTranscriptPath ?? transcriptPath`，这会在 child path 缺失时把多个子任务都绑定到父 JSONL。

### Key constraint

* Claude Code 内部 `Agent` 工具已经启动的 subagent，本质上不是 CLI-Manager 管理的 PTY/子进程；CLI-Manager 可以通过 Hook 把它镜像成 transcript/status pane，但不能把这个已存在的内部 subagent 变成真实终端进程。
* 现有内部 subagent 虚拟 tab 的输出链路是：`SubagentStart` hook 携带 `agentTranscriptPath`/`transcriptPath` → 前端创建 `subagent-transcript` 伪会话并分屏 → Rust `subagent_transcript_subscribe` 轮询 tail JSONL 文件 → 前端按 JSONL 行解析 user/assistant/tool 内容并渲染。
* 这条链路只有在 `agentTranscriptPath` 真正指向独立 child JSONL 时，才能显示子 Agent 实时内容。
* CMUX 风格的“分屏启动对应 Claude”必须由 CLI-Manager 自己作为 orchestrator：创建 pane、启动本地 `claude`/`codex` 进程、保存会话状态、接管输入输出。
* 因此需要把“内部 subagent 自动可见”和“CLI-Manager 内置启动真实 agent pane”作为两个可组合但不同的能力处理。

## Feasible approaches

### Approach A: 修正现有子任务 transcript 镜像（推荐立即处理）

* How it works: 保留 Hook 驱动的 `subagent-transcript` 伪分屏，但新增数据源判断与 UI source badge；只有独立 child JSONL 才 tail 实时内容，否则降级为 lifecycle-only 或 filtered parent transcript。
* Pros: 直接解决当前两个 sub-agent pane 显示一模一样的问题；改动小；不改变真实终端逻辑。
* Cons: 如果 Claude Code 不暴露独立 child transcript，仍无法显示完整实时子 Agent 内部过程。

### Approach B: PTY 真终端分屏启动 Claude（原生 Agent Runner MVP 可选）

* How it works: 复用现有 `pty_create` / pane tree，在父会话旁边新建真实终端 pane，并自动执行一条可配置的 `claude` 启动命令。
* Pros: 最贴近用户看到的“分屏启动 Claude”；复用现有终端、Hook、Tab 状态、输入输出和关闭逻辑；实现风险较低。
* Cons: 输出是普通终端文本，不是 CMUX 那种结构化 transcript UI；需要定义如何从当前任务生成启动命令。

### Approach C: CMUX-style 结构化 Agent pane（长期目标）

* How it works: 新增 Rust 后端 agent runner，用 pipe 启动 `claude -p --output-format stream-json ...`，解析 JSON stream，前端新增专门 agent pane UI。
* Pros: 架构最接近 CMUX；可做结构化消息、活动状态、停止/继续。
* Cons: 需要新增 provider runner、协议解析、UI store、Tauri commands/capabilities；范围明显更大。

## Technical Notes

* 需要先记录真实 hook payload，确认 `agentTranscriptPath` 在本机 Claude Code 版本中的实际行为。
* `openSubagentTranscript` 不应在 `agentTranscriptPath` 缺失或等于 `transcriptPath` 时静默 tail 父 JSONL。
* `SubagentTranscriptView` 需要展示数据源状态与降级提示。
* `TerminalSession.subagent` 可能需要扩展 source 元信息，例如 `sourceKind`、`transcriptPath`、`parentTranscriptPath`、`sourceReason`。
* 并发 sub-agent 的 pane key 推荐优先使用独立 `agentTranscriptPath` 或 `agentId`，缺失时使用 `parentTabId + timestamp + sequence`，不能只用父 session。
* 原生 agent runner 需要继续检查：如何从当前 CLI 会话/任务上下文生成新 pane 的 Claude 启动命令。
* 原生 agent runner 需要继续检查：设置页是否应提供 provider executable/path 和默认启动模式。
* 原生 agent runner 需要继续检查：新建 agent pane 是否复用 `TerminalSession.kind`，还是新增更明确的 `agent-session` kind。

## Phase 1 实现方案 (已实现)

### 核心设计原则

**不监听所有 PTY，只在需要时订阅相关 Claude/Codex session 的 transcript/subagents 文件。**

### 事件优先级

1. **主路径：SubagentStart / SubagentStop hook**
   - Claude/Codex 内置 subagent lifecycle hook（如果版本支持）
   - 携带 `agentId`、`agentTranscriptPath`、`transcriptPath`
   - 前端收到即可精确定位 child JSONL

2. **Fallback 路径：AgentToolStart / AgentToolStop**
   - 通过 Claude `PreToolUse`/`PostToolUse` 捕获 `Agent`/`Task` 工具调用
   - Hook installer 限定 matcher 为 `Agent`
   - `AgentToolStart`：前端立即创建 `pending` 状态 pane，**不订阅父 transcript**
   - `AgentToolStop`：若携带 `agentId` 或可推导 child path，升级为 `child-jsonl` 并订阅

### Source Resolution 规则

```ts
type SubagentTranscriptSourceKind = "pending" | "child-jsonl" | "parent-jsonl" | "lifecycle-only";
```

- **pending**: 已捕获 Agent 工具调用，等待 child transcript 发现
- **child-jsonl**: 有独立 `agentTranscriptPath` 且不同于父 `transcriptPath`，订阅该文件
- **parent-jsonl**: 只有父 `transcriptPath`，不订阅（避免把完整主会话伪装成子输出）
- **lifecycle-only**: 无可用 transcript，仅显示启动/完成状态

### 订阅生命周期

1. 收到 `SubagentStart` 或 `AgentToolStart`：
   - 只对当前已绑定的父 tab/pane 创建子 Agent pane
   - 不是全局监听所有终端
   
2. Source = `child-jsonl`：
   - 调用 `subagent_transcript_subscribe({ key, transcriptPath, cwd, sessionId, agentId })`
   - 后端启动轻量轮询线程 (250ms)，只 tail 该文件
   
3. Source = `pending` (AgentToolStart 且无 child path)：
   - 前端不订阅任何文件
   - `AgentToolStop` 时若能推导 child path，升级并订阅
   - 后端根据 `cwd + sessionId + agentId` 推导 `~/.claude/projects/<slug>/<sessionId>/subagents/agent-<agentId>.jsonl`
   
4. 清理时机：
   - 收到 `SubagentStop` / `AgentToolStop`
   - 用户关闭该 pane
   - 父 tab 关闭
   - 后端自动停止对应 tail 线程

### 性能保证

- **不扫描所有 PTY**：只处理有 hook 绑定的 Claude/Codex session
- **不扫描所有项目**：只监听当前事件关联的 `cwd/sessionId/agentId` 组合
- **低开销文件 tail**：每个订阅一个轻量线程，offset-based 增量读取
- **按需启停**：订阅随 pane 生命周期绑定，关闭即停
- **短时发现**：pending 状态不会无限等待；AgentToolStop 时尝试一次推导绑定，失败则保持 pending 或降级为 lifecycle-only

### UI 降级提示

| Source Kind | Badge | 空内容提示 |
|------------|-------|-----------|
| `pending` | `Pending` (蓝色) | "已捕获 Agent 工具调用，正在等待子 Agent transcript。CLI-Manager 只会短时订阅相关子任务 JSONL，不会扫描所有终端输出。" |
| `child-jsonl` | `Child JSONL` (绿色) | "等待子 Agent 输出…" |
| `parent-jsonl` | `Parent JSONL` (黄色) | "Claude Code 未暴露独立子 Agent transcript。当前只检测到父会话 transcript；为避免重复显示主会话内容，此视图仅保留子任务状态。" |
| `lifecycle-only` | `Lifecycle only` (暗色) | "Claude Code 当前没有暴露可读取的子 Agent transcript。此视图仅显示启动、运行、完成或失败状态。" |

### 实现文件清单

- **类型定义**: `src/lib/types.ts` — 新增 `pending` 到 `SubagentTranscriptSourceKind`，`toolUseId` 到 `TerminalSession.subagent`
- **Store 逻辑**: `src/stores/terminalStore.ts` — 新增 `resolveSubagentTranscriptSource`、`shouldUpgradeSubagentSource`、`mergeSubagentSource`、`shouldSubscribeSubagentSource`、`shouldAttemptDerivedChildTranscript`、`findSubagentSessionId`、`createSubagentPaneId` 辅助函数；`openSubagentTranscript` 与 `finishSubagentTranscript` 支持 `AgentToolStart`/`AgentToolStop` 和 pending/derived child 订阅
- **事件路由**: `src/App.tsx` — 监听 `AgentToolStart` 创建/更新 pending pane，监听 `AgentToolStop` 升级绑定并 finish
- **UI 渲染**: `src/components/terminal/SubagentTranscriptView.tsx` — 新增 `pending` 的 label/color/提示文案
- **后端订阅**: `src-tauri/src/commands/subagent_transcript.rs` — `resolve_transcript_path` 从 `transcriptPath` 或推导 `cwd/sessionId/agentId` 得出 child JSONL 路径
- **Hook 安装**: `src-tauri/src/commands/hook_settings.rs` — Claude hook installer 已配置 `PreToolUse`/`PostToolUse` matcher 为 `Agent`，卸载时一并移除
- **Bridge 白名单**: `src-tauri/src/claude_hook.rs` — `is_event_allowed_for_source` 已允许 Claude 的 `AgentToolStart`/`AgentToolStop`
- **Hook 客户端**: `src-tauri/src/hook_client.rs` — `__hook` 已解析 `tool_use_id`/`tool_input`/`tool_response` 并提取 `agentId`/`toolUseId`
- **合同文档**: `.trellis/spec/backend/cli-hook-contracts.md` — 更新 Signatures、Contracts、Good/Base/Bad Cases、Tests Required
- **验收文档**: `.trellis/tasks/06-22-cli-manager-agent/acceptance.md` — 已完整覆盖 pending/AgentToolStart/AgentToolStop/source resolution/并发/降级/diagnostics 验收点

### 进度更新 (2026-06-23) — 并发多子 Agent Tab 修复

**问题**：在终端内启动多个并发 sub-agent 时，UI 出现两类异常：

1. **Tab 重复**：2 个 sub-agent 产生 4 个 Tab。根因是 `AgentToolStart`（只有 `toolUseId`，无 `agentId`）和 `SubagentStart`（只有 `agentId`，无 `toolUseId`）在并发场景下无共同标识，无法关联，导致两类事件各自创建 Tab。
2. **Tab 闪现即消失 + 误覆盖**：`findSubagentSessionId` 的 fallback 在「同父 Tab 候选唯一」时会把第二个 agent 错误匹配到第一个 Tab，造成内容互相覆盖；后续 `Stop` 又把它关闭。

**修复**（`src/stores/terminalStore.ts`）：

- **`AgentToolStart`/`AgentToolStop` 不再创建 UI**：这两个事件只触发短时目录 discovery，由 `SubagentStart`（携带可靠 `agentId` + `agentType`）创建真实 Tab，discovery 负责把数据源升级为 `child-jsonl`。
- **收紧 `findSubagentSessionId` fallback**：精确匹配优先用 `agentId`，其次 `toolUseId`；仅当 payload **既无 `agentId` 也无 `toolUseId`** 时才按 parentTabId 推断，且要求候选唯一，避免并发误匹配。
- **`SubagentStart` 绑定 placeholder 时重建标题**：当更新已有 session 带来新的 `agentType` 时，重新生成标题，格式为 `{agentType} (父Tab名)`，第二个起追加 `#N` 序号。
- **`buildSubagentTitle()` 辅助函数**：统一生成包含父 Tab 标题与序号的可读标题。

**结果**：2 个并发 sub-agent → 2 个独立 Tab，标题可区分来源，均能正确显示各自内容，互不覆盖。`npx tsc --noEmit` 通过，Rust backend 编译通过。
