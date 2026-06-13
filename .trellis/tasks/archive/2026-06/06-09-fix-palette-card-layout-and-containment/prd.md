# Fix Palette Card Layout And Containment

## Goal

修复通用设置页调色卡当前视觉问题：卡片边界太弱，看起来不像卡片；同时卡片内部描述文本横向溢出到相邻卡片。目标是恢复克制但可见的卡片感，并保证内容始终留在卡片内部。

## What I already know

* 用户反馈当前版本有两个问题：没有卡片效果、卡片中的内容溢出。
* 截图显示长描述（如 Apple Pure）横向越过卡片边界。
* 当前问题集中在 `GeneralSettingsPage` 的 `PaletteCard` 局部样式。
* 之前强渐变和重投影被用户认为廉价，因此不能回到重阴影方案。

## Requirements

* 调色卡未选中态要有可见卡片边界：浅背景、细边框、轻阴影。
* 调色卡选中态要清晰，但不能大面积发光或重投影。
* 标题和描述必须在卡片内换行，不得横向溢出到相邻卡片。
* 色块继续保持靠内，不被圆角裁切。
* 不改变设置语义、持久化字段、主题选项或其他设置页。

## Acceptance Criteria

* [ ] 调色卡未选中态看起来是卡片，不是平铺文本块。
* [ ] 调色卡选中态有明确边框/背景反馈，不过度发光。
* [ ] 长描述在卡片内部换行或被约束，不横向溢出。
* [ ] 色块位置靠内且不被圆角裁切。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 视觉最终由用户手动验收。

## Definition of Done

* TypeScript 静态检查通过。
* 改动保持最小，仅限相关 UI 样式。
* 不启动 Tauri 桌面 app，由用户人工检查视觉。

## Technical Approach

只调整 `PaletteCard` 的局部样式：为按钮恢复更明确但轻量的背景、边框和阴影；显式设置按钮和文本允许正常换行，并用 overflow/minWidth 约束内容留在卡片内。

## Out of Scope

* 不改 Mantine Provider。
* 不改 settings schema。
* 不改主题 palette 选项。
* 不改终端、项目树、统计看板或其他设置页。
* 不抽象新组件或全局样式。

## Technical Notes

* 相关代码在 `src/components/settings/pages/GeneralSettingsPage.tsx` 的 `PaletteCard`。
* 浅色/暗色配色列表用 `SimpleGrid cols={{ base: 1, md: 3 }}` 渲染。
* 本任务应沿用现有 CSS 变量，不引入新依赖或全局样式。
