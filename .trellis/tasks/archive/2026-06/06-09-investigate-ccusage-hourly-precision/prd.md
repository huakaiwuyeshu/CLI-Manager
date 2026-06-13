# Investigate ccusage hourly precision

## Goal

确认 ccusage 日视图小时图是否能使用 `blocks.entries` 做更精确聚合；如果 entries 不可用，则使用 block 的 `startTime` 到 `endTime` 窗口做小时均摊，让热点图和折线图更接近实际 5 小时窗口覆盖范围。

## What I already know

- 用户希望优先尝试方案 3：如果 `entries` 有细粒度时间与 token 字段，则按 entries 聚合。
- 如果方案 3 不可行，用户同意使用方案 2：按 block 覆盖窗口均摊到小时。
- 当前 `ccusage blocks --json --offline` 本机输出有 198 个 blocks。
- 本机输出中 `blocks.entries` 没有可用数据：`blocksWithEntries = 0`。
- block 顶层包含 `startTime`、`endTime`、`actualEndTime`、`tokenCounts`、`totalTokens`、`costUSD`。

## Requirements

- 优先检查 `entries` 是否可用；不可用时不再尝试方案 3。
- 使用 `startTime` 到 `endTime` 的时间窗口，把 block token/cost 平均摊到覆盖的小时中。
- 日视图仍固定显示 00:00-23:00。
- 不新增依赖，不改变后端命令。

## Acceptance Criteria

- [ ] `entries` 不可用时，前端按 block 时间窗口均摊小时数据。
- [ ] 跨小时 block 不再全部落在 `startTime` 所在小时。
- [ ] `npx tsc --noEmit` 通过。

## Definition of Done

- TypeScript 类型检查通过。
- 不启动 Tauri 桌面 UI，运行态视觉由人工验收。
- 不处理无关工作区改动。

## Technical Approach

修改 `src/components/stats/CcusageStatsPanel.tsx`：让 block 解析生成多个小时 item。每个 block 根据 `startTime/blockStart/id` 和 `endTime/actualEndTime` 计算覆盖小时数，将 input/output/cache/total/cost 按小时平均分摊。若缺少有效 `endTime`，回退为单小时。

## Decision (ADR-lite)

**Context**: `ccusage blocks` 的 `entries` 当前没有数据，无法按真实 entry 时间聚合。
**Decision**: 使用 block window 均摊作为 MVP。
**Consequences**: 小时图比起始小时归因更准确，但仍是近似值，不代表真实每小时 token 消耗。

## Out of Scope

- 不从原始 Claude/Codex 日志重新解析消息级时间。
- 不修改 Rust 后端命令。
- 不新增图表或日期库。

## Technical Notes

- 取证命令只输出字段摘要，不输出完整日志内容。
- 本机取证结果：`blockCount=198`、`blocksWithEntries=0`、`blocksWithEntryTime=0`、`blocksWithEntryTokens=0`。
