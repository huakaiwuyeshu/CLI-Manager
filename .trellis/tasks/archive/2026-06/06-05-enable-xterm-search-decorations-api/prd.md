# 启用 xterm 搜索装饰 API

## 问题

终端搜索框能打开，但执行搜索时无法正确搜索。诊断发现 `@xterm/addon-search` 在传入 `decorations` 时会调用 xterm 的 decoration API，当前 `Terminal` 未启用 proposed API，运行时抛出 `You must set the allowProposedApi option to true to use proposed API`。

## 目标

- 保持使用 `@xterm/addon-search`。
- 保留搜索高亮与结果计数能力。
- 通过最小修改让 decorations 搜索路径可运行。
- 不修改 PTY、全局快捷键、搜索 UI 结构或终端输出缓冲逻辑。

## 验收标准

- `Ctrl+F` 打开搜索框后，输入已有终端文本能命中。
- 搜索不再触发 proposed API 运行时异常。
- TypeScript 与构建检查通过。
