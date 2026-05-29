# fix history cache compile error

## Goal

修复 `src-tauri/src/commands/history.rs` 中历史会话缓存计算的 Rust 编译错误，保证缓存 entry 与计算结果类型使用一致。

## Requirements

* `get_or_scan_session_computation` 返回 `CachedSessionComputation`。
* 复用缓存时从 `CachedSessionCacheEntry.computed` 克隆结果，并用 `CachedSessionCacheEntry.fingerprint` 判断文件是否可复用。
* 写入缓存时保存完整的 `CachedSessionCacheEntry`，而不是直接写入 `CachedSessionComputation`。
* 修改范围尽量限制在历史缓存逻辑，不改外部行为。

## Acceptance Criteria

* [ ] `cargo check` 不再出现 `CachedSessionCacheEntry` / `CachedSessionComputation` 类型不匹配错误。
* [ ] 历史会话列表、详情、搜索、提示词、统计相关调用路径保持原有返回结构。

## Definition of Done

* Rust 编译检查通过或明确记录剩余非本任务错误。
* 变更范围与 GitNexus 影响分析一致。

## Technical Approach

保持现有缓存结构：`SessionStatsCache.entries` 存储 `CachedSessionCacheEntry`；函数对外仍返回 `CachedSessionComputation`。

## Out of Scope

* 不重构历史解析/索引架构。
* 不改变历史会话 UI 或 IPC 返回字段。
* 不新增依赖。

## Technical Notes

* 已检查 `src-tauri/src/commands/history.rs` 中 `CachedSessionCacheEntry`、`CachedSessionComputation`、`get_or_scan_session_computation`。
* GitNexus 对 `get_or_scan_session_computation` 的 upstream 影响为 CRITICAL：直接影响 `history_search`、`history_list_prompts`、`history_get_stats`、`build_session_summary`、`build_session_detail`，间接影响 `history_list_sessions`、`history_get_session`。
