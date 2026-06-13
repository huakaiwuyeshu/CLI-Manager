# Refine ccusage dashboard layout

## Goal

把 ccusage 用量分析面板从重卡片堆叠改成更轻量、更连续、更现代的图表看板。折线图保留并作为视觉主角，弱化卡片边框和碎片化指标块。

## Requirements

* 保留 ECharts 折线图、热点图、模型排行图。
* 顶部指标从多张重卡片改为轻量 KPI strip。
* 最高使用日信息融入 KPI strip 或趋势图区域，不再使用突兀大卡片。
* Token 构成改为轻量 segmented bar。
* 数据结构摘要弱化，默认放到底部小区域。
* 减少 Card 嵌套和强边框，让图表成为主视觉。

## Acceptance Criteria

* [ ] 面板顶部是轻量 KPI strip，而不是多张重卡片。
* [ ] 主趋势图是页面最突出的视觉区域。
* [ ] 最高使用日清晰可见但不突兀。
* [ ] Token 构成不再占用重卡片视觉。
* [ ] 热点图和模型排行保留。
* [ ] `npx tsc --noEmit` passes。
* [ ] `npm run build` passes。

## Definition of Done

* Static checks pass.
* User manually verifies desktop UI.

## Technical Approach

只修改 `CcusageStatsPanel.tsx` 的布局和局部组件样式；保留现有数据 normalization 和 ECharts wrapper。

## Decision (ADR-lite)

**Context**: 用户认可折线图效果，但明确反馈卡片使用很丑。

**Decision**: 减少重卡片容器，改用 KPI strip、轻量分区、连续布局。

**Consequences**: 视觉更统一，但仍保留现有 Card 外层弹窗和必要分区。

## Out of Scope

* 替换 ECharts。
* 修改 ccusage 后端命令。
* 新增其他报表维度。
