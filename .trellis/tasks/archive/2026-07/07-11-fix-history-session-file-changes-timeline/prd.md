# 修复历史会话文件变更解析与记录展示

## Goal

从 Claude/Codex 会话 JSONL 文件中按时间顺序解析文件编辑操作，并在“会话历史 -> 会话 -> 变更”中展示文件变更信息列表；点击文件后查看该次操作对应的 Diff。

## Changelog Target

`[TEMP]`

## Requirements

- 变更数据来源必须是当前历史会话对应的 JSONL 文件，不能依赖当前工作区文件推断历史状态。
- 后端按 JSONL 记录顺序解析 `Write`、`Edit`、`apply_patch` 及兼容格式中的文件路径、旧内容、新内容或 Patch。
- 每批文件操作保留时间戳、消息索引和操作组索引，作为前端记录排序依据。
- “变更”页按操作时间展示文件变更信息列表，列出文件路径及增删行数。
- 点击文件只展示该次操作、该文件对应的 Diff。
- 文件行使用与文件浏览器相同的 Material 文件图标。
- 文件行右键菜单支持跳转到产生该次修改的原文对话；无消息索引时菜单禁用。
- 历史 Diff 复用文件浏览器的 `GitDiffViewer`，保持只读并禁用 Git 回滚操作。
- Apply Patch 格式必须先转换为标准 unified diff，确保 `GitDiffViewer` 使用左右分栏而不是 Monaco 单栏兜底。
- 文件行使用彩色 Tag 区分新增、修改、删除；增加行与删除行分别使用绿色和红色。
- Codex 工具调用中以 `\\n` 保存的转义 Patch 必须先还原，再解析文件路径和增删行数。
- 顶部查看全部变更入口保留，展示当前会话解析出的全部 Diff。
- Claude 与 Codex 历史格式均需兼容；旧会话仅能从消息文本提取 Diff 时保留兜底展示。
- 不读取当前项目文件补齐旧内容，避免展示与历史时间点不一致的结果。

## Acceptance Criteria

- [ ] 存在结构化文件操作的会话不再错误显示“当前会话暂未解析到文件变更”。
- [ ] 变更列表按 JSONL 中的操作时间顺序分组展示。
- [ ] 每条变更记录正确列出该次操作涉及的文件名称。
- [ ] 点击具体文件后仅显示该次操作中该文件的 Diff。
- [ ] Codex 转义 Patch 不再显示 `unknown-file` 和错误的 `+0 / -0`。
- [ ] 查看全部变更可显示会话中的全部已解析 Diff。
- [ ] Claude `tool_use` 与 Codex `function_call` / `custom_tool_call` / `file-history-snapshot` 解析有测试覆盖。
- [ ] 无文件变更的会话继续显示空状态。
- [ ] 前端类型检查和 Rust 相关测试通过。

## Definition of Done

- 使用现有历史会话数据结构，不新增依赖。
- 改动保持在历史解析与历史变更展示链路内。
- 用户可见文案同步兼容 `zh-CN` 与 `en-US`。
- 更新 `CHANGELOG.md` 的 `[TEMP]` 版本记录。
- 运行 GitNexus 变更影响检查。

## Technical Approach

后端继续由 `scan_file_changes` 单遍读取会话 JSONL，先还原 Codex 工具调用中的转义 Patch，再解析文件路径和增删行数；前端直接消费 `HistorySessionDetail.file_changes`，按 `operation_group_index`，其次按 `timestamp/message_index` 排列变更记录。点击文件时构造仅包含目标 operation 的 `HistoryFileChangeSummary` 交给现有 `DiffModal`，不重复实现 Diff 渲染器。

## Decision (ADR-lite)

**Context**: 当前后端已经返回 `file_changes`，但“变更”页仍只从渲染后的消息文本提取 Diff，且历史工作区打开 `DiffModal` 时没有传入结构化变更数据。

**Decision**: 以会话 JSONL 解析结果作为主数据源，消息文本 Diff 仅作为旧数据兼容兜底；按操作时间展示文件变更记录，不读取当前工作区文件推断历史内容。

**Consequences**: 能准确关联操作时间和文件变更；当原始 JSONL 只记录最终内容且没有旧内容时，只能展示日志中可还原的 Diff，不能伪造历史基线。

## Out of Scope

- 不通过 Git 仓库提交历史反推会话变更。
- 不读取当前工作区文件作为历史 Diff 基线。
- 不新增数据库表或持久化重复的 Diff 数据。
- 不重构会话详情其他视图。

## Technical Notes

- 后端入口：`src-tauri/src/commands/history.rs` 中的 `history_get_session`、`scan_file_changes`。
- 前端入口：`src/components/HistoryWorkspace.tsx`、`src/components/history/SessionDetailPane.tsx`、`SessionFileChangesView.tsx`、`DiffModal.tsx`。
- GitNexus 影响分析：`buildSessionProcessModel`、`SessionFileChangesView`、`DiffModal`、`HistoryWorkspace` 均为 LOW 风险。
