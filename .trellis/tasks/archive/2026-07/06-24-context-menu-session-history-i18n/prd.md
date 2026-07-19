# 右键会话历史国际化

## Goal

项目右键菜单中的“会话历史”应跟随应用语言设置显示，避免英文界面下出现硬编码中文。

## Requirements

- 复用现有 `src/lib/i18n.ts` 中的 `sidebar.menu.sessionHistory` 翻译键。
- 只修复项目右键菜单中的硬编码文案，不扩大到其他历史模块文案。
- 不新增依赖，不改变右键菜单行为。

## Acceptance Criteria

- [ ] `src/components/sidebar/index.tsx` 中项目右键菜单的会话历史项使用 `t("sidebar.menu.sessionHistory")`。
- [ ] `npx tsc --noEmit` 通过，或明确说明失败原因。

## Definition of Done

- 最小代码改动完成。
- 静态类型检查完成。
- 记录影响范围和验证结果。

## Technical Approach

`Sidebar` 已经调用 `useI18n()` 并且同一菜单其他项都使用 `t(...)`。直接将硬编码 `会话历史` 替换为现有翻译键即可。

## Out of Scope

- 不审计全项目所有硬编码中文。
- 不调整 i18n 字典结构。
- 不修改菜单交互、图标或样式。

## Technical Notes

- 已检查 `src/components/sidebar/index.tsx`：右键菜单中只有这一处“会话历史”没有走 `t(...)`。
- 已检查 `src/lib/i18n.ts`：`sidebar.menu.sessionHistory` 已存在中英文翻译。
- GitNexus impact: `Sidebar` upstream risk LOW，direct callers 0，affected processes 0。
