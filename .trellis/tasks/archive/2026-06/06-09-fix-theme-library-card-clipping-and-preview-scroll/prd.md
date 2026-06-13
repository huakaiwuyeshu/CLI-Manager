# Fix theme library card clipping and preview scroll

## Goal

修复终端设置页中独立主题库的两个展示问题：主题卡片内容贴近圆角边缘导致显示不完整；预览区域滚动后不可见，影响用户切换主题时对比效果。

## What I already know

- 用户反馈独立主题库卡片与通用卡片存在同类问题：内容靠近卡片边缘，被圆角遮住或展示不完整。
- 用户反馈预览固定在最上面，滚动后就看不到预览。
- 相关页面位于 `src/components/settings/pages/ThemeSettingsPage.tsx`。
- 当前主题卡片使用 `UnstyledButton`，类名包含 `overflow-hidden rounded-xl border p-3`。
- 当前终端预览定义为 `terminalPreview`，在 `xl` 尺寸使用 `sticky top-5` 放在右侧列。

## Assumptions (temporary)

- 本任务只修复终端设置页的主题库和预览布局，不改主题数据、设置存储或终端运行逻辑。
- 预览应在浏览主题库时持续可见；如果布局空间不足，优先保持当前设置页结构，不新增复杂交互。

## Requirements

- 独立主题库卡片内容不得贴边到被圆角裁切。
- 当前标记、主题名、说明文字、色块在卡片内完整可见。
- 终端预览在浏览主题库时保持可见，避免滚动后失去参照。
- 保持现有主题选择行为、搜索行为和设置字段不变。

## Acceptance Criteria

- [ ] 独立主题库卡片内容与圆角边缘有足够内距，不出现裁切。
- [ ] 选中 Badge 不遮挡主题名主体内容。
- [ ] 在主题库列表滚动时，终端预览仍可作为参照查看。
- [ ] `npx tsc --noEmit` 通过。

## Definition of Done

- TypeScript 类型检查通过。
- 不修改设置存储字段、主题 preset 数据或 Tauri 命令。
- 桌面运行态 UI 由用户人工验收。

## Out of Scope

- 不重做整个设置页视觉体系。
- 不新增主题管理、自定义主题或导入导出能力。
- 不修改终端实际渲染主题逻辑。

## Technical Notes

- 需遵循 `.trellis/spec/frontend/component-guidelines.md` 中设置页优先使用 Mantine 控件、特殊视觉内容可用 Tailwind/CSS 组合的约定。
- 相关记忆：终端内嵌 UI 应贴近终端视觉；本次目标是修复设置页终端主题 UI 的可读性和参照性。
- 相关文件候选：`src/components/settings/pages/ThemeSettingsPage.tsx`，可能涉及通用样式定义 `src/App.css`。
