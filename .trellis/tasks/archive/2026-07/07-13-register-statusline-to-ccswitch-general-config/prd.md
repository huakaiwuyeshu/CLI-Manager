# 状态栏注册到 CC Switch 通用配置

## Goal

安装 CLI-Manager Claude 状态栏时，将受管理的 `statusLine` 同步到 CC Switch 的 `common_config_claude`，避免切换供应商后状态栏配置被覆盖。

## Requirements

- 参考现有 Hook 保护逻辑，优先使用设置中的 `ccSwitchDbPath`，未指定时使用平台默认 CC Switch 数据库路径。
- 安装状态栏时，同时把 CLI-Manager 管理的 `statusLine` 合并到 `common_config_claude`。
- 卸载状态栏时，只移除 CC Switch 通用配置中由 CLI-Manager 管理（命令包含 `__statusline`）的 `statusLine`。
- 保留 `common_config_claude` 中的其他字段、Hook 和非 CLI-Manager 状态栏配置。
- 未安装 CC Switch 或数据库不可用时，不影响 Claude 本地状态栏的安装与卸载；同步失败应返回可识别的结果，避免误报整体安装失败。
- 前端沿用设置中的 CC Switch 数据库路径，不增加新的路径配置。
- 不改变 Codex 状态栏与状态栏布局/配置库逻辑。

## Changelog Target

`[TEMP]`

## Acceptance Criteria

- [x] 安装后，CC Switch `settings.common_config_claude` 包含 CLI-Manager 管理的 `statusLine`。
- [x] 已有通用配置字段与 Hook 在安装、重装后保持不变。
- [x] 卸载只删除命令包含 `__statusline` 的通用 `statusLine`，不删除第三方状态栏。
- [x] CC Switch 不存在或同步失败时，Claude 本地状态栏安装/卸载仍可完成。
- [x] 状态栏页面调用安装/卸载时传递当前 `ccSwitchDbPath`。
- [x] Rust 定向测试与前端 TypeScript 类型检查通过。

## Out of Scope

- 为 CC Switch 通用配置增加独立状态栏管理 UI。
- 同步状态栏组件布局到 CC Switch；CC Switch 仅保存 Claude `statusLine` 启动命令。
- 修改 Codex `[tui].status_line`。

## Technical Notes

- Claude 本地安装入口：`src-tauri/src/statusline.rs:501`、`src-tauri/src/statusline.rs:518`。
- Hook 通用配置同步参考：`src-tauri/src/commands/hook_settings.rs:964`。
- 前端安装入口：`src/components/settings/pages/StatuslineSettingsPage.tsx:308`。
- GitNexus 对 `statusline_install`、`statusline_uninstall`、`StatuslineSettingsPage` 的上游影响分析均为 LOW，无直接调用符号或已识别执行流受影响。
- 验证：`npx tsc --noEmit`、`cargo test hook_settings`（27 passed）、`cargo check` 通过。
- `cargo fmt -- --check` 仍被工作区内大量既有未格式化 Rust 改动阻断；未批量格式化，以免覆盖并发用户改动。

