# Linux Wayland NVIDIA performance and AUR

## Goal

修复 CLI-Manager 在 Linux Wayland + NVIDIA 环境下的白屏、黑屏、闪烁与低帧率问题，建立可诊断、可分级降级的 WebKitGTK/xterm 渲染策略，并在 V1.2.7 发布后提供 `cli-manager-bin` AUR 安装包。

## Changelog Target

V1.2.7

## Requirements

- Linux 图形策略支持 `auto`、`system`、`disable-dmabuf`、`disable-compositing` 四种模式。
- `auto` 仅在 Wayland + NVIDIA 专有驱动时应用 `__NV_DISABLE_EXPLICIT_SYNC=1`，不得覆盖用户已有环境变量。
- 支持 `CLI_MANAGER_LINUX_GRAPHICS_MODE` 启动覆盖，并提供只读图形诊断 IPC。
- Linux 主窗口在首屏完成前隐藏；慢启动必须显示加载或错误状态，不能长期显示空白窗口。
- xterm WebGL 保持默认性能路径；兼容模式、context loss 或用户禁用硬件加速时可靠回退。
- Wayland + NVIDIA 自动模式下，隐藏终端延迟释放 WebGL 资源，后台输出继续缓冲。
- 设置、诊断、AUR 更新渠道提示兼容 `zh-CN` 与 `en-US`。
- AUR 使用 `cli-manager-bin`，从 V1.2.7 `.deb` 资产安装，并禁用应用内自更新安装。
- 不升级依赖，不替换 xterm/WebKitGTK，不重构无关 UI。

## Acceptance Criteria

- [ ] Rust 图形策略的模式、优先级、平台检测与不覆盖环境变量均有单元测试。
- [ ] 前端类型检查、Node 测试、`cargo check`、`cargo test` 通过。
- [ ] CachyOS/Arch + Wayland + NVIDIA 下 AppImage、源码构建、AUR 包冷启动各 10 次，无白屏、黑屏或崩溃。
- [ ] Ubuntu/Fedora Wayland + Mesa 和至少一组 Linux X11 启动与终端冒烟通过。
- [ ] 持续输出、分屏拖拽、窗口缩放、背景图片和休眠恢复无明显卡顿或 context-loss 黑屏。
- [ ] `makepkg` 与 `namcap` 验证通过，AUR 包通过 pacman/AUR 更新而非内置 updater。
- [ ] `CHANGELOG.md` V1.2.7 与 `docs/功能清单.md` 已同步。

## Notes

- Tauri 官方 Linux graphics 文档确认 WebKitGTK DMABUF 与 NVIDIA/Wayland 可产生相同症状。
- GitNexus 将 Rust `run()` 启动入口标记为 HIGH 风险，必须保持平台隔离并完整回归启动流程。
- GitNexus 索引刷新因 `.gitnexus/lbug` 被占用失败；实现以最新源码直接检查为准，提交前重试 `detect_changes`。
