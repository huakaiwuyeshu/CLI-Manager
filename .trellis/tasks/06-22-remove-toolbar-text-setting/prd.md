# remove-toolbar-text-setting

## Goal

从通用设置中移除“显示工具栏文字”功能，工具栏文字不再作为用户可配置项存在，终端右侧工具栏保持固定图标模式。

## What I already know

* 用户明确要求：通用设置里的“显示工具栏文字”功能直接移除。
* 设置 UI 位于 `src/components/settings/pages/GeneralSettingsPage.tsx`。
* 持久化设置字段位于 `src/stores/settingsStore.ts` 的 `terminalToolbarVisibility.showText`。
* 运行时渲染位于 `src/components/TerminalTabs.tsx`，通过 `terminalToolbarVisibility.showText` 切换图标/文字模式。
* `CommandTemplatePanel` 与 `CommandHistoryPanel` 仅由 `TerminalTabs` 传入 `showText`，可同步简化。

## Requirements

* 删除通用设置页里的“显示工具栏文字”开关。
* 删除 `terminalToolbarVisibility.showText` 持久化字段与迁移读取。
* 终端工具栏固定为图标模式，不再渲染工具栏文字。
* 保留现有工具栏按钮显示/隐藏开关、排序、拖拽逻辑。
* 不改已有历史设置文件里的旧 `showText` 数据；新版本只忽略它。

## Acceptance Criteria

* [x] 通用设置 > 工具栏 不再出现“显示工具栏文字”。
* [x] 全代码库 `src/` 内不再有 `terminalToolbarVisibility.showText` / `showToolbarText` / `显示工具栏文字` 的有效使用。
* [x] 终端右侧工具栏按钮保持图标模式与原图标样式。
* [x] `npx tsc --noEmit` 通过。

## Definition of Done

* 静态类型检查通过。
* 不启动 Tauri 桌面应用，运行态 UI 由人工验收。
* 说明变更范围、风险和人工验收点。

## Out of Scope

* 不删除终端工具栏入口显示/隐藏开关。
* 不调整工具栏排序逻辑。
* 不清理用户本地 `settings.json` 中可能残留的旧 `showText` 字段。
* 不重做工具栏视觉样式。

## Technical Approach

最小化删除：移除设置字段、设置页开关和运行时分支，把 `TerminalTabs` 及两个子按钮组件固定为现有图标模式。

## Technical Notes

* 已读前端规范：`.trellis/spec/frontend/component-guidelines.md`、`state-management.md`、`quality-guidelines.md`。
* 已读共享指南：`.trellis/spec/guides/index.md`、`code-reuse-thinking-guide.md`。
* GitNexus impact：`GeneralSettingsPage` LOW、`TerminalTabs` LOW、`migrateTerminalToolbarVisibility` LOW、`CommandTemplatePanel` LOW、`CommandHistoryPanel` LOW。
* 相关文件：
  * `src/stores/settingsStore.ts`
  * `src/components/settings/pages/GeneralSettingsPage.tsx`
  * `src/components/TerminalTabs.tsx`
  * `src/components/CommandTemplatePanel.tsx`
  * `src/components/CommandHistoryPanel.tsx`
