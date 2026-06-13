# Fix Sidebar Density Option Style

## Goal

调整通用设置页“侧栏密度”选项的视觉样式，解决当前选项看起来只有阴影、缺少清晰卡片边界和层次的问题。

## What I already know

* 用户反馈：“侧栏密度”这里的样式需要修改，目前只有阴影。
* 截图显示“舒适 / 紧凑”两个选项边界感弱，更像浮在背景上的浅灰块。
* 相关代码集中在 `src/components/settings/pages/GeneralSettingsPage.tsx` 的 `SIDEBAR_DENSITY_OPTIONS.map(...)` 渲染区域。
* GitNexus 对 `GeneralSettingsPage` upstream impact 为 LOW，0 个直接上游调用，0 个受影响流程。

## Requirements

* 让“舒适 / 紧凑”选项具备明确卡片边界，不只依赖阴影。
* 保持轻量、干净，不使用重阴影、强渐变或发光效果。
* 保留当前点击行为和 `sidebarDensity` 设置字段。
* 不改变设置 schema、选项值或其他设置项。

## Acceptance Criteria

* [ ] “舒适 / 紧凑”选项有明确边框、背景和选中态。
* [ ] 视觉与当前调色卡的克制卡片风格一致。
* [ ] 不改变 `sidebarDensity` 持久化字段和选项语义。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 视觉最终由用户手动验收。

## Definition of Done

* TypeScript 静态检查通过。
* 改动保持最小，仅限 `GeneralSettingsPage` 局部 UI 样式。
* 不启动 Tauri 桌面 app，由用户人工检查视觉。

## Technical Approach

在侧栏密度 `UnstyledButton` 上补充局部 inline style：明确设置 `display`、`backgroundColor`、`borderColor`、轻量 `boxShadow`、选中态边框/背景；保持现有 `ui-interactive`、`ui-selection-card`、点击回调和文本结构不变。

## Out of Scope

* 不改 Mantine Provider。
* 不改 settings schema。
* 不改 `sidebarDensity` 选项值。
* 不改项目树、终端、调色卡或其他设置页。
* 不抽象新组件或全局样式。

## Technical Notes

* 相关代码：`src/components/settings/pages/GeneralSettingsPage.tsx` 第 571 行附近。
* 现有实现使用 `UnstyledButton` + `ui-selection-card`，可以局部增强样式，无需新增组件或依赖。
