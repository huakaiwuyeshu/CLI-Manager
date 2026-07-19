# 修复 WSL Codex PermissionRequest 误提醒与强制跳回

## Goal

修复 Codex 在 WSL 中触发 `PermissionRequest` 前置 Hook 时，CLI-Manager 将其误判为已经存在用户审批，并自动启动、聚焦 Windows 主窗口的问题；保留真实待处理事件的标签状态和用户主动跳转能力。

## Changelog Target

`[TEMP]`

## Root Cause

Codex 的 `PermissionRequest` 在正常审批界面之前运行，可能继续被其他 Hook、策略或自动审查处理；CLI-Manager 当前丢弃 `permission_mode`，并在 daemon 收到任意 `PermissionRequest` 时无条件启动应用，同时前端无条件显示审批提醒，错误地把前置候选事件当成最终待用户处理状态。

## Requirements

- Hook 桥接必须透传 Codex `permission_mode`。
- `bypassPermissions` 和 `dontAsk` 等非交互权限模式不得显示审批 toast、发送审批系统通知、设置待处理状态或唤醒应用。
- daemon 不得仅凭原始 `PermissionRequest` 强制启动或聚焦 CLI-Manager。
- 对仍可能需要用户处理的交互模式，保留标签注意状态、应用内 toast 和系统通知；用户点击通知后仍可跳转目标终端。
- Claude Hook 行为保持不变。
- Windows 原生、WSL、daemon 托管和前台进程内 Hook 使用同一判定口径。
- 不新增依赖，不修改用户 Codex 配置，不尝试解析不稳定的 Codex transcript。

## Acceptance Criteria

- [ ] WSL Codex `PermissionRequest` 携带 `permission_mode=bypassPermissions` 时，不弹审批提醒、不发送系统通知、不将标签设为待处理、不启动或聚焦 CLI-Manager。
- [ ] `permission_mode=dontAsk` 时行为同上。
- [ ] 交互权限模式下，现有待处理标签、toast、系统通知和用户点击跳转行为不回归。
- [ ] daemon 和前台进程内 Hook 对可处理性判断一致。
- [ ] Claude `Notification`/`PermissionRequest` 既有语义不受影响。
- [ ] Rust 针对性测试、`cargo check` 和 `npx tsc --noEmit` 通过。

## Scenario Matrix

- WSL / Windows 原生。
- CLI-Manager 前台 / 最小化或退出后由 daemon 托管。
- Codex `bypassPermissions` / `dontAsk` / 交互模式。
- 单一用户 Hook / 用户与项目 Hook 同时存在。
- 目标终端存在 / 已关闭。

## Out of Scope

- 识别其他 Hook 或自动审查最终是否允许、拒绝请求；Codex 当前 Hook 输入不提供最终审批界面状态。
- 接管 Codex TUI 的 `approval-requested` OSC/BEL 通知。
- 自动修改或去重用户、项目、插件中的第三方 Hook。

## Technical Notes

- 官方文档：`PermissionRequest` 在用户审批界面之前运行，多个匹配 Hook 可共同决定结果。
- 主要触点：`src-tauri/src/hook_client.rs`、`src-tauri/src/claude_hook.rs`、`src-tauri/src/daemon/server.rs`、`src/stores/terminalStore.ts`、`src/App.tsx`。
- GitNexus 已完成索引；已确认相关符号当前影响风险为 LOW。
