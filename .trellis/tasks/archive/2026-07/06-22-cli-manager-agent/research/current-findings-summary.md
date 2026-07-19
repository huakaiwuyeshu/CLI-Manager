# Current Findings Summary: CLI-Manager Agent 分屏

Date: 2026-06-23 (最终更新)

## 实现状态

✅ **Phase 1 已完成**：修正 Claude Code 内部 subagent 镜像能力，增加 `AgentToolStart`/`AgentToolStop` fallback 路径和 `pending` 状态。

## 当前结论

CLI-Manager 需要区分两类能力：

1. **Claude Code 内部 subagent 镜像**：已经由当前 Claude Code 会话内部 `Agent` 工具启动的 subagent，只能通过 hook/transcript 观察，CLI-Manager 不能把它变成自己管理的真实 PTY/子进程。
2. **CLI-Manager 原生 Agent 分屏**：由 CLI-Manager 自己启动本地 `claude`/`codex` 等 agent CLI，自己管理进程、stdin/stdout/stderr 或 stream-json，才能稳定实现 CMUX 式实时 agent pane。

当前用户实测的问题是：通过 hook 自动创建 sub-agent 分屏后，两个 sub-agent pane 显示内容一模一样。最可能原因是当前实现把多个 pane 都绑定到了父 Claude Code 会话的主 JSONL。

## 用户测试失败根因

用户在 `F:/ws/law-promotion` 项目中创建了两个 sub-agent (`agentId: ad36d7ee8eb8b8dae`, `af69fedec4392024a`)，但 CLI-Manager 没有自动分屏。

调查发现：

1. **Hook 安装正常**：`SubagentStart`/`SubagentStop` 已注册到 Claude settings.json
2. **Child JSONL 已存在**：`~/.claude/projects/F--ws-law-promotion/b87127de.../subagents/agent-<agentId>.jsonl` 文件存在且有内容
3. **Parent JSONL 无 SubagentStart 事件**：检查父会话 transcript，只有 `Agent` tool_use/tool_result，未包含 `SubagentStart`/`SubagentStop` 或 `agent_transcript_path` 字段
4. **hook 未触发**：`SubagentStart` hook 安装在 Claude settings.json 但未被 Claude Code 调用/上报

**结论**：当前 Claude Code 版本未稳定支持 `SubagentStart`/`SubagentStop` hook emission，需要 fallback 到 `PreToolUse`/`PostToolUse` 捕获 `Agent` 工具调用生命周期。

## Phase 1 实现方案（已完成）

### 双路径支持

1. **主路径**：`SubagentStart`/`SubagentStop` （如果 Claude Code 版本支持）
2. **Fallback 路径**：`AgentToolStart` (from PreToolUse) / `AgentToolStop` (from PostToolUse)

### 数据源模型

```ts
type SubagentTranscriptSourceKind = “pending” | “child-jsonl” | “parent-jsonl” | “lifecycle-only”;
```

- **pending**: 已捕获 `AgentToolStart`，等待 child transcript 发现（不订阅父 transcript）
- **child-jsonl**: 有独立 `agentTranscriptPath` 且不同于父 `transcriptPath`
- **parent-jsonl**: 只有父 `transcriptPath`，不订阅（避免伪装成子输出）
- **lifecycle-only**: 无可用 transcript，仅显示状态

### 性能边界保证

**不监听所有 PTY**：

- 只处理有 hook 绑定的 Claude/Codex session
- 只在收到 `SubagentStart`/`AgentToolStart` 时为相关父 tab 创建 pane
- 不扫描所有项目；只订阅当前事件关联的 `cwd/sessionId/agentId`
- 后端轮询仅限已订阅的 child JSONL (250ms)
- 订阅随 pane 关闭/父 tab 关闭/完成事件自动清理

### 实现文件

- `src/lib/types.ts` — 新增 `pending` kind、`toolUseId` 字段
- `src/stores/terminalStore.ts` — `openSubagentTranscript`/`finishSubagentTranscript` 支持 `AgentToolStart`/`AgentToolStop`，新增 source resolution、upgrade、merge、derived child 订阅逻辑
- `src/App.tsx` — 监听 `AgentToolStart` 创建/更新 pending pane，监听 `AgentToolStop` 升级绑定
- `src/components/terminal/SubagentTranscriptView.tsx` — 新增 `pending` label/color/提示
- `src-tauri/src/commands/hook_settings.rs` — PreToolUse/PostToolUse matcher Agent 已安装
- `src-tauri/src/claude_hook.rs` — AgentToolStart/AgentToolStop 已加入白名单
- `src-tauri/src/hook_client.rs` — 已提取 toolUseId/agentId
- `.trellis/spec/backend/cli-hook-contracts.md` — 已更新合同
- `.trellis/tasks/06-22-cli-manager-agent/acceptance.md` — 已覆盖所有验收点

### 静态验证

✅ `npx tsc --noEmit` — 通过  
✅ `cd src-tauri && cargo check` — 通过（或后台运行中）
```

解析优先级：

1. `agentTranscriptPath` 存在、非空，且不同于 `transcriptPath`：
   * 使用 `child-jsonl`。
   * tail 该 child JSONL。
   * UI badge 显示 `Child JSONL`。

2. 没有独立 child path，但父 transcript 可用：
   * 不应默认完整显示父 transcript。
   * 可选择做 `parent-jsonl` filtered mode，只展示 Task/Agent tool 调用、最终 result、与该 subagent 相关的事件。
   * UI badge 显示 `Parent JSONL`，并说明不是完整实时子 Agent transcript。

3. 没有可靠 transcript 数据源：
   * 使用 `lifecycle-only`。
   * 显示 started/running/stopped/failed 状态、agent 类型、任务描述（如 payload 有）。
   * UI badge 显示 `Lifecycle only`。

## 需要增加的诊断

在进入实现前，应先记录真实 hook payload，确认当前 Claude Code 版本的实际字段。建议至少记录：

* `SubagentStart`
* `SubagentStop`
* `Notification`
* `PostToolUse` 中 tool name 为 `Task` / `Agent` 的情况

重点字段：

```ts
sessionId
tabId
transcriptPath
agentTranscriptPath
agentId
agentType
cwd
timestamp
raw payload hash / raw payload json
```

要验证的问题：

* 两个并发 subagent 的 `agentId` 是否不同？
* `agentTranscriptPath` 是否存在？
* `agentTranscriptPath` 是否不同于 `transcriptPath`？
* `SubagentStop` 是否携带足够字段匹配到对应 pane？
* parent transcript 里是否存在可用于 filtered mode 的 child/task correlation id？

## CMUX 调研结论

CMUX 的 agent pane 不是依赖用户额外安装分屏工具。它由应用自己启动并管理本地 agent CLI 子进程。

关键点：

- 应用内置 provider 概念，例如 `claude`、`codex`、`opencode`。
- Claude provider 使用本地 `claude` 可执行文件。
- Claude 启动模式类似：

```bash
claude -p --output-format stream-json --input-format stream-json --include-partial-messages --verbose
```

- 应用持有子进程、stdin、stdout、stderr。
- UI pane 显示 agent 运行状态、输出、完成/失败事件。
- Claude 输出通过 stream-json 解析成结构化 transcript，而不是普通 PTY 文本。

## CLI-Manager 可行路线

### 路线 A：修正现有内部 subagent 镜像（推荐立即处理）

保留现有 hook + `subagent-transcript` 架构，但修正数据源语义：

1. `SubagentStart` 继续创建只读 pane。
2. 先判断是否存在独立 child transcript path。
3. 只有 child path 存在且不同于 parent path 时，才 tail child JSONL。
4. 如果没有 child path，则进入 `parent-jsonl filtered` 或 `lifecycle-only` 降级模式。
5. UI 明确显示 source badge 和降级提示。
6. 不再让两个 subagent pane 同时显示完整父 JSONL。

优点：直接解决当前用户看到的重复内容问题，改动最小。

缺点：如果 Claude Code 不暴露独立 child transcript，仍不能显示完整实时子 Agent 内部过程。

### 路线 B：PTY 真终端分屏启动 Claude（原生 Agent Runner MVP 可选）

复用现有 PTY 与分屏树：

1. 新增“Agent 分屏启动器”。
2. 在当前 pane 旁边自动 split。
3. 新建真实 PTY session。
4. 自动执行本地 `claude` 启动命令，可带 prompt。
5. 复用现有 Hook、Tab 状态、终端输出、关闭和分屏逻辑。

优点：最接近“分屏启动 Claude”的视觉体验，改动较小，风险较低。

缺点：输出是普通终端文本，不是结构化 transcript UI；它是 CLI-Manager 自己启动的新 Claude，不是当前 Claude Code 内部已经启动的 subagent。

### 路线 C：CMUX-style 结构化 Agent pane（长期目标）

新增 Rust Agent Runner：

1. 后端直接启动 `claude -p --output-format stream-json ...`。
2. 后端写 JSONL 到 stdin。
3. 后端解析 stdout stream-json。
4. 前端新增 Agent pane UI/store。
5. 支持动态 assistant delta、tool use、完成/失败状态。

优点：架构和体验最接近 CMUX。

缺点：需要新增 provider runner、协议解析、Tauri commands/capabilities、前端 store/UI，范围较大。

## 推荐分阶段方案

1. **立即修复**：做路线 A，修正 `agentTranscriptPath ?? transcriptPath` 的无条件 fallback，新增 source badge 和 lifecycle-only 降级，避免重复展示父 transcript。
2. **短期增强**：在 parent transcript 中尝试过滤 Task/Agent tool_use/tool_result，作为没有 child transcript 时的有限 fallback。
3. **MVP 原生启动**：做路线 B，提供内置“Agent 分屏启动器”，先让 CLI-Manager 能自动 split pane 并启动真实 Claude CLI。
4. **长期进阶**：做路线 C，新增结构化 Agent Runner，解析 Claude stream-json，形成类似 CMUX 的专门 Agent UI。

## 已保存的详细研究

- `research/cmux-agent-panes.md`：CMUX agent pane 源码调研与 CLI-Manager 映射。
- `prd.md`：当前需求、约束、可行方案与验收标准。
