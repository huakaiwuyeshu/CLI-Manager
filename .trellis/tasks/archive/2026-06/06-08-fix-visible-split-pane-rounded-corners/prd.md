# Fix Visible Split Pane Rounded Corners

## Goal

分屏后每个 terminal pane 的圆角必须在视觉上可见，而不是看起来仍然只有整体 terminal well 的四个外角有圆角。

## What I already know

- 上一次仅给 `.ui-terminal-well .ui-terminal-pane` 加 `border-radius: 8px`，但用户反馈视觉上仍只有外层四角。
- 原因不是 radius 属性不存在，而是 pane 之间缺少可见承托/对比，圆角裁剪区域露出的仍接近终端背景色，所以内部圆角看不出来。
- `src/App.css` 是当前最小修改点。
- `src/components/TerminalTabs.tsx` 已修复所有分屏 pane 显示 toolbar，本次不应回退。
- CLI-Manager 桌面 UI 只能人工验收，AI 只跑静态检查和构建。

## Requirements

- 分屏后每个 pane 的独立圆角必须可见。
- pane 之间需要有克制的间距/gutter 承托，让内部圆角不被同色背景吞掉。
- 不使用明显描边或强卡片化边界，避免视觉太“土”。
- 保留整体 terminal well 外层圆角。
- 保留每个分屏 pane 的 toolbar。
- fullscreen 模式不应出现不必要圆角或边缘空白。

## Acceptance Criteria

- [x] 横向分屏时，左右 pane 各自靠近 divider 的顶部/底部角能看出圆角。
- [x] 纵向分屏时，上下 pane 各自靠近 divider 的左右角能看出圆角。
- [x] 多级分屏时，每个 leaf pane 都有可见圆角。
- [x] 单 pane 和 fullscreen 不出现明显视觉回退。

## Definition of Done

- TypeScript 静态检查通过。
- 前端构建通过。
- diff 检查通过。
- GitNexus detect_changes 无 HIGH/CRITICAL 风险。
- 运行态视觉由人工验收。

## Technical Approach

单文件 CSS 修正：

- 在 `SplitTerminalView` 的 split 根节点和 divider 上加语义 class。
- 让 split 根节点使用克制的 gutter 背景，divider 保持透明，让 gutter 自然露出。
- 给 `.ui-terminal-well .ui-terminal-pane` 保留 `border-radius: 8px`，不增加明显描边。
- fullscreen 下继续将 pane 圆角清零。

## Decision (ADR-lite)

**Context**: 仅设置 border-radius 不足以让内部圆角可见，因为裁剪区域和终端背景接近同色。
**Decision**: 用 split 容器的克制 gutter 背景承托每个 pane 的圆角，不使用明显描边。
**Consequences**: 分屏 pane 的内部圆角会更自然地露出来；需要人工确认 gutter 强度是否合适。

## Out of Scope

- 不改 split tree、拖拽、比例计算或 divider 尺寸。
- 不改 toolbar 结构。
- 不新增设置项。

## Technical Notes

- 相关文件：`src/App.css`。
- 需要保持上一轮 `src/components/TerminalTabs.tsx` 的 toolbar 修复不变。
