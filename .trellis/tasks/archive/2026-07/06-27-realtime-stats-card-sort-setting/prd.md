# 实时统计卡片排序设置

## Goal

在设置页的侧边栏设置中，为实时统计卡片增加排序设置，让用户能调整终端右侧实时统计面板中各卡片的显示顺序。

## What I Already Know

* 用户目标：设置 -> 侧边栏设置 -> 实时统计卡片，增加排序设置功能。
* 现有显隐设置在 `src/components/settings/pages/SidebarSettingsPage.tsx`。
* 现有实时统计面板渲染在 `src/components/terminal/TerminalStatsPanel.tsx`，卡片顺序目前是硬编码 JSX 顺序。
* 卡片 key 与默认集合在 `src/stores/settingsStore.ts` 的 `TERMINAL_STATS_CARD_KEYS`。
* 新增用户可见文案必须同步 `zh-CN` 与 `en-US`，位置在 `src/lib/i18n.ts`。
* GitNexus 对 `TerminalStatsPanel` 与 `useSettingsStore` 的影响分析风险为 LOW；`SidebarSettingsPage` 与部分迁移函数在当前索引中不可解析，已用 `rg` 直接确认引用范围。

## Requirements

* 在侧边栏设置的“实时统计卡片”区域提供拖拽排序能力。
* 保留上移/下移按钮作为键盘和无拖拽环境的备用排序方式。
* 排序结果持久化到用户设置，重启后保留。
* 实时统计面板按用户配置顺序渲染可见卡片。
* 现有“显示/隐藏卡片”能力保留。
* 老用户没有排序字段时使用当前默认顺序。
* 新增/缺失/非法 key 通过迁移函数自动修正。

## Acceptance Criteria

* [ ] 设置页能通过拖拽调整 7 张实时统计卡片的顺序。
* [ ] 设置页也能通过上移/下移按钮调整卡片顺序。
* [ ] 调整后实时统计面板立即按新顺序显示。
* [ ] 隐藏卡片不影响顺序；重新显示后回到用户设置的位置。
* [ ] 老配置或损坏配置不会导致页面崩溃，回退到默认顺序并补齐缺失项。
* [ ] 中英文界面都有对应文案。
* [ ] `npx tsc --noEmit` 通过。

## Technical Approach

新增 `terminalStatsCardOrder: TerminalStatsCardKey[]` 持久化设置，默认值复用 `TERMINAL_STATS_CARD_KEYS`。设置页按该数组展示卡片，每行保留显隐开关，并增加 dnd-kit 拖拽排序、上移/下移按钮与恢复默认顺序按钮。实时统计面板将各卡片封装为按 key 渲染的函数，按 `terminalStatsCardOrder` 过滤并渲染。

## Decision (ADR-lite)

**Context**: 现有项目已使用持久化 settings store 管理侧边栏和实时统计卡片显隐。排序需要跨重启保留，并与显隐使用同一组 card key。

**Decision**: 使用持久化顺序数组 + dnd-kit 拖拽排序 + 上移/下移备用按钮，不新增依赖。

**Consequences**: 复用项目已有 dnd-kit 模式，交互更直观；保留按钮操作降低纯拖拽对可访问性的影响。

## Out of Scope

* 不改实时统计数据来源和统计逻辑。
* 不改历史会话统计卡片。
* 不改终端工具栏排序逻辑。

## Technical Notes

* Relevant files:
  * `src/stores/settingsStore.ts`
  * `src/components/settings/pages/SidebarSettingsPage.tsx`
  * `src/components/terminal/TerminalStatsPanel.tsx`
  * `src/lib/i18n.ts`
* Frontend specs read:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
