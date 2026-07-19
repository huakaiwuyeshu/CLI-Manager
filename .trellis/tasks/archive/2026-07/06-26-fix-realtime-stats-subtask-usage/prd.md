# 修复实时统计遗漏子任务用量

## Goal

修复终端侧“实时统计”面板，使其在存在子任务（Subagent/子 Agent）转录文件时，不再只统计父会话单个 transcript，而能正确纳入子任务产生的 token、工具调用和相关上下文信息。

## What I already know

* 当前实时统计入口在 `src/components/terminal/TerminalStatsPanel.tsx`，通过 `fetchLatestProjectSessionDetail()` 拉取会话详情。
* `src/stores/historyStore.ts` 中的 `fetchLatestProjectSessionDetail()` 只会选中一个最近会话 summary，再调用一次 `history_get_session` 获取单文件详情。
* `src-tauri/src/commands/history.rs` 中的 `history_get_session()` / `build_session_detail()` 当前只解析单个 jsonl 文件。
* 子任务 transcript 是独立文件；历史列表已有通过 `file_path` 中 `/subagents/agent-*.jsonl` 反推父会话的逻辑，说明“父会话 + 子任务文件”目前是分离存储的。
* 现有实现下，父会话详情天然不会包含子任务独立 transcript 的 usage / tool / message 信息，因此实时统计会漏算。

## Assumptions (temporary)

* 用户提到的“子任务”指 CLI Hook 打开的子 Agent / Subagent transcript。
* 目标优先是修复实时统计口径，不扩展历史详情页的完整子任务回放能力。

## Requirements (evolving)

* 父终端的实时统计需要聚合“父会话 + 全部子任务”后的总量。
* 实时统计不能再只统计父会话单文件数据。
* 修复后需要覆盖子任务产生的 token 用量与相关统计信息。
* 聚合口径至少覆盖 Token 用量、趋势、模型上下文、工具调用与消息统计。

## Acceptance Criteria (evolving)

* [ ] 有子任务 transcript 时，实时统计的 token 用量不再低于父会话单文件口径，且等于父会话与子任务汇总口径。
* [ ] 工具调用/模型上下文/趋势图等会话级统计与聚合口径一致。
* [ ] 无子任务时，现有实时统计行为不回退、不串显。

## Definition of Done (team quality bar)

* 类型检查通过
* 如涉及 Rust 后端，`cargo check` 通过
* 列出需要人工验证的实时统计场景

## Out of Scope (explicit)

* 历史详情页的完整子任务树回放重构
* 新增与本问题无关的统计卡片或 UI 改版

## Technical Notes

* 已检查文件：
  * `src/components/terminal/TerminalStatsPanel.tsx`
  * `src/stores/historyStore.ts`
  * `src-tauri/src/commands/history.rs`
  * `src/components/history/HistoryListPane.tsx`
* 相关规范：
  * `.trellis/spec/backend/history-stats-contracts.md`
  * `.trellis/spec/backend/cli-hook-contracts.md`
  * `.trellis/spec/frontend/state-management.md`
