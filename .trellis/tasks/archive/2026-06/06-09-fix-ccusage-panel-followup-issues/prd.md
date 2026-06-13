# Fix ccusage panel follow-up issues

## Goal

修复 ccusage 用量分析面板的后续展示与交互问题：统计面板支持 Esc 关闭、日视图小时数据继续排查并增强无数据说明、热点图低值和 0 值可区分、Token 数量展示使用 K/M 单位、最高使用日只展示日期不展示星期。

## What I already know

- 用户确认“这个窗口绑定 Esc 关闭”指 ccusage 统计窗口。
- 日视图小时数据当前依赖 `blocksPayload` 中的 `blockStart` 聚合为 00:00-23:00 小时桶。
- 如果 `blocksPayload` 为空、旧缓存未刷新、ccusage 当前来源没有 blockStart 记录，日视图小时数据仍会显示为全 0。
- 现有总 Token KPI 使用 `formatCount`，会展示完整数字，例如 `1,877,138,244`。
- 现有最高使用日 KPI 使用 `formatDayFromStart`，该格式包含星期。
- 现有热点图颜色把 0 值和很低非 0 值映射得过近，视觉上难区分。

## Requirements

- ccusage 统计面板打开时，按 Esc 关闭该面板。
- 日视图小时数据如果没有 blocks 数据，需要明确提示数据来源/刷新要求，避免误判为 UI 空白。
- 热点图中 0 使用量和低非 0 使用量必须可视觉区分。
- 总 Token KPI 使用紧凑单位：大于等于 1M 显示 M；未超过 1M 但大于等于 1K 显示 K；更小显示原数字。
- 最高使用日只展示日期，不展示星期。

## Acceptance Criteria

- [ ] 打开 ccusage 用量分析面板后，按 Esc 会关闭面板。
- [ ] 日视图小时热点图在缺少 blocks 数据时有明确说明，而不是让用户以为 ccusage 完全不支持。
- [ ] 热点图 0 值方块与低非 0 值方块颜色明显不同。
- [ ] 总 Token 为 `1,877,138,244` 时显示为 `1877.1M` 或同等 M 单位紧凑格式。
- [ ] 总 Token 未超过 1M 时显示 K 单位；未超过 1K 时显示原始数字。
- [ ] 最高使用日 KPI 和图表文案只展示日期，不包含星期。
- [ ] `npx tsc --noEmit` 通过。

## Definition of Done

- TypeScript 类型检查通过。
- 不新增依赖。
- 不启动 Tauri 桌面 UI，运行态视觉由人工验收。
- 不处理无关工作区改动。

## Technical Approach

以最小前端改动为主，集中修改 `src/components/stats/CcusageStatsPanel.tsx`：增加 Esc keydown effect、调整格式化函数和展示调用点、细化热点图颜色阶梯、在日视图无 blocks 使用量时补充提示。后端和 store 暂不改动，避免扩大范围。

## Out of Scope

- 不新增第三方日期/选择器/图表库。
- 不改变 ccusage 后端命令调用方式。
- 不自动安装或升级 ccusage/bun/bunx。
- 不启动桌面应用做人工 UI 验收。

## Technical Notes

- `CcusageStatsPanel` 挂载点：`src/App.tsx` 中 `CcusageStatsPanel open={statsOpen} onClose={() => setStatsOpen(false)}`。
- 主要代码位置：`src/components/stats/CcusageStatsPanel.tsx`。
- `KpiStrip` 当前总 Token 使用 `formatCount(summary.totalTokens)`。
- `KpiStrip` 当前最高使用日使用 `formatDayFromStart(peak.dayStart)`，包含星期。
- `formatCompactCount` 当前超过 1M 用 M，超过 1K 用 K，可复用但需要决定 KPI 展示精度。
- `DailyUsageHeatmap` 当前仅按 `item.totalTokens` 和 `maxTokens` 映射颜色，需要让 0 和低非 0 更明显区分。
