# 状态栏组件按选中行添加并支持拖拽

## Goal

简化 Claude Code 状态栏组件库的添加交互：移除“添加到哪一行”的 Tab，点击组件时直接添加到中间编辑区当前选中的行；同时支持把组件从组件库拖拽到指定行。

## Changelog Target

`[TEMP]`

## What I Already Know

- 组件库目前存在用于选择“添加到哪一行”的多个 Tab。
- 中间编辑区已有当前选中行的状态。
- 点击组件应复用当前选中行，不再维护组件库内的目标行选择。
- 拖拽组件时，放置目标由用户实际拖到的行决定。

## Requirements

- 移除 Claude Code 状态栏组件库内用于选择添加目标行的 Tab。
- 点击组件库条目时，将组件添加到中间编辑区当前选中的行。
- 支持从组件库拖拽组件到中间编辑区的指定行。
- 不新增组件类型，不改变现有状态栏配置格式。

## Acceptance Criteria

- [x] 组件库不再显示目标行 Tab。
- [x] 点击组件后，组件添加到中间编辑区当前选中的行。
- [x] 组件可拖拽到任意可用行，并添加到放置行。
- [x] 拖拽取消或放置到无效区域时，不修改状态栏配置。
- [x] 现有行内组件排序、删除和预览逻辑保持兼容。

## Open Questions

- 无阻塞问题。现有 `activeLineIndex` 始终指向一个活动行，初始为第 1 行；点击行或行内组件时会同步更新，因此可直接作为点击添加的目标。

## Out of Scope

- 新增组件类型。
- 重构状态栏配置数据结构。
- 改变 Codex 状态栏编辑器交互。

## Technical Notes

- 主实现位于 `src/components/settings/pages/StatuslineSettingsPage.tsx`。
- 现有 `activeLineIndex` 已同时驱动中间行高亮、行点击和行内组件选择；点击组件库目前也已按该状态添加，只需移除组件库中的目标行 `SegmentedControl`。
- 现有行内排序使用 `@dnd-kit`，但 `DndContext` 只包裹中间布局区。组件库拖拽需把同一上下文扩到组件库和布局区，并用带前缀的 catalog drag id 区分“新增组件”和“移动已有组件”。
- 拖到行容器时追加到行尾；拖到已有组件时插入该组件位置。拖到无效区域不修改配置。
- 不新增用户可见文案，不需要新增国际化键。
- GitNexus 上游影响分析：`ClaudeStatuslineEditor`、`addWidget`、`handleWidgetDragEnd`、`StatuslineLayoutLine` 均为 LOW 风险；仅 `addWidget` 有 1 个直接调用方，范围局限于当前页面。

## Decision (ADR-lite)

**Context**: 组件库与布局区需要共享拖拽目标识别，同时保留现有行内组件排序。

**Decision**: 复用当前 `@dnd-kit` 上下文和 `activeLineIndex`，将上下文上移到三栏编辑区；组件库条目作为 draggable source，现有行内条目继续作为 sortable source。

**Consequences**: 不改配置结构、不加依赖；改动集中在一个现有页面，主要回归风险是拖拽事件区分和原有跨行排序。

## Verification

- `npx tsc --noEmit`：通过。
- `git diff --check`：通过，仅有仓库现存的 LF/CRLF 提示。
- 未启动 Tauri 桌面应用；按项目规范保留人工验证：点击添加到当前行、组件库拖到空行/已有组件位置、已有组件同行与跨行排序。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
