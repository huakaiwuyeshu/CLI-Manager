# reduce-info-log-noise

## Goal

减少生产环境 `cli-manager.log` 的常规诊断噪声，使 `info` 仅保留关键生命周期、状态变更和用户数据修改操作。

## Requirements

- 将已审查的 131 处常规诊断 `info!` / `log::info!` 调整为 `debug!` / `log::debug!`。
- 将 daemon 因容量限制丢弃退出会话缓冲区的日志从 `info` 调整为 `warn`。
- 保留 21 处关键 `info`：应用/daemon 生命周期、PTY 关键生命周期、Git 工作区修改、同步完成和调试开关状态。
- 保持前端 `debugConsoleInfo` 不变，其已受 `debugMode` 控制。
- 不修改日志文本、业务逻辑、调用流程和依赖。
- Changelog Target: `[TEMP]`。

## Acceptance Criteria

- [x] 默认 `Info` 级别不再输出扫描、轮询、候选匹配、逐阶段耗时等诊断日志。
- [x] 开启 Debug 日志后仍可获得被降级的诊断信息。
- [x] daemon 缓冲区被容量上限淘汰时输出 `warn`。
- [x] 关键生命周期和会改变 Git 工作区的操作仍输出 `info`。
- [x] Rust 编译检查通过。
- [x] `CHANGELOG.md` 的 `[TEMP]` 节记录本次调整。

## Technical Approach

- 仅替换日志宏级别，不调整条件分支和格式参数。
- 对混合保留/降级的文件按已确认行位点逐项修改；其他已确认文件中的现有 `info` 全部降为 `debug`。

## Out of Scope

- 不重构日志框架。
- 不新增采样、限流或结构化日志设施。
- 不调整现有 `warn` / `error` 日志。
- 不修改日志轮转和保存策略。
