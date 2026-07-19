# 修正历史用量分析统计口径

## Goal

修正 CLI-Manager 历史用量分析数据不准确的问题，参考 cc-switch 的数据分析口径，让历史统计中的会话、消息、Token、模型、项目和时间趋势结果更可信。

## What I already know

* 用户反馈“历史用量分析的数据不准”。
* 用户指定参考项目：<https://github.com/farion1231/cc-switch>。
* 当前项目已有 `history_get_stats` 后端接口和前端分析看板。
* 后端相关规约位于 `.trellis/spec/backend/history-stats-contracts.md`。
* cc-switch 按每条计费用量记录的 `created_at/timestamp` 聚合趋势；CLI-Manager 当前按整份会话文件的 `updated_at` 聚合。
* CLI-Manager 当前单文件 token 解析已覆盖 Claude usage 去重、Codex 累计差分和缓存 token 归一化，主要偏差在聚合层。

## Assumptions (temporary)

* 问题核心优先按“统计口径不一致或解析字段错误”处理，而不是先重做 UI。
* 本任务优先修正 CLI-Manager 自身统计数据来源与聚合逻辑，除非确认需要同步改前端展示。

## Open Questions

* None. User approved the minimal backend-only aggregation fix.

## Requirements (evolving)

* 对比当前 `history_get_stats` 实现和 cc-switch 的数据分析逻辑。
* 找出导致历史用量分析不准的最小根因。
* 按项目现有接口约定修正统计逻辑，尽量保持前端 API 兼容。
* 历史用量的 Token、费用、模型分布、日期趋势和小时分布按 usage 事件时间聚合，而不是按 session 文件最终修改时间聚合。
* 范围内 session 计数需要按唯一 session 去重，避免同一 session 多条 usage 事件导致 session 数虚高。

## Acceptance Criteria (evolving)

* [x] 明确记录当前实现与 cc-switch 统计口径的差异。
* [x] 修正后 `history_get_stats` 的 Token、费用、模型分布和时间趋势按 usage 事件时间统计且可验证。
* [x] 跨天 session 的 usage 不再全部归到文件 `updated_at` 所在日期。
* [x] 同一 session 多个 usage 事件不会让范围总 session 数虚高。
* [x] 后端检查通过：`cd src-tauri && cargo check`。
* [x] 如修改前端类型或展示，前端类型检查通过：未修改前端 payload/type，跳过。

## Definition of Done

* Tests added/updated where practical.
* Typecheck/build checks pass for touched layers.
* Behavior change and remaining risk are summarized.
* Existing unrelated working-tree changes are not reverted or included.

## Out of Scope

* 不重做分析看板 UI。
* 不新增外部依赖，除非发现现有解析无法可靠完成且用户确认。
* 不修改 cc-switch 或外部项目。
* 不在本任务里引入单独 SQLite 用量日志表；保持当前 JSONL 扫描 + 缓存架构。

## Technical Notes

* Task directory: `.trellis/tasks/06-26-fix-history-usage-analysis-stats/`
* Research notes will be written under `research/`.
* Research: `research/cc-switch-history-usage-analysis.md`
* GitNexus impact:
  * `build_history_stats_daily_index`: LOW。
  * `build_history_stats_response`: LOW。
  * `scan_session_inner`: CRITICAL，影响 detail/list/search/stats 共享扫描链路，实施时必须补测试。
