# Add ccusage time window filters

## Goal

为 ccusage 用量分析面板增加时间窗口筛选，让用户能按年、月、日以及自定义时间范围查看 KPI、趋势图、热点图和模型排行。

## What I already know

* 用户要求增加时间窗口：年、月、日、自定义时间查询。
* 当前 ccusage 面板已经有 normalized daily 数据和 ECharts 趋势图、热点图、模型排行。
* 过滤应优先在前端基于已缓存 daily 数据完成，不改后端 ccusage 命令。

## Requirements

* 支持按某一年查看。
* 支持按某个月查看。
* 支持按某一天查看。
* 支持自定义起止日期查询。
* KPI、趋势图、热点图、模型排行应跟随时间窗口重新汇总。
* 保留空数据状态。

## Acceptance Criteria

* [ ] 面板提供年 / 月 / 日 / 自定义时间窗口入口。
* [ ] 年筛选表示选择某一年，月筛选表示选择某个月，日筛选表示选择某一天。
* [ ] 选择时间窗口后，顶部 KPI 使用过滤后的数据。
* [ ] 主趋势图、热点图、模型排行使用过滤后的数据。
* [ ] 自定义时间范围无数据时显示清晰空态。
* [ ] `npx tsc --noEmit` passes。
* [ ] `npm run build` passes。

## Definition of Done

* Static checks pass.
* User manually verifies desktop UI.

## Technical Approach

优先只修改 `src/components/stats/CcusageStatsPanel.tsx`：在前端保留原始 summary，再根据选择的时间窗口过滤 daily，并基于过滤后的 daily 重新派生展示 summary。除非现有类型不够，否则不改 store 和后端。

## Decision (ADR-lite)

**Context**: 用户需要按年、月、日和自定义时间查询 ccusage 用量。

**Decision**: 年 / 月 / 日使用日历粒度筛选：选择某一年、某个月、某一天；自定义使用起止日期。

**Consequences**: 交互更符合历史分析场景；相比滚动窗口，用户需要明确选择具体日期范围。

## Open Questions

* 无。

## Out of Scope

* 修改 ccusage 后端命令。
* 新增远端查询能力。
* 改造整体统计系统。
