# 终端右键添加清屏功能按钮

## Goal

在终端右键菜单中添加一个清屏功能入口，让用户可以从当前终端的上下文菜单直接清空可见终端内容。

## What I already know

* 用户明确要求：“终端右键添加一个清屏的功能按钮”。
* 项目是 Tauri + React + xterm.js 的 Windows 桌面应用。
* 这是前端终端交互功能，预计主要影响终端组件和国际化文案。
* 终端右键菜单实现位于 `src/components/XTermTerminal.tsx`，当前菜单文案有硬编码中文。
* 终端 Tab 右键菜单已有 i18n 示例，使用 `useI18n()` 和 `src/lib/i18n.ts` 中的 `terminal.*` key。
* 本地 `@xterm/xterm` 类型定义确认 `Terminal.clear(): void` 可用，但人工复测发现它会让输入法/helper textarea 继续锚在清屏前的位置。
* GitNexus impact：`XTermTerminal`、`zh`、`en` 上游影响范围均为 LOW。
* 本项目已有复杂 IME/helper textarea 定位补丁；右键清屏应走正常终端输入路径，避免绕过 PTY/shell 后造成 xterm 光标、helper textarea 与输入法候选框不同步。

## Assumptions (temporary)

* “清屏”改为向当前 PTY 发送 Ctrl+L（`\x0c`），让 shell/TUI 自己执行清屏/重绘。
* 功能应只作用于当前右键所在的终端会话。
* 需要兼容 `zh-CN` 与 `en-US` 文案。

## Open Questions

* 已决策：不使用 `terminal.clear()`，改用 Ctrl+L，以保持输入法候选框位置正确。

## Requirements (evolving)

* 在终端右键菜单中增加“清屏”操作。
* 点击后向当前终端发送 Ctrl+L，清空或重绘当前终端显示内容。
* 新增用户可见文案走现有 i18n 机制。
* 顺手将本次触达的终端右键菜单文案接入现有 i18n，避免继续扩散硬编码中文。

## Acceptance Criteria (evolving)

* [ ] 右键终端时可以看到清屏操作。
* [ ] 点击清屏后当前终端内容被清空，不影响其他终端会话。
* [ ] `zh-CN` 与 `en-US` 均有对应文案。
* [ ] 前端类型检查通过。

## Definition of Done

* Tests added/updated where appropriate.
* Typecheck passes.
* Behavior change is documented in this PRD.
* Rollback is straightforward because change is scoped to terminal UI.

## Out of Scope

* 不改终端 PTY 后端协议。
* 不新增全局快捷键。
* 不批量清空所有终端。

## Technical Notes

* `src/components/XTermTerminal.tsx`：新增 `useI18n`，新增 `handleMenuClear`，在右键菜单“复制全部输出”附近插入清屏按钮。清屏动作通过 `pty_write` 发送 `\x0c`，避免 `terminal.clear()` 绕过输入路径导致输入法候选框停留在清屏前位置。
* `src/lib/i18n.ts`：新增 `terminal.contextMenu.*` 翻译 key，覆盖现有终端右键菜单文本和新增清屏文本。
* 验证：`npx tsc --noEmit`；运行时 UI 由人工在 Tauri 桌面应用中右键终端验证。
