# Codex 和 Claude Code 可视化展示实施规划

## Goal

把 Codex / Claude Code 的历史会话从“记录查看”升级为“可追溯的 AI 开发过程审计视图”。第一阶段聚焦 5 个能力：会话执行时间线、子任务树增强、上下文窗口视图、文件变更链、工具调用诊断面板。

## What I already know

* 用户明确要规划并实施以下 5 个方向：
  * 会话执行时间线
  * 子任务树增强
  * 上下文窗口视图
  * 文件变更链
  * 工具调用诊断面板
* 项目已有历史会话、Diff、统计看板、子任务转录窗口等基础能力。
* 已保存产品方向文档：`docs/Codex-Claude-Code-可视化展示规划.md`。
* 历史工作区入口：`src/components/HistoryWorkspace.tsx`。
* 历史详情主渲染：`src/components/history/SessionDetailPane.tsx`。
* Transcript 内容渲染：`src/components/history/SessionTranscriptContent.tsx`。
* Diff 弹窗已经支持从 diff 跳回消息：`src/components/history/DiffModal.tsx`。
* Diff 解析 worker 已能从消息中提取文件级 patch：`src/lib/diffParser.worker.ts`。
* 会话统计侧栏已有 Token 趋势、上下文、工具计数卡片：`src/components/history/SessionStatsPanel.tsx`、`src/components/stats/termStatsCards.tsx`。
* 历史 store 当前会 normalize 消息、usage、token_trend、tool counts：`src/stores/historyStore.ts`。
* 后端 `history_get_session` 当前返回消息、usage、token_trend、context_window、last_context_tokens、tool_call_count、mcp_calls、skill_calls、builtin_calls：`src-tauri/src/commands/history.rs`。
* 后端当前没有返回完整工具调用明细、调用耗时、每次调用成功/失败状态，因此“慢命令/失败命令集中展示”需要后端补结构化事件，不能只靠现有 usage 字段完整实现。

## Assumptions

* 第一阶段优先在历史会话详情中增强可视化，不新建完全独立的主入口。
* 尽量复用现有历史解析、Diff 提取、Token 统计和子任务转录能力。
* 不引入新依赖，除非现有数据结构无法支撑必要交互。
* 先做 Codex / Claude Code 共通抽象，供应商差异通过字段缺失降级展示。
* MVP 先保证“可追溯”，再做“完整诊断”。

## Requirements

### R1. 会话执行时间线

* 将一次历史会话解析成事件流。
* 事件至少覆盖：用户消息、模型回复、工具调用、文件读取、文件编辑、测试命令、错误。
* 时间线节点可点击。
* 点击节点后展示对应原文、命令输出、diff 或上下文片段。
* 支持筛选：错误、文件改动、工具调用。

### R2. 子任务树增强

* 在主视图中展示主任务和子任务层级。
* 子任务节点展示状态、耗时、Token、修改文件数、错误状态、最后结论。
* 点击子任务节点时复用现有子任务窗口/转录查看能力。

### R3. 上下文窗口视图

* 展示每轮输入 Token、输出 Token、累计 Token。
* 标记上下文压缩点、摘要生成点、历史截断点。
* 展示上下文增长趋势。
* 字段缺失时降级展示，不阻塞会话详情打开。

### R4. 文件变更链

* 建立模型消息和 diff 的双向关联。
* 支持从消息跳到 diff。
* 支持从 diff 跳回触发消息。
* 支持按文件查看本会话中被哪些轮次修改过。
* 按时间展示 patch / edit 事件。

### R5. 工具调用诊断面板

* 展示 shell / read / search / patch / test 等工具调用。
* 显示成功/失败、耗时、输出摘要、错误输出。
* 慢命令高亮。
* 失败命令集中展示。

## Acceptance Criteria

* [ ] 历史会话详情中出现统一的“过程/时间线”类入口或标签。
* [ ] 能在至少一个已有 Codex 或 Claude Code 历史会话中看到消息、工具调用、文件变更事件。
* [ ] 时间线筛选可用，不影响原有 transcript 阅读。
* [ ] Diff 与触发消息可以互相跳转。
* [ ] 子任务总览能打开现有子任务详情。
* [ ] Token / 上下文视图在数据存在时展示，在数据缺失时有明确空态。
* [ ] 工具调用失败和慢调用能被单独查看；若当前历史无耗时字段，需以后端新增结构化事件完成。
* [ ] 前端类型检查通过。
* [ ] Rust 编译检查通过，如后端有改动。

## Definition of Done

* 最小实现满足 MVP，不追求大而全。
* 不引入和现有设计体系冲突的新视觉风格。
* 不破坏现有历史会话、Diff、统计看板、子任务窗口能力。
* 新增逻辑有清晰边界，可继续扩展到更多供应商。
* 执行必要验证：`npx tsc --noEmit`；如改 Rust，执行 `cd src-tauri && cargo check`。

## Out of Scope

* 本阶段不做复杂自动评分系统。
* 本阶段不做跨模型排行榜。
* 本阶段不做大而全的全局 AI 看板首页。
* 本阶段不做花哨知识图谱或低信息密度网络图。
* 本阶段不强行补齐历史记录中不存在的数据，只做可用字段的结构化展示。

## Technical Approach

推荐分两阶段实施。

### Phase 1：前端 MVP，复用现有数据

核心目标：先让用户能看到“会话过程”和“消息 ↔ diff ↔ 上下文”的可追溯关系。

* 在 `src/components/history/` 下新增会话过程相关组件和解析工具。
* 在 `SessionDetailPane` 内增加详情视图切换，保留原始 transcript 为默认或可切换视图。
* 新增统一 `SessionEvent` 前端抽象，基于 `HistoryMessage[]`、`HistorySessionUsage` 和 diff worker 结果生成。
* 复用 `src/lib/diffParser.worker.ts` 的 diff 提取能力，避免重复写 patch 解析。
* 上下文窗口视图直接复用 `usage.token_trend`、`context_window`、`last_context_tokens`。
* 工具诊断 MVP 先展示工具计数、疑似工具调用消息、错误消息、patch 事件；耗时/状态明细留给 Phase 2。

### Phase 2：后端补结构化事件

核心目标：补齐“每次工具调用”的状态、耗时、输出摘要、错误输出。

* 在 `src-tauri/src/commands/history.rs` 中扩展 `HistorySessionDetail`，新增结构化事件或工具调用明细字段。
* 从 Claude tool_use/tool_result、Codex function_call/function_call_output/mcp_tool_call_end 等 JSONL 行中提取：
  * call id
  * tool name
  * category
  * message index 或 line index
  * timestamp
  * input / output 摘要
  * success / failure
  * duration（仅当原始日志能提供）
* 前端 normalize 新字段并接入 `SessionEvent`。

## Implementation Plan

### PR1：会话过程视图骨架

需要修改：

* `src/lib/types.ts`：补充前端事件类型，或新增独立 `historyEvents` 类型文件。
* `src/components/history/SessionDetailPane.tsx`：增加“原文 / 过程 / 上下文 / 变更 / 工具”视图切换。
* `src/components/history/SessionTimelineView.tsx`：新增时间线视图组件。
* `src/components/history/sessionEvents.ts`：新增从 `HistorySessionDetail` 生成 `SessionEvent[]` 的纯函数。

验收：能在历史详情中切换到过程视图，并看到用户、助手、工具、错误、文件变更事件。

### PR2：文件变更链和消息跳转

需要修改：

* `src/lib/diffParser.worker.ts`：如有必要导出可复用解析逻辑或新增轻量同步解析函数。
* `src/components/history/SessionFileChangesView.tsx`：新增按文件聚合的变更链。
* `src/components/history/DiffModal.tsx`：保留现有弹窗能力，必要时共享 parsed diff 结构。
* `src/components/HistoryWorkspace.tsx`：补充从过程视图跳转消息的回调传递。

验收：可以从文件变更跳到触发消息，也可以从消息关联看到 diff。

### PR3：上下文窗口视图

需要修改：

* `src/components/history/SessionContextView.tsx`：新增上下文/Token 趋势视图。
* `src/components/stats/termStatsCards.tsx`：尽量复用已有 Token 和 Context 卡片，避免重复实现。

验收：Token 趋势、累计、上下文窗口和最后上下文占用可见；缺失数据时显示空态。

### PR4：子任务树增强

需要修改：

* `src/components/history/SessionSubtaskTreeView.tsx`：新增主任务/子任务总览。
* `src/components/terminal/SubagentTranscriptView.tsx` 或相关打开逻辑：复用现有子任务窗口能力。
* 必要时扩展 store 中子任务元数据来源。

验收：历史详情中能看到子任务层级，并能打开现有子任务详情。

### PR5：工具调用诊断增强

需要修改：

* `src-tauri/src/commands/history.rs`：新增工具调用明细字段。
* `src/lib/types.ts`：新增工具调用明细类型。
* `src/stores/historyStore.ts`：normalize 工具调用明细。
* `src/components/history/SessionToolDiagnosticsView.tsx`：展示失败、慢调用、输出摘要。

验收：失败工具调用和慢工具调用可单独查看；如原始日志没有耗时，显示“无耗时数据”而不是伪造。

## Decision (ADR-lite)

**Context**: 用户要一次性规划并实施 5 个可视化能力，但现有后端数据只完整支持消息、Token、上下文和工具计数，不完整支持工具调用耗时/状态明细。

**Decision**: 采用“两阶段实施”。先以前端事件抽象复用现有数据交付可追溯 MVP，再由后端补结构化工具调用事件实现完整诊断。

**Consequences**:

* 优点：第一阶段改动更小，能快速落地核心价值，不破坏现有历史详情。
* 缺点：工具调用诊断在 Phase 1 只能做到“概览/疑似事件”，完整耗时和失败状态依赖 Phase 2。
* 后续：一旦后端工具事件稳定，所有视图共享 `SessionEvent` 数据源继续增强。

## Technical Notes

* UI 应偏工作台/审计台风格，信息密度优先，避免营销页式大卡片。
* 时间线、诊断、文件变更链应共享同一事件数据源，避免重复解析。
* 当前历史详情布局位于 `HistoryWorkspace`：左侧列表 + 右侧 `SessionDetailPane`，适合在详情内部增加标签页，不适合再开全屏大看板。
* `DiffModal` 当前已支持 `onJumpToMessage`，应复用现有消息定位逻辑。
* 工具耗时不能猜；只有原始日志字段存在时才展示。
