# Adjust General Settings Palette Card

## Goal

修正通用设置页面调色卡的视觉问题：色块需要再向卡片内部移动一些，同时恢复明显的卡片效果，避免看起来像裸露按钮。

## What I already know

* 用户反馈上一轮修复后，色块仍需要“更过去一点”。
* 用户反馈当前调色卡“没有卡片的效果”。
* 影响范围应限制在 `GeneralSettingsPage` 的调色卡局部样式。

## Requirements

* 调色卡色块整体继续向卡片内部移动。
* 调色卡需要保留/恢复卡片感，包括背景、边框和轻微阴影/层次。
* 不改变设置项语义、持久化字段或主题选项。
* 不迁移其他设置页或终端相关 UI。

## Acceptance Criteria

* [ ] 色块不会被圆角裁切，并且位置更靠卡片内部。
* [ ] 调色卡在未选中和选中状态都能看出卡片边界与层次。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 最终视觉由用户手动验收。

## Definition of Done

* TypeScript 静态检查通过。
* 改动保持最小，仅限相关 UI 样式。
* 不启动 Tauri 桌面 app，由用户人工检查视觉。

## Out of Scope

* 不调整 Mantine Provider。
* 不调整设置 schema。
* 不调整终端、项目树、统计看板或其他设置页。

## Technical Notes

* 预计修改 `src/components/settings/pages/GeneralSettingsPage.tsx` 中 `PaletteCard` 的局部样式。
* 遵循现有 Mantine 试点范围和 Trellis 任务 `06-09-implement-mantine-ui-adoption` 的边界。
