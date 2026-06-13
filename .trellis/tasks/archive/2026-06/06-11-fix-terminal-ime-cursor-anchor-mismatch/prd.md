# Fix terminal IME cursor anchor mismatch

## Goal

修复内嵌终端里中文输入法候选窗位置与真实输入光标位置不一致的问题。用户截图显示 Claude Code 输入行在终端中部，但 IME 候选栏锚定到了窗口底部。

## What I already know

* 用户截图中的现象：终端内真实输入光标在 `> 是地方撒` 后方，IME 候选栏却显示在窗口底部。
* 相关实现集中在 `src/components/XTermTerminal.tsx` 的 xterm helper textarea / composition-view 锚点逻辑。
* 当前逻辑 `resolveCompositionAnchorCell()` 会扫描底部 prompt 行；扫不到时 fallback 到倒数第二行。
* 之前的修复目标是避免 `/compact` 进度光标把 IME 锚点带到进度条区域，因此引入了“底部输入行附近”的兜底策略。
* 现在的截图说明该兜底策略在真实输入行不在底部时会过度修正，把候选窗放错。
* 追加复现：composition 期间 xterm 当前 cursor 有时会落到 Claude 状态/进度行，导致候选栏出现在状态行右侧。
* xterm 公开 `terminal.buffer.active.cursorX/cursorY`，且 xterm 自身 `CompositionHelper.updateCompositionElements()` 也是用当前 cursor 作为 composition 锚点。
* GitNexus impact：`XTermTerminal` upstream risk LOW，无直接调用链影响。

## Requirements

* 中文/IME composition 期间，候选窗应优先锚定到当前 xterm 可见光标位置。
* 如果 composition 期间当前 cursor 被 TUI 状态/进度行占用，应回退到最近的可见 prompt 行，而不是固定到底部或状态行右侧。
* 仍保留已有的 compact/progress 场景防抖逻辑，避免非 composition 下 helper textarea 跟随进度光标造成滚动或视觉跳动。
* 不新增终端外部输入框。
* 不修改 Claude Code 输出、不绑定具体 Claude 文案。
* 最小改动，优先只改 `src/components/XTermTerminal.tsx`。

## Acceptance Criteria

* [ ] 截图场景中，中文输入法候选栏靠近真实输入光标，而不是固定到底部。
* [ ] 状态/进度行抢占 cursor 的偶现场景中，中文输入法候选栏回退到最近可见 prompt 行。
* [ ] Claude Code `/compact` 或类似进度输出期间，非 composition 状态下输入代理不造成画面跳动。
* [ ] 普通英文输入、回车、粘贴仍可用。
* [ ] 中文/IME composition 仍可用。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 运行态终端 UI 由用户人工验证。

## Technical Approach

把 composition 期间的锚点从“优先扫描底部 prompt / fallback 底部”改为“当前 cursor 位于 prompt 行时使用 `buffer.active.cursorX/cursorY`；当前 cursor 位于状态/进度行时，扫描可视 buffer 中最近的 prompt 行作为兜底”。行尾列使用 xterm buffer cell 宽度计算，避免中文宽字符造成偏移。保留非 composition 时隐藏 helper textarea 的逻辑，继续避免 compact 进度光标带来的跳动。

## Out of Scope

* 不重写 xterm 渲染或输入架构。
* 不新增状态机识别 Claude compact 文案。
* 不启动 Tauri 桌面应用做 AI 视觉验收。
* 不处理本任务外的未提交文件。

## Technical Notes

* 相关文件：`src/components/XTermTerminal.tsx`
* 参考规范：`.trellis/spec/frontend/component-guidelines.md`、`.trellis/spec/frontend/quality-guidelines.md`
* xterm typing：`IBuffer.cursorX/cursorY` 表示当前可见 cursor 的列/行。
* xterm source：`CompositionHelper.updateCompositionElements()` 用 buffer cursor 计算 composition-view 和 textarea 的 left/top。
