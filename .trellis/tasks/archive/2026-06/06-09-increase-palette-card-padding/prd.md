# Increase Palette Card Padding

## Goal

修复通用设置页调色卡内容贴边问题，让卡片内部留白更舒适，同时保持当前克制卡片效果和文本不溢出。

## What I already know

* 用户反馈：卡片中的内容还是太靠近边框，需要加一点内边距。
* 问题集中在 `GeneralSettingsPage` 的 `PaletteCard` 局部样式。
* 当前 `PaletteCard` 外层仍使用 `p-3`，徽标为 `right-2 top-2`。
* `PaletteCard` GitNexus upstream impact 为 LOW，0 个直接上游调用，0 个受影响流程。

## Requirements

* 增加调色卡内部 padding，让色块、标题、描述离边框更远。
* 调整“当前”徽标位置，避免贴近右上边框。
* 保留现有换行/防溢出处理。
* 保留现有轻卡片视觉，不回到重阴影或强渐变。
* 不改变设置语义、持久化字段、主题选项或其他设置页。

## Acceptance Criteria

* [ ] 调色卡内容不再显得贴边。
* [ ] “当前”徽标不贴近卡片右上边框。
* [ ] 长描述仍在卡片内部换行，不横向溢出。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 视觉最终由用户手动验收。

## Definition of Done

* TypeScript 静态检查通过。
* 改动保持最小，仅限 `PaletteCard` 局部 UI 样式。
* 不启动 Tauri 桌面 app，由用户人工检查视觉。

## Technical Approach

把 `PaletteCard` 外层从 `p-3` 调为更宽松的 `p-4`，并把徽标从 `right-2 top-2` 调为 `right-3 top-3`。必要时略增 `minHeight`，避免更大内边距后内容显得拥挤。

## Out of Scope

* 不改 Mantine Provider。
* 不改 settings schema。
* 不改主题 palette 选项。
* 不改终端、项目树、统计看板或其他设置页。
* 不抽象新组件或全局样式。

## Technical Notes

* 相关代码：`src/components/settings/pages/GeneralSettingsPage.tsx` 的 `PaletteCard`。
* 本任务沿用现有 CSS 变量和 Mantine 组件，不引入新依赖。
