# Fix Split Terminal Toolbar and Rounded Corners

## Goal

分屏后每个终端 pane 都应保留 tab 栏右侧 toolbar 按钮；终端圆角只应来自整体 terminal well 的外层四角，而不是每个分屏 pane 都呈现独立圆角。

## What I already know

- toolbar 已从全局顶部栏合并到 pane tab 栏。
- 当前 `src/components/TerminalTabs.tsx` 在 `renderLeaf` 中只给包含 `activeSessionId` 的 pane 传入 `toolbarActions`，导致分屏后只有一个 pane 有按钮。
- 当前 terminal 外框圆角主要由 `src/App.css` 的 `.ui-terminal-well` 控制。
- 运行态/桌面 UI 只能由人工验收，AI 只做静态检查和构建验证。

## Requirements

- 所有分屏 pane 的 tab 栏都显示同一组 toolbar 按钮。
- 分屏内部 pane 不显示独立圆角，只保留整体 terminal 区域外层四角圆角。
- 不修改终端会话、PTY、历史、拖拽分屏或会话恢复逻辑。
- 顺手收敛 terminal pane 内重复的 tab 配色规则，避免后置规则覆盖主题蓝灰方案。

## Acceptance Criteria

- [x] 分屏为两个或多个 pane 后，每个 pane 的 tab 栏右侧都有新建、模板、历史、全屏等可见 toolbar 按钮。
- [x] 分屏内部相邻 pane 边界不再呈现每个 pane 独立圆角。
- [x] terminal 区域整体外框仍保留外层四角圆角。
- [x] tab 普通态、选中态、新建按钮配色沿用主题蓝灰方案且无重复规则互相覆盖。

## Definition of Done

- TypeScript 静态检查通过。
- 前端构建通过。
- diff 只包含预期 CSS / TerminalTabs / Trellis 文件。
- CLI-Manager 运行态终端视觉由人工验收。

## Technical Approach

- `src/components/TerminalTabs.tsx`：移除 active pane 条件过滤，`renderLeaf` 对每个 pane 都传入 `renderToolbarActions()`。
- `src/App.css`：显式保证 terminal pane 内部不产生独立圆角，外层 `.ui-terminal-well` 继续负责整体裁剪；合并 `.ui-terminal-pane-chrome .ui-tab-trigger` 的重复配色规则。

## Decision (ADR-lite)

**Context**: toolbar 已并入 pane tab 栏后，active pane 过滤让分屏 UI 行为不一致；内部 pane 独立圆角会破坏整体 terminal well 的单一容器感。
**Decision**: toolbar 按 pane 渲染但共享同一组 actions；圆角只放在外层 terminal well，内部 pane/chrome/content 保持直角。
**Consequences**: 每个 pane 操作入口一致，整体视觉更像一个分屏终端容器；最终视觉仍需人工在桌面 UI 中确认。

## Out of Scope

- 不调整分屏比例、拖拽逻辑或 drop zone 行为。
- 不改 toolbar 按钮功能和显示配置。
- 不新增主题设置项。
- 不启动 Tauri 桌面应用做自动验收。

## Technical Notes

- `src/components/TerminalTabs.tsx` 的 `renderLeaf` 是 toolbar 丢失的直接原因。
- `src/App.css` 的 `.ui-terminal-well` 是整体终端圆角来源。
- 前端规约要求终端 UI 改动运行 `npx tsc --noEmit`，运行态视觉列人工验收项。
