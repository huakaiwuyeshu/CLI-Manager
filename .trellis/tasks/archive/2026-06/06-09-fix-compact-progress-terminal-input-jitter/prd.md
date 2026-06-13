# Fix compact progress terminal input jitter

## Goal

修复内嵌终端中 Claude Code compact 进度输出期间，光标频繁移动导致输入区域/视图位置跟随跳动的问题。目标是让 compact 进度条刷新时终端画面保持稳定，不影响正常键盘输入、粘贴、搜索和输入法组合输入。

## What I already know

* 用户复现现象：Claude Code 压缩上下文时会输出 `Compacting conversation…` 文本和进度条，期间光标跳动；输入框位置会随光标跳动，造成画面乱晃。
* 项目内嵌终端由 `src/components/XTermTerminal.tsx` 管理，使用 `@xterm/xterm`、`FitAddon`、`SearchAddon`、`WebglAddon`。
* PTY 输出通过 `pty-output-${sessionId}` 事件进入 `XTermTerminal`，前端每帧批量写入 xterm。
* `XTermTerminal` 已在 IME composition 期间锁定 `containerRef` 和 `.xterm-viewport` 的 scrollTop/scrollLeft，说明项目之前遇到过输入法/隐藏 textarea 引起的滚动问题。
* `TerminalTabs` 的 pane 容器使用 `absolute inset-0` + `overflow-hidden`，终端主体不是独立业务输入框，而是 xterm 内部屏幕和 helper textarea。
* `src/App.css` 已导入 `@xterm/xterm/css/xterm.css`，当前只对背景图透明层和主题做了局部样式覆盖。
* 项目记忆要求：终端内 UI 应贴近终端视觉；CLI-Manager 运行态/桌面 UI 由人工验收，AI 不启动应用做视觉验证。

## Assumptions (temporary)

* 抖动高概率来自 xterm 内部 `.xterm-helper-textarea` 随终端光标定位时触发浏览器 `scrollIntoView`/滚动校正，而不是应用层 React state 反复布局。
* 最小修复应优先限制终端容器/viewport 在正常输入焦点下的意外滚动，不能禁用 xterm 的键盘输入和 IME composition。

## Open Questions

* 等待用户确认：采用通用“光标移动后锁定终端滚动”的最小修复，而不是只识别 Claude compact 文案。

## Requirements (evolving)

* compact 进度条刷新期间，终端容器和视图不应出现肉眼可见的上下跳动。
* 修复应覆盖同类频繁光标定位输出，而不是绑定 Claude compact 文案。
* 不破坏正常终端输入、粘贴、快捷键和搜索浮层。
* 不破坏现有 IME composition 滚动锁定逻辑。
* 采用最小必要改动，优先局限在终端组件范围内。

## Research Notes

* xterm 6.0 的 `focus()` 已使用 `textarea.focus({ preventScroll: true })`，因此焦点本身不是主要问题。
* xterm 会在 `onCursorMove` 后调用内部 `_syncTextArea()`，把 `.xterm-helper-textarea` 的 `left/top/width/height` 同步到光标位置，以支持 IME。
* `.xterm-helper-textarea` 不能隐藏或移除；它承担键盘输入、粘贴和 IME 输入职责。
* 项目现有 `XTermTerminal` 已在 IME composition 期间恢复 `containerRef` 与 `.xterm-viewport` 滚动，适合扩展成更通用的滚动稳定逻辑。

## Technical Approach

在 `src/components/XTermTerminal.tsx` 内提取一个小的滚动捕获/恢复函数，复用给 IME composition；再监听 `terminal.onCursorMove`，当终端获得焦点且未处于 IME composition 时，在下一帧把 `containerRef` 与 `.xterm-viewport` 恢复到光标移动前的滚动位置。这样保留 xterm helper textarea 的定位和 IME 能力，同时抵消浏览器因 textarea 跟随光标而触发的容器滚动。

## Acceptance Criteria (evolving)

* [ ] Claude Code compact 进度输出期间，当前终端输入区域不随光标动画跳动。
* [ ] 普通命令输入、回车、粘贴仍可写入 PTY。
* [ ] 中文/IME composition 期间不新增滚动错位。
* [ ] 终端搜索浮层仍可打开、输入、关闭并恢复终端焦点。
* [ ] `npx tsc --noEmit` 通过，或明确说明失败原因。
* [ ] 运行态 UI 由用户人工验证 compact 场景。

## Definition of Done (team quality bar)

* 静态检查通过或失败原因明确。
* 改动范围与 PRD 一致。
* 如 GitNexus 影响分析提示 HIGH/CRITICAL，实施前明确告知用户。
* 不引入新依赖，不修改无关 UI。

## Out of Scope (explicit)

* 不重写终端渲染架构。
* 不修改 Claude Code 输出内容或 compact 行为。
* 不新增终端外部输入框。
* 不启动 Tauri/桌面应用做 AI 视觉验收。

## Technical Notes

* 候选文件：`src/components/XTermTerminal.tsx`、`src/App.css`；`src/components/TerminalTabs.tsx` 目前看更像容器布局，不是直接根因。
* 相关代码：`XTermTerminal` 中 `compositionstart/update/end` 会捕获并恢复 `containerRef` 与 `.xterm-viewport` 滚动位置。
* 风险点：xterm helper textarea 对键盘输入、焦点、IME 非常敏感；不能简单 `display:none`、`pointer-events:none` 或移除 textarea。
* 验证限制：根据项目记忆，运行态终端视觉需要用户人工验证。
