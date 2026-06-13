# 增加系统字体大小设置

## Goal

在系统通用设置中增加应用界面字体大小控制，让用户可以调整除内置终端外的整体 UI 字号，并避免 Mantine 全局样式覆盖项目默认字号。

## What I Already Know

* 用户希望“直接在系统里面增加一个字体大小的设计”。
* 现有终端字号已在 `src/components/settings/pages/ThemeSettingsPage.tsx` 中单独配置，字段为 `fontSize`，范围 10-24。
* 现有应用字体族与字体颜色在 `src/components/settings/pages/GeneralSettingsPage.tsx` 中配置，字段为 `uiFontFamily` / `uiTextColor`。
* 应用默认字号来自 `src/App.css`：`--font-size-body: 13px`，并应用到 `body`。
* Mantine 全局样式默认 `body` 字号为 `--mantine-font-size-md`，通常是 16px；新增设置需要同步 Mantine 字号变量，避免 UI 变大回归。

## Assumptions

* “系统字体大小”指应用整体 UI 字号，不包含 xterm 内置终端字号。
* 默认值保持当前项目视觉密度：13px。
* 设置应持久化到现有 `settings.json` store，不新增依赖。

## Requirements

* 在通用设置页的“应用字体”附近新增“应用字体大小”控制。
* 字号控制影响除内置终端外的应用整体 UI。
* 终端字号继续由“终端设置”中的现有控件单独管理。
* 字号应实时生效并持久化。
* 默认字号为 13px，兼容旧配置。
* Mantine 组件字号应跟随该设置，不能回落到 16px。

## Acceptance Criteria

* [x] 通用设置页能看到并调整应用字体大小。
* [x] 修改后普通 UI 文本、Mantine 控件文本跟随变化。
* [x] xterm 内置终端字号不受该设置影响。
* [x] 重启后设置仍保留。
* [x] `npx tsc --noEmit` 通过。

## Definition of Done

* 变更保持最小范围。
* 不新增依赖。
* 不重命名已有设置 tab id。
* 不改变终端字号设置语义。
* 完成类型检查。

## Out of Scope

* 不新增多套排版主题。
* 不调整终端字号范围或终端字体族逻辑。
* 不做复杂响应式字号系统。

## Technical Approach

新增 `uiFontSize` 设置字段，默认 13。`App` 将其写入 CSS 变量，并注入覆盖规则同步 `body` 与 Mantine 字号变量。`GeneralSettingsPage` 复用现有终端字号控件模式，提供数字输入 + 滑杆。

## Technical Notes

* `src/stores/settingsStore.ts`：新增持久化字段和默认值。
* `src/App.tsx`：读取 `uiFontSize` 并写入全局 CSS 变量/覆盖样式。
* `src/components/ui/MantineThemeProvider.tsx`：Mantine theme 同步 `fontSizes`。
* `src/components/settings/pages/GeneralSettingsPage.tsx`：新增设置 UI。
* `src/App.css`：现有字号 token 已集中在 `@theme` 与 `body` 规则。
