# Project Tree Badge and Toolbar Visibility Controls

## Goal

补齐侧栏项目树徽章与终端工具栏的显示偏好：项目树徽章可隐藏/显示；终端工具栏设置移动到通用页并命名为“工具栏”；工具栏除“新增”区域外默认只显示图标，且可在设置中控制是否显示文字。

## What I already know

* 用户要求项目树徽章增加隐藏和显示。
* 用户要求“终端工具栏”设置项改名为“工具栏”，并放到通用设置中。
* 用户要求工具栏除新增区域外只显示图标，不显示文字。
* 用户要求设置中增加选项控制工具栏是否显示文字。
* 项目树徽章在 `src/components/sidebar/TreeNodeItem.tsx`：项目 `cli_tool` chip、路径异常 warning chip、分组数量 badge。
* 工具栏显示控制当前在 `src/components/settings/pages/ThemeSettingsPage.tsx`，需要移动到 `GeneralSettingsPage`。
* 本任务应复用现有 `settingsStore` 持久化模式，不新增依赖。

## Requirements

* 项目树徽章可在设置中显示/隐藏，默认显示。
* 隐藏项目树徽章时，不渲染项目 `cli_tool` chip、路径异常 chip、分组数量 badge。
* 工具栏设置放在通用设置页，标题为“工具栏”。
* 终端设置页不再显示工具栏设置区。
* 工具栏入口的显示/隐藏开关继续保留：Templates、历史命令、全屏、历史会话。
* 工具栏除“新增”区域外默认只显示图标。
* 设置中增加“显示工具栏文字”开关；关闭时工具栏入口不显示文字，开启时显示文字。

## Acceptance Criteria

* [x] 通用设置中存在“项目树徽章”显示/隐藏开关。
* [x] 通用设置中存在“工具栏”设置区。
* [x] 工具栏设置区包含入口显示/隐藏开关和“显示工具栏文字”开关。
* [x] 终端设置页不再出现工具栏设置区。
* [x] 项目树徽章关闭后不渲染 `cli_tool`、路径异常 chip、分组数量 badge。
* [x] 工具栏除“新增”区域外默认只有图标。
* [x] 开启“显示工具栏文字”后，受控工具栏入口恢复文字。
* [x] `npx tsc --noEmit` 通过。

## Definition of Done

* 遵循现有 settingsStore 持久化模式。
* 不新增依赖。
* 不重构项目树或工具栏无关逻辑。
* 不做界面手动测试，除非用户重新要求。

## Out of Scope

* 自定义徽章样式。
* 自定义单个徽章类型。
* 自定义工具栏排序。
* 改造项目树布局。

## Technical Approach

* 扩展 `terminalToolbarVisibility` 增加 `showText` 字段，默认 `false`。
* 新增 `showProjectTreeBadges` 设置字段，默认 `true`。
* 在 `TreeNodeItem` 中读取 `showProjectTreeBadges`，控制项目/分组徽章渲染。
* 将 `TERMINAL_TOOLBAR_OPTIONS` 与工具栏设置 UI 从 `ThemeSettingsPage` 移到 `GeneralSettingsPage`。
* 在 `TerminalTabs` 中用 `terminalToolbarVisibility.showText` 控制 Templates、历史命令、全屏、历史会话文字显示。

## Technical Notes

* 已检查：`TreeNodeItem.tsx`、`ProjectTree.tsx`、`GeneralSettingsPage.tsx`、`ThemeSettingsPage.tsx`。
