# AI Replay 进展视图重构

## Goal

将当前按 Hook 原始事件平铺的“时间轴”重构为按用户对话轮次聚合的“AI 进展”侧栏，让用户快速确认 AI 当前动作、文件改动、验证结果和最终回复，同时保留完整原始日志及快照恢复能力。

## Changelog Target

[TEMP]

## Requirements

- 默认显示“进展”视图，按用户 Prompt 划分轮次；最新轮次置顶并展开，轮次内部按时间正序展示。
- 每个轮次显示用户 Prompt 摘要、AI 最终回复摘要、状态、耗时，以及工具、文件、验证、子任务和异常概览。
- 复用历史 transcript 解析结果补充完整问答、工具输入输出和文件变更；Hook 事件继续负责实时状态和 transcript 尚未落盘时的降级展示。
- 工具和子任务只在 `toolUseId` / `agentId` 可精确匹配时合并开始与结束事件，不使用可能串并发事件的名称猜测。
- 详情在轮次或步骤原位置展开；完整 Diff 继续使用现有 DiffModal。
- 保留快照查看、回滚和 Fork。
- 提供次级“详细日志”视图，保留逐事件记录、搜索、类型筛选和原始 payload 查看。
- 不修改 SQLite、Tauri command、Hook payload 和 Replay 持久化格式，不增加依赖。
- 所有新增文案同时支持 zh-CN 与 en-US，时间继续使用 24 小时制。

## Acceptance Criteria

- [ ] 打开侧栏时能在首屏看到当前任务、当前动作和最新对话轮次，不再被会话卡片及统计卡片占满。
- [ ] 同一次工具调用的开始/结束事件合并为一个步骤，并展示运行中、完成或失败状态。
- [ ] 有 transcript 时可查看 Prompt、AI 回复、工具结果和文件变更；没有 transcript 时仍能显示 Hook 进展且不会串到其他会话。
- [ ] 文件变更可查看文件、增删行及 Diff；快照回滚/Fork 行为保持不变。
- [ ] 详细日志可搜索和筛选，并可内联展开原始事件。
- [ ] 窄侧栏无横向筛选滚动条，键盘焦点可见，展开控件带 `aria-expanded`。
- [ ] 聚合模型自动测试和 TypeScript 类型检查通过。

## Out of Scope

- 新增后端接口、数据库迁移或新的 AI 摘要调用。
- 将侧栏改造成完整聊天客户端或合规级审计导出系统。
- 重构历史工作区或实时统计面板的数据缓存架构。

## Technical Notes

- Main UI: `src/components/terminal/SessionReplayPanel.tsx`
- Raw events: `src/stores/replayStore.ts`
- Rich session detail: `fetchLatestProjectSessionDetail` in `src/stores/historyStore.ts`
- Transcript renderer: `src/components/history/SessionTranscriptContent.tsx`
- GitNexus refresh currently fails because `.gitnexus/lbug` is denied; impact analysis must be attempted and any stale result verified against direct source reads.
