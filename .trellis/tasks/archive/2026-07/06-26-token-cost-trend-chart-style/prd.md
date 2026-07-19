# 调整 Token 费用趋势图样式

## Goal

让历史用量分析里的 `Token / 费用趋势` 图表更易区分：费用也使用折线展示，Token 相关折线用实线/虚线区分，悬浮信息面板带上对应系列色彩。

## Requirements

* 费用不使用柱状图，改为右轴折线展示。
* ccusage 用量分析的 `Token / 费用趋势` 同样不使用费用柱状图，改为费用折线。
* 费用折线使用明确的暖色系费用颜色，不使用灰色或低辨识度中性色。
* `Token / 费用趋势` 图中的多条 Token 折线增加线型区分，保留现有颜色语义。
* 历史用量和 ccusage 图表悬浮信息面板中，每个系列行显示对应色彩标识，文字排版不能拥挤。
* 历史用量和 ccusage 的日期/月选择控件替换原生浏览器弹层，使用跟随主题色的本地 UI。
* 参照现有统计图共享色板，不新增依赖，不改后端统计数据。
* 同步更新图表提示文案，避免继续描述为柱状辅助。

## Acceptance Criteria

* [ ] 历史用量分析 `Token / 费用趋势` 的费用以折线展示，不再使用柱状图。
* [ ] ccusage 用量分析 `Token / 费用趋势` 的费用以折线展示，不再使用柱状图。
* [ ] 总 Token、输入、输出、缓存写入、缓存命中折线能通过实线/虚线组合区分。
* [ ] 历史用量和 ccusage Tooltip 每一行有对应系列色彩标识，费用按美元格式显示，Token 系列按 Token 格式显示。
* [ ] 历史用量 Tooltip 信息面板有足够宽度和行距，避免标签和值挤在一起。
* [ ] 历史用量和 ccusage 日期/月选择控件跟随主题背景、边框、文本和主色变化。
* [ ] `npx tsc --noEmit` 通过，或明确说明失败项是否与本次改动无关。
* [ ] 按项目规范列出桌面端手动验证项，不自动启动 Tauri 桌面程序。

## Definition of Done

* 代码改动最小化。
* 遵守前端统计图共享 palette 约定。
* 完成静态验证。

## Out of Scope

* 不修改后端 `history_get_stats`。
* 不引入新图表库。
* 不重做统计看板整体布局。
* 不改变日期过滤语义。

## Technical Notes

* 主图组件：`src/components/stats/StatsPanel.tsx` 的 `DailyUsageTrendChart`。
* ccusage 图组件：`src/components/stats/CcusageStatsPanel.tsx` 的 `DailyUsageTrendChart`。
* 日期控件：新增 `src/components/stats/StatsDatePicker.tsx`，替代原生 `input type="date/month"`。
* 费用颜色来源：`src/components/stats/statsPalette.ts` 的 `COST_COLOR`。
* 现有 ccusage 趋势图：`src/components/stats/CcusageStatsPanel.tsx`，当前费用也是柱状辅助量，峰值辅助线使用虚线。
* 前端规范：统计图颜色应使用 `src/components/stats/statsPalette.ts` 的共享语义色。
