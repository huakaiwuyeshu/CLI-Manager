# 修复本地路径打开权限

## Goal

修复终端路径及 Worktree 目录通过前端 `openPath` 打开时被 Tauri opener 路径 scope 拒绝的问题，同时避免给 WebView 配置全盘路径通配权限。

## Requirements

- 复用现有 `open_folder_in_explorer` Tauri command，统一处理本地目录与文件打开。
- 目录继续由系统文件管理器打开。
- 终端识别到的外部文件继续使用系统默认应用打开。
- 项目、Worktree 和终端路径不再从 WebView 直接调用 `openPath`。
- 移除不再需要的 `opener:allow-open-path` capability。
- Changelog Target: `[TEMP]`。

## Acceptance Criteria

- [ ] 点击项目或 Worktree 的“打开目录”通过 Rust command 打开资源管理器，不再经过 WebView ACL/scope（待应用内手动验证）。
- [ ] 点击终端输出中的项目根目录或外部目录通过 Rust command 打开文件管理器（待应用内手动验证）。
- [ ] 点击终端输出中的外部文件可由 Rust 侧 opener 调用系统默认应用打开（待应用内手动验证）。
- [x] HTTP/HTTPS 链接仍保留前端 `openUrl` 逻辑。
- [x] `cargo check`、前端类型检查及相关测试通过。
- [x] `opener:allow-open-path` 不再出现在 capability 中。

## Technical Approach

- 为 `open_folder_in_explorer` 增加可选的文件默认应用打开模式；路径存在性继续在 Rust 边界校验。
- Rust 侧通过 `tauri_plugin_opener::OpenerExt` 调用系统默认应用，不经过 WebView opener scope。
- 前端三个本地路径入口统一改为 `invoke("open_folder_in_explorer", ...)`。

## Decision

- 不采用 `{"path": "**"}` 之类的全盘 opener scope，避免扩大 WebView 权限。
- 复用现有 command，避免新增重复的路径打开接口。

## Out of Scope

- 不改变 URL 打开逻辑。
- 不调整终端路径识别规则。
- 不新增依赖。

## Notes

- 官方 Tauri 2 opener 文档确认：`opener:allow-open-path` 仅启用命令，具体路径仍需 `allow` scope。
- GitNexus 影响分析：`openTerminalFilePath` 与 `open_folder_in_explorer` 均为 LOW 风险。
