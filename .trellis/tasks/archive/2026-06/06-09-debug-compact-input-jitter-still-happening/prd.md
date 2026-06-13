# Debug compact input jitter still happening

## Goal

重新诊断并修复 Claude Code `/compact` 期间，进度条刷新导致终端输入代理/输入框视觉锚点跟随光标跳动的问题。

## What I already know

* 用户反馈上一版修复无效：`/compact` 时输入框仍会随着进度条光标跳动。
* 复现场景是 Claude Code compact 输出进度条和 Tip 行，终端应用会频繁移动光标刷新进度。
* 上一版修复只重置 `containerRef` 外层滚动，并保留 IME composition 滚动恢复。
* 当前证据表明根因不在外层容器滚动；xterm 自身会在每次 `onCursorMove` 后把 `.xterm-helper-textarea` 的 left/top 同步到终端光标。
* `.xterm-helper-textarea` 是真实输入代理，不能隐藏或移除；否则会破坏键盘输入、粘贴或 IME。

## Requirements

* compact 期间输入代理/输入框视觉锚点不跟随进度条光标跳动。
* 保留 xterm 正常渲染、键盘输入、粘贴。
* IME composition 时仍允许 xterm 把 textarea 定位到实际终端光标，避免破坏候选窗口定位。
* 不绑定 Claude compact 文案，不改 Claude 输出。
* 最小修改，优先局限在 `src/components/XTermTerminal.tsx`。

## Acceptance Criteria

* [ ] `/compact` 进度条刷新期间输入框视觉锚点稳定。
* [ ] 普通命令输入、回车、粘贴可用。
* [ ] 中文/IME composition 可用。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 运行态视觉由用户人工验证。

## Technical Notes

* xterm 6.0 `focus()` 已经使用 `textarea.focus({ preventScroll: true })`，所以不是 focus 自动滚动问题。
* xterm `CoreBrowserTerminal._syncTextArea()` 在光标移动后设置 `textarea.style.left/top/width/height`，用于让 IME 知道输入位置。
* 上一版重置容器滚动不会阻止 textarea 自身跟随光标，因此无法解决用户看到的输入框跳动。
* 候选修复：非 composing 状态下，在 xterm 完成 cursor move 同步后，把 helper textarea 的位置钉在终端底部稳定区域；composition 开始后恢复交给 xterm 控制。
