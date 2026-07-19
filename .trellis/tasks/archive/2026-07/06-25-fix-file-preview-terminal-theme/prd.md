# 修复文件预览终端主题割裂

## Goal

文件浏览器打开文件后的编辑/预览区域，应跟随当前终端主题观感，而不是只跟随应用系统浅/深色主题。避免“系统浅色 + 终端深色”时，文件信息区和编辑器大面积变成浅色造成割裂。

## What I Already Know

- 用户截图显示应用设置为系统浅色时，终端主题是深色，但文件编辑器顶部、Tab、编辑区域仍呈浅色。
- `TerminalTabs` 已在 `.ui-terminal-well` 上提供 `--terminal-theme-background`、`--terminal-theme-foreground`、`--terminal-theme-muted`、`--terminal-theme-accent`、`--terminal-theme-selection`。
- `FileEditorPane` 位于 `.ui-terminal-well` 内，但当前样式使用应用 token，例如 `--surface`、`--on-surface`。
- `FileEditorPane` 当前按 `resolvedTheme` 选择 Monaco `vs` / `vs-dark`，没有考虑独立终端主题。

## Requirements

- 文件编辑器 Pane 背景、顶部栏、文件 Tab、空状态/不可预览/图片预览容器跟随当前终端主题变量。
- Monaco 编辑器主题至少按终端主题明暗选择，避免终端深色时编辑器仍是浅色。
- 不新增依赖，不改设置存储结构，不改变文件读写行为。

## Acceptance Criteria

- [ ] 当应用主题为系统/浅色、终端主题为深色时，文件编辑器不再出现大面积浅色背景。
- [ ] 当终端主题为浅色时，文件编辑器仍保持浅色可读。
- [ ] 文件编辑器关闭、保存、AI 路径/上下文按钮功能不变。
- [ ] `npx tsc --noEmit` 通过。

## Definition of Done

- 代码改动限定在文件编辑器主题渲染相关位置。
- 静态类型检查通过。
- 按项目规范列出需要人工在 Tauri 桌面端验证的视觉项。

## Out of Scope

- 不做整套 Monaco 自定义配色系统。
- 不调整文件树左侧栏主题。
- 不改终端主题设置 UI。
- 不启动 Tauri 桌面应用做运行时截图验证。

## Technical Notes

- 已读：`.trellis/spec/frontend/component-guidelines.md`
- 已读：`.trellis/spec/frontend/state-management.md`
- 已读：`.trellis/spec/frontend/quality-guidelines.md`
- 相关文件：`src/components/files/FileEditorPane.tsx`
- 相关文件：`src/components/TerminalTabs.tsx`
- 相关文件：`src/styles/components.css`
