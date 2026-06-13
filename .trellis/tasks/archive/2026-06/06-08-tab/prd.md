# 修正终端 Tab 悬浮样式

## Goal

修正终端 Tab 悬浮后背景变灰但文字仍偏白导致视觉突兀的问题，让 hover 状态继续贴近终端主题配色。

## What I already know

- 用户反馈：当前 Tab hover 后背景色是灰色，字体仍为白色，视觉效果很差。
- `src/components/TerminalTabs.tsx` 中终端 Tab 同时使用 `ui-interactive ui-tab-trigger`。
- `src/App.css` 的通用 `.ui-interactive:hover` 会设置 `background-color: var(--interactive-hover-bg)`，这是灰底来源。
- `src/App.css` 已有 `.ui-terminal-pane-chrome .ui-tab-trigger` 与 selected 态的终端局部覆盖，但缺少 hover 态覆盖。
- 项目规范要求终端内嵌 UI 贴近终端视觉，不要套用通用应用控件样式。

## Requirements

- 只修正终端 pane 内 Tab hover 状态的文字/背景配色。
- 优先使用终端主题变量派生色，避免通用灰色 hover 背景。
- 最小改动，不重构 `TerminalTabs.tsx`，不改状态或交互逻辑。

## Acceptance Criteria

- [x] 未选中终端 Tab hover 时不再显示突兀灰底。
- [x] hover 文字、关闭按钮、状态文字在终端主题下可读且不抢眼。
- [x] 选中 Tab 样式保持不变。
- [x] 只影响终端 Tab，不扩大到其他通用交互控件。

## Definition of Done

- 静态检查通过（优先 `npx tsc --noEmit`，如耗时/环境异常则说明）。
- 不启动 Tauri 桌面应用做 AI 自验。
- 列出人工 UI 验收项。

## Technical Approach

在 `src/App.css` 的终端 pane 局部样式附近新增 `.ui-terminal-pane-chrome .ui-tab-trigger:hover:not([data-selected="true"])` 规则，用终端前景色/背景色和 accent 派生低强度 hover 背景、文字色、边框色，覆盖通用 `.ui-interactive:hover`。

## Decision (ADR-lite)

**Context**: 通用 `.ui-interactive:hover` 用应用级灰底，不适合终端内嵌 Tab。

**Decision**: 仅在 `.ui-terminal-pane-chrome` 范围内添加 hover 覆盖，不修改通用交互样式。

**Consequences**: 风险集中在终端 pane tab 的 hover 视觉；全局 tab、拖拽 overlay、按钮交互不应受影响。

## Out of Scope

- 不调整 Tab 尺寸、圆角、布局、拖拽逻辑。
- 不修改全局 `.ui-interactive` 行为。
- 不启动桌面 UI 自动验收。

## Technical Notes

- Relevant code: `src/components/TerminalTabs.tsx:238`，Tab class 包含 `ui-interactive ui-tab-trigger`。
- Relevant code: `src/components/TerminalTabs.tsx:569`，pane 使用 `ui-terminal-pane-chrome` 作为终端局部作用域。
- Relevant style: `src/App.css:718`，通用 hover 设置灰底。
- Relevant style: `src/App.css:1964`，终端 pane Tab 普通态。
- Relevant style: `src/App.css:1969`，终端 pane Tab 选中态。
