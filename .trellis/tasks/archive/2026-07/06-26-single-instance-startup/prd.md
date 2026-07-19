# single-instance-startup

## Goal

避免 CLI-Manager 在已经后台运行时被桌面/任务栏再次启动出多个进程；再次启动时应复用现有实例，而不是新开一个实例。

## What I already know

* 当前启动入口在 `src-tauri/src/lib.rs` 的 `run()`。
* 现有启动链路里没有单实例保护逻辑。
* 托盘“显示”逻辑已经存在，当前就是对 `main` 窗口执行 `show` / `unminimize` / `set_focus`。
* 官方 Tauri 2 文档推荐使用 `tauri-plugin-single-instance`，并要求该插件最先注册。

## Assumptions (temporary)

* 二次启动的期望行为是：唤醒现有主窗口，而不是静默忽略。
* 本次只处理桌面应用的单实例约束，不扩展到额外命令行参数转发场景。

## Open Questions

* 无

## Requirements (evolving)

* 桌面端同时只允许存在一个 CLI-Manager 进程实例。
* 当应用已在后台运行时，从桌面或任务栏再次启动，不得出现第二个实例。
* 二次启动触发时，应复用现有 `main` 窗口。
* 二次启动时应显示并聚焦现有主窗口。

## Acceptance Criteria (evolving)

* [ ] 当应用已运行时，第二次从桌面/任务栏启动不会产生第二个 CLI-Manager 进程。
* [ ] 如果现有窗口被最小化或隐藏到托盘，第二次启动会把它显示出来并聚焦。
* [ ] `src-tauri` 后端编译检查通过。

## Definition of Done (team quality bar)

* Tests added/updated if appropriate
* Lint / typecheck / compile checks green
* Docs/notes updated if behavior changes

## Out of Scope (explicit)

* 不改动前端 UI。
* 不新增多窗口管理。
* 不处理复杂参数路由或深链接恢复。

## Technical Notes

* 入口文件：`src-tauri/src/lib.rs`
* 依赖文件：`src-tauri/Cargo.toml`
* 预期使用官方单实例插件，并复用已有托盘显示主窗口逻辑。
