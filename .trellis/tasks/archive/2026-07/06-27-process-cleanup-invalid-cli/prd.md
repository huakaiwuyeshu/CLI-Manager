# 关闭无效 CLI 进程

## Goal

在 CLI-Manager 关闭终端标签、取消分屏或退出应用时，清理该终端会话派生出的无效 CLI 进程，避免 `codex.exe`、`bash.exe` 等子进程长期残留。

## What I Already Know

* 用户截图显示 Windows 任务管理器中存在大量 `codex.exe` 与 `bash.exe` 进程。
* 项目通过 Rust `PtyManager` 使用 `portable-pty` 创建 PTY 会话。
* 前端关闭普通终端标签会调用 `pty_close`；取消分屏关闭终端时也会调用 `pty_close`。
* 当前后端 `PtyManager::close` 只调用 `portable_pty::Child::kill()` 终止直接 child，没有显式清理派生进程树。
* 应用退出清理目前清空前端 session store 后退出窗口/进程，没有显式关闭全部 PTY 会话。

## Assumptions

* “无效进程”指某个 CLI-Manager 终端会话已经关闭，或应用正在退出后，该会话对应的 shell/CLI 进程树不应继续存活。
* MVP 先处理 CLI-Manager 自己创建的 PTY 进程树，不扫描或杀死系统中与 CLI-Manager 无法建立归属关系的同名进程。

## Decisions

* MVP 的无效进程边界确认如下：已关闭 PTY 会话或应用退出时，由该 PTY 根进程派生出的进程树。

## Requirements

* 关闭普通终端标签时，后端应尽量清理该 PTY 根进程及其子进程树。
* 取消分屏导致终端会话关闭时，应复用相同的后端清理逻辑。
* 应用退出时，应先关闭所有仍由 `PtyManager` 管理的 PTY 会话，再退出应用。
* 不应按进程名全局清理 `codex.exe` / `bash.exe`，避免误杀用户在 CLI-Manager 外部启动的进程。

## Acceptance Criteria

* [ ] 关闭 CLI-Manager 中的 Codex/Git Bash 终端后，该会话派生出的 `codex.exe` / `bash.exe` 不继续残留。
* [ ] 应用通过窗口退出或托盘退出时，仍在运行的 PTY 会话会被清理。
* [ ] 不新增依赖，优先使用系统已有能力和 Rust 标准库。
* [ ] `cd src-tauri && cargo check` 通过。

## Definition of Done

* 后端变更经过 `cargo check` 验证。
* 影响范围说明清楚。
* 不处理 CLI-Manager 无法归属的外部同名进程。

## Technical Notes

* `src-tauri/src/pty/manager.rs:597` 的 `PtyManager::close` 是现有清理入口。
* `src-tauri/src/commands/terminal.rs:80` 的 `pty_close` 只是转发到 `PtyManager::close`。
* `src/stores/terminalStore.ts:761` 关闭普通终端标签后在 `finally` 中调用 `pty_close`。
* `src/stores/terminalStore.ts:1107` 取消分屏时会对关闭的 PTY 调用 `pty_close`。
* `src/App.tsx:638` 的应用退出清理目前没有调用 PTY 批量关闭命令。
* `portable-pty` 的 `Child` trait 提供 `process_id()`，Windows 下可拿到 PTY 根进程 PID。
* GitNexus 对 `pty_close` impact 返回 LOW；`PtyManager::close` 成员级索引不精确，实际影响按直接调用点核验。

## Out of Scope

* 不扫描并清理所有同名 `codex.exe` / `bash.exe`。
* 不做独立进程管理面板。
* 不新增后台守护服务。
