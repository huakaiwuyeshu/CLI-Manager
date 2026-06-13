# Customize Terminal Toolbar Visibility and Fullscreen Shortcut

## Goal

增强终端工具栏可定制性：全屏按钮改为纯图标并移动到历史命令后；全屏支持可配置快捷键；Templates、历史命令、全屏、历史会话这些工具栏功能都能在设置中控制显示/隐藏。

## What I already know

* 用户要求全屏按钮只保留图标，并放在历史命令后面。
* 用户要求全屏绑定快捷键，并且可在设置中修改。
* 用户要求页面上的 Templates、历史命令、全屏、历史会话都能在设置里控制隐藏和显示。
* 现有终端工具栏在 `src/components/TerminalTabs.tsx`。
* 现有 Templates 入口是 `CommandTemplatePanel`，历史命令入口是 `CommandHistoryPanel compact`，历史会话入口是 `handleOpenHistoryTab` 按钮。
* 上一轮已经新增系统全屏切换入口和 Tauri fullscreen capability。

## Assumptions (temporary)

* 新设置项应放到现有设置中心中，不新增独立弹窗。
* 工具栏显示/隐藏偏好应持久化到 settings store。
* 全屏快捷键应复用现有快捷键设置机制，如果项目已有。

## Open Questions

* 待代码检查后确认是否需要用户选择设置页位置或默认快捷键。

## Requirements (evolving)

* 全屏按钮改为仅图标按钮。
* 全屏按钮排序在历史命令按钮后面。
* 全屏支持键盘快捷键。
* 全屏快捷键可以在设置中修改。
* Templates、历史命令、全屏、历史会话可分别在设置中控制显示/隐藏。

## Acceptance Criteria (evolving)

* [x] 全屏按钮不显示文字，只显示图标。
* [x] 工具栏顺序为：Templates、历史命令、全屏、历史会话（受显示设置控制）。
* [x] 设置里可以分别隐藏/显示 Templates、历史命令、全屏、历史会话。
* [x] 被隐藏的功能不占用工具栏空间。
* [x] 全屏快捷键生效。
* [x] 全屏快捷键可在设置中修改。
* [x] `npx tsc --noEmit` 通过。

## Definition of Done

* 遵循现有 settingsStore 和快捷键配置模式。
* 不新增依赖。
* 不重构无关设置页面。
* 手动验证可选；如用户不需要则只跑静态检查。

## Out of Scope

* 自定义工具栏排序。
* 新增拖拽配置工具栏。
* 改造全局命令面板。

## Technical Notes

* 待检查：`src/stores/settingsStore.ts`、`src/hooks/useKeyboardShortcuts.ts`、设置页组件、`src/components/TerminalTabs.tsx`。
