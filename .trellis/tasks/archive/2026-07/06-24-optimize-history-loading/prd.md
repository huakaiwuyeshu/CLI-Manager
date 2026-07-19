# 优化历史会话加载性能

## Goal

历史会话打开仍然偏慢。本任务用最小必要改动降低首屏等待：先让列表尽快可见，再延后或减少详情解析和后端 JSONL 扫描成本。

## Requirements

* 历史会话首屏优先展示列表，不让首条详情解析阻塞或抢占首屏加载。
* 历史列表摘要尽量复用已有内存/磁盘索引，只对新增或变更的当前页文件做必要解析。
* 本轮不触碰高风险的会话详情解析主干；详情重复扫描优化延后单独处理。
* 系统/注入提示词在会话详情中默认折叠，避免大段 AGENTS/系统上下文占据首屏。
* 历史会话标题使用真实用户输入，跳过 AGENTS.md instructions 等注入提示词。
* 收藏元数据加载兼容旧 session key，避免软件更新后收藏状态看起来丢失。
* 保留现有分页、筛选、搜索、元数据、删除和详情查看行为。
* 增加必要的耗时日志或保留现有 perf marker，方便验证列表和详情分别是否变快。

## Acceptance Criteria

* [ ] 打开历史工作区时列表加载和详情加载解耦，首屏列表不等待完整详情。
* [ ] `history_list_sessions` 在无搜索路径下能优先复用可用索引摘要。
* [ ] 首条详情自动加载被延迟执行，且用户手动选择会话或关闭历史时不会被旧自动加载覆盖。
* [ ] AGENTS.md instructions 不再作为历史会话列表标题。
* [ ] AGENTS.md/system/codex internal prompt 在详情中默认折叠。
* [ ] 收藏元数据可通过精确 key、source+session_id 或 source+file_path 匹配到当前会话。
* [ ] `cd src-tauri && cargo test history` 通过。
* [ ] `cd src-tauri && cargo check` 通过。
* [ ] `npx tsc --noEmit` 通过。

## Definition of Done

* 改动范围限于历史会话加载相关前后端代码。
* 不新增依赖，不引入新的持久化表或后台服务。
* 对高风险解析逻辑补充或保留测试。
* 验证命令执行并记录结果。

## Technical Approach

1. 前端：`loadSessions` 完成后不要立即抢占式解析首条详情。优先让列表完成渲染；自动详情如保留，则延迟到 idle/timeout，并避免覆盖用户快速点击的会话。
2. 后端列表：无搜索的 `history_list_sessions` 优先使用 `refresh_history_index_snapshot`/持久化索引的已计算摘要；fingerprint 不匹配时再回退扫描。
3. 本轮暂不合并 `scan_tool_events` 和详情消息解析；`scan_session_inner` 影响范围被 GitNexus 标记为 CRITICAL，需另起低风险设计。
4. 标题提取跳过明确注入提示词，并 bump 历史索引缓存版本让旧标题重建。
5. 收藏 meta 不迁移数据库，应用时做兼容匹配。
6. 验证：跑 Rust history 测试、Rust 编译检查、前端 TypeScript 检查。

## Decision (ADR-lite)

**Context**: 历史文件数量可达上千，本机当前约 382 个 Codex JSONL、724 个 Claude JSONL；近期 Codex 单文件可达 0.3MB 到 1.3MB。前端已有虚拟列表，主要成本在后端摘要扫描和详情全量解析。

**Decision**: 不引入 SQLite 索引表或后台索引服务，先复用现有索引缓存并减少首屏抢占和重复解析。

**Consequences**: 改动面较小，能降低首屏等待；索引缓存损坏或 fingerprint 不匹配时仍回退现有扫描路径。未来如果历史量继续增长，再考虑显式持久化索引表。

## Out of Scope

* 新增 SQLite 历史索引表。
* 新增后台索引 daemon/service。
* 重做历史会话 UI。
* 优化全局全文搜索性能。
* 合并 `history_get_session` 的消息解析与 tool events 扫描。

## Technical Notes

* `src/stores/historyStore.ts`：`loadSessions`、`openSession`、自动首条详情加载。
* `src/components/HistoryWorkspace.tsx`：历史列表与详情渲染、分页触发。
* `src-tauri/src/commands/history.rs`：`history_list_sessions`、`history_get_session`、`build_session_detail`、`scan_session_inner`、`scan_tool_events`、历史索引缓存。
* GitNexus 显示 `history_list_sessions` 直接依赖 `collect_session_files`、`session_file_fingerprint`、`get_or_scan_session_computation`、`refresh_history_index`。
* GitNexus 显示 `build_session_detail` 仅由 `history_get_session` 调用，适合局部优化。
