# 终端分屏与重绘性能排查

## Changelog Target

`[TEMP]`

## Goal

参照 VS Code 1.130.0 的终端布局策略，恢复终端分屏拖拽交互，并消除 Tab 切换后的大片空白与侧边栏拖拽引发的终端尺寸重绘卡顿。

## Root-Cause Statement

问题集中在 React 布局、xterm 可见性恢复和 resize/reflow 三层边界：当前代码在布局拖动期间重复触发 React 渲染与带动画的几何变化，同时普通 Tab 切回只做尺寸同步、不保证 WebGL viewport 已恢复，因此需要在布局驱动与 xterm 重绘协议处修复，不能只增加延时或重试。

## What I Already Know

- 用户已确认“拖拽分屏”指拖动终端 Tab 到 Pane 边缘创建新分屏。
- 用户已确认拖拽可以启动，但 Pane 边缘不出现高亮；按当前界面语义，将该标签视为顶部 Workspan Tab。
- 该 DnD 代码仍存在，但 Workspan 引入后出现可达性断层：单会话时 Pane Tab 栏被隐藏，用户实际拖动的是顶层 Workspan Tab；Workspan 拖动分支只能合并到“另一个当前可见 Workspan”的 Pane，但拖动期间不会激活目标 Workspan，因此目标 Pane 无法出现，边缘分屏路径实际上不可达。
- `ebd6b38` 将强制 fit 时的 viewport 刷新条件从 `force || needsViewportRefresh` 收紧为仅 `needsViewportRefresh`；普通 Tab 切回且 WebGL 未重建时不会标记刷新。
- 首轮修复重新把强制 fit 与完整 viewport 刷新绑定，运行时截图确认这会让普通 Tab 每次切回都暴露从上到下的整屏重绘；正确边界应是“立即 resize”和“强制 viewport 刷新”分别控制。
- 侧边栏拖拽每帧调用 `setSidebarWidth`，会重渲染约 2400 行的 `Sidebar` 组件。
- `SplitTerminalView` 的 pane 几何默认有 250ms 的 width/height transition；侧边栏拖拽时未关闭，导致连续 `ResizeObserver -> proposeDimensions -> resize` 链路。
- 当前 `TerminalResizeDebouncer` 已复制 VS Code 的“大缓冲区纵向立即、横向 100ms debounce”策略，但没有统一的布局拖动结束 flush 协议。

## Requirements

- 保留终端实例常驻和隐藏期间继续解析输出，不恢复 inactive replay。
- Tab 切回时必须在 1–2 帧内显示完整 viewport，不得等待后续输出或定时器触发重绘。
- 不允许每次普通 Tab 切换都无条件暴露整屏逐行刷新过程。
- 侧边栏和分屏拖动期间，布局更新不得让大型 React 子树每帧重渲染。
- 横向列数变化继续采用 100ms debounce，纵向行数变化立即处理；拖动结束必须提交最终尺寸。
- 布局拖动期间禁止 pane 宽高动画叠加，非拖动场景可保留现有过渡效果。
- 不新增依赖，不修改 PTY/daemon 协议。

## Scenario Matrix

- Tab：同 Pane 切换、跨 Workspan 切换、隐藏超过 10 秒后切回。
- Renderer：WebGL 保留、WebGL 释放后重建、硬件加速关闭。
- Pane：单 Pane、横向分屏、纵向分屏、深层 split、Pane 全屏。
- Layout：左侧栏拖拽、右侧工具面板拖拽、窗口 resize、分屏 divider 拖拽。
- Buffer：少于 200 行、大于 200 行、用户停留在 scrollback 非底部。
- 环境：PowerShell/Pwsh/CMD、Git Bash、WSL、Codex/Claude TUI。

## Acceptance Criteria

- [x] 用户确认“拖拽分屏”指拖动终端 Tab 到 Pane 边缘创建新分屏。
- [ ] 拖动顶层 Workspan Tab 或 Pane 内 Terminal Tab 时，目标 Pane 边缘可正确高亮并完成分屏合并。
- [x] 顶部 Workspan Tab 悬停到另一个 Workspan Tab 500ms 后自动激活目标，继续拖到目标 Pane 边缘时显示高亮。
- [ ] 普通 Tab 切换后完整内容在两帧内可见，无大片空白和约 10 秒等待。
- [ ] 隐藏期间无输出、持续输出、WebGL 被释放三种情况下切回均正确。
- [ ] 连续拖拽侧边栏时终端容器跟手，横向 reflow 不高频执行，松手后 100ms 内完成最终尺寸。
- [ ] 连续拖拽分屏 divider 时行为与 VS Code 一致，松手后最终 cols/rows 与容器匹配。
- [ ] 用户查看历史 scrollback 时 resize 不强制滚到底部。
- [ ] 新增终端可见性、resize debounce 和拖动结束行为测试通过。
- [x] `npx tsc --noEmit` 与相关 Node 测试通过。

## Verification Status

- 自动检查：`npx tsc --noEmit` 通过；相关 Node 测试 27/27 通过；`git diff --check` 通过。
- 已覆盖回归：Workspan 拖拽 ID/悬停目标解析、500ms 常量、立即 fit 与强制 viewport 刷新解耦、显式刷新在尺寸不变时仍重绘完整 viewport、Workspan 四方向合并与嵌套 Pane 合并。
- 待人工桌面验收：实际拖拽高亮/落位、普通与 WebGL 释放后的 Tab 切回观感、侧边栏/分屏 divider 连续拖动、历史 scrollback 位置保持。

## Out of Scope

- 不重构整个 `TerminalTabs`、`Sidebar` 或 xterm 子系统。
- 不调整 daemon 回放、ACK、spool 或跨平台 PTY 实现。
- 不引入新的布局库。

## Technical Approach

- 复用现有 `mergeWorkspanAtPaneEdge`，不新增 Store 数据模型。
- 对齐 VS Code：拖动 Workspan Tab 悬停另一个 Tab 500ms 后自动激活目标 Workspan；目标 Pane 挂载后沿用现有 edge drop-zone 和 preview。
- Tab 切回先立即 fit 并等待 xterm 自然恢复；两帧内没有完整 render 时再强制刷新，同时使用完整 viewport render 屏障避免暴露逐行绘制。
- 侧边栏拖动用 DOM width 做实时预览，mouseup 时一次性提交 React state；移除终端 Pane 几何 transition。

## Decision (ADR-lite)

**Context**: Workspan 引入后，顶部 Tab 代表工作区而不是直接代表 Pane 内 Session；拖动源 Workspan 时另一个 Workspan 的 Pane 未挂载，边缘 drop-zone 无法参与碰撞。

**Decision**: 采用 VS Code 的 500ms drag-hover 自动激活目标 Tab，再复用现有 Pane edge drop 逻辑。

**Consequences**: 不改变 Workspan/Pane 数据结构；拖动行为增加一个有界计时器，必须在离开目标、取消和结束拖动时清理。

## Open Questions

- 无。

## Research References

- [`research/vscode-terminal-layout.md`](research/vscode-terminal-layout.md) — VS Code 的分屏、可见性和 resize 优化策略。
