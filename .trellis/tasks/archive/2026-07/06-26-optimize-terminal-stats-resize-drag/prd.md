# 优化终端分屏与实时统计拖拽流畅度

## Goal

减少终端分屏拖拽、实时统计面板拖拽、Git 侧边面板拖拽时的卡顿感，让宽度/比例调整更顺滑，同时不改变现有终端分屏、统计面板和 Git 面板的功能行为。

## What I already know

- 用户反馈终端分屏与实时统计相关面板在拖拽变更宽度时明显卡顿、不丝滑。
- `src/components/SplitTerminalView.tsx` 当前在拖拽过程中每帧调用 `setSplitRatio`，把比例写入 Zustand `terminalStore`。
- `src/stores/terminalStore.ts` 的 `setSplitRatio` 会更新全局 `paneTree`，从而触发 `TerminalTabs` 和整棵终端 pane 视图刷新。
- `src/components/TerminalTabs.tsx` 的 `PaneLeafView` 当前未做 `memo`，分屏拖拽时容易带着 tab bar、xterm 容器和侧边 pane 一起重渲染。
- `src/components/terminal/TerminalSidePanel.tsx` 的 `ResizableTerminalPanelFrame` 当前在拖拽过程中每帧 `setWidth`，会带着实时统计面板 / Git 面板内容一起重渲染。
- 仓库里历史会话侧栏与主侧栏拖拽已经使用“拖拽中直接改 DOM 宽度，松手后再持久化”的模式，可复用这一思路。

## Assumptions

- 本次目标是优化拖拽体验，不改面板功能、不改布局结构、不引入新依赖。
- 优先接受“拖拽过程做局部预览，mouseup 再落库/落全局状态”的方案。

## Open Questions

- 是否按最小改动方案，仅优化拖拽时的重渲染路径，不调整任何视觉样式或布局规则。

## Requirements

- 终端分屏拖拽时，避免每帧把比例写回全局 store。
- 实时统计 / Git 侧边面板拖拽时，避免每帧触发重型子组件重渲染。
- 拖拽结束后，仍需保持当前宽度/比例持久化行为。
- 不影响现有分屏、切 tab、实时统计轮询、Git 面板加载逻辑。

## Acceptance Criteria

- [ ] 拖拽终端分屏 divider 时，主观卡顿明显降低，交互连续。
- [ ] 拖拽实时统计 / Git 面板宽度时，面板内容不再跟着明显掉帧重绘。
- [ ] 松手后宽度/比例仍会保存，刷新或重新打开后行为保持一致。
- [ ] `npx tsc --noEmit` 通过。

## Definition of Done

- 完成最小必要代码修改。
- 静态检查通过。
- 给出终端拖拽场景的人工验证项。

## Out of Scope

- 重构终端布局架构。
- 修改统计卡片内容、Git 面板功能或数据加载策略。
- 启动 Tauri 应用做自动化运行时验证。

## Technical Approach

- 分屏拖拽：在 `SplitTerminalView` 引入本地拖拽预览比例，拖拽中只更新本地视图，mouseup 再一次性提交到 `terminalStore`。
- pane 内容稳定：让 `PaneLeafView` 具备稳定渲染边界，避免拖拽预览时把内部重型内容一并重渲染。
- 侧边面板拖拽：复用历史侧栏的模式，拖拽中直接改容器 DOM 宽度，mouseup 后再 `setWidth` + `localStorage` 持久化。

## Technical Notes

- 已定位文件：
  - `src/components/SplitTerminalView.tsx`
  - `src/components/TerminalTabs.tsx`
  - `src/components/terminal/TerminalSidePanel.tsx`
  - `src/stores/terminalStore.ts`
- 参考现有拖拽实现：
  - `src/components/HistoryWorkspace.tsx`
  - `src/components/sidebar/index.tsx`
