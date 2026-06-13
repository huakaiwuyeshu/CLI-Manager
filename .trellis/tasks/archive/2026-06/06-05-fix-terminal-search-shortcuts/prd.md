# 修复终端搜索快捷键行为

## 问题

终端搜索框已可打开并搜索，但在终端外部按 `Ctrl+F` 会触发 Tauri/WebView 默认页面搜索；同时终端搜索框内尚未绑定上下方向键快速跳转匹配项。

## 目标

- 禁用应用内非预期的 Tauri/WebView 默认 `Ctrl+F` 页面搜索。
- 保留现有终端内 `Ctrl+F` 打开 xterm 搜索框行为。
- 保留历史会话打开时 `Ctrl+F` 聚焦历史搜索行为。
- 在终端搜索输入框内支持方向键导航匹配项。

## 需求

- `Ctrl+F` 在普通应用区域不触发 WebView 默认查找 UI。
- `Ctrl+F` 在历史会话面板打开时继续聚焦历史搜索。
- `Ctrl+F` 在 xterm 终端中继续打开终端搜索框。
- 终端搜索框内 `ArrowDown` 跳转下一个匹配。
- 终端搜索框内 `ArrowUp` 跳转上一个匹配。
- 保持使用 `@xterm/addon-search`，不新增手动缓冲扫描逻辑。

## 验收标准

- [x] 在终端外部按 `Ctrl+F` 不出现 Tauri/WebView 默认搜索框。
- [x] 在终端内按 `Ctrl+F` 仍打开终端搜索框。
- [x] 终端搜索框输入已有文本后，`ArrowDown` 能跳转下一个匹配。
- [x] 终端搜索框输入已有文本后，`ArrowUp` 能跳转上一个匹配。
- [x] TypeScript 与构建检查通过。

## Out of Scope

- 不修改终端搜索 UI 结构和视觉风格。
- 不修改 PTY、终端输出缓冲、历史搜索实现。
- 不替换 `@xterm/addon-search`。

## Technical Notes

- 预计涉及 `src/hooks/useKeyboardShortcuts.ts` 的全局快捷键拦截。
- 预计涉及 `src/components/XTermTerminal.tsx` 的搜索输入键盘事件。
