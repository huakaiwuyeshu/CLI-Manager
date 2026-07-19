# fix independent git stats panel resize

## Goal

修复设置中关闭“合并实时统计与 Git 变更面板”后，独立显示的 Git 变更面板和实时统计面板无法拖拽调整宽度的问题。

## What I already know

* 用户反馈：关闭合并面板设置后，`git变更` 和 `实时监控/实时统计` 不再支持拖拽宽度。
* 项目是 React 19 + TypeScript 前端，设置走 `stores/settingsStore.ts`，UI 状态多由 Zustand 管理。
* 记忆约定：tab 栏右侧叫“实时统计”，左下角叫“历史记录”。

## Assumptions (temporary)

* 该问题大概率是面板拆分/合并布局分支遗漏 resize handle 或宽度状态绑定。
* 修复应优先复用现有拖拽宽度逻辑，不新增依赖、不重构布局体系。

## Open Questions

* 暂无阻塞问题，先从代码定位现有合并/独立面板实现。

## Requirements (evolving)

* 关闭合并设置后，Git 变更面板仍可拖拽调整宽度。
* 关闭合并设置后，实时统计面板仍可拖拽调整宽度。
* 不影响合并设置开启时的现有行为。

## Acceptance Criteria (evolving)

* [ ] 设置关闭“合并实时统计与 Git 变更面板”后，两个独立面板的宽度拖拽控件可用。
* [ ] 设置开启合并后，原合并面板拖拽行为不回退。
* [ ] 前端类型检查 `npx tsc --noEmit` 通过。

## Definition of Done (team quality bar)

* 前端类型检查通过。
* 不新增依赖。
* 不做无关 UI 重构。
* 说明无法由 AI 启动桌面 UI 完成人工验收（按项目记忆），给出人工验收步骤。

## Out of Scope (explicit)

* 不调整面板视觉设计。
* 不改变默认宽度、设置项名称或面板合并策略。
* 不改 Rust 后端。

## Technical Approach

复用现有侧边面板的拖拽宽度逻辑，抽成一个轻量可复用的可拖拽外框；合并模式继续用原 `TerminalSidePanel`，非合并模式分别用该外框包住 `TerminalStatsPanel` 与 `GitChangesPanel` 的 embedded 版本。

## Decision (ADR-lite)

**Context**: 合并模式已有 `TerminalSidePanel` 宽度拖拽；非合并模式直接渲染两个固定宽度面板，遗漏拖拽入口。  
**Decision**: 不改设置项、不引入依赖，只复用/抽取现有 resize frame，并为实时统计与 Git 变更保留独立 localStorage 宽度 key。  
**Consequences**: 改动集中在前端布局层；需确认两个独立面板同时打开时宽度合计不会挤压终端，沿用现有窄屏自动收起 Git 逻辑降低风险。

## Technical Notes

* `src/components/TerminalTabs.tsx:1785`：合并模式渲染 `TerminalSidePanel`；非合并模式直接渲染 `TerminalStatsPanel` / `GitChangesPanel`，因此无 resize handle。
* `src/components/terminal/TerminalSidePanel.tsx:20`：已有宽度 localStorage、clamp、mousemove/mouseup 拖拽逻辑。
* `src/components/terminal/TerminalStatsPanel.tsx:362`：非 embedded 固定 `w-[203px]`。
* `src/components/git/GitChangesPanel.tsx:375`：非 embedded 固定 `w-[196px]`。
* GitNexus impact：`TerminalTabs` upstream 风险 LOW；`TerminalSidePanel` 在索引中未命中，已用文件读取确认局部组件实现。
