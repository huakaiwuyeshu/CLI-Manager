# Improve Fullscreen Terminal Immersion Spacing

## Goal

让终端进入沉浸式全屏后减少左右和底部留白，使终端内容更贴近窗口边缘，提升沉浸感。

## What I already know

- 用户反馈：全屏以后左右下方边距都有很多留白，不够沉浸式。
- 全屏状态由 `src/App.tsx` 中的 `terminalFullscreen` 控制，会隐藏应用标题栏和侧边栏。
- `src/components/TerminalTabs.tsx` 的终端内容区仍使用 `px-3 pb-3 pt-3` 和 `inset-x-3 bottom-3 top-3`。
- `src/App.css` 的 `.ui-terminal-well` 还有 `margin: 12px`、`border-radius: 14px`，全屏时会继续产生额外边距和卡片感。

## Assumptions (temporary)

- “沉浸式”优先指终端内容区贴边，而不是完全隐藏顶部 Tab/工具栏。
- 历史会话 Tab 如果在全屏中打开，应与终端内容区采用一致的全屏边距策略。

## Open Questions

- 无。

## Requirements

- 全屏模式下减少终端内容区左右和底部留白。
- 全屏模式保留顶部终端 Tab/工具栏，确保新建、模板、历史、退出全屏等操作继续可用。
- 普通非全屏模式保持现有卡片式终端布局。

## Acceptance Criteria

- [x] 进入沉浸式全屏后，终端内容区左右和底部不再出现明显外层留白。
- [x] 全屏模式下顶部终端 Tab/工具栏仍可见可用。
- [x] 退出全屏后，原有终端圆角、阴影、边距视觉恢复。
- [x] TypeScript 检查通过。

## Definition of Done

- 完成最小必要代码改动。
- 运行 `npx tsc --noEmit`。
- 如能启动应用，进入全屏做一次视觉验证。

## Out of Scope

- 不新增独立设置项。
- 不重构终端 Tab、分屏或历史会话逻辑。
- 不调整非全屏模式视觉。

## Technical Notes

- 可能涉及 `src/App.tsx`、`src/components/TerminalTabs.tsx`、`src/App.css`。
- 更倾向通过 `fullscreen` prop 切换 class/data attribute，只在全屏状态覆盖边距、圆角、阴影。
