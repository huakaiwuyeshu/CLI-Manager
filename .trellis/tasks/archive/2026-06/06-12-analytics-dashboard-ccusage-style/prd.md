# 改造分析看板为 ccusage 风格与统计链路

## Goal

将当前历史会话“分析看板”改造成更接近 ccusage 看板的用量分析体验，并借鉴 cc-switch 的用量统计方式：数据源明确、token/cost 口径清晰、可按来源/模型/项目/时间聚合，UI 以连续图表看板为主，减少碎片化卡片堆叠。

## What I Already Know

* 用户希望“按照 cc-switch 的方式”改造分析看板，并让 UI 像现有 `CcusageStatsPanel` 风格。
* 用户明确允许新增 `cost/cache` 字段；本任务属于重构改造，允许大改造。
* 当前入口在 `src/App.tsx` 中由 `ccusageAnalyticsEnabled` 控制：开启时渲染 `CcusageStatsPanel`，否则渲染 `StatsPanel`。
* 当前历史分析看板主要文件：
  * `src/components/stats/StatsPanel.tsx`
  * `src/stores/historyStore.ts`
  * `src-tauri/src/commands/history.rs::history_get_stats`
* 当前 ccusage 风格看板主要文件：
  * `src/components/stats/CcusageStatsPanel.tsx`
  * `src/stores/ccusageStore.ts`
  * `src-tauri/src/commands/ccusage.rs`
* 本仓库已有多个历史统计图表组件：`StatsTrendChart`、`StatsTokenTrendChart`、`StatsTokenDonut`、`StatsSourceComparisonChart`、`StatsProjectEfficiencyScatter`、`StatsHourlyActivityChart`、`TimelineHeatmap`。
* 工作区已有与本任务无关的未提交变更：`src/components/TerminalTabs.tsx`、`.trellis/diagnostics/`、两个 06-12 终端任务目录。本任务不得触碰这些文件。

## Research References

* [`research/cc-switch-usage-statistics.md`](research/cc-switch-usage-statistics.md) — cc-switch 用量统计的关键模式：代理日志、CLI 会话日志、SQLite 明细/rollup、定价表、去重、前端实时刷新。

## Requirements

* 分析看板仍从本项目历史数据读取，不直接依赖 cc-switch 或外部服务。
* 借鉴 cc-switch 的统计口径，前端展示要明确区分数据来源、token 构成、模型/项目维度和时间窗口。
* UI 迁移到接近 `CcusageStatsPanel` 的轻量连续看板风格：顶部 Hero/KPI strip，主趋势图为视觉中心，减少厚重边框和重复卡片。
* 保留现有历史统计能力：总会话、消息数、输入/输出 token、项目排行、模型占比、热力图、来源分布、项目效率、小时活跃。
* 扩展历史统计 payload，新增 cache 与 cost 统计字段；cache 至少区分缓存读取和缓存创建，cost 需要清楚标注为本地估算。
* 支持在日趋势、项目/模型/来源聚合中表达 cost/cache，避免只在总览中展示孤立数字。
* 不引入新的图表依赖；优先复用现有 ECharts 封装和 stats 图表组件。
* 不改变历史会话列表/会话详情的行为。

## Acceptance Criteria

* [ ] 打开分析看板时，默认历史分析 UI 与 ccusage 看板风格一致：顶部摘要、时间/项目/来源筛选、主趋势图、辅助图表区。
* [ ] 历史统计的 token 展示包含输入、输出和总量，且来源分布可见。
* [ ] 历史统计展示 cache read / cache creation token；当历史日志无法提供该字段时应稳定回退为 0。
* [ ] 历史统计展示估算 cost；定价缺失或模型无法识别时不得报错，并要能看出该 cost 不是官方账单。
* [ ] 项目排行、模型构成、热力图、小时活跃等现有统计仍可访问。
* [ ] `ccusageAnalyticsEnabled` 的既有开关行为不被破坏。
* [ ] 前端类型检查通过：`npx tsc --noEmit`。
* [ ] 若改动 Rust 后端，`cd src-tauri && cargo check` 通过。

## Technical Approach

前后端同步改造：先扩展 `history_get_stats` 的统计结构，解析历史日志中的 input/output/cache usage，按内置模型价格表估算 cost；再扩展 TypeScript 类型和 store normalize；最后把 `StatsPanel.tsx` 迁移到接近 `CcusageStatsPanel` 的 summary / trend / composition / ranking 连续看板。成本口径只做本地估算，不包装成官方账单。

## Open Questions

* 是否只改默认历史分析看板 UI，保留独立 `CcusageStatsPanel` 开关；还是合并两个看板入口？默认倾向保留开关，降低迁移风险。

## Out of Scope

* 不接入 cc-switch 源码或 cc-switch 数据库。
* 不新增本地代理拦截统计。
* 不新增本地代理拦截统计。
* 不接入官方账单 API。
* 不修改终端相关未提交变更。

## Definition of Done

* 变更范围清晰，未覆盖无关工作区变更。
* 必要的 GitNexus impact analysis 已在改动目标符号前完成。
* 类型检查通过；如涉及后端则 Rust 编译检查通过。
* UI 变更列出人工桌面验证项。

## Technical Notes

* `StatsPanel.tsx` 当前是历史分析看板入口，约 22KB。
* `CcusageStatsPanel.tsx` 当前是 ccusage 风格用量看板入口，约 66KB，有可参考的 `KpiStrip`、`TokenCompositionStrip`、`TimeWindowSelector`、趋势图、热力图、模型排行等布局。
* `historyStore.ts` 已有 stats cache，避免无谓重复加载。
* 前端规范要求多使用现有组件风格，避免引入无用搜索控件和大范围重构。

## Implementation Notes

* 后端 `history_get_stats` 已扩展 `cache_read_tokens`、`cache_creation_tokens`、`total_cost_usd`、`unpriced_tokens`，覆盖 total / daily / project / source / model 聚合。
* usage 提取兼容 snake_case、camelCase、Claude cache 字段、OpenAI/Codex cached tokens 字段；Codex 成本计算按 cache-inclusive input 扣减 cache read。
* 定价采用内置小表 best-effort 匹配，未知模型不伪造费用，计入 `unpriced_tokens`。
* `StatsPanel` 已改为 ccusage 风格连续看板：KPI strip、Token 构成、Token/费用趋势、项目排行、模型排行、来源对比、热力图和日期会话下钻。
* 已验证：`npx tsc --noEmit`、`cd src-tauri && cargo check`、`cd src-tauri && cargo test history --lib`。
