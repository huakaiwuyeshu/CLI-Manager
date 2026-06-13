# cc-switch 用量统计调研

调研对象：`https://github.com/farion1231/cc-switch`，commit `2d64d8c61965fec6e55d232371e404f92f1b396e`。

## 核心结论

cc-switch 的用量统计不是单纯调用供应商账单 API，而是本地形成一套统计账本：

1. 本地代理截获 API 响应，从响应 `usage` / `usageMetadata` 提取 token。
2. CLI 会话日志导入，覆盖 Claude / Codex / Gemini / OpenCode 等本地历史。
3. SQLite 存明细表 `proxy_request_logs`。
4. 模型价格表 `model_pricing` 负责估算 cost。
5. 老数据进入日汇总表 `usage_daily_rollups`。
6. 查询层合并明细与 rollup，并做跨来源去重。
7. 前端监听 `usage-log-recorded` 事件后刷新看板。

## 可借鉴点

* 数据来源必须显式标记：proxy、session_log、codex_session、gemini_session、opencode_session。
* token 拆分必须保留输入、输出、缓存读取、缓存创建，不能只存总量。
* 请求模型、响应模型、计费模型要分开，否则路由/模型别名场景会算错。
* 定价缺失时先保留明细，后续可以 backfill。
* 查询层需要去重，避免代理日志和会话日志双算。
* UI 应展示“这是估算，不等于官方账单”的上下文。

## 对 CLI-Manager 当前任务的映射

本项目当前历史分析看板已经有 `history_get_stats` 和 `HistoryStatsPayload`，短期不需要照搬 cc-switch 的 SQLite 三表模型。更合适的 MVP 是：

* 保留现有历史统计数据源。
* 在前端把历史统计 payload 按 cc-switch / ccusage 的展示方式组织：summary、token composition、trend、source distribution、model/project ranking。
* 后端只在现有 payload 缺字段时再补充，不优先新增表。

## 风险

* cc-switch 统计的是 API 请求成本，本项目历史看板统计的是 CLI 会话历史，两者口径不同，不能把历史消息统计包装成官方账单。
* 如果要实现真正 cc-switch 式代理日志，需要新增本地代理和请求日志，范围远超当前“分析看板改造”。
