# Fix Terminal Paste Newline Auto Send

## Goal

修复内置终端粘贴文本时，剪贴板内容带尾随换行会被 xterm 转换为提交输入的问题。目标是保留粘贴内容中的换行语义，但不因为粘贴自动发送；用户仍需手动按 Enter 才提交。

## What I Already Know

* 用户复现：粘贴 `停车场平面图\n` 时会自动发送。
* 用户明确：允许有尾行/换行，但不允许自动发送。
* 终端输入组件是 `src/components/XTermTerminal.tsx`。
* 当前 `Ctrl+V` 路径读取剪贴板后直接调用 `terminal.paste(text)`。
* `@xterm/xterm` 的 `prepareTextForTerminal` 会把 `\r?\n` 统一转换成 `\r`，而项目中普通 Enter/提交正是 `\r`。
* 项目已有“终端插入换行”快捷键，命中时写入的是 `\n`。
* GitNexus 对 `XTermTerminal` 上游影响分析为 LOW：直接依赖 0，受影响流程 0。

## Requirements

* 粘贴文本时保留换行内容，不删除尾随换行。
* 粘贴中的换行不得被转换为自动提交输入的 `\r`。
* 用户需要手动按 Enter 才提交当前输入。
* 优先只修改前端终端输入处理，不改 Rust PTY 后端。

## Acceptance Criteria

* [x] 粘贴 `停车场平面图\n` 后不会自动提交。
* [x] 粘贴后终端输入内容仍包含换行语义。
* [x] 普通 Enter 仍保持提交行为。
* [x] 已配置的终端换行快捷键仍保持写入 `\n`。
* [x] TypeScript 检查通过。

## Definition of Done

* 修改范围保持在最小必要代码内。
* 运行 `npx tsc --noEmit` 或等价类型检查。
* 如需真实 UI 验证，再启动 Tauri dev 进行手工验证。

## Technical Approach

在 `XTermTerminal` 内新增一个很小的粘贴写入路径：对剪贴板文本做换行规范化，把 `\r\n` 和 `\r` 统一为 `\n`，然后直接通过 `pty_write` 写入 PTY，避免调用 `terminal.paste` 触发 xterm 的 `\n -> \r` 转换。

同时拦截原生 paste 事件，覆盖右键/系统粘贴；`Ctrl+V` 继续使用现有剪贴板读取路径，但改为调用新的粘贴写入函数。

## Decision (ADR-lite)

**Context**: xterm 的 paste API 会把粘贴文本换行转换为 `\r`，这在当前终端/CLI 输入场景下等价于提交。

**Decision**: 不改后端 PTY，也不删除尾随换行；只在前端粘贴入口绕开 xterm 的 paste 换行转换，并保留 `\n`。

**Consequences**: 多行粘贴将更偏向“填入输入框”而不是“逐行执行命令”。这是更安全的默认行为，但会改变直接粘贴多行 shell 命令时自动逐行执行的习惯。

## Out of Scope

* 不新增粘贴确认弹窗。
* 不新增设置项。
* 不调整命令历史模块。
* 不修改 Rust PTY 后端。

## Technical Notes

* `src/components/XTermTerminal.tsx:217` 处理 Enter 与 `Ctrl+V`。
* `src/components/XTermTerminal.tsx:256` 的 `terminal.onData` 当前直接转发到 `pty_write`。
* `node_modules/@xterm/xterm/src/browser/Clipboard.ts:13` 的 `prepareTextForTerminal` 会将换行转换为 `\r`。
* `node_modules/@xterm/xterm/typings/xterm.d.ts:938` 说明用户键入或粘贴都会触发 `onData`。
