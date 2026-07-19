# 设置页调试模式卡片包裹

## Goal

让设置页中的“调试模式”开关在视觉结构上与“终端 Tab 悬浮信息”保持一致，使用同样的卡片包裹样式，避免同一区块内出现一个卡片项和一个裸露开关项的视觉不一致。

## Requirements

* 将 `src/components/settings/pages/GeneralSettingsPage.tsx` 中的“调试模式”开关从裸 `Group` 调整为与相邻开关一致的 `Card` 包裹结构。
* 保持现有 `debugMode` 状态读写逻辑不变。
* 保持现有国际化 key 与 aria-label 行为不变。
* 不引入新的配置项、依赖或跨文件重构。

## Acceptance Criteria

* [ ] “调试模式”在设置页中显示为与“终端 Tab 悬浮信息”一致的卡片样式。
* [ ] 点击开关后仍然更新 `debugMode` 设置。
* [ ] `aria-label` 与现有中英文文案逻辑保持不变。

## Definition of Done

* 变更限制在最小必要范围
* `npx tsc --noEmit` 通过
* 提供人工 UI 核验项

## Out of Scope

* 不调整调试模式的功能语义
* 不新增调试模式说明文案，除非现有结构改造必须依赖它
* 不顺手统一其他设置项样式

## Technical Notes

* 已定位目标文件：`src/components/settings/pages/GeneralSettingsPage.tsx`
* 相邻参考样式：同文件中的 `confirmCloseTab`、`tabHoverInfo` 开关卡片
* 当前 `debugMode` 已有 i18n 与 aria-label key，无 `debugModeDescription`
