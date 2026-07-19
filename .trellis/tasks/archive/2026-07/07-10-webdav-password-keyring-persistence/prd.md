# webdav-password-keyring-persistence

## Changelog Target

[TEMP]

## Goal

修复 WebDAV 密码不持久化的问题：保存后重启应用（或重新打开设置窗口）密码丢失。将密码接入 Windows 凭据管理器，兑现设置页既有文案"密码使用系统安全存储，不会被明文保存"。

## Background

- 提交 `a0a7dc3`（2026-07-06 安全加固）移除了 tauri store 中的明文密码持久化，改为仅内存变量 `sessionWebdavPassword`，但未实现配套的系统安全存储。
- `syncStore.ts` 的 `load()` 每次启动强制 `hasPassword = false` 并清空内存密码 → 重启后密码必丢，启动自动同步静默失效。
- 设置页 UI 文案已承诺"系统安全存储"（`SyncSettingsPage.tsx:610`）。

## Requirements

- Rust 侧新增 3 个命令：`sync_save_password` / `sync_load_password` / `sync_delete_password`，基于 Windows 凭据管理器（`keyring-core` 1.x + `windows-native-keyring-store` 1.x，固定 service/user，仅存一条凭据）。
- `lib.rs` invoke_handler 注册新命令。
- 前端 `syncStore.ts`：
  - `load()`：从凭据管理器取回密码到 `sessionWebdavPassword`，据此恢复 `hasPassword`；保留清理旧明文 `webdavPassword` 键的逻辑。
  - `setConfig()`：提供密码时写入凭据管理器（空密码 = 删除凭据）。
  - `clearPassword()`：删除凭据管理器条目。
- 密码仍不进 tauri store / SQLite / 同步快照。

## Acceptance Criteria

- [ ] 保存 WebDAV 配置（含密码）→ 重启应用 → 设置页显示已配置密码（hasPassword=true），上传/下载无需重输密码。
- [ ] 清除密码后凭据管理器条目被删除，hasPassword=false。
- [ ] `cargo check` 与 `npx tsc --noEmit` 通过。
- [ ] CHANGELOG.md（[TEMP] 段）与 docs/功能清单.md 更新。

## Notes

- 运行态 UI 验收由用户人工完成（AI 不启动应用）。
- 非 Windows 平台命令返回明确错误（项目为 Windows-only 桌面应用）。
