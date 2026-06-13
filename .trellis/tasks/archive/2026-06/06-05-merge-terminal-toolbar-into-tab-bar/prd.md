# Merge Terminal Toolbar Into Tab Bar

## Goal

终端顶部当前有一条单独按钮栏，造成 tab 上方存在空白/额外高度。将顶部按钮移动到终端 tab 同一行，并把 terminal tab 边框调整为绿色，让终端顶部更紧凑。

## Requirements

- 移除单独的 global terminal chrome 按钮栏，不保留上方空白。
- 将新建、模板、命令历史、全屏、会话历史等 toolbar actions 移入终端 tab 栏。
- terminal tab 边框使用绿色；选中 tab 的绿色更明显。
- 不修改终端会话、PTY、分屏拖拽、历史数据或设置存储逻辑。
- 不新增依赖。

## Acceptance Criteria

- [x] 终端内容区顶部不再出现独立按钮栏/空白栏。
- [x] toolbar 按钮与 terminal tab 位于同一水平行。
- [x] terminal tab 边框呈绿色，选中态清晰。
- [x] tab 横向溢出滚动、tab 列表按钮、关闭按钮仍可用。
- [x] 多分屏下不会重复出现多套全局 toolbar 按钮。

## Definition of Done

- TypeScript 静态检查通过。
- GitNexus 变更检测无异常高风险影响。
- CLI-Manager 运行态终端 UI 由人工验收。

## Technical Approach

推荐方案：删除 `TerminalTabs` 返回结构中的 global chrome 按钮栏，将 `renderToolbarActions()` 作为 `toolbarActions` 传入当前活跃 pane 的 `PaneTabBar`；在 `App.css` 中局部覆写 terminal pane 内 tab 的绿色边框和 toolbar 在 tab 行内的紧凑样式。

## Decision (ADR-lite)

**Context**: 当前按钮在单独的 global chrome，tab 栏在 pane 内，导致顶部有额外一行空白。
**Decision**: 将按钮挂到活跃 pane 的 tab 行，避免多分屏时重复按钮。
**Consequences**: 多分屏时只有当前活跃 pane 显示全局 toolbar；视觉更紧凑，但需要人工确认 split 场景下按钮位置符合预期。

## Out of Scope

- 不重做终端 tab 交互。
- 不新增 toolbar 位置设置项。
- 不调整历史工作区内部布局。
- 不改变 terminal theme palette。

## Technical Notes

- `src/components/TerminalTabs.tsx:1154` 渲染 toolbar actions。
- `src/components/TerminalTabs.tsx:566` 的 `PaneTabBar` 已支持 `toolbarActions?: ReactNode`。
- `src/components/TerminalTabs.tsx:1294` 当前渲染独立 global chrome，是要移除的空白来源。
- `src/App.css:755` 控制 tab 边框；可用 `.ui-terminal-pane-chrome .ui-tab-trigger` 做局部覆盖。
- `src/App.css:1935` 控制 terminal chrome 外观。
- GitNexus impact: `TerminalTabs` upstream risk LOW, direct callers 0, affected processes 0；内层 `PaneTabBar`/`PaneLeafView` 未单独索引。
- 项目记忆要求：CLI-Manager 运行态/桌面 UI 不由 AI 启动服务验证，最终需人工验收视觉。
