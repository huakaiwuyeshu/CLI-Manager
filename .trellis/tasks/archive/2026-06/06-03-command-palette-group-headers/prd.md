# 强化命令面板分组视觉层级

## Goal

让 Ctrl+P 命令面板中的“操作 / 项目 / 命令模板”等分组标题更明显，用户能快速识别列表结构，同时保持整体 UI 与项目视觉体系一致。

## What I already know

- 用户反馈：`操作`、`命令模板`、`项目` 这几个分组不明显。
- 分组标题由 `src/components/CommandPalette.tsx` 中 `showHeader` 分支渲染。
- 当前分组标题只是小字号 muted 文本：`text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant`，缺少背景、分隔和垂直层级。
- 上一轮已把命令面板整体切到项目统一 UI token：`ui-surface-card`、`Input`、`ui-interactive`。
- GitNexus impact：`CommandPalette` upstream 风险 LOW，未发现直接上游依赖、受影响流程或模块。

## Requirements

- 分组标题必须比普通命令项更容易识别。
- 保持项目现有 token 样式体系，不新增独立颜色体系。
- 不改变分组顺序、命令来源、搜索逻辑、键盘选择和点击执行行为。
- 改动控制在 `src/components/CommandPalette.tsx` 的局部样式。

## Acceptance Criteria

- [x] “操作 / 项目 / 命令模板”分组标题有明确视觉层级。
- [x] 分组标题与命令项之间有清晰间距或分隔感。
- [x] 选中项样式仍使用统一 `ui-interactive` token。
- [x] Ctrl+P 搜索、上下键、Enter、点击行为保持不变。
- [x] `npx tsc --noEmit` 通过。

## Definition of Done

- 只修改必要文件。
- 不新增 state、依赖或新组件抽象。
- 静态检查通过；如允许启动应用，则手动验证 Ctrl+P 面板。

## Technical Approach

在 `showHeader` 的分组标题节点上增强视觉层级：增加上方间距、圆角背景、细边框/底部分隔、适度更强的文字颜色或字重，并用 `color-mix` / 现有 token 类保持主题一致。

## Decision (ADR-lite)

**Context**: 命令面板整体风格已统一，但分组标题过弱，列表结构不清楚。

**Decision**: 采用局部样式增强，不引入新组件或全局 CSS；优先通过 Tailwind arbitrary value + 现有 token 完成。

**Consequences**: 改动范围最小，能快速改善可读性；后续如果多个列表都需要同类分组标题，再考虑抽共享样式。

## Out of Scope

- 不新增图标。
- 不调整命令排序或分组逻辑。
- 不修改搜索算法。
- 不重构 CommandPalette。

## Technical Notes

- 已读：`src/components/CommandPalette.tsx`
- 已读：`.trellis/spec/frontend/component-guidelines.md`
- 已读：`.trellis/spec/frontend/quality-guidelines.md`
- 已运行：GitNexus impact for `CommandPalette`，风险 LOW。
