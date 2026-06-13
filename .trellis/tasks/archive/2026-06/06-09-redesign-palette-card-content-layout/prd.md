# Redesign Palette Card Content Layout

## Goal

重新设计通用设置页调色卡的内部内容版式，解决文字贴近边框、内容层次拥挤的问题，让色块、标题、描述与“当前”徽标之间有清晰间距，同时保留克制、干净的卡片视觉。

## What I already know

* 用户反馈：卡片中的文字太挨着边框，需要重新设计。
* 截图显示标题和描述靠近左边框，顶部色块与标题之间层次不自然。
* 相关代码集中在 `GeneralSettingsPage` 的 `PaletteCard`。
* 当前 `PaletteCard` 已有 `p-4`、`minHeight: 108`、文本换行和轻卡片样式。
* `PaletteCard` GitNexus upstream impact 为 LOW，0 个直接上游调用，0 个受影响流程。

## Requirements

* 重新组织调色卡内部内容，而不是只继续堆 padding。
* 标题和描述要有明确的左侧安全距离，不贴边。
* 色块、标题、描述之间要有稳定垂直节奏。
* “当前”徽标不挤压文字区域。
* 保留长文本换行/防溢出处理。
* 保留轻卡片感，不回到重阴影、强渐变或廉价发光。
* 不改变设置语义、持久化字段、主题选项或其他设置页。

## Acceptance Criteria

* [ ] 标题和描述不再贴近卡片左边框。
* [ ] 色块、标题、描述之间间距自然，不拥挤。
* [ ] “当前”徽标不压迫内容区域。
* [ ] 长描述仍在卡片内部换行，不横向溢出。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 视觉最终由用户手动验收。

## Definition of Done

* TypeScript 静态检查通过。
* 改动保持最小，仅限 `PaletteCard` 局部 UI 结构/样式。
* 不启动 Tauri 桌面 app，由用户人工检查视觉。

## Technical Approach

在 `PaletteCard` 内部增加一个内容容器，用 `Stack` 管理色块、标题、描述的垂直节奏；外层卡片负责边框/背景/点击区域，内层容器负责内容安全区。徽标继续绝对定位，但顶部右侧留出更稳定空间。

## Out of Scope

* 不改 Mantine Provider。
* 不改 settings schema。
* 不改主题 palette 选项。
* 不改终端、项目树、统计看板或其他设置页。
* 不抽象新组件或全局样式。

## Technical Notes

* 相关代码：`src/components/settings/pages/GeneralSettingsPage.tsx` 的 `PaletteCard`。
* 现有文件已引入 `Stack`、`Group`、`Box`、`Text`、`Badge`，无需新增依赖或新组件。
