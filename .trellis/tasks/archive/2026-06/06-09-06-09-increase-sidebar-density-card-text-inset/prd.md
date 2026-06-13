# Increase Sidebar Density Card Text Inset

## Goal

调整通用设置页“侧栏密度”卡片内部文本安全距离，解决文字太靠近卡片边框的问题。

## What I already know

* 用户反馈：侧栏密度卡片文字太靠近卡片边框。
* 截图显示标题和描述在卡片左侧视觉过近，选中态更明显。
* 相关代码集中在 `src/components/settings/pages/GeneralSettingsPage.tsx` 的 `SIDEBAR_DENSITY_OPTIONS.map(...)`。
* 当前按钮已有 `px-4 py-3`，但文本仍直接挂在按钮内容层上，没有独立内容安全区。
* GitNexus 对 `GeneralSettingsPage` upstream impact 为 LOW，0 个直接上游调用，0 个受影响流程。

## Requirements

* 增加“舒适 / 紧凑”文字相对卡片边框的安全距离。
* 不继续只堆外层按钮 padding，优先增加内部内容容器。
* 保持当前轻卡片视觉、选中态、点击行为。
* 保留长文本换行/防溢出处理。
* 不改变 `sidebarDensity` 设置字段、选项值或其他设置项。

## Acceptance Criteria

* [ ] 标题和描述不再贴近卡片左边框。
* [ ] 卡片仍有明确边框和轻量选中态。
* [ ] 文本仍能在卡片内换行，不横向溢出。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 视觉最终由用户手动验收。

## Definition of Done

* TypeScript 静态检查通过。
* 改动保持最小，仅限 `GeneralSettingsPage` 局部 UI 结构/样式。
* 不启动 Tauri 桌面 app，由用户人工检查视觉。

## Technical Approach

在侧栏密度 `UnstyledButton` 内包一层 `Stack` 内容安全区，外层按钮只负责边框、背景和点击区域，内层 `Stack` 负责文本左侧/顶部留白和垂直节奏。

## Out of Scope

* 不改 Mantine Provider。
* 不改 settings schema。
* 不改 `sidebarDensity` 选项值。
* 不改调色卡、项目树、终端或其他设置页。
* 不抽象新组件或全局样式。

## Technical Notes

* 相关代码：`src/components/settings/pages/GeneralSettingsPage.tsx` 第 571 行附近。
* 当前文件已引入 `Stack`，无需新增依赖。
