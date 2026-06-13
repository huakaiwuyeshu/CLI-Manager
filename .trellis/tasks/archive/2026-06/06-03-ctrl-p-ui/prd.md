# 修复 Ctrl+P 快捷窗口 UI 与项目风格一致

## Goal

让 Ctrl+P 打开的命令面板视觉风格与 CLI-Manager 当前 UI 体系保持一致，避免它继续使用独立的背景色、边框、选中态和输入框样式。

## What I already know

- 用户反馈：Ctrl+P 会弹出快捷窗口，但 UI 和整个项目 UI 不一致，需要修复。
- 快捷窗口实现位于 `src/components/CommandPalette.tsx`，由 `useCommandPaletteStore` 控制打开/关闭。
- 快捷键绑定位于 `src/hooks/useKeyboardShortcuts.ts`，触发 `useCommandPaletteStore.getState().toggle()`。
- 现有弹窗基础组件在 `src/components/ui/dialog.tsx`，`DialogContent` 使用 `ui-surface-card`、统一居中、动画和关闭按钮样式。
- 项目现有输入组件在 `src/components/ui/input.tsx`，使用 `ui-input ui-focus-ring`。
- 当前 `CommandPalette` 手写 Radix Overlay/Content，并直接使用 `var(--bg-secondary)`、`var(--bg-tertiary)`、`var(--text-*)` 等旧式内联样式，和当前 token 化组件体系不一致。
- GitNexus impact：`CommandPalette` upstream 风险 LOW，未发现直接上游依赖、受影响流程或模块。

## Requirements

- Ctrl+P 命令面板应复用项目现有弹窗/输入/交互视觉体系。
- 保留现有功能：搜索、模糊匹配、键盘上下选择、Enter 执行、点击执行、无结果提示。
- 保留现有打开位置和尺寸语义：顶部偏上、宽度约 `max-w-lg`、列表最大高度约 `max-h-80`。
- 不改变命令项来源、行为逻辑、compact mode 分支和模板执行逻辑。
- 不新增依赖，不新增全局状态，不重构无关代码。

## Acceptance Criteria

- [x] Ctrl+P 打开的面板背景、边框、圆角、动画与现有 Dialog/Card 体系一致。
- [x] 搜索输入使用项目统一输入/focus 样式，不再是纯透明裸 input。
- [x] 命令列表选中项使用统一 `ui-interactive`/选中态 token，而不是单独内联背景色。
- [x] 空结果、分类标题、描述文本使用项目文本 token 类名。
- [x] Ctrl+P、Esc、ArrowUp/ArrowDown、Enter 行为保持不变。
- [x] `npx tsc --noEmit` 通过。
- [x] 如能启动应用，手动验证 Ctrl+P 面板视觉与交互。

## Definition of Done

- 仅修改必要文件。
- 遵循 React/TypeScript 规则：不新增不必要 state，不在 render 中引入副作用，不使用 `any`。
- 通过类型检查或说明无法运行的原因。
- 若运行应用可行，使用实际 UI 验证。

## Technical Approach

优先在 `src/components/CommandPalette.tsx` 内做局部样式替换：继续使用 Radix Portal/Content 以保留顶部位置，但把外层卡片、输入框、列表项、分类标题和空状态切换到项目已有 token 类与基础组件；不改变命令数据和行为逻辑。

## Decision (ADR-lite)

**Context**: `CommandPalette` 是局部快捷窗口，功能逻辑已完整，问题集中在视觉体系不一致。

**Decision**: 采用“单文件样式对齐”的最小方案：复用 `Input`、`ui-surface-card`、`ui-interactive`、`text-on-surface*` 等现有样式，不抽新组件、不改快捷键逻辑。

**Consequences**: 改动面小、风险低；仍保留 CommandPalette 顶部偏上布局，因此不强行套用居中 `DialogContent`，避免改变用户使用习惯。

## Out of Scope

- 不改快捷键配置。
- 不新增命令面板功能。
- 不重构命令构建逻辑。
- 不调整 Radix Dialog 基础组件。
- 不新增动画、图标或复杂视觉特效。

## Technical Notes

- 已读：`src/components/CommandPalette.tsx`
- 已读：`src/components/ui/dialog.tsx`
- 已读：`src/components/ui/input.tsx`
- 已读：`src/components/ConfigModal.tsx`
- 已读：`src/components/SettingsModal.tsx`
- 已读：`src/App.css`
- 已读：`.trellis/spec/frontend/index.md`
- 已读：`.trellis/spec/frontend/component-guidelines.md`
- 已读：`.trellis/spec/frontend/quality-guidelines.md`
- 已读：`.trellis/spec/frontend/type-safety.md`
- 已读：`.trellis/spec/guides/index.md`
- 已读：`.trellis/spec/guides/code-reuse-thinking-guide.md`
