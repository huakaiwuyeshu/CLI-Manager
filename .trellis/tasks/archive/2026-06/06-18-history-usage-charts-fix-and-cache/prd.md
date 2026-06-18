# 历史用量分析图表交互修复与加载缓存优化

## Goal

修复 v1.1.5「历史用量分析」重构后引入的若干图表交互缺陷，补齐 Token 趋势的缓存维度与配色区分，重做短范围（7 天）会话热力图的空旷布局，并优化历史用量加载速度（冷启动慢）。目标是让看板在悬浮交互、信息完整度、视觉密度与加载性能上达到可用、好看、快速。

## What I already know（已诊断根因）

- **图1 Token/费用趋势**（`src/components/stats/StatsPanel.tsx` `DailyUsageTrendChart` ~508-640，ECharts）：
  - 悬浮折线消失：series 颜色用 CSS 变量字符串（`var(--accent)` / `color-mix(...)`），ECharts 进入 emphasis/blur 时需自行解析颜色派生高亮色，无法解析 `var()`/`color-mix()` → 派生透明/空色 → 悬浮时整条线消失（圆点带显式 itemStyle 故仍在）。
  - 缺缓存：当前 series 为 `总Token / 输入 / 输出 / 费用`，缓存命中/写入只在 tooltip 末尾纯文字，无独立系列。`statsPalette.ts` 已定义 `cacheCreation/cacheRead` 色但未作为系列使用。
  - 颜色不分：`color: [ACCENT, SERIES_COLORS.input, ...]`，而 `SERIES_COLORS.input === var(--accent) === ACCENT`，导致「总Token」与「输入」同色。
- **图2 模型用量排行**（`StatsPanel.tsx` `ModelRankingChart` ~646-713，ECharts 横向 bar）：
  - 悬浮柱消失：同 `var()` 颜色 emphasis 解析失败根因。
  - 下方留白：容器固定 `h-[300px]`，模型数量少（截图 ~6）时 category 撑不满 → 底部空白。
- **图3 活跃时段分布**（`src/components/stats/StatsHourlyActivityChart.tsx`，SVG）：
  - 横向滚动条：SVG 固定 `width=620` 套在 `overflow-x-auto` 容器，容器宽度 ≠ 620 即出现横向滚动条。
  - 悬浮看不到数据：hover 仅更新右上角汇总文字，光标处无 tooltip，信息离视线远。
- **图4 会话热力图**（`src/components/stats/TimelineHeatmap.tsx`，SVG grid）：
  - 7 天空旷：day 粒度用 GitHub 式 `grid-rows-7` × N 列、14px 小格；7 天仅 1~2 列 → 极小、大片留白。
- **图5 加载慢**（`src-tauri/src/commands/history.rs`）：
  - 后端已有多层缓存：`refresh_history_index_snapshot`（内存索引快照 + TTL + 按 fingerprint 增量复用 + 并行解析）、`stats_aggregation_cache`、`stats_daily_index_cache`；前端 `historyStore.ts` 也有 LRU `statsCache`。
  - 瓶颈是**冷启动**：索引为 `OnceLock<RwLock<HistorySessionIndex>>` 纯内存，无磁盘持久化；每次 App 启动后首个 `history_get_stats` 必须全量扫描+解析所有 JSONL（可能上千个），耗时不可接受。

## Assumptions（待验证）

- 截图来自历史用量分析面板（非 ccusage 面板）；但 `CcusageStatsPanel.tsx` 很可能存在同源 `var()` 颜色 emphasis bug，应一并核查。
- 颜色根因修复优先采用「把 `var()`/`color-mix()` 解析为具体 rgb 再交给 ECharts」，从根上修好 emphasis 派生色，且随主题切换重解析。

## Decisions（已确认 2026-06-18）

- **图4 热力图重做**：短范围（7 天）改为**横向条形图**——最高条铺满图宽（按最大值归一化，不用固定比例，避免大片留白）；条形颜色按活跃强度变化（色阶）。长范围（90 天）保留**热力网格**（90 行条形列表过长）。30 天阈值归属待确认。
- **图5 加载缓存**：**索引持久化到磁盘**（per-file `computed` 序列化到 appLocalData，启动载入 + fingerprint 校验，仅重解析变更文件）。
- **图1 缓存维度**：新增**单条「缓存」折线**（命中+写入合并，橙色 `cacheCreation`），与 总Token/输入/输出 并列；总Token/输入/输出/缓存 各用可区分颜色；费用仍为右轴弱柱。
- **图4 热重做阈值**：**7 天 → 横向条形图**；**30 / 90 天 → 热力网格**（已确认默认）。
- **统计口径**：用户确认**第 5 点纯粹是优化加载速度，无任何指标/口径改动**。

## Open Questions

（已全部澄清）

## Requirements（evolving）

1. 修复图1/图2 悬浮时线/柱消失（根因：ECharts 无法解析 `var()`/`color-mix()` 派生色）；一并核查 `CcusageStatsPanel.tsx` 同源问题。
2. 图1 增加单条「缓存」折线（命中+写入合并，橙色），并让 总Token/输入/输出/缓存 各用可区分颜色（随主题自适应）。
3. 图2 消除底部留白（按模型数量自适应高度）。
4. 图3 改为响应式宽度（占满容器、无横向滚动条），并提供光标处可见的 tooltip。
5. 图4 短范围（7 天）改横向条形图（最大值归一化铺满宽度、按强度变色）；30/90 天保留热力网格。
6. 图5 后端历史索引持久化到磁盘，加速冷启动首次加载。

## Acceptance Criteria（evolving）

- [ ] 悬浮图1/图2 时，折线与柱状保持可见，tooltip 正常。
- [ ] 图1 含缓存维度且各系列颜色可区分，随主题自适应。
- [ ] 图2 无明显底部留白。
- [ ] 图3 无横向滚动条、宽度自适应，悬浮可见数据。
- [ ] 图4 在 7 天范围下不空旷（条形铺满、按强度变色）；30/90 天仍为热力网格。
- [ ] 冷启动（重启 App）后首次加载历史用量明显加快。
- [ ] `npx tsc --noEmit` 与 `cargo check` 通过。

## Definition of Done

- 受影响图表交互/视觉修复并自测。
- 类型检查 / cargo check 通过；UI 由用户最终验收。
- CHANGELOG 视情况更新。

## Out of Scope（explicit）

- 不改任何统计指标/计算口径（费用计价、Token 归类、时间窗口口径维持现状）。
- 不改 KPI 指标块的项目构成。
- 不改后端聚合算法本身（仅加持久化缓存层）。

## Technical Approach

- **颜色根因（图1/2 及 Ccusage）**：新增 `resolveCssColor()` 工具（隐藏探针元素 + `getComputedStyle().color` 把 `var()`/`color-mix()` 解析为具体 rgb）；提供 `useResolvedStatsPalette()` hook，主题切换时重解析；图表 option 使用解析后的具体色（ECharts emphasis 派生色即可正常工作），同时把 总Token/输入/输出/缓存 指定为 4 个不同 token，消除「总Token=输入」同色。
- **图2 高度自适应**：根据 `models.length` 计算容器高度（每条固定行高 + 上下边距），替代固定 `h-[300px]`。
- **图3 响应式**：去掉固定 `width=620`，用 `viewBox` + 容器 `ResizeObserver`/100% 宽度自适应（或 `preserveAspectRatio`），移除 `overflow-x-auto`；增加跟随光标的 tooltip 层。
- **图4 条形（7 天）**：短范围渲染横向条形（每日一条），按当日最大活跃值归一化到容器宽度，颜色按强度（沿用 `cellColor` 色阶或线性插值）；`granularity`/天数阈值决定条形 vs 热力网格。
- **图5 持久化（`history.rs`）**：把 per-file `computed` 索引（path → fingerprint + computed）序列化落盘到 appLocalData（带 schema version），`build_history_index` 冷启动时若内存 `previous` 为空则从磁盘载入作为 `previous_entries`，仅重解析 fingerprint 变更文件；构建后写回磁盘（写操作加锁/防并发）。需解决落盘路径获取（AppHandle/路径 API）与版本失效。

## Technical Notes

- 前端图表分两类：ECharts（图1/2，内联在 `StatsPanel.tsx`，经 `EChart.tsx` 用 svg renderer）与 自绘 SVG（图3/4，独立组件）。
- `EChart.tsx`：`echarts.init(..., { renderer: "svg" })`，`setOption(notMerge:true, lazyUpdate:true)`。
- 颜色根因可在 `EChart` 包装层或 `statsPalette` 解析层集中处理（探针元素 `getComputedStyle().color` 可把 `var()`/`color-mix()` 解析为 rgb）。
- 后端索引：`history.rs` `refresh_history_index_snapshot`/`build_history_index`，fingerprint = mtime+size+created/updated，`can_reuse_session_scan` 增量复用；持久化可序列化 per-file `computed` 索引到磁盘（appLocalData），启动时载入、按 fingerprint 校验。
