# Fix compact IME input anchor jitter

## Goal

修复 Claude Code `/compact` 期间中文 IME 组合输入层和候选窗锚点跟随 compact 进度条光标跳动的问题。用户截图显示：实际输入行在底部 prompt，但 xterm 的 composition 文本和 IME 候选窗漂到 compact 进度输出附近。

## What I already know

* 之前只固定非 composition 状态下的 `.xterm-helper-textarea`，仍未解决。
* 截图显示问题发生在 IME composition：黑色 composition-view 和白色候选窗都出现在 compact 进度区域，而不是底部输入行。
* xterm `CompositionHelper.updateCompositionElements()` 在 composition 时会把 `.composition-view` 和 `.xterm-helper-textarea` 设到 `buffer.x/y` 对应的终端光标。
* Claude Code `/compact` 会高频移动终端光标刷新进度条；此时真实输入区由 TUI 自绘在底部，不一定等于 xterm 光标。
* 仅重置外层 scroll 或仅在非 composition 时离屏 textarea 都不够。
* GitNexus impact：`XTermTerminal` upstream risk LOW，无直接调用链影响。

## Requirements

* `/compact` 期间，IME composition 文本和候选窗应锚定到底部输入行附近，不跟随 progress cursor。
* 保留普通键盘输入、回车、粘贴。
* 保留中文/IME composition 的基本可用性。
* 不绑定 compact 文案，不修改 Claude Code 输出。
* 最小修改，优先只改 `src/components/XTermTerminal.tsx`；必要时同步更新 xterm 规约。

## Acceptance Criteria

* [ ] `/compact` 期间输入中文/拼音，composition-view 和候选窗不跳到进度条区域。
* [ ] 普通英文输入和回车仍可用。
* [ ] 粘贴仍走 `terminal.paste` 路径。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 运行态 UI 由用户人工验证。

## Technical Approach

在 xterm composition 期间，不再完全交给 xterm 的 `buffer.x/y`。新增一个 composition 锚点修正：xterm 更新 `.composition-view` 和 `.xterm-helper-textarea` 后，再把它们重定位到底部输入行附近的稳定位置。非 composition 状态继续把 helper textarea 固定到离屏默认位置。

优先方案：用 xterm buffer 可见行扫描底部 prompt 行（如 `> ...`）并估算输入末尾 x 坐标；找不到时 fallback 到倒数第二行左侧。这样比固定 progress 光标更接近 Claude Code 的真实输入区，同时不依赖 compact 文案。

## Out of Scope

* 不重写 xterm 或 Claude Code TUI。
* 不新增外部输入框。
* 不启动桌面应用做 AI 视觉验证。

## Technical Notes

* xterm CSS：`.composition-view` 是 absolute active layer。
* xterm code：`CompositionHelper.updateCompositionElements()` 会设置 composition view 与 textarea 的 left/top/width/height。
* 风险：candidate window 精确跟随输入末尾需要估算字符宽度；可接受目标是稳定在底部输入行附近，不再漂到进度条。
