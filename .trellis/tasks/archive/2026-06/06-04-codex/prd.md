# 修复 Codex 换行快捷键回归

## Goal

恢复 Codex 会话窗口的多行换行行为：当前用户反馈 Codex 中 Alt+Enter 和 Shift+Enter 都无法换行，而 Claude Code 正常。需要先确认 Codex 需要的输入序列，再做最小修复。

## What I already know

* 用户反馈：Codex 中 Alt+Enter 和 Shift+Enter 都无法换行。
* 用户反馈：Claude Code 换行正常。
* 上一次改动在 `src/components/XTermTerminal.tsx` 中统一拦截 Shift/Ctrl/Alt+Enter，并在设置命中时写入 `\n`。
* 这说明设置读取和拦截本身大概率生效；问题更可能是 Codex 对 `\n` 不按预期处理，或需要保留 Codex 原生 Alt+Enter 序列。

## Assumptions (temporary)

* Claude Code 接受 `\n` 作为“插入换行”。
* Codex 可能不接受裸 `\n`，需要 xterm/终端原生组合键序列，尤其是 Alt+Enter。
* 修复应优先恢复 Codex 可用性，而不是继续强行统一屏蔽所有组合键。

## Requirements

* 先确认 `XTermTerminal` 当前拦截逻辑与 Codex 回归之间的因果关系。
* Codex 至少应有一个可用换行键；用户当前设置为 Shift+Enter 时，优先让 Shift+Enter 可用。
* Claude Code 现有换行行为不能回退。
* 修复尽量局部，不新增依赖，不重做快捷键系统。

## Acceptance Criteria

* [x] 找到 Codex 中 Shift/Alt+Enter 失效的真实原因。
* [x] 设置为 Shift+Enter 时，Codex 可通过 Shift+Enter 换行。
* [x] Claude Code 的 Shift+Enter 换行仍正常。
* [x] Alt+Enter 行为有明确策略：只有设置选中的组合键触发换行；Codex 使用 ESC+CR，Claude Code 保持 \n。
* [x] 完成 TypeScript 静态检查或说明无法手动验证的原因。

## Definition of Done

* Typecheck green where practical
* No unrelated refactor
* Behavior risk explained
* Manual verification path documented if app is not launched

## Technical Approach

在 `XTermTerminal` 的 Enter 组合键拦截处继续以 `terminalNewlineShortcut` 为唯一开关：未选中的 Shift/Ctrl/Alt+Enter 不透传；选中的组合键写入 PTY。Codex 会话写入 xterm 原生 Alt+Enter 等价序列 `ESC + CR` (`\x1b\r`)，其他会话继续写入 `\n`。

## Decision (ADR-lite)

**Context**: Codex 不接受裸 `\n` 作为多行输入，但 xterm 原生 Alt+Enter 会发送 `ESC + CR`；上一轮拦截吞掉了这个原生序列。
**Decision**: 按会话识别 Codex，仅改变换行写入序列，不新增设置项，不改后端 PTY。
**Consequences**: Shift+Enter 在 Codex 中通过发送 Codex 可识别的序列工作；Claude Code 路径保持原行为。未选中的组合键仍会被吞掉，确保设置生效。

## Verification

* `npx tsc --noEmit` passed.
* `git diff --check -- src/components/XTermTerminal.tsx` passed.
* 未自动启动 Tauri dev 服务做 UI 手动验证；该项目规则要求后台/开发服务启动需用户明确允许。

## Out of Scope

* 不新增快捷键配置项。
* 不修改 Codex CLI 或 Claude Code CLI 本身。
* 不启动后台服务/开发服务，除非用户明确允许。

## Technical Notes

* 已检查 `src/components/XTermTerminal.tsx`：当前逻辑拦截 Shift/Ctrl/Alt+Enter；设置命中时向 PTY 写入 `\n`，未命中时吞掉事件。
* 已检查 `src-tauri/src/commands/terminal.rs` 与 `src-tauri/src/pty/manager.rs`：`pty_write` 原样写入字符串字节，不做换行或按键序列转换。
* 已检查 `node_modules/@xterm/xterm/src/common/input/Keyboard.ts`：xterm 原生 Enter 为 `CR`，Alt+Enter 为 `ESC + CR`。
* 根因：Claude Code 接受 `\n` 作为插入换行；Codex 的 Alt+Enter 语义依赖 xterm 原生 `ESC + CR`。上次改动吞掉了原生 Alt+Enter，又把 Shift+Enter 发成 Codex 不识别的 `\n`，所以 Codex 两个键都不能换行。
