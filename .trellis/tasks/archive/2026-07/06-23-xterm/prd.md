# 添加 xterm 普通链接识别

## 目标

优化内置 xterm 终端的链接识别、Unicode 宽字符表现、缓冲区复制能力和受限图片协议支持，主要服务 Claude Code / Codex 长会话使用场景。

## 范围

- 新增 @xterm/addon-web-links 依赖。
- 新增 @xterm/addon-unicode11、@xterm/addon-serialize、@xterm/addon-image 依赖。
- 在 XTermTerminal 初始化时加载 WebLinksAddon。
- 在 XTermTerminal 初始化时加载 Unicode11Addon、SerializeAddon、ImageAddon。
- 仅允许 http/https 链接通过系统默认浏览器打开。
- 启用 Unicode 11 宽度规则，改善中文、Emoji、TUI 符号对齐。
- 右键菜单新增复制全部输出，复制当前终端缓冲区纯文本。
- 图片协议支持采用保守资源限制，避免长会话内存失控。

## 不做

- 不改 PTY 后端。
- 不改终端布局、主题、搜索、WebGL 行为。
- 不引入新的链接协议。
- 不新增图片导出、图片保存、历史会话图片持久化。

## 验收

- TypeScript 类型检查通过。
- 项目构建通过。
- 人工检查普通 URL 点击能打开浏览器，OSC 8 链接行为不回退到 WebView 导航。
- 人工检查 Claude Code / Codex TUI 中文、Emoji、边框字符显示未明显错位。
- 人工检查右键复制全部输出得到纯文本，不包含明显 ANSI 转义字符。
