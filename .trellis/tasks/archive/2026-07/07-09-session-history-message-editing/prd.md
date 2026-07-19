# session-history-message-editing

## Goal

给会话历史（历史记录工作区）赋能**消息级编辑能力**：参考 memory-forge-rs，允许用户像操作聊天会话一样编辑/删除/插入历史消息，改动直接写回 CLI 本地会话文件（JSONL），使 `--resume` 后 AI 基于修正后的记忆继续。

Changelog Target: V1.2.8

## Requirements

### 消息操作（聊天式交互）
- 消息气泡 hover 显示操作栏：**复制、编辑、删除、在此后插入**；tool 消息只显示复制（不可编辑/删除，避免破坏 tool_use/tool_result 配对）。
- **编辑**：user/assistant 文本消息进入行内编辑态（气泡变 textarea），保存后写回原 JSONL 文件对应行，只改文本内容，保留 uuid/parentUuid/usage 等其他字段，原子写（tmp + rename）。
- **删除**：移除对应 JSONL 行；Claude 侧修复后续行 parentUuid 链；Codex 侧同步删除配对的 `event_msg` 行。
- **插入**：在指定消息之后插入新消息，角色可选 user/assistant（默认 user）；Claude 侧生成 uuid 并接入 parentUuid 链；Codex 侧双写 `response_item` + `event_msg`。
- 操作完成后当前 detail 视图原地刷新（不整页重载），消息数/统计同步更新。

### 来源范围
- Claude Code 与 Codex 会话都支持编辑（Codex 需保持 `response_item` 与 `event_msg` 一致，结构已被互转功能验证）。

### 安全网 + 审计
- **首次修改某会话文件前自动备份**整个原文件（备份目录在 appLocalData 下），提供"还原到编辑前"入口。
- **编辑审计日志**：每次操作记录到 SQLite（操作类型、会话定位、受影响行的 before/after 原文），UI 可查看每次操作的 diff。
- 回滚粒度（简化决策）：v1 提供「查看每次操作 diff」+「整文件还原到最初备份」，不做单次操作的精确逆操作回滚。

### 活跃会话保护
- 编辑/删除/插入时检测该会话是否正被终端内活跃会话绑定（hook sessionId 匹配），是则弹确认警告，用户确认后仍可操作。
- 并发防护：编辑命令携带加载时的文件指纹（mtime/size 或行内容校验），文件已被外部改动时拒绝写入并提示重新加载。

### 联动一致性
- 收藏会话的 SQLite 快照（session_favorite_snapshots）在编辑后同步更新。

## Acceptance Criteria

- [ ] 编辑一条 user/assistant 消息后，`claude --resume` 该会话，CLI 内显示修改后内容且可正常继续对话。（人工验收）
- [ ] Codex 会话编辑后 `codex resume`，模型上下文与 TUI 重放显示一致（response_item 与 event_msg 同步）。（人工验收；写回同步已有 cargo test 覆盖）
- [ ] 删除一条消息后 resume，会话链不断裂（Claude parentUuid 链完整）。（人工验收；重链逻辑已有 cargo test 覆盖）
- [ ] 插入一条 user 消息后 resume，新消息出现在正确位置且可继续对话。（人工验收；插入链路已有 cargo test 覆盖）
- [x] 首次编辑自动生成备份；还原入口可完整恢复原文件。（cargo test：backup_created_once_and_restore_recovers_original）
- [x] 每次编辑/删除/插入在审计日志中可见 before/after diff。（history_edit_audit 表 + EditAuditModal）
- [x] 活跃会话编辑时出现警告确认；外部改动过的文件写入被拒绝并提示。（hook sessionId 匹配警告 + fingerprint 守卫 cargo test）
- [x] tool 消息不出现编辑/删除入口。（editable 门控，读路径 cargo test）
- [x] 编辑后 CLI-Manager 内重新打开该会话，显示新内容，消息数/统计正确；收藏快照同步。（命令返回刷新 detail + finalizeEditOutcome）
- [x] `npx tsc --noEmit` 与 `cd src-tauri && cargo test` 通过。（tsc 无输出；cargo test 318/318）

## Definition of Done

- Rust 侧编辑/删除/插入/重链/备份逻辑有单测（前端无测试框架，纯逻辑下沉后端）。
- 新增 invoke 命令在 `lib.rs` invoke_handler 登记；新增 SQLite 表走 `migrations()` 追加新 Migration（只增不改）。
- `CHANGELOG.md` V1.2.8 记录；`docs/功能清单.md` 更新。

## Decision (ADR-lite)

**Context**: 消息编辑需要把展示层消息映射回 JSONL 原始行，且要防写坏文件。
**Decision**:
- v1 范围 = 编辑 + 删除 + 插入 + 首次备份安全网 + 审计日志（diff 查看），Claude + Codex 双支持，活跃会话警告后允许。
- 解析层为每条 HistoryMessage 附带源定位（行号 + Claude uuid / 源文件路径），编辑命令按定位 + 文件指纹校验写回。
- 回滚 = 整文件还原到最初备份；不做单操作逆回滚（复杂度高，v2 再议）。
**Consequences**: Codex 双行同步与 Claude parentUuid 重链是主要风险点；审计日志新增 SQLite 表（migration v14）。

## Out of Scope

- 单次操作的精确逆回滚（undo 某一次编辑）。
- 从某条消息 fork 新会话。
- 编辑 tool_use/tool_result 消息。
- Gemini/OpenCode 等其他 CLI 来源。
- 实时统计面板内的编辑入口（只在历史记录工作区提供）。

## Technical Notes

- 参考: https://github.com/voidcraft-dev/memory-forge-rs (MIT)
- 关键文件: `src-tauri/src/commands/history.rs`（parse_message:6526 / HistoryMessage:366 / history_get_session:957 / history_delete_session:1236 / 原子写:2366）、`src/components/history/SessionDetailPane.tsx`（HistoryMessageCard:189）、`src/stores/historyStore.ts`、`src-tauri/src/lib.rs`（invoke_handler + migrations）
- 解析模型：一行 JSONL → 至多一条 HistoryMessage，大量行被过滤（event_msg/session_meta 等），message_index ≠ 行号，必须显式记录行映射。
- Claude JSONL：每行 `{uuid, parentUuid, type, message:{role, content: string|blocks[]}, ...}`；同一 assistant 回合可能拆成多行（相同 message.id 不同 content block）——设计阶段需验证解析器是否合并，编辑定位以"行"为准。
- Codex rollout：`response_item`（模型上下文）+ `event_msg.user_message/agent_message`（TUI 重放）需双写/双删（V1.2.7 互转功能已验证该结构）。
- `history_get_session` 的 aggregateSubtasks 选项可能混入子任务文件消息——设计阶段确认历史工作区路径下每条消息的源文件，编辑定位需携带源文件路径。
- 活跃会话检测可复用 hook 绑定的 sessionId（terminalStore/实时统计已有映射）。
- 备份目录建议 `appLocalData/history-backups/`，注意 capability scope 是否需要放开（后端 Rust 直写则不需要 asset scope）。

## Research Notes

### memory-forge-rs 对标

- 核心操作：Edit / Erase / Inject / Audit（before-after diff）/ resume 快捷命令；多平台统一界面。
- 本项目已有 resume、互转、收藏、搜索等外围能力，本任务只补消息级写操作 + 安全网。

### 本仓库约束

- 前端无测试框架 → 写回/重链逻辑全部下沉 Rust 并配 cargo test。
- SQLite migration 当前 v13，审计表走 v14 追加。
- 前端直连 SQLite（tauri-plugin-sql）读审计记录，或走 invoke 命令二选一（设计阶段定）。
