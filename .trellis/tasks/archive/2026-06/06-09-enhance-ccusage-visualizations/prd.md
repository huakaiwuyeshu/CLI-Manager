# Enhance ccusage Visualizations

## Goal

完善 ccusage 用量分析面板：当前 ccusage 输出里没有 `daily` 和 `modelBreakdowns` 时，面板只显示空态。目标是在不新增图表依赖的前提下，从现有 ccusage payload 中尽量提取更多可展示信息，并增加折线图、热力图等可视化，让 Claude / Codex 本地用量更容易判断趋势、结构和活跃度。

## What I already know

* 用户明确反馈：ccusage 输出中没有 `daily` 数据。
* 用户明确反馈：ccusage 输出中没有 `modelBreakdowns` 数据。
* 当前后端固定执行 `bunx ccusage [source] daily --json --offline`，并把原始 JSON payload 返回前端。
* 当前前端 `CcusageStatsPanel` 直接读取 `payload.daily` 与 `totals.modelBreakdowns` / `payload.modelBreakdowns`。
* 当上述字段缺失时，当前 UI 只显示“ccusage 输出中没有 daily 数据”和“ccusage 输出中没有 modelBreakdowns 数据”。
* 项目已有历史统计 SVG 图表实现，包括 Token 折线图、日活热力图、小时活动图、散点图等，不需要新增图表库。
* `package.json` 没有图表依赖，现有可视化主要用 React + SVG + CSS 变量实现。

## Assumptions (temporary)

* 优先保留 Rust 侧命令为“原始 ccusage 输出透传”，在前端做容错解析和派生统计。
* 不新增 npm 依赖。
* 不修改 ccusage 安装方式或全局环境行为。
* 如果 payload 没有逐日明细，就不能伪造日趋势；只能显示总览、结构、缺失说明和 raw-derived 信息。

## Research Notes

* ccusage JSON 文档存在两种日统计结构：旧/标准示例为 `daily[] + totals`，另一些文档示例为 `type: "daily" + data[] + summary`。
* ccusage 模型拆分通常由 `--breakdown` 开启，JSON 中可能表现为每日项内的 `modelBreakdowns` 或 `breakdown` 对象。
* 现有代码没有传 `--breakdown`，且只读取 `root.daily` 和 `root.totals`，所以遇到 `data/summary/breakdown` 结构时会误判为无 daily / 无 modelBreakdowns。

## Open Questions

* 无。

## Requirements

* 面板需要在 `daily` 缺失时不只显示空态，而是展示可从 payload 派生的更多信息。
* 面板需要增加折线图形式的 Token 趋势；若无逐日数据，应显示明确原因和降级视图。
* 面板需要增加热力图或类似密度图；若无逐日数据，应显示明确降级提示。
* 模型明细缺失时，需要优先从 `modelsUsed`、totals 或其它可用字段展示模型相关信息，而不是直接完全空白。
* 图表实现应沿用现有 `src/components/stats/*` 的 SVG/CSS 风格。

## Acceptance Criteria (evolving)

* [ ] ccusage payload 没有 `daily` 时，面板仍展示总览、Token 构成和可用字段摘要。
* [ ] ccusage payload 没有 `modelBreakdowns` 时，面板仍能展示模型数量、模型列表或明确的不可得原因。
* [ ] 有逐日数据时，展示 Token 折线图。
* [ ] 有逐日数据时，展示日活/Token 热力图。
* [ ] 无逐日数据时，折线图和热力图都有清晰空态，不误导用户。
* [ ] 不新增第三方图表依赖。
* [ ] 通过 TypeScript 类型检查。

## Definition of Done

* Tests added/updated where appropriate.
* `npm run build` or at least `npx tsc --noEmit` passes.
* UI behavior manually verifiable;本项目运行态桌面 UI 由用户人工验收。
* No dependency changes unless explicitly approved.

## Out of Scope (explicit)

* 不接入官方账单或云端 API。
* 不把 ccusage 数据等同于官方 billing。
* 不改 Bun/bunx 全局安装策略。
* 不新增大型图表库。

## Technical Approach

优先在 `CcusageStatsPanel` 内增加一个更健壮的 payload normalization 层：从 `totals`、`daily`、`modelsUsed`、可能存在的其它数组/对象字段中派生 summary、daily series、token composition、model summary 和 raw field overview；可视化用本项目已有 SVG 图表写法实现。

## Decision (ADR-lite)

**Context**: ccusage 输出字段不稳定，当前 UI 绑定 `daily` 和 `modelBreakdowns` 导致字段缺失时图表不可用；公开文档显示新版/不同口径可能返回 `data/summary`，模型拆分通常需要 `--breakdown`。

**Decision**: 采用“兼容两种 JSON schema + daily 命令加 `--breakdown`”方案。后端继续只采集 daily report，前端解析 `daily/totals/modelBreakdowns` 与 `data/summary/breakdown` 两类结构。

**Consequences**: 改动范围适中，不新增依赖；能解决当前空态误判和模型拆分缺失。代价是 daily 刷新输出会更详细，payload/cache 体积略增。

## Technical Notes

* `src-tauri/src/commands/ccusage.rs`: 当前 `REPORT_KIND = "daily"`，响应字段为 `{ source, reportKind, payload, refreshedAt }`。
* `src/stores/ccusageStore.ts`: SQLite cache 原样缓存 payload JSON，cache key 为 `${source}:daily`。
* `src/components/stats/CcusageStatsPanel.tsx`: 当前 summary 只解析 `root.daily`、`totals.modelBreakdowns`、`root.modelBreakdowns` 和 `modelsUsed`。
* `src/components/stats/StatsTokenTrendChart.tsx`: 可参考双折线 SVG、hover、keyboard focus 写法。
* `src/components/stats/TimelineHeatmap.tsx`: 可参考热力图 cell、level、hover、keyboard navigation 写法。
