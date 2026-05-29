# fix terminal tab vertical drag constraint

## Goal

修复终端 Tab 拖拽缺少垂直方向约束的问题，避免 Tab 在拖拽时向上脱离 Tab 栏，保持交互稳定和视觉边界一致。

## What I already know

* 用户反馈：终端 Tab 拖拽时没有设置规范，可以向上拖拽，导致 Tab 移出 Tab 框。
* 目标应是最小修复：限制拖拽时的 y 方向或容器边界，不引入新的拖拽系统。

## Assumptions (temporary)

* 问题位于前端终端 Tab 条或 Tab 项的 drag/pointer 交互逻辑中。
* 只需要限制终端 Tab 拖拽，不改变其他可拖拽区域行为。

## Open Questions

* 已确认：采用最小修复，锁定终端 Tab 拖拽的 y 位移为 0，只保留横向排序。

## Requirements

* 终端 Tab 拖拽时不得向上脱离 Tab 栏容器。
* 终端 Tab 拖拽只呈现横向位移，保持现有横向排序行为不变。
* 不新增依赖，不重构拖拽系统。

## Acceptance Criteria

* [x] 代码层面已锁定拖拽 y 位移，终端 Tab 不再渲染垂直拖拽偏移。
* [x] 现有 Tab 横向拖拽/切换/关闭逻辑未改动。
* [x] 文件级静态检查通过：`git diff --check -- src/components/TerminalTabs.tsx .trellis/tasks/05-29-fix-terminal-tab-vertical-drag-constraint/prd.md`。
* [ ] 全量构建检查：`npm run build` 被既有 `src/stores/historyStore.ts:414` 类型错误阻塞，非本次修改文件。
* [ ] 本地 UI 交互验证：用户选择跳过，未启动 `npm run dev`。

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI-relevant checks pass where feasible.
* Docs/notes updated only if behavior change requires it.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* 不重构终端 Tab 拖拽系统。
* 不改动非终端区域的拖拽交互。
* 不新增依赖。

## Technical Notes

* 已定位主要实现：`src/components/TerminalTabs.tsx`。
* `SortableTab` 使用 `useSortable` 返回的 `transform` 直接生成 CSS transform：当前同时应用 x/y 位移，因此拖拽时可产生垂直偏移。
* 最小修复倾向：保留 dnd-kit 现有横向排序逻辑，只在渲染 Tab 时把 transform 的 `y` 固定为 `0`，不新增依赖。
