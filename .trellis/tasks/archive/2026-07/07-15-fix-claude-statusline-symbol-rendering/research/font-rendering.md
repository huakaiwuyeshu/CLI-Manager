# Claude 状态栏 Powerline 字形回归调查

## 结论

问题位于 Rust 字体安装与 WebView 字体解析的边界：Windows 注册表和字体文件均存在，但 Chromium/WebView2 无法通过系统字体族名 `Symbols Nerd Font Mono` 解析该字体，因此预览中的 Powerline 私有区字符显示为方框。

## 证据

- `08e632b` 已让预览保留 Powerline 私有区字符，并使用规范化终端字体栈；当前代码仍保留该修复。
- 内置 `SymbolsNerdFontMono-Regular.ttf` 的字体族名为 `Symbols Nerd Font Mono`，且 cmap 覆盖 `E0B0/E0B2/E0B4/E0B6/E0B8/E0BA/E0BC/E0BE`。
- Windows 用户字体目录和 HKCU 字体注册表均存在该字体，但独立 Chromium 字体测试仍显示方框。
- 同一 Chromium 通过 CSS `@font-face` 直接加载仓库内置 TTF 后，可正确显示全部目标 Powerline 字形。

## 触点清单

- `src/components/settings/pages/StatuslinePreview.tsx`：症状消费者；当前字符保留和字体栈逻辑正确，无需修改。
- `src/lib/terminalFontFamily.ts`：被终端、主题设置、Claude 编辑器和预览共同调用，GitNexus 风险为 HIGH；无需修改。
- `src/styles/components.css`：应在 WebView 资源层声明内置字体，使现有字体族名可直接解析。
- `src/components/settings/pages/StatuslineSettingsPage.tsx`：Powerline 下拉框已使用同一字体族名，将自动受益，无需修改。
- `src-tauri/src/statusline.rs`：系统字体安装仍服务外部终端；与 WebView 内字体加载职责不同，确认无需修改。
- `src-tauri/resources/fonts/SymbolsNerdFontMono-Regular.ttf`：直接复用现有资源，不新增字体文件或依赖。

## 建议

在全局组件样式中增加 `@font-face`，直接引用现有内置 TTF，并保持字体族名为 `Symbols Nerd Font Mono`。这样预览、下拉框和应用内终端继续使用现有字体栈，不触碰高风险共享函数。

## Bug Analysis: WebView Powerline 字体不可见

### 1. Root Cause Category

- **Category**: B - Cross-Layer Contract；同时包含 E - Implicit Assumption。
- **Specific Cause**: 之前默认“系统检测到字体”即可推出“WebView 能按字体族名使用字体”，但 Windows 字体注册、WebView2 字体缓存和前端 CSS 字体解析并不共享这一可靠契约。

### 2. Why Fixes Failed

1. `08e632b` 修正了预览字符替换和字体栈，但只处理了前端消费逻辑，没有保证字体资源对 WebView 可见。
2. 后续内置字体安装解决了下载和系统安装，却仍以注册表检测结果代替 WebView 实际可用性，导致问题在更新后回归。

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|---|---|---|---|
| P0 | Architecture | WebView 通过 `@font-face` 直接加载随包字体，不依赖系统缓存 | DONE |
| P1 | Documentation | 在状态栏前端契约中记录系统安装与 WebView 字体可见性是两个边界 | DONE |
| P1 | Test Coverage | 保留目标 Powerline 码位的 Chromium 字形冒烟检查 | DONE |

### 4. Systematic Expansion

- **Similar Issues**: 状态栏预览、Powerline 下拉框和 xterm 共享同一字体族名，均可能受系统字体缓存影响。
- **Design Improvement**: 应用内渲染使用打包字体，系统安装仅服务应用外终端。
- **Process Improvement**: 字体检测不能只检查文件或注册表，还要区分系统可用与 WebView 可用。

### 5. Knowledge Capture

- [x] 根因与触点记录到当前任务调查文档。
- [x] 补充 `.trellis/spec/frontend/statusline-editor-contracts.md`，记录 WebView 必须直接加载内置字体。
- [x] 仓库不存在 `src/templates/markdown/spec/`，无对应模板可同步。
