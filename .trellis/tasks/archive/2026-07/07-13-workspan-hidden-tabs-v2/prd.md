# 优化 Workspan 隐藏 Tab 下拉列表

## Goal

将 Workspan 顶层 Tab 栏调整为 IDEA 的单行滚动逻辑：仅在 Tab 超出栏位时显示下拉按钮，下拉列表只展示当前视口外的 Tab。

## Requirements

- 全部 Workspan Tab 可完整显示时，下拉按钮不渲染、不占用空间。
- Tab 总宽度超过完整栏位宽度时显示下拉按钮。
- 下拉列表只展示完全隐藏或部分裁剪的 Tab，并保持原始 Workspan 顺序。
- 鼠标滚轮横向滚动后实时更新隐藏列表。
- 通过下拉、快捷键或其他入口激活隐藏 Tab 后，Tab 自动滚入可视区域。
- 用户主动滚动时不强制吸回激活 Tab。
- 保留现有拖拽、右键菜单、关闭确认、Tab 尺寸和 Workspan 状态结构。
- Changelog Target: `[TEMP]`。

## Acceptance Criteria

- [ ] Tab 未溢出时不显示下拉按钮。
- [ ] Tab 溢出时显示下拉按钮，且没有原生滚动条。
- [ ] 下拉列表只包含当前视口外或部分裁剪的 Tab。
- [ ] 滚轮滚动后列表实时反映新的隐藏集合。
- [ ] 从下拉切换隐藏 Tab 后，该 Tab 自动进入可视区域并从隐藏列表移除。
- [ ] 删除 Tab 或扩大窗口使全部 Tab 可见后，下拉按钮自动消失。
- [ ] 拖拽、右键、关闭、重命名和范围过滤无回归。
- [ ] `npx tsc --noEmit` 与 `git diff --check` 通过。

## Technical Approach

- 使用 Tab 栏完整可用宽度判断真实溢出，避免按钮占宽造成永久显示。
- 使用实际滚动视口和每个 Tab 的 DOM 边界计算隐藏 ID。
- 使用 `ResizeObserver`、`scroll` 监听和 `requestAnimationFrame` 合并测量。
- 隐藏列表从现有 `workspanTabModels` 派生，不修改 store。

## Decision

- 采用计划文件 `.claude/plan/workspan-hidden-tabs-dropdown-v2.md` 中的几何测量方案。
- 不抽取跨组件通用 Hook，改动保持在 `TerminalTabs` 内，避免扩大范围。

## Out of Scope

- 不新增 Tab 压缩、多行布局或 Tab 数量上限。
- 不修改 Workspan 数据模型和持久化格式。
- 不新增依赖。

## Technical Notes

- 计划文件：`.claude/plan/workspan-hidden-tabs-dropdown-v2.md`。
- GitNexus 对 `TerminalTabs` 上游影响为 `LOW`。
- 当前分支与远端分叉；用户明确要求直接执行。远端独有改动未触及 `TerminalTabs`，本任务不拉取、不改并行状态栏文件。
