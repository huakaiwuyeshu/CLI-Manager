# 终端支持文件拖拽显示路径

## Goal

让用户可以把系统文件或文件夹拖入终端区域，终端当前输入位置插入对应本地路径，减少手动复制路径的成本。

## What I already know

* 用户希望“终端支持 文件拖拽进来显示路径”。
* 终端核心组件是 `src/components/XTermTerminal.tsx`。
* 终端已有统一输入通道：`terminal.paste(...)` -> `terminal.onData(...)` -> `pty_write`。
* 项目使用 Tauri 2，`@tauri-apps/api/webview` 提供 `getCurrentWebview().onDragDropEvent(...)`，drop 事件 payload 包含 `paths: string[]`。
* Tauri 配置没有禁用 WebView 文件拖放；不需要新增后端命令或文件系统权限。

## Decisions

* 只处理系统文件/文件夹拖入，不处理应用内部 tab/pane 拖拽。
* 拖入后只插入路径文本，不自动回车，不读取文件内容。
* 路径插入格式采用 shell 安全引用，避免路径含空格时命令解析失败。
* 多个路径一次拖入时按空格分隔，每个路径独立 shell 安全引用。

## Requirements

* 文件或文件夹拖到终端显示区域并释放时，将路径插入该终端当前输入位置。
* 插入文本使用 shell 安全引用路径，例如 `'D:\My Project\a.txt'`。
* 复用 xterm 的 paste 路径，保持现有粘贴、换行、命令历史行为一致。
* drop 后聚焦目标终端，并标记 attention 输入已处理。
* 不影响已有终端 tab/pane 拖拽分屏行为。

## Acceptance Criteria

* [ ] 从 Windows 资源管理器拖入单个文件，终端输入行出现该文件路径。
* [ ] 从 Windows 资源管理器拖入文件夹，终端输入行出现该文件夹路径。
* [ ] 一次拖入多个文件，终端输入行出现多个路径。
* [ ] 拖入路径不会自动执行命令。
* [ ] `npx tsc --noEmit` 通过。

## Definition of Done

* 最小代码改动。
* 无新增依赖。
* 无 Tauri 后端权限或配置变更。
* 静态检查通过；桌面运行交互由人工验证。

## Out of Scope

* 路径自动补全、文件内容读取、上传、打开文件。
* 拖入后自动执行命令。
* 支持从应用内部文件树拖拽到终端。
* 新增可配置项。

## Technical Approach

在 `XTermTerminal` 中监听当前 WebView 的 Tauri 文件拖放事件。drop 事件发生时，根据 drop 坐标判断是否落在当前终端容器内；若是，将 paths 格式化为文本并通过 `terminal.paste(text)` 插入。

## Technical Notes

* `src/components/XTermTerminal.tsx` 已有 `pasteIntoTerminal` helper，应复用或扩展。
* `node_modules/@tauri-apps/api/webview.d.ts` 中 `DragDropEvent` 的 drop payload 为 `{ type: "drop"; paths: string[]; position: PhysicalPosition }`。
* 前端规范要求终端相关 UI 改动运行 `npx tsc --noEmit`，运行时 UI 不由 AI 自动启动 Tauri 验证。
