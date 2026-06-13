# fix-ccusage-chart-display-issues

## Goal

修复 ccusage 用量分析面板的图表展示问题，让日视图小时热点、时间窗口选择、趋势图坐标、tooltip 和峰值标记更稳定、更清晰。

## What I already know

- 用户反馈：日统计按小时 Token 热点图没有数据。
- 用户反馈：时间选择框需要更好看的组件。
- 用户反馈：热点图缺失时间要显示空方块，不应直接不显示。
- 用户反馈：折线图 x 轴需要显示坐标。
- 用户反馈：折线图 tooltip 内容需要文字左对齐、数据右对齐。
- 用户反馈：折线图最高标记是水滴型，但字体太大导致数据显示不完整，需要调小。
- 当前前端 `src/components/stats/CcusageStatsPanel.tsx` 负责解析 ccusage payload、时间窗口筛选和图表 option。
- 当前后端 `src-tauri/src/commands/ccusage.rs` 返回 `dailyPayload + sessionPayload`。
- 当前 `normalizeSessionItem` 读取 `metadata.lastActivity`，且要求时间字符串包含 `T`。
- ccusage 官方 JSON 文档显示 `session --json` 的 `lastActivity` 是顶层字段，通常是 `YYYY-MM-DD` 日期，不含小时。
- ccusage 官方 JSON 文档显示 `blocks --json` 有 `blockStart` ISO 时间，可提供小时级/块级时间定位。
- GitNexus 当前索引未识别新 ccusage 符号：`CcusageStatsPanel`、`normalizeSessionItems`、`ccusage_refresh_report` 均返回 target not found；这些文件很可能是当前未纳入索引的新改动。

## Assumptions (temporary)

- 本任务优先修复现有 ccusage 面板，不引入新依赖。
- 时间选择框优先沿用项目已有 `Select` 风格，对原生 date/month input 做视觉统一，而不是引入日期选择库。
- 日视图小时热点如果需要真实小时分布，应使用 `blocks --json` 或更底层日志；仅靠 `session --json` 无法得到真实小时。

## Open Questions

- 暂无阻塞问题。

## Requirements (evolving)

- 修复日视图热点数据解析，不再依赖错误的 `metadata.lastActivity`。
- 后端额外拉取 `ccusage blocks --json --offline`，前端按 `blockStart` 所在小时聚合到 24 小时格。
- 日视图需要固定展示 00:00-23:00 共 24 个时间格，无数据时显示空方块。
- 年/月/日/自定义时间窗口下，趋势图 x 轴要保留可读坐标。
- 折线图 tooltip 内部行布局要左侧标签、右侧数值对齐。
- 峰值水滴标记字体/尺寸需要缩小，避免数值被截断。
- 时间窗口控件需要更精致，符合当前设置/看板视觉。

## Acceptance Criteria (evolving)

- [ ] 日视图选择某一天后，热点图固定显示 00:00-23:00 的 24 个方块。
- [ ] 无 Token 的小时/时间桶显示为空方块，不隐藏。
- [ ] 折线图在 day/month/year/custom 模式下均显示 x 轴坐标标签。
- [ ] 折线图 tooltip 每行标签左对齐、数值右对齐。
- [ ] 峰值水滴标记完整显示紧凑数值。
- [ ] 时间窗口选择区域视觉更统一，不使用突兀的原生控件外观。

## Definition of Done

- TypeScript 类型检查通过。
- 如修改 Rust 命令，执行 Cargo 检查。
- UI 运行态按用户记忆由用户人工验收；AI 不自动启动桌面应用。
- 不新增项目依赖，除非用户额外确认。

## Technical Notes

- 关键文件：`src/components/stats/CcusageStatsPanel.tsx`
- 关键文件：`src/components/stats/EChart.tsx`
- 关键文件：`src/stores/ccusageStore.ts`
- 关键文件：`src-tauri/src/commands/ccusage.rs`
- 关键组件：`src/components/ui/select.tsx`
- 外部资料：ccusage JSON 文档说明 `session --json` 返回 `data[].lastActivity` 日期；`blocks --json` 返回 `data[].blockStart` ISO 时间。

## Out of Scope (draft)

- 不重做整个 ccusage 看板布局。
- 不引入新的图表库或日期选择依赖。
- 不解析完整原始 JSONL 日志，除非用户明确选择真实小时精度方案。
