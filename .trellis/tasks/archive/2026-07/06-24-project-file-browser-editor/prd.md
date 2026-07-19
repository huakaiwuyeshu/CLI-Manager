# 项目文件浏览器与编辑器

## Goal

在项目右键菜单中增加「浏览文件」入口，打开该项目根目录的文件浏览视图。侧栏从项目树切换为文件列表，主区域在现有终端旁边打开文件编辑器分屏，提供基于 Monaco 的代码编辑、Markdown 预览和图片预览，整体样式跟随当前应用主题。

## What I already know

- 用户要求：文件浏览器项目文件树，支持搜索、创建、重命名、删除、复制、移动。
- 用户要求：代码编辑器基于 Monaco，支持 60+ 种语言、Markdown 预览、图片预览。
- 用户要求：入口在项目右键菜单中；进入后项目树切换成文件列表。
- 用户已确认：主区域采用终端与编辑器并排分屏，而不是替换终端或弹窗。
- 用户已确认：编辑器接入现有终端 Pane 树，而不是独立右侧 App 分屏。
- 用户已确认：每个项目只保留一个文件编辑器 Pane；重复从同一项目进入文件浏览时激活已有 Pane。
- 用户已确认：当前文件有未保存内容时，切换文件或关闭编辑器 Pane 弹窗提供「保存 / 丢弃 / 取消」。
- 当前项目是 Tauri 2 + React 19 + TypeScript + Vite 7。
- 当前依赖已有 `react-markdown` 和统一组件 `src/components/ui/MarkdownContent.tsx`，没有 Monaco 依赖。
- `src/components/sidebar/index.tsx` 已有项目右键菜单和「打开所在目录」入口，适合追加「浏览文件」入口。
- `src/components/sidebar/ProjectTree.tsx` 当前负责项目树渲染；文件列表可作为侧栏内容模式切换，避免改项目树数据模型。
- `src/components/git/GitTreeNode.tsx` 已有文件/目录树渲染经验和文件图标依赖 `@baybreezy/file-extension-icon`，可复用视觉思路。
- `src-tauri/src/commands/fs.rs` 当前只有 `check_paths_exist`，新文件浏览/读写/移动/删除需要新增 Rust 命令。
- `src-tauri/capabilities/default.json` 当前启用 `fs:default`，但项目规范要求用户文件路径优先通过 Rust command 做边界校验。
- `src-tauri/tauri.conf.json` 的 asset protocol 目前只允许 `$APPLOCALDATA/backgrounds/**`，直接用 `convertFileSrc` 预览项目图片会扩大本地文件暴露面，不推荐作为 MVP 默认方案。

## Research References

- [`research/monaco-react-vite.md`](research/monaco-react-vite.md) — 推荐使用 `@monaco-editor/react` + `monaco-editor`，Vite worker 显式配置，Markdown 预览复用现有组件。

## Assumptions

- 文件操作只允许在选中项目根目录内进行，所有相对路径由后端校验，禁止 `..`、绝对路径逃逸和符号链接逃逸。
- MVP 只处理普通目录和普通文件；隐藏文件可以显示，系统/权限错误以行内错误或 toast 呈现。
- Markdown 文件打开后显示编辑/预览切换；图片文件只预览，不进入 Monaco。
- 大文件需要限制读取，超过阈值时提示不打开，避免卡死 UI。

## Requirements

- 项目右键菜单增加「浏览文件」。
- 点击后侧栏内容从项目树切换为该项目的文件树，顶部显示返回项目树入口、当前项目名、搜索框和常用操作。
- 文件树支持：
  - 搜索文件/目录名。
  - 创建文件、创建文件夹。
  - 重命名文件/文件夹。
  - 删除文件/文件夹，删除前确认。
  - 复制、移动文件/文件夹；目标路径已存在时弹窗确认后允许覆盖。
  - 刷新当前目录。
- 主区域支持：
  - 文本/代码文件使用 Monaco 打开和编辑。
  - 根据扩展名设置 Monaco language；未知类型回退 `plaintext`。
  - 编辑后显示 dirty 状态，只有点击保存或按 `Ctrl+S` 才写入磁盘。
  - 每个项目一个编辑器 Pane，Pane 内第一版一次只打开一个文件。
  - 未保存内容在切换文件或关闭编辑器 Pane 时必须弹窗确认：保存、丢弃或取消当前动作。
  - Markdown 文件可切换源码/预览，预览复用 `MarkdownContent`。
  - 图片文件支持预览常见格式。
- UI 必须使用现有主题变量和现有图标/菜单风格，不引入单独的视觉体系。
- 后端文件命令必须把项目根目录作为边界，拒绝越界路径和危险路径。

## Acceptance Criteria

- [ ] 在项目右键菜单点击「浏览文件」后，侧栏显示该项目文件列表，主区域保持应用主题风格。
- [ ] 同一项目重复点击「浏览文件」不会创建重复编辑器 Pane，而是激活已有 Pane。
- [ ] 文件搜索能按名称过滤并保留目录上下文。
- [ ] 可在项目根目录内创建、重命名、删除、复制、移动文件或目录。
- [ ] 删除操作有二次确认，失败时不更新为成功状态。
- [ ] 复制/移动遇到目标已存在时必须二次确认，用户取消则不写入磁盘。
- [ ] 文本文件打开后 Monaco 能按扩展名高亮，编辑后可保存。
- [ ] 有未保存内容时切换文件或关闭编辑器 Pane，会出现保存/丢弃/取消确认。
- [ ] Markdown 文件可以预览，且不新增第二套 Markdown 解析器。
- [ ] 图片文件能预览，非文本/未知大文件给出清晰提示。
- [ ] 后端测试覆盖路径越界、相对路径校验、根目录边界和基础文件操作。
- [ ] `npx tsc --noEmit` 通过。
- [ ] `cd src-tauri && cargo check` 通过。

## Definition of Done

- Tests added/updated where practical.
- Typecheck and Rust compile check pass.
- Destructive operations are guarded by confirmation and backend validation.
- Manual desktop verification items listed because项目规范禁止 AI 自动启动 Tauri 桌面应用做 UI 验证。

## Technical Approach

推荐采用「项目根目录受控文件 API + 前端文件视图状态」：

- Backend：新增文件浏览 commands，所有命令接收 `rootPath` + 相对路径，后端 canonicalize 后验证结果仍在 root 内。
- Frontend：新增文件浏览 store/hook 管理当前项目、文件树、选中项、打开文件、dirty 状态和剪贴板操作。
- Sidebar：在已有项目右键菜单增加入口；`ProjectTree` 容器层按模式渲染项目树或文件树。
- Pane：扩展现有终端 Pane 模型，让 Pane 叶子可以承载终端会话或文件编辑器面板；保持终端 tab 移动、分屏、关闭的现有行为不变。
- Editor：新增文件工作区组件，文本走 Monaco，Markdown 预览走 `MarkdownContent`，图片通过后端读取 bytes/base64 或安全 blob URL 方案预览，避免扩大 asset scope。
- Dependencies：需要新增 `@monaco-editor/react` 和 `monaco-editor`。

## Decision (ADR-lite)

**Context**: 需求需要桌面端项目文件操作和代码编辑，且涉及用户文件系统安全边界。

**Decision**: 使用 Rust Tauri commands 作为所有文件 I/O 边界；Monaco 使用 React wrapper；Markdown 复用现有 `MarkdownContent`；MVP 不扩大 `assetProtocol.scope` 到项目目录。文件编辑第一版采用显式保存，避免自动写盘造成误改。复制/移动冲突采用弹窗确认覆盖。编辑器接入现有终端 Pane 树，以非 PTY 面板参与上下左右分屏。编辑器生命周期按项目去重：每个项目一个编辑器 Pane。未保存内容阻断切换/关闭，并由用户选择保存、丢弃或取消。

**Consequences**: 实现比直接用前端 fs 插件稍多，但安全边界更清晰；图片预览需要后端读文件返回安全数据；Monaco 会引入新依赖和 worker 配置。接入 Pane 树会触碰 `terminalPaneTree`、`terminalStore`、`TerminalTabs` 和持久化过滤逻辑，必须做影响分析并保持 PTY 会话不被编辑器面板误关闭。

## Out of Scope

- 多标签编辑器。
- Git 状态叠加、diff、提交操作。
- LSP/类型服务、代码格式化、终端内联。
- 二进制文件编辑。
- 跨项目全局文件搜索。
- 拖拽上传外部文件到项目。

## Open Questions

- 暂无。

## Expansion Sweep

- Future evolution: 后续可能扩展多标签、最近打开文件、Git 状态、全局搜索、终端联动。
- Related scenarios: 文件树的复制/移动交互应和项目树右键菜单、Git 文件树风格保持一致。
- Failure/edge cases: 权限失败、文件被外部修改、大文件、编码失败、删除目录、复制覆盖冲突、符号链接越界都需要明确处理。
