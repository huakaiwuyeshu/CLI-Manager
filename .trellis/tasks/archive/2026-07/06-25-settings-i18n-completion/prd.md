# 补齐设置页国际化

## Goal

补齐 Settings 相关界面的中英文国际化，避免用户切换界面语言后设置窗口仍出现大量硬编码中文。

## What I already know

* 用户反馈：设置中的国际化还没有完全修改完。
* 现有 i18n 入口是 `src/lib/i18n.ts`，通过 `useI18n()` 和 `TranslationKey` 使用。
* `SettingsModal.tsx` 已将设置页 Tab label/title/description/searchPlaceholder 接入 i18n。
* `GeneralSettingsPage.tsx` 已部分接入 i18n，但仍存在配色名、工具栏选项、aria label 等中文硬编码。
* `SettingsNav.tsx` 仍硬编码侧栏标题“设置”。
* `SettingsTopBar.tsx` 仍硬编码搜索 aria label、关闭 aria label 与关闭按钮文案。
* `src/components/settings/pages` 多数页面仍有硬编码中文，按中文命中行数粗略排序：
  * `SyncSettingsPage.tsx`: 115
  * `HookSettingsPage.tsx`: 110
  * `ProviderSettingsPage.tsx`: 82
  * `ModelPricingSettingsPage.tsx`: 68
  * `ThemeSettingsPage.tsx`: 61
  * `TerminalBackgroundSection.tsx`: 50
  * `GeneralSettingsPage.tsx`: 48
  * `AboutSection.tsx`: 38
  * `TemplateSettingsPage.tsx`: 34
  * `ShortcutSettingsPage.tsx`: 25
  * `SettingsTopBar.tsx`: 3
  * `SettingsNav.tsx`: 1

## Assumptions

* 本任务只处理设置窗口内用户可见文案、aria label、toast/confirm 文案。
* 不引入第三方 i18n 库，不改语言持久化模型。
* 不重命名 `SettingsTab` id，不改变设置页数据流和持久化字段。
* 代码注释中的中文不属于本次国际化范围。

## Open Questions

* 无。

## Requirements

* 新增翻译 key 时必须同时提供 `zh-CN` 与 `en-US`。
* 设置页新增或迁移的用户可见文案必须通过 `useI18n()` 获取。
* 本次一次性覆盖整个设置窗口，包括 General、Terminal、Shortcuts、Templates、Providers、Model Pricing、Sync、Hooks、About 及设置外壳。
* 覆盖范围包含用户可见文案、按钮、表单 label/placeholder/description、toast、confirm、aria label、tooltip、空状态、状态文案。
* 保持现有 UI、状态、IPC、数据库、Tauri command 行为不变。

## Acceptance Criteria

* [ ] 切换 Settings > General > Display Language 后，整个设置窗口用户可见文案同步切换。
* [ ] `src/components/settings` 中不再存在用户可见硬编码中文。
* [ ] `npx tsc --noEmit` 通过。

## Definition of Done

* 读取相关前端规约和目标代码。
* 修改前完成 GitNexus impact analysis。
* 变更后运行类型检查。
* 如涉及视觉验证，列出人工检查项，不自动启动 Tauri 桌面应用。

## Out of Scope

* 不做 i18n 框架替换。
* 不改设置项存储结构。
* 不改非设置窗口页面。
* 不翻译开发注释和内部变量名。

## Technical Notes

* 前端规约要求用户可见 app shell 文案通过 `src/lib/i18n.ts` 和 `useI18n()`。
* 前端规约要求设置视觉迁移使用现有 Mantine 模式，且不能为了文案修改更改 `SettingsTab` id。
* 质量规约要求 AI 不自动启动 Tauri 桌面应用做 UI 运行时验证。
