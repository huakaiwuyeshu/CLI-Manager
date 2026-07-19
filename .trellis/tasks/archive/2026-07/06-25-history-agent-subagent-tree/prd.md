# 历史会话 Agent 子 Agent 树形展示

## Goal

让历史会话列表能区分主 agent 会话与 subagent 会话，并以树形或同等清晰的方式展示父子来源，解决用户无法判断子 agent 由哪个主会话创建的问题。

## What I Already Know

* 用户当前能通过“复制定位”看到具体路径和 `sessionId`，但列表本身无法体现父子关系。
* 期望展示：历史会话中的 agent 与 subagent 通过树形结构或更友好的方式关联。
* `HistorySessionSummary` 当前只包含 `session_id/source/project_key/title/file_path/created_at/updated_at/message_count/branch`，没有父会话字段。
* 历史列表由 `src/components/history/HistoryListPane.tsx` 将 `groupedSessions` 扁平渲染为虚拟列表。
* 前端会话数据由 `src/stores/historyStore.ts` 调用 `history_list_sessions` 后通过 `toView` 转为 `HistorySessionView`。
* 后端 `history_list_sessions` 返回 `HistorySessionSummary`，当前没有显式输出 `parentSessionId`。
* 现有 `SessionSubtaskTreeView` 只在会话详情中基于消息内容识别子任务线索，不解决历史列表的跨会话父子关系。
* Claude subagent transcript 约定路径为 `<home>/.claude/projects/<project>/<parent-session-id>/subagents/agent-<agent-id>.jsonl`，可从 `file_path` 推导父会话 session id。
* 相关契约见 `.trellis/spec/backend/cli-hook-contracts.md`：subagent transcript 路径与 `sessionId/agentId` 关系已有明确约定。

## Assumptions

* MVP 优先不改历史文件格式，只基于已有 `file_path` 和 `session_id` 推导关系。
* 如果无法可靠推导父会话，子会话不强行挂到任意父节点，避免误导。
* 树形展示应保留当前搜索、项目筛选、来源筛选、分页加载、删除、继续会话等行为。

## Requirements

* 历史会话列表应能把可识别的 subagent 会话挂到对应父会话下。
* 父节点显示子会话数量，并支持展开/折叠。
* 子会话在视觉上缩进显示，能看出来源于哪个父会话。
* 子会话仍可点击打开、右键继续、删除。
* 当前搜索命中模式不需要强行树形化，避免搜索结果与父节点上下文混乱。
* 无法识别父级或父级未加载时，应按普通会话显示或显示为未关联子会话，不做错误归属。
* MVP 只在当前已加载列表内做父子树形归并；父会话未加载时不额外扫描加载父会话。

## Acceptance Criteria

* [ ] 当列表同时包含主会话和其 `subagents/agent-*.jsonl` 子会话时，主会话下方显示子会话。
* [ ] 父会话可展开/折叠，折叠时列表高度和虚拟滚动仍正常。
* [ ] 子会话标题、来源、消息数、更新时间仍可见。
* [ ] 点击子会话能打开对应历史详情。
* [ ] 删除/继续会话行为不因树形展示失效。
* [ ] 无父级可识别的会话不被错误挂载。
* [ ] `npx tsc --noEmit` 通过。

## Definition of Done

* 前端类型检查通过。
* 如修改 Rust 历史结构，`cd src-tauri && cargo check` 通过。
* 不引入新依赖。
* 不破坏现有历史列表筛选、分页和搜索行为。

## Out of Scope

* 不重写历史详情页的 `SessionSubtaskTreeView`。
* 不新增数据库表。
* 不做跨项目、跨来源的模糊父子匹配。
* 不把搜索结果页强制改成完整树视图。

## Technical Approach

推荐 MVP：在前端基于 `HistorySessionView.file_path` 推导 `parentSessionId`。

* 对 `.../<parent-session-id>/subagents/agent-*.jsonl` 形式的路径识别为子会话。
* 在当前已加载列表中查找相同 `source/project_key` 且 `session_id === parent-session-id` 的父会话。
* 将父会话和子会话组合成树形 rows，保持虚拟列表机制。
* 父会话未加载时，子会话按普通会话展示，避免分页场景误判。

## Decision

* 采用 MVP：只基于当前已加载的历史列表做父子归并。
* 父会话未加载时，子会话按普通会话显示。
* 不做跨项目、跨来源、跨分页的额外查找，避免引入扫描成本和误关联。

## Technical Notes

* 已检查：
  * `src/components/history/HistoryListPane.tsx`
  * `src/stores/historyStore.ts`
  * `src/lib/types.ts`
  * `src/components/history/SessionSubtaskTreeView.tsx`
  * `src/components/history/sessionEvents.ts`
  * `src-tauri/src/commands/history.rs`
  * `src-tauri/src/commands/subagent_transcript.rs`
  * `.trellis/spec/backend/cli-hook-contracts.md`
* 初步风险：
  * 后端分页只加载部分历史时，父会话可能不在当前页；MVP 不额外拉取可避免复杂度，但会出现暂时未归组。
  * 如果 Codex/Claude 历史路径格式变化，前端路径推导需要保持保守匹配。
