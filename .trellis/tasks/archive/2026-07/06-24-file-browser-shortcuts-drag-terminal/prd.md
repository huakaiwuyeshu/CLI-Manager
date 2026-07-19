# 文件浏览器快捷键与拖拽终端路径输入

## Goal

补齐文件浏览器常用键盘操作，并支持从文件树拖拽文件/目录到终端，把适合当前 CLI 的路径文本输入到终端中，减少右键菜单和手动输入路径的成本。

## What I Already Know

- 文件浏览器入口在 `src/components/files/FileExplorerSidebar.tsx`。
- 文件操作状态和后端调用集中在 `src/stores/fileExplorerStore.ts`，已有 `renameEntry`、`setClipboard`、`pasteInto`。
- 终端输入集中在 `src/components/XTermTerminal.tsx`，现有粘贴通过 `terminal.paste(text)`，符合项目 xterm 规范。
- AI 路径格式化集中在 `src/lib/aiPathFormatter.ts`，当前已支持 `@项目名/path` 风格。
- 项目类型来自 `Project.cli_tool`，现有约定是小写后包含 `claude` / `codex` 做推断。
- 工作区已有与文件浏览器、快捷键、AI 路径相关的未提交改动，本任务必须在现有改动上追加，不回滚。

## Requirements

- 文件树聚焦到某个文件/目录行时：
  - `F2` 触发重命名。
  - `Ctrl+C` 复制该文件/目录到文件浏览器内部剪贴板。
  - `Ctrl+X` 标记移动该文件/目录。
  - `Ctrl+V` 粘贴到当前目录；如果当前聚焦的是文件，则粘贴到该文件所在目录；无聚焦项时粘贴到项目根目录。
- 拖拽文件树中的文件/目录到终端时，将路径文本输入到终端，不自动回车。
- 拖拽输入沿用 `terminal.paste(text)`，不直接改写 PTY 数据路径。
- 路径文本按 CLI 类型最小区分：
  - Claude/Claude Code：使用项目根目录下的 `@相对路径` 格式，目录末尾保留 `/`。
  - Codex：使用普通相对路径，不加 `@`。
  - 未识别 CLI：沿用现有 AI 路径格式化结果。
- 不新增后端文件命令，不调整文件系统权限。

## Acceptance Criteria

- [x] 文件树行获得焦点后，`F2` 能打开现有重命名弹窗。
- [x] 文件树行获得焦点后，`Ctrl+C` / `Ctrl+X` 能设置内部文件剪贴板，并复用现有顶部状态提示。
- [x] 文件树目录或文件行获得焦点后，`Ctrl+V` 能调用现有粘贴逻辑；目标已存在时复用现有覆盖确认。
- [x] 将文件/目录拖到终端后，终端输入区出现对应路径文本且不会自动提交。
- [x] Codex 项目拖拽输入不带 `@`；Claude 项目拖拽输入带 `@`。
- [x] `npx tsc --noEmit` 通过。

## Verification

- `npx tsc --noEmit`：通过。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 提示。
- `npm run build`：通过；仅有 Vite 既有大 chunk 警告。
- 追加补强：终端文件拖拽监听从 xterm 容器冒泡改为 `window` 捕获阶段，并用终端矩形过滤目标，避免 xterm 内部节点吞掉文件浏览器拖拽 drop。
- 追加补强后复验：`npx tsc --noEmit`、`git diff --check -- src/components/XTermTerminal.tsx src/components/files/FileExplorerSidebar.tsx src/lib/aiPathFormatter.ts`、`npm run build` 均通过。
- 再次修复：不再依赖 `DataTransfer.types` 传递自定义 MIME；新增应用内拖拽状态通道，文件树 `dragstart` 写入路径、终端 `drop` 读取路径，`dragend/drop` 后清理状态。
- 再次复验：`npx tsc --noEmit`、`git diff --check -- src/components/XTermTerminal.tsx src/components/files/FileExplorerSidebar.tsx src/lib/aiPathFormatter.ts src/lib/terminalFileDrag.ts`、`npm run build` 均通过。
- 本次补强：左侧文件树普通行和搜索结果行都改为 `div role="button"` 承载 `draggable`，避免 `button draggable` 在 Radix `ContextMenuTrigger asChild` 下丢失原生拖拽；同时保留 Enter/Space、F2、Ctrl+C/X/V。
- 本次复验：`npx tsc --noEmit` 通过；`git diff --check -- src/components/XTermTerminal.tsx src/components/files/FileExplorerSidebar.tsx src/lib/aiPathFormatter.ts src/lib/terminalFileDrag.ts` 通过；`npm run build` 通过，仅有既有大 chunk 警告。
- 桌面运行时 UI 未由 AI 启动；需人工按验收项验证拖拽和快捷键。

## Definition of Done

- 静态类型检查通过。
- 不启动 Tauri 桌面应用，由人工按验收项做运行时验证。
- 改动尽量限定在文件浏览器、终端拖拽处理、路径格式化辅助函数。

## Out of Scope

- 多选文件复制/拖拽。
- 系统剪贴板文件复制粘贴。
- 拖拽外部系统文件到终端。
- 新增快捷键设置项；`F2` / `Ctrl+C` / `Ctrl+X` / `Ctrl+V` 作为文件树局部常用键处理。
- 自动回车执行命令。

## Technical Approach

- 在 `FileExplorerSidebar` 的文件行上增加稳定的 `data-*` 元信息和 `draggable`，局部捕获键盘事件并调用现有 store 方法。
- 在 `aiPathFormatter` 增加一个用于终端拖拽的格式化函数，隔离 Claude/Codex 差异，避免在组件里散落判断。
- 在 `XTermTerminal` 增加 `dragover/drop` 监听，读取 `text/plain` 并调用现有 `pasteIntoTerminal`。

## Technical Notes

- 需先对要修改的函数/组件运行 GitNexus impact analysis。
- 相关规范：
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/state-management.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
