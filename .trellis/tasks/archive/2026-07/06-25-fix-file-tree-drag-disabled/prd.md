# fix file tree drag disabled

## Goal

修复 Windows/Tauri 下项目文件树内部 HTML5 拖拽全程显示禁用图标的问题，让文件树条目可以拖到终端并插入对应路径。

## Requirements

- 在 Tauri 主窗口配置中禁用原生 WebView 文件拖放拦截，使前端 HTML5 drag/drop 事件可用。
- 保持前端现有文件树拖拽逻辑不变：`FileExplorerSidebar` 继续通过 `dataTransfer` 和 `terminalFileDrag` 向终端传递路径文本。
- 不新增依赖、不新增 Tauri command、不扩大 capabilities/fs scope。

## Acceptance Criteria

- [ ] `src-tauri/tauri.conf.json` 的 main window 设置 `dragDropEnabled: false`。
- [ ] `npx tsc --noEmit` 通过。
- [ ] 人工验证：在 Tauri 桌面应用中，从“浏览文件”文件树拖拽文件/目录到真实终端内容区，不再全程显示禁用图标，并能插入路径文本。

## Definition of Done

- 配置改动最小化。
- 静态校验通过。
- 明确记录需要人工验收的桌面 UI 行为。

## Technical Approach

Tauri v2 文档说明：Windows 上如果要使用前端 HTML5 drag/drop，需要禁用 WebView 默认原生 drag/drop。当前项目未设置该选项，且终端内部已经实现 HTML5 `dragover/drop` 接收逻辑。因此本任务只在主窗口配置中添加 `dragDropEnabled: false`。

## Decision (ADR-lite)

**Context**: 文件树条目已有 `draggable` 和 `dataTransfer` 设置；终端已有 HTML5 drop 处理。但 Windows 下 Tauri WebView 默认原生 drag/drop 会拦截前端 HTML5 drag/drop。

**Decision**: 在 main window 配置中设置 `dragDropEnabled: false`。

**Consequences**: 内部 HTML5 拖拽恢复；原先依赖 Tauri `onDragDropEvent` 的外部系统文件拖入路径可能受影响，后续如需兼容需另开任务设计替代方案。

## Out of Scope

- 不重写文件树拖拽 UI。
- 不新增 drop 高亮提示。
- 不处理外部系统文件拖入终端的替代实现。
- 不调整终端路径格式化规则。

## Technical Notes

- 相关配置：`src-tauri/tauri.conf.json`。
- 拖拽源：`src/components/files/FileExplorerSidebar.tsx`。
- Drop 目标：`src/components/XTermTerminal.tsx`。
- Tauri v2 文档：`dragDropEnabled` 默认开启；Windows 上使用 HTML5 drag/drop 需要禁用原生 drag/drop。
