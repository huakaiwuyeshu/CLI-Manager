# terminal-file-tree-drag-insert-path

## Goal

实现从左侧文件树拖拽文件或目录到终端时，把对应路径插入当前终端输入位置，减少手动复制路径。

## What I already know

* 用户需求：左侧文件树拖到终端时，插入路径。
* 项目是 React + Tauri 桌面应用，终端组件基于 xterm.js。
* 当前工作区已有相关未提交改动/草稿：
  * `src/components/files/FileExplorerSidebar.tsx`：文件树行已存在 `draggable`、`onDragStart`、`onDragEnd`，并写入 `dataTransfer`。
  * `src/components/XTermTerminal.tsx`：终端侧已有 dragover/drop 监听并调用 `terminal.paste(text)` 的逻辑。
  * `src/lib/aiPathFormatter.ts`：已有 `formatTerminalDragPath` 和 `TERMINAL_FILE_PATH_MIME`。
  * `src/lib/terminalFileDrag.ts`：已有拖拽期间的内存 payload。
* 需要继续检查这些草稿是否完整、是否符合期望路径格式、是否通过类型检查。

## Assumptions (temporary)

* 拖拽插入只负责插入文本，不自动执行命令。
* 拖拽目标仅限终端区域，拖到其他区域不应插入。
* 文件和目录都支持；目录路径可以带尾部 `/`。
* 不引入新依赖，不改后端 IPC。

## Open Questions

* 暂无。

## Requirements (evolving)

* 文件树中的文件/目录节点可拖拽到终端。
* 搜索结果中的文件/目录节点也可拖拽到终端。
* 放到终端后，将路径文本插入终端当前输入位置。
* 路径格式按当前项目 CLI 工具决定：Claude 插入 `@相对路径`，Codex 插入普通相对路径，其他工具保持项目 AI 路径格式。
* 不自动回车，不执行命令。
* 拖拽完成后清理临时拖拽状态，避免影响后续普通拖放。

## Acceptance Criteria (evolving)

* [ ] 从普通文件树拖拽文件到终端，终端输入区出现对应路径。
* [ ] 从搜索结果拖拽文件到终端，终端输入区出现对应路径。
* [ ] 从文件树拖拽目录到终端，终端输入区出现对应目录路径。
* [ ] 拖到非终端区域不会插入路径。
* [ ] 前端 `npx tsc --noEmit` 通过。

## Definition of Done (team quality bar)

* 前端类型检查通过。
* 不新增依赖。
* 不改无关 UI/样式。
* 如涉及已有未提交草稿，只做最小修正，不覆盖用户其他改动。

## Out of Scope (explicit)

* 不实现多选文件拖拽。
* 不实现拖拽排序或文件移动。
* 不自动转换 WSL/Linux/Windows 路径。
* 不自动执行命令。

## Technical Notes

* 已检查：`src/components/files/FileExplorerSidebar.tsx`、`src/components/XTermTerminal.tsx`、`src/lib/aiPathFormatter.ts`、`src/lib/terminalFileDrag.ts`。
* GitNexus impact：`XTermTerminal` upstream 风险 LOW；`FileExplorerSidebar` / `formatTerminalDragPath` / `terminalFileDrag` 未在当前索引中找到对应符号，可能索引未覆盖这些新/局部符号。
* 现有终端粘贴入口是 `terminal.paste(text)`，比直接 `pty_write` 更贴近“插入到当前输入位置”的语义。
