# Refine General Settings Palette Card Visual

## Goal

重新优化通用设置页调色卡视觉，去掉上一版夸张、廉价的卡片效果，让它更克制、干净，同时保留清晰的可点击卡片边界和选中态。

## What I already know

* 用户反馈上一版“卡片效果非常丑”。
* 截图显示当前卡片投影过重、渐变和边框层次不统一，选中态像浮在页面上。
* 影响范围应限制在 `GeneralSettingsPage` 的 `PaletteCard` 局部样式。
* `PaletteCard` GitNexus upstream impact 为 LOW，0 个直接上游调用，0 个受影响流程。

## Requirements

* 移除夸张渐变和重阴影。
* 保留干净的卡片感：浅背景、细边框、轻微层次。
* 选中态要清楚，但不要显得突兀或廉价。
* 色块继续保持靠内，不被圆角裁切。
* 不改变设置语义、持久化字段、主题选项或其他设置页。

## Acceptance Criteria

* [ ] 调色卡未选中态看起来是轻量卡片，不是大阴影悬浮块。
* [ ] 调色卡选中态有明确边框/背景反馈，但不过度发光。
* [ ] 色块位置靠内且不被圆角裁切。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 视觉最终由用户手动验收。

## Definition of Done

* TypeScript 静态检查通过。
* 改动保持最小，仅限相关 UI 样式。
* 不启动 Tauri 桌面 app，由用户人工检查视觉。

## Technical Approach

只调整 `PaletteCard` 的局部 inline style：删除强渐变和重投影，使用更平整的背景、细边框和极轻阴影。选中态用轻主色背景和边框强调，不再使用大面积 glow。

## Out of Scope

* 不改 Mantine Provider。
* 不改 settings schema。
* 不改终端、项目树、统计看板或其他设置页。
* 不抽象新组件或全局样式。

## Technical Notes

* 已检查 `src/components/settings/pages/GeneralSettingsPage.tsx` 的 `PaletteCard`。
* 已检查 `src/App.css` 的 `.ui-selection-card` 和 `.ui-interactive` 全局样式。
* 已运行 GitNexus impact：`PaletteCard` upstream risk LOW，direct 0，processes affected 0。
