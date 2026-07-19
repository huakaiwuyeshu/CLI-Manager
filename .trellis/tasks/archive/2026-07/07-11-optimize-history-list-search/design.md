# Technical Design

## Storage

- 新建 `~/.cli-manager/history-cache/history-catalog.db`，使用现有 SQLx/SQLite。
- `history_catalog_sessions` 保存 roots、文件指纹、来源、项目、cwd、标题、时间和消息数。
- `history_catalog_messages` 保存消息元数据和正文；外部内容 FTS5 表使用 trigram tokenizer 和同步触发器。
- `history_catalog_state` 保存 schema/parser 版本、阶段、进度、generation 和错误。

## Data Flow

1. 列表直接查询 catalog；若为空则读取现有 JSON 缓存作为临时列表来源。
2. 后台枚举文件并比较指纹，按更新时间从新到旧解析变化文件。
3. 每个文件使用短事务替换摘要、消息和 FTS 行；消失文件同步删除。
4. 通过 `history-index-status` 事件报告进度；前端节流刷新，完成后重跑当前搜索。
5. 搜索使用转义后的字面量 MATCH，来源和项目条件在 SQL 查询中完成。

## Compatibility

- 保持 `history_list_sessions`、`history_search` 参数与数组返回不变。
- 新增 `history_get_index_status`、`history_refresh_index` 和 `HistoryIndexStatus`。
- 精确 sessionId 查询命中 catalog 后只检查对应文件元数据，不触发全量扫描。

## Failure Handling

- catalog 是派生缓存；schema 不匹配或损坏时重建，源日志不删除。
- 同步失败保留最后一次成功数据，并将状态设为 error。
- 首次索引无旧缓存时允许列表/搜索部分可用。

