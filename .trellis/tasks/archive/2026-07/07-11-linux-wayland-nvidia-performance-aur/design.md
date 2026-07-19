# Design

## Linux graphics policy

- 新增纯 Rust 策略模块，输入平台环境、持久化设置和 CLI-Manager 覆盖变量，输出最终模式、NVIDIA/Wayland 判定和待设置变量。
- 优先级：用户已设置的标准变量 > `CLI_MANAGER_LINUX_GRAPHICS_MODE` > `settings.json.linuxGraphicsMode` > `auto`。
- `system` 不设置变量；`auto` 在 Wayland + NVIDIA 时设置 explicit-sync workaround；两个禁用模式分别设置 WebKitGTK 对应变量。
- 检测只读取 `XDG_SESSION_TYPE`、`WAYLAND_DISPLAY`、`XDG_CURRENT_DESKTOP`、`/proc/driver/nvidia/version` 等非敏感信息，不执行外部命令。

## Startup and frontend

- 增加 Linux Tauri 平台配置 `visible=false`，复用现有首屏完成和 3 秒 fallback 显示逻辑。
- 设置未加载时渲染主题安全的加载状态；启动阶段增加 15 秒 watchdog 和阶段日志。
- 设置 store 新增 `linuxGraphicsMode` 迁移默认值；开发者设置页仅在 Linux 显示选项和诊断信息。
- 后端诊断 IPC 返回 camelCase 结构，前端仅展示可复制的有限字段。

## Terminal renderer

- 复用现有 `disableHardwareAcceleration` 控制 xterm WebGL，不新增重复渲染器设置。
- 后端诊断结果缓存在前端；Wayland + NVIDIA 自动模式或 WebKit 降级模式下，隐藏终端沿用 10 秒释放策略。
- context loss 后保持默认渲染器，不在同一会话无限重建 WebGL。

## AUR distribution

- `get_app_version` 增加 `distribution`，读取 `CLI_MANAGER_DISTRIBUTION=aur`。
- AUR 包使用 wrapper 设置 distribution 后执行上游二进制；前端跳过自动更新检查和安装入口。
- `packaging/aur/cli-manager-bin` 保存可审查模板；正式 AUR 仓库在 V1.2.7 资产发布后单独推送。

## Risks

- 启动变量必须在 Tauri/WebKitGTK 初始化前设置。
- 禁用 DMABUF/合成可能降低性能，因此不得作为所有 Linux 的默认值。
- AppImage、源码构建和 AUR 使用的 WebKitGTK/图形库边界不同，必须分别实测。
