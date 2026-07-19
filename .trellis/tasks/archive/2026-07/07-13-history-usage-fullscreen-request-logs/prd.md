# 历史用量分析全屏重设计与本地请求日志

## Goal

将“历史用量分析”和“ccusage 用量分析”升级为应用窗口内的全屏工作区；历史用量分析新增请求日志页，将本地 Claude/Codex 会话中的 usage 事件持久化到 CLI-Manager 自身数据库，彻底移除对 cc-switch 的运行时依赖。

## Requirements

- 历史用量分析使用“用量概览 / 请求日志”两个一级页签。
- 用量概览中 Token / 费用趋势独占中间整行。
- 首屏底部四列依次为项目排行、模型排行、24 小时活跃、Token 构成。
- Token 构成必须位于最后一列。
- 请求日志数据仅来自本地 Claude/Codex 会话 JSONL 中的 usage 事件。
- usage 事件写入 CLI-Manager 自身 `cli-manager.db` 的 `request_logs` 表。
- 使用独立同步状态表记录文件指纹，未变化文件不得重复解析。
- 应用启动后同步一次，运行期间每 60 秒同步一次，并支持手动刷新。
- Claude 复用 `message.id + requestId` 去重；Codex 复用累计 Token 差分逻辑。
- 文件截断、重写或删除后，请求日志必须与当前本地会话文件保持一致。
- 请求日志支持来源、项目、模型、会话关键字和时间范围筛选，以及分页和会话跳转。
- 请求日志不保存 Prompt、响应正文、Header、密钥或环境变量。
- 不伪造 HTTP 状态、耗时、首 Token 时间或 Provider ID；状态显示为本地会话记录。
- 费用按当前 CLI-Manager 模型价格计算，无价格时显示未定价。
- ccusage 看板只调整全屏布局和视觉层级，不增加功能、字段、数据源、筛选项或统计口径。
- 所有新增用户可见文案必须同时支持 `zh-CN` 与 `en-US`，时间保持 24 小时制。
- Changelog Target: `[TEMP]`。

## Acceptance Criteria

- [ ] `cli-manager.db` 包含 `request_logs` 和文件同步状态表及必要索引。
- [ ] 相同 Claude usage 事件重复扫描不会产生重复记录。
- [ ] Codex 累计 Token 能正确还原为逐事件用量。
- [ ] 未变化文件会被跳过，变化文件会原子替换对应日志。
- [ ] 文件截断、重写和删除后不存在残留请求日志。
- [ ] 启动同步、60 秒同步和手动刷新不会并发重复执行。
- [ ] 请求日志不读取或依赖 cc-switch 数据库、配置或进程。
- [ ] 请求日志表格包含时间、来源、模型、项目/会话、输入、输出、费用、状态和操作。
- [ ] 匹配到本地历史会话时可以跳转；无法匹配时不显示伪操作。
- [ ] 历史用量分析占满应用窗口，并可通过 ESC 和关闭按钮退出。
- [ ] Token / 费用趋势独占中间整行，Token 构成位于底部最后一列。
- [ ] ccusage 原有功能和数据契约保持不变，仅布局发生变化。
- [ ] 1600px、1280px、1024px 下无整页横向滚动。
- [ ] `npx tsc --noEmit`、`cargo check` 和相关 Rust 测试通过。

## Definition of Done

- 后端 migration、同步、查询、分页和单元测试完成。
- 前端请求日志、定时同步、全屏布局、i18n 和响应式完成。
- 历史统计原有 Token、费用、去重和会话详情行为无回归。
- ccusage Store、Rust command 和数据口径未改变。
- `CHANGELOG.md` 和 `docs/功能清单.md` 已更新。
- 已完成 GitNexus 变更影响检查和项目质量检查。

## Technical Approach

- migration 19 创建 `request_logs` 与 `request_log_sync`。
- 新增 `src-tauri/src/commands/history/request_logs.rs`，复用 history 私有扫描能力。
- `SessionUsageEventScan` 增加稳定事件键和事件序号，不改变现有汇总行为。
- `request_id` 使用 `SHA-256(source|规范化文件路径|event_key)`，复用现有 `sha2` 依赖。
- 同步采用文件级增量：比较 `created_at + updated_at + size + parser_version`，变化文件完整重扫并在事务内替换。
- Rust 使用 `app_paths::db_path()` 打开 CLI-Manager 自身数据库，并设置 busy timeout。
- 前端在设置状态就绪后启动一次同步和 60 秒定时器；请求日志页手动刷新复用同一 command。
- 费用查询时按模型聚合并复用 history 当前价格计算，数据库只保存原始 Token 构成。
- 两个看板保留现有 Portal 和入口，只移除弹窗尺寸限制并重排网格。

## Decision (ADR-lite)

**Context**：cc-switch 未启用代理时也通过扫描本地会话日志生成 usage 记录，但读取其数据库会引入外部路径、Schema 和运行状态耦合。

**Decision**：CLI-Manager 自行扫描本地 Claude/Codex 会话 usage，并写入自身 `request_logs`；不调用、不读取、不配置 cc-switch。

**Consequences**：请求日志没有真实 HTTP 状态和耗时，但数据来源稳定、隐私边界清晰、可离线工作。文件级增量会重扫发生变化的大文件，但避免了持久化 Codex 累计解析器状态的复杂度。

## Out of Scope

- 不实现 HTTP 代理、抓包、请求转发或 API Header 注入。
- 不读取或迁移 cc-switch 的 `proxy_request_logs`。
- 不展示伪造的 HTTP 状态、延迟或首 Token 时间。
- 不保存 Prompt、响应正文、API Key、Authorization Header 或完整请求体。
- 不为 ccusage 增加请求日志、指标、筛选或统计逻辑。
- 不新增第三方依赖。

## Technical Notes

- 计划：`.claude/plan/history-usage-fullscreen-request-logs.md`。
- 原型：`ui-overview.png`、`ui-request-logs.png`、`ccusage-fullscreen.png`。
- `src-tauri/src/commands/history.rs:4548` 已在单遍扫描中处理 Claude 去重、Codex 累计差分和 Token 归一化。
- `src-tauri/src/app_paths.rs:73` 提供 CLI-Manager 数据库路径。
- 当前 migration 最新版本为 18，新表使用版本 19。
- `scan_session_inner` 的 GitNexus 初步风险为 MEDIUM；实施时必须保持现有统计输出不变并补回归测试。
- `StatsPanel` 与 `CcusageStatsPanel` 的 GitNexus 初步风险为 LOW。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` and `implement.md` when the execution plan cannot be represented clearly elsewhere.
