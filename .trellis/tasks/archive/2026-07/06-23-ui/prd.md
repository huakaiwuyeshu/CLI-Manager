# 压缩顶部边框并评估 UI 优化

## Goal

压缩应用顶部标题栏/上方边框的视觉高度，让主工作区更贴近窗口顶部，同时基于当前截图给出可落地的 UI 优化建议。

## What I already know

* 用户反馈截图中上方边框有点太宽，希望压缩窄一点。
* 当前应用使用自定义 `WindowTitleBar`，标题栏固定为 `h-9`，窗口按钮为 32px 高。
* 终端标签栏 `ui-terminal-chrome`/`ui-terminal-pane-chrome` 同时占据上方空间；本次优先压缩窗口标题栏，避免影响终端标签拖拽/分屏交互。
* 右侧 Git 面板与 Hook 通知存在叠放场景，截图中通知遮挡了 Git 面板局部内容，可作为后续 UI 优化建议。

## Assumptions (temporary)

* 本次只做小范围视觉压缩，不改窗口交互逻辑、不改终端标签栏结构。
* 不新增前端依赖。

## Open Questions

* 无阻塞问题；按最小可逆样式调整执行。

## Requirements

* 将顶部自定义标题栏从约 36px 压缩到约 26px。
* 同步压缩窗口控制按钮高度，保持点击区域可用且视觉更轻。
* 保留标题栏拖拽、双击最大化、最小化/最大化/关闭按钮交互。
* Hook toast 在宽屏桌面布局下避让常见右侧 Git 面板区域，窄屏保持右侧贴边行为。
* 轻量化 Hook toast 的宽度、padding、icon、按钮与阴影，降低遮挡面积。
* 压缩终端标签栏/分屏标签栏视觉高度，不改变拖拽、分屏、关闭按钮交互。
* 弱化右侧终端操作区与嵌入 Git 面板的边框/渐变/hover 噪声，提升层级清晰度。
* 修复标题栏收窄后设置页顶部与窗口标题栏之间暴露黑色缝隙的问题。
* 移除终端 tab 栏悬浮时的多行状态描述 tooltip（状态/会话名/更新时间），保留无障碍 `aria-label` 和 tab 标题截断时的简单 hover。
* 给出截图中其他可优化 UI 点的建议，并已按阶段落地主要 CSS-only 优化。

## Acceptance Criteria

* [x] 顶部标题栏视觉高度明显变窄。
* [x] 窗口图标、标题、窗口控制按钮仍垂直居中。
* [x] Hook toast 在宽屏下向左避让右侧面板，窄屏仍保持可见且不过度占用中心区域。
* [x] Hook toast 视觉体积降低但标题、来源、操作按钮仍可读可点。
* [x] 终端标签栏视觉高度降低，标签、滚动按钮、关闭按钮保持对齐。
* [x] 不改变终端标签栏拖拽/分屏逻辑。
* [x] 右侧操作区/Git 面板视觉层级更轻，不改变 Git 数据或交互逻辑。
* [x] 设置页打开时顶部不再出现标题栏收窄后暴露的黑色缝隙。
* [x] 前端类型检查通过或说明未运行原因。

## Definition of Done (team quality bar)

* 类型检查通过（`npx tsc --noEmit`）或如用户约定由用户验证，则明确说明未跑。
* 变更范围清楚、可回滚。
* 不主动提交 git commit。

## Out of Scope (explicit)

* 重做整体布局系统。
* 调整终端分屏/拖拽交互逻辑。
* 变更 Hook 通知行为或 Git 面板数据逻辑。
* 新增设置项。

## Technical Notes

* Inspected: `src/components/WindowTitleBar.tsx` — 标题栏 JSX 与窗口按钮。
* Inspected: `src/styles/components.css` — `.window-titlebar`、`.titlebar-btn`、终端 chrome 相关样式。
* Inspected: `src/components/TerminalTabs.tsx` — 终端标签栏高度来自 `h-10` 与 `h-7` 标签触发器。
* 本次只计划改 CSS 规则，不改 TypeScript 函数组件符号；因此不涉及 GitNexus 函数/方法符号影响面。
