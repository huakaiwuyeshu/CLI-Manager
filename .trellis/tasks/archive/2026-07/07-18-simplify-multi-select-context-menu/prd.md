# 精简项目多选右键菜单

## Goal

项目列表进入多选状态后，右键菜单仅展示对当前选中集合有意义的批量操作，避免混入针对单个项目的操作。

## Changelog Target

`[TEMP]`

## What I already know

- 当前项目右键菜单同时渲染单项目操作和批量操作。
- 多选相关操作已有：取消选择、启动已选、批量修改 Shell、删除已选。
- 实现入口位于 `src/components/sidebar/index.tsx`，现有文案可复用，无需新增依赖或 IPC。

## Assumptions

- 仅当选中项目/分组总数大于 1，且右键目标属于当前选中集合时，切换为精简的批量菜单。
- 单选或右键未选中项目时，保持现有完整菜单行为。

## Requirements

- 多选菜单不展示打开终端、新建终端、分屏、克隆、目录、文件、历史、供应商切换、重命名、编辑和单项删除等单项目操作。
- 多选菜单仅保留：取消选择、启动已选、批量修改 Shell、删除已选。
- 不改变现有批量操作的执行逻辑和确认流程。

## Acceptance Criteria

- [x] 多选后右键已选项目，只显示确认保留的批量操作。
- [x] 单选状态下右键菜单保持原有功能。
- [x] 右键未选中项目时行为明确且不会误操作已有选择。
- [x] 中英文界面均复用现有国际化文案。

## Decision

- 多选且右键目标属于当前选中集合时，切换为精简批量菜单。
- 右键未选中项目时保持完整单项目菜单，避免改变用户对该项目的直接操作入口。
- 用户已确认上述范围。

## Out of Scope

- 不新增批量操作。
- 不调整菜单视觉样式。
- 不修改项目选择、批量启动、批量 Shell 或删除逻辑。

## Technical Notes

- 需求分诊：新增交互行为，按新需求处理；需覆盖单选、多选、混合选中及右键目标是否已选中等场景。
- 预计主实现仅修改 `src/components/sidebar/index.tsx`，另按交付规则更新 `CHANGELOG.md` 和产品功能清单（如现有条目需要同步）。
- GitNexus 影响分析：`Sidebar` 上游影响为 LOW，无直接调用方或受影响执行流。
- 验证：`npx tsc --noEmit` 与 `git diff --check` 通过；运行时菜单交互需人工验证。
- 本次未形成新的跨模块契约或可复用编码约定，无需更新 `.trellis/spec/`。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
