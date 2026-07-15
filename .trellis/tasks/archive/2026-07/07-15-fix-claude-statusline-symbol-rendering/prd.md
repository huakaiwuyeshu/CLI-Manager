# 修复 Claude 状态栏 Powerline 符号显示

## Goal

恢复 Claude Code 状态栏实时预览中的 Powerline 分隔符和端帽，不再显示为方框，并保持实际 Unicode 字形与终端一致。

## Requirements

- 直接复用已内置的 `SymbolsNerdFontMono-Regular.ttf`，不新增依赖或字体文件。
- 在 WebView 资源层加载内置字体，不依赖 Windows 字体缓存是否及时识别用户字体。
- 不修改状态栏配置格式、Rust 渲染结果或共享终端字体规范化逻辑。
- Powerline 下拉框和应用内终端继续使用现有字体族名并自动获得内置字体。
- Changelog Target: `[TEMP]`。

## Acceptance Criteria

- [ ] Claude 实时预览正确显示 `E0B0/E0B2/E0B4/E0B6/E0B8/E0BA/E0BC/E0BE`，不出现方框。
- [ ] Powerline 下拉框已选值和选项继续显示真实符号。
- [ ] 未安装系统 Powerline 字体时，WebView 内仍可加载内置字体。
- [ ] 不改变普通中英文、数字和状态栏颜色渲染。
- [x] TypeScript 检查通过。

## Root Cause

问题位于 Rust 字体安装与 WebView 字体解析的边界：系统层已检测到字体文件和注册表记录，但 WebView2 无法按系统字体族名解析它；修复应落在 WebView 字体资源加载层，而不是继续修改预览文本或共享字体栈。

## Technical Approach

在 `src/styles/components.css` 中通过 `@font-face` 直接引用现有内置 TTF，并沿用 `Symbols Nerd Font Mono` 字体族名，使现有预览、Powerline 下拉框和终端字体栈无需代码改动即可使用该资源。

## Out of Scope

- 修改 Powerline 字符或替换为普通三角符号。
- 修改系统字体安装命令或状态栏配置格式。
- 重构 `normalizeTerminalFontFamily`。

## Technical Notes

- 调查记录：`research/font-rendering.md`。
- `StatuslinePreview` GitNexus 影响风险为 LOW。
- `normalizeTerminalFontFamily` GitNexus 影响风险为 HIGH，因此本次明确不修改。
