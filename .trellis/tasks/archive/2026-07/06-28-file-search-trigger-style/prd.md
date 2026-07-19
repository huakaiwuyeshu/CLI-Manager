# 调整文件搜索触发与选中样式

## Goal

文件侧栏默认不展示搜索输入框和“文件 / 代码”模式切换，减少头部占用；触发搜索后再显示搜索控件，并替换当前聚焦时偏绿色的边框视觉。

## Requirements

- 文件搜索输入框默认隐藏。
- “文件 / 代码”搜索模式切换默认隐藏，随搜索输入框一起显示。
- 头部保留搜索图标按钮，点击后显示搜索控件。
- 文件侧栏区域内按 `Ctrl/Cmd+F` 时显示搜索控件并聚焦输入框。
- 搜索控件显示后，原搜索按钮切换为隐藏搜索按钮；不新增额外隐藏按钮。
- 搜索控件显示后，输入框自动获得焦点。
- 聚焦态不要使用明显绿色边框，改成更克制的中性背景/阴影或主题弱化样式。
- 搜索已有内容时不得因为隐藏控件导致结果丢失或搜索状态异常。

## Acceptance Criteria

- [ ] 打开文件侧栏时，头部只保留项目标题、刷新、关闭和搜索触发入口。
- [ ] 点击搜索图标或在文件侧栏内按 `Ctrl/Cmd+F` 后显示输入框和“文件 / 代码”切换，搜索按钮变为隐藏搜索按钮。
- [ ] 输入框聚焦态没有截图中的绿色描边。
- [ ] 输入文件名搜索仍显示文件结果。
- [ ] 切换到代码搜索仍显示代码片段结果。
- [ ] `npx tsc --noEmit` 通过。

## Definition of Done

- 只做文件侧栏相关的最小 UI 改动。
- 不新增依赖，不改后端接口，不改搜索 store 数据结构。
- 新增或变更用户可见文案必须复用或补齐 `zh-CN` / `en-US` i18n。

## Technical Approach

在 `FileExplorerSidebar` 内增加本地 UI 显隐状态和输入框 ref；触发搜索时显示控件并聚焦输入框。搜索逻辑继续复用 `fileExplorerStore` 的 `searchQuery` / `searchMode` / `setSearchQuery` / `setSearchMode`。

## Out of Scope

- 不改搜索算法。
- 不改全局历史搜索或全局代码搜索。
- 不新增可配置快捷键项。
- 不改 Tauri / Rust 后端。

## Technical Notes

- 已检查 `src/components/files/FileExplorerSidebar.tsx`：搜索输入与模式切换目前固定显示在头部。
- 已检查 `src/stores/fileExplorerStore.ts`：搜索模式和查询由 Zustand store 管理，本任务不需要改 store。
- 已检查 `src/hooks/useKeyboardShortcuts.ts`：全局 `Ctrl+F` 已被历史/全局搜索占用，文件侧栏触发需要避免无边界抢占。
- 已检查 `.trellis/spec/frontend/component-guidelines.md`、`.trellis/spec/frontend/state-management.md`、`.trellis/spec/frontend/quality-guidelines.md`。
- GitNexus impact: `FileExplorerSidebar` upstream risk LOW，direct callers 0，affected processes 0。

## Decision

- “通过按键触发显示”按最小可用方案落为：头部搜索图标按钮 + 文件侧栏内 `Ctrl/Cmd+F` 快捷键。全局搜索快捷键不改。
