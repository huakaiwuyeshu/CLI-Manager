# fix git change filter layout

## Goal

Git 变更面板中的筛选条件（全部、修改、新增、删除）按容器宽度自适应分布，避免按钮集中挤在中间，提高窄侧栏和宽侧栏下的可读性。

## Requirements

* 保留现有筛选项、计数、图标、点击筛选行为。
* 筛选按钮在整行内自适应分布，不再全部居中堆在一起。
* 继续复用现有 `ResizeObserver` 小宽度隐藏文字标签逻辑。
* 不改 Git 状态计算、提交、暂存、丢弃等行为。

## Acceptance Criteria

* [ ] 有 Git 变更时，筛选按钮占用整行可用宽度并均匀分布。
* [ ] 面板变窄时，标签隐藏后图标和数量仍不挤压溢出。
* [ ] 点击全部/修改/新增/删除仍正确切换筛选状态。
* [ ] `npx tsc --noEmit` 通过，或记录现有无关失败。

## Definition of Done

* 最小代码改动。
* 不新增依赖。
* 不改后端或数据结构。
* 记录无法自动完成的桌面 UI 手工检查项。

## Technical Approach

调整 `src/components/git/GitChangesPanel.tsx` 的筛选行布局：容器改为占满宽度的 flex/grid 分布，按钮允许均分可用空间，并保留现有小宽度隐藏标签逻辑。

## Out of Scope

* 不新增筛选条件。
* 不调整 Git 树、Diff、提交区样式。
* 不改筛选状态管理或 Git Store。

## Technical Notes

* 已定位筛选行在 `src/components/git/GitChangesPanel.tsx`，当前容器使用 `justify-center`。
* `GitChangesPanel` GitNexus upstream impact：LOW，direct=0，processes_affected=0。
