# Token 趋势添加缓存折线

## Goal

在分析看板的 Token 趋势折线图中补充缓存 Token 曲线，让输入、输出、缓存写入、缓存命中在同一趋势图里可对比。

## What I already know

* 用户要求：“请求 Token 趋势 的折线图添加输入输出缓存的折线”。
* `history_get_stats` 的 `daily_series` 已返回 `cache_read_tokens` 和 `cache_creation_tokens`。
* `src/stores/historyStore.ts` 已归一化 `cache_read_tokens` 和 `cache_creation_tokens`。
* `src/components/stats/StatsPanel.tsx` 的 `DailyUsageTrendChart` 是当前分析看板挂载的 Token / 费用趋势图。
* `src/components/stats/CcusageStatsPanel.tsx` 也有同名趋势图，已有缓存数据字段但未画缓存折线。
* `src/components/stats/StatsTokenTrendChart.tsx` 目前未被引用。

## Requirements

* 当前分析看板 Token / 费用趋势图展示缓存写入与缓存命中折线。
* Tooltip 与图例能区分输入、输出、缓存写入、缓存命中。
* 不修改后端统计聚合，不新增依赖。
* 尽量保持 ccusage 趋势图与主分析看板趋势图表现一致。

## Acceptance Criteria

* [x] `StatsPanel` 的趋势图出现“缓存写入”和“缓存命中”两条折线。
* [x] `CcusageStatsPanel` 的趋势图出现“缓存写入”和“缓存命中”两条折线。
* [x] Y 轴最大值计算包含缓存写入/命中，避免曲线超出坐标范围。
* [ ] 前端类型检查通过（当前失败来自 unrelated 的 `FileExplorerSidebar.tsx` 事件类型）。

## Definition of Done

* 代码改动最小化。
* 通过 `npx tsc --noEmit` 验证。
* 如涉及 Rust 后端才运行 `cargo check`；本任务预计不涉及。

## Out of Scope

* 不调整后端 token 解析逻辑。
* 不重做统计看板布局。
* 不新增图表库或配置项。

## Technical Notes

* 候选文件由 ace-tool 语义搜索定位，随后直接读取代码确认。
* 相关文件：
  * `src/components/stats/StatsPanel.tsx`
  * `src/components/stats/CcusageStatsPanel.tsx`
  * `src/components/stats/statsPalette.ts`
  * `src/lib/types.ts`
  * `src/stores/historyStore.ts`
* 当前工作区已有多处未提交改动，实施时只触碰本任务需要的前端统计图文件。
