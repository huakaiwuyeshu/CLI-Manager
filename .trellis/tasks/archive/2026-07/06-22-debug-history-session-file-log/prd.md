# debug-history-session-file-log

## Goal

添加最小调试日志，明确实时统计/历史会话链路在 WSL 场景下扫描、匹配和读取的是哪个 Claude jsonl 文件，帮助定位“有文件但实时统计提示该项目暂无 Claude 会话记录”的原因。

## Requirements

* 在 `history_list_sessions` 中记录关键查询参数：source、Claude/Codex 历史根目录、projectPath、query、limit、offset。
* 在 `history_list_sessions` 中记录匹配到的会话文件路径；当无匹配结果时记录候选文件数量与过滤条件。
* 在 `history_get_session` / 校验读取链路中记录最终实际读取的 jsonl 文件路径。
* 日志仅用于调试，不改变会话扫描、匹配、排序和统计逻辑。

## Acceptance Criteria

* [ ] 打开实时统计时，Rust 日志能看到本次查询使用的历史根目录和过滤条件。
* [ ] 命中会话时，Rust 日志能看到返回/读取的 jsonl 文件路径。
* [ ] 未命中会话时，Rust 日志能看到无结果以及相关过滤条件，便于判断是目录、source、projectPath 还是 sessionId query 不匹配。
* [ ] 前端类型检查不受影响；Rust 编译检查通过。

## Definition of Done

* 最小代码改动。
* 不新增依赖。
* 不改变用户可见行为。
* 运行必要的静态/编译检查。

## Technical Approach

在 `src-tauri/src/commands/history.rs` 既有 `log::debug` 基础上补充少量 `debug!` 日志。日志落在 Rust/Tauri 日志体系内，用户可通过 `CLI_MANAGER_DEBUG=1` 查看。

## Decision (ADR-lite)

**Context**: WSL hook 通知可达，说明 hook 回调链路基本通；实时统计无记录更可能发生在历史目录扫描、项目路径匹配、sessionId 查询或实际 jsonl 读取阶段。

**Decision**: 只在 Rust 历史读取链路加 debug 日志，不改匹配逻辑，不引入 UI 开关。

**Consequences**: 调试时需要开启 `CLI_MANAGER_DEBUG=1`；日志包含本地路径，只在 debug 模式使用。

## Out of Scope

* 不修复 WSL 匹配逻辑。
* 不新增前端调试 UI。
* 不改 ccusage 全局报表逻辑。

## Technical Notes

* 相关文件：`src-tauri/src/commands/history.rs`
* 现有日志宏：文件已使用 `log::debug`。
* GitNexus impact：`history_list_sessions` LOW；`history_get_session` LOW。
