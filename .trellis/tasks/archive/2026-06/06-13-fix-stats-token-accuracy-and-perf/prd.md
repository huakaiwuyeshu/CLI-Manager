# PRD: 修复分析看板 Token 统计准确性 + 性能优化

## 背景

分析看板（StatsPanel）与会话统计面板（SessionStatsPanel）的 token 统计存在严重失真，
且首次构建历史索引为串行全量扫盘（本机 1055 个 jsonl、约 717MB），加载慢。

## 已验证的问题（基于本机真实数据）

### A1. Claude 重复计数（最严重）

Claude Code 流式写入会把同一条 assistant 消息（相同 `message.id` + `requestId`）写成多行，
每行携带**相同的 usage**。`scan_session_combined` 逐行累加，未去重。

实测：本项目 137 个会话，naive 求和 17.37 亿 tokens，按 (message.id, requestId) 去重后 5.49 亿，
**虚高 216%（约 3.2 倍）**。

### A2. Codex token 统计为 0 / 口径错误

新版 Codex rollout 的 token 在 `event_msg.payload.info` 下：
- `total_token_usage`：**会话累计值**（单调递增）
- `last_token_usage`：本回合增量（但存在重复事件，直接求和虚高 2~5%，个别文件 2 倍）

当前 `extract_usage_tokens` 的候选路径（`usage`/`token_usage`/`payload.usage`/`message.usage`/`response.usage`）
全部匹配不到 → Codex 会话 token 统计为 **0**。

正确口径：对 `total_token_usage` 做相邻差分（差分为负=重置，取当前值）。
注意 Codex `input_tokens` **包含** `cached_input_tokens`，需归一化为
input(不含缓存) + cache_read，与 Claude 口径一致；同时删除 `calculate_usage_cost`
中 `source=="codex"` 的二次扣减（否则双重扣减）。

### A3. Codex usage 无法归因到模型

`token_count` 事件不带 model；model 在 `turn_context.payload.model`。
当前逐行 `extract_model` → token 全部归到 "unknown" 且全部 unpriced。
修复：扫描时跟踪"当前模型"（最近一次出现的 model），usage 行无 model 时回退使用。

### A4. `<synthetic>` 模型污染

Claude 错误行 `"model":"<synthetic>"` 会进入 model_hits/模型分布。需过滤。

### A5. 会话详情面板 token 恒为 0

- 后端 `parse_message` 只查顶层 `value.usage`，Claude 的 usage 在 `message.usage` → 永远 None。
- 前端 `historyStore.normalizeDetail` 映射消息时直接丢弃 token 字段。
- 即使修了以上两点，重复行会让前端 SessionStatsPanel 求和虚高 → 后端流式输出消息时对重复
  (message.id, requestId) 行清空 token 字段。

### P1. 性能：索引构建串行扫盘

`build_history_index` 串行逐文件 `scan_session_combined`（全量 JSON 解析）。
1055 文件 / 717MB 首次加载耗时高。改为 `std::thread::scope` 并行扫描
（线程数 = available_parallelism，无新增依赖）。指纹缓存命中路径不变。

## 需要修改的文件

| 文件 | 修改 |
|------|------|
| `src-tauri/src/commands/history.rs` | A1 去重；A2 codex 差分解析+口径归一+删二次扣减；A3 当前模型跟踪；A4 过滤 synthetic；A5 parse_message 读 message.usage + iter_session_messages 去重清空；P1 并行扫描 |
| `src/stores/historyStore.ts` | A5 normalizeDetail 透传 token 字段（兼容 camelCase/snake_case） |

## 不做

- 不新增 GPT-5 系列定价（不猜价格，保持 unpriced_tokens 口径）。
- 不改 message_count 口径（避免列表显示变化）。
- 不引入 rayon/simd-json 等新依赖。

## 验收

1. `cargo check` + 既有 `cargo test` 通过；新增针对去重/codex 差分的单元测试。
2. 用本机真实数据对比：Claude 项目 token 总量应接近去重基准（5.49 亿 vs 17.37 亿）。
3. Codex 会话 token 不再为 0，且与最后一条 `total_token_usage` 一致（差分求和）。
4. `npx tsc --noEmit` 通过。
5. 运行态 UI 由用户人工验收（按既有约定 AI 不启动桌面应用）。
