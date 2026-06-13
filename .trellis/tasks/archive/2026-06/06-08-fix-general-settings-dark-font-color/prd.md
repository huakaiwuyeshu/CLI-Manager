# 修复通用设置暗色主题文字不可读

## Goal

修复通用设置中“应用字体颜色”自定义为黑色时，切换暗色配色后界面文字几乎不可读的问题，避免用户因单一自定义文字色破坏暗色主题可读性。

## What I already know

- 用户反馈：通用设置里的暗色/系统配色文字几乎不可读，并怀疑是自定义字体颜色优先级过高。
- 截图显示当前“应用字体颜色”为自定义 `#000000`。
- `src/App.tsx` 在 `uiTextColor` 有值时把它写入 `--text-primary`，并派生 `--text-secondary` / `--text-muted`。
- `src/App.css` 的语义色 `--on-surface` / `--on-surface-variant` 依赖这些文字变量，所以暗色主题自带浅色文字会被自定义黑色覆盖。
- `src/stores/settingsStore.ts` 默认 `uiTextColor` 为空字符串，空值代表跟随主题。
- GitNexus impact：`App` LOW，`GeneralSettingsPage` LOW。

## Requirements

- 暗色主题下，即使存在低对比度自定义应用字体颜色，也不能让主要界面文字不可读。
- 保留“应用字体颜色”自定义能力，不破坏留空跟随主题的现有语义。
- 改动应尽量小，不引入依赖，不重构设置系统。

## Acceptance Criteria

- [x] 当 `uiTextColor = "#000000"` 且 `resolvedTheme = "dark"` 时，全局主文字色不再变成黑色。
- [x] 当自定义文字色与当前主题背景有足够对比度时，仍可生效。
- [x] 留空 `uiTextColor` 时继续完全跟随主题配色。
- [x] TypeScript 检查通过。

## Definition of Done

- 静态检查通过。
- 说明人工 UI 验收点；本项目桌面 UI 按记忆要求由用户人工验收。
- 不提交 git，除非用户明确要求。

## Technical Approach

推荐在 `src/App.tsx` 的全局 CSS 变量写入前做最小对比度判断：只在自定义文字色与当前背景色可读时应用；否则移除 `--text-primary` / `--text-secondary` / `--text-muted` 覆盖，回退到当前主题自己的文字色。

## Decision (ADR-lite)

**Context**: 单一 `uiTextColor` 同时作用于浅色和暗色主题，黑色适合浅色但不适合暗色。
**Decision**: 使用运行时可读性保护，而不是删除自定义能力或改存储结构。
**Consequences**: 低对比度颜色在部分主题下会被忽略；行为更安全，但用户选择极端颜色时需要 UI 文案说明（可选）。

## Out of Scope

- 不做按浅色/暗色分别保存字体色。
- 不重做配色系统。
- 不改终端字体/终端主题颜色。
- 不自动修改用户已保存的设置值。

## Technical Notes

- 相关文件：`src/App.tsx`、可选 `src/components/settings/pages/GeneralSettingsPage.tsx`。
- 当前最小修复可只改 `src/App.tsx`。
