# 内置 Powerline 符号字体

## Goal

将 Powerline 符号字体随 CLI-Manager 打包，安装时直接使用本地内置资源，取消 GitHub 字体仓库克隆，缩短安装时间并支持离线安装。

## Requirements

- 内置 Nerd Fonts `SymbolsNerdFontMono-Regular.ttf`，覆盖当前状态栏使用的全部 Powerline 分隔符与端帽。
- 保留字体原始许可证文件。
- Windows、Linux、macOS 继续安装到当前用户字体目录，并沿用各平台注册或缓存刷新逻辑。
- 不新增依赖，不修改状态栏配置格式和 Tauri command 签名。
- Changelog Target: `[TEMP]`。

## Acceptance Criteria

- [ ] 安装流程不执行 Git、HTTP 或其他网络请求。
- [ ] 中英文安装提示明确说明使用内置字体且无需联网。
- [ ] 安装成功提示明确要求重启 CLI-Manager，使系统与 WebView 字体缓存完全刷新。
- [ ] Powerline 分隔符、起止端帽的下拉选项和已选值均使用兼容符号字体显示。
- [ ] Windows 注册并即时激活内置字体。
- [ ] Linux 安装后刷新 fontconfig 缓存。
- [ ] macOS 安装到 `~/Library/Fonts`。
- [ ] 内置字体覆盖 `E0B0/E0B2/E0B4/E0B6/E0B8/E0BA/E0BC/E0BE`。
- [ ] TypeScript 检查、Rust 编译检查和状态栏测试通过。

## Notes

- 采用 Nerd Fonts v3.4.0 的完整符号字体，约 2.5 MB，避免维护自定义裁剪字体。
- 字体通过 Rust `include_bytes!` 编译进应用，不修改 Tauri resources 配置。
