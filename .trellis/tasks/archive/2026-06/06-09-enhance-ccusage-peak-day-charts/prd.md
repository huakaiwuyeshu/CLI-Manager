# Enhance ccusage peak day charts

## Goal

重构 ccusage 用量分析的图表体验，让用户能清楚看到哪天使用最多、费用/Token 趋势、每日热点密度和模型排行。美观优先，允许新增图表依赖。

## Requirements

* 使用更精致的图表方案展示 ccusage daily 数据。
* 折线/面积图必须明确标出最高使用日。
* 热点图必须展示每日用量密度，并突出最高使用日。
* 展示峰值日摘要：日期、Token、费用、输入、输出。
* 展示模型用量排行，优先按 Token/费用可读性排序。
* 保留空数据状态，不误导用户。
* 依赖变更必须更新 `package.json` 和 `package-lock.json`。

## Acceptance Criteria

* [ ] 主趋势图展示每日 Token/费用趋势。
* [ ] 主趋势图有最高使用日标记和 tooltip。
* [ ] 面板有峰值日摘要卡片。
* [ ] 热点图按每日 Token 低到高上色，并突出最高日。
* [ ] 模型排行图展示 Top models。
* [ ] 无逐日数据时显示清晰空态。
* [ ] `npx tsc --noEmit` passes。
* [ ] `npm run build` passes。

## Definition of Done

* Static checks pass.
* User manually verifies desktop UI after refresh.

## Technical Approach

Use Apache ECharts native package (`echarts`) with a small local React wrapper component. Prefer ECharts core/tree-shaking imports if practical, otherwise keep the first implementation simple and focused. Do not add `echarts-for-react`; one dependency is enough.

Charts:
* Main line/area chart: daily Token trend, cost as secondary visual/tooltip, max day highlighted by markPoint/markLine.
* Calendar heatmap: daily Token density, max day emphasized.
* Horizontal bar chart: model usage ranking.

## Decision (ADR-lite)

**Context**: Hand-written SVG is enough for basic charts but becomes costly for polished tooltip, peak highlighting, animation, heatmap, and responsive behavior.

**Decision**: Use Apache ECharts (`echarts`) directly, not a React wrapper dependency.

**Consequences**: Adds one runtime dependency and increases bundle size, but improves visual quality, interactions, and future chart extensibility.

## Out of Scope

* Backend ccusage command changes.
* Additional ccusage report commands.
* Full analytics dashboard redesign outside this panel.

## Technical Notes

* Current `CcusageStatsPanel` already normalizes daily rows and model breakdowns.
* `package-lock.json` exists, so dependency install must update lockfile.
* ECharts official docs use `echarts.init(...)`, `setOption(...)`, and dispose/resize lifecycle; React integration can be a small `useEffect` wrapper.
