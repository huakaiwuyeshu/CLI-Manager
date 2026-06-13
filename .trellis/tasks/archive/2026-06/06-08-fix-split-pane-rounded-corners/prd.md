# Fix Split Pane Rounded Corners

## Goal

分屏后，每个 terminal pane 自己也要保留圆角效果，而不是只有整体 terminal well 外框有圆角。用户反馈上次修复方向不对：现在只有全局终端大区域有圆角，分屏出来的 pane 没有圆角。

## What I already know

- 当前 `src/App.css` 里新增了 `.ui-terminal-well .ui-terminal-pane` 等规则，把 terminal well 内部 pane/chrome/background 的 `border-radius` 强制设为 `0`。
- 这会让分屏 pane 无法显示自己的圆角。
- `src/components/TerminalTabs.tsx` 已经有 `ui-terminal-pane` 和 `ui-terminal-pane-content` class，可直接用 CSS 控制 pane 层视觉。
- 运行态/桌面 UI 不由 AI 启动验证，最终视觉需人工验收。

## Requirements

- 分屏出来的每个 terminal pane 都要有圆角。
- 仍保留整体 terminal well 的外层圆角。
- 不回退上一轮 toolbar 修复：所有分屏 pane 仍应显示 toolbar 按钮。
- 不改终端会话、PTY、历史、拖拽分屏逻辑。
- fullscreen 模式不应因为 pane 圆角导致终端无法贴边填充。

## Acceptance Criteria

- [x] 分屏后每个 pane 的可视区域有圆角。
- [x] 单 pane 模式整体外观不出现额外异常缝隙。
- [x] fullscreen 终端仍能填满窗口，不出现不必要外层空白。
- [x] 每个分屏 pane 的 toolbar 仍可见。

## Definition of Done

- TypeScript 静态检查通过。
- 前端构建通过。
- diff 检查通过。
- GitNexus detect_changes 无 HIGH/CRITICAL 风险。
- 运行态视觉由人工验收。

## Technical Approach

- `src/App.css`：把上一轮强制内部 pane `border-radius: 0` 的规则改为让 `.ui-terminal-pane` 自己有圆角和裁剪。
- 保持 `.ui-terminal-pane-content`、`.ui-terminal-chrome`、`.ui-terminal-bg-layer` 不单独声明圆角，依赖 pane 根节点 `overflow: hidden` 裁剪内部背景和 chrome。
- fullscreen 下覆盖 `.ui-terminal-pane` 为直角，避免影响沉浸式填充。

## Decision (ADR-lite)

**Context**: 用户确认分屏 pane 也需要圆角；上一轮把圆角集中到外层 well 导致 split pane 视觉不符合预期。
**Decision**: 圆角层级改为外层 well + 每个 pane 根节点；内部 chrome/content 不各自定义圆角。
**Consequences**: 分屏 pane 会有独立卡片感；最终观感仍需桌面 UI 人工确认。

## Out of Scope

- 不调整 split divider 尺寸、颜色或拖拽逻辑。
- 不调整 toolbar 按钮结构。
- 不新增用户配置项。

## Technical Notes

- 相关文件：`src/App.css`、`src/components/TerminalTabs.tsx`。
- 前端规约要求终端视觉改动运行静态检查/构建，并列人工验收项。
