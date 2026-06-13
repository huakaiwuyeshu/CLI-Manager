# Fix ccusage time filter charts

## Goal

修复 ccusage 时间筛选和图表显示问题：时间选择器必须可见，图表轴范围更舒适，热点图改成类 GitHub 方块风格，并让图表粒度随时间窗口变化。

## Requirements

* 时间选择框必须在面板中清晰可见。
* 柱状图/数值轴最大值不要贴近数据峰值，例如最大值 144 时应扩展到 200 这类更舒适刻度。
* 热点图使用更接近 GitHub contribution graph 的正方形方块、柔和绿色系配色。
* 过滤后图表必须跟随时间窗口变化。
* 粒度规则：日视图按小时，月视图按天，年视图按月，自定义按天。

## Acceptance Criteria

* [ ] ccusage 面板能看到时间选择器。
* [ ] 趋势图/排行图数值轴不会贴顶。
* [ ] 热点图方块接近正方形，颜色更像 GitHub 热点图。
* [ ] 月筛选按天展示。
* [ ] 年筛选按月展示。
* [ ] 自定义筛选按天展示。
* [ ] 日筛选按小时展示；若数据源没有小时数据，需要清晰说明或补齐数据源方案。
* [ ] `npx tsc --noEmit` passes。
* [ ] `npm run build` passes。

## Technical Notes

* 当前 ccusage 面板已基于 daily 数据做前端过滤。
* `src-tauri/src/commands/ccusage.rs` 当前固定 `REPORT_KIND = "daily"`，不会返回小时数据。
* `bunx ccusage --help` 显示没有 hourly 命令，只有 daily/monthly/weekly/session。
* `bunx ccusage session --json --offline` 的 `metadata.lastActivity` 部分记录包含 ISO 时间戳，可用于日视图按小时近似聚合；只有日期的 session 无法精确归小时，只能按 00:00 或跳过，需要实现时保守处理。

## Decision (ADR-lite)

**Context**: 用户要求日视图按小时、月视图按天、年视图按月、自定义按天展示。

**Decision**: 扩展 ccusage 刷新结果，同时缓存 daily 与 session payload；图表层根据时间窗口生成 display buckets。

**Consequences**: 改动范围从单前端文件扩大到后端命令、store 缓存和面板聚合逻辑；日视图小时粒度依赖 session 报告中的 timestamp，缺少小时的 session 不能精确归类。

## Out of Scope

* 不改非 ccusage 面板的统计看板。
