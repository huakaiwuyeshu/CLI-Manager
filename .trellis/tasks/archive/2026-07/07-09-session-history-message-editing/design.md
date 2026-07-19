# Design: session-history-message-editing

## 核心问题与决策

1. **消息→行映射**：`scan_session_inner`（history.rs:4519）逐行扫描、`messages.push` 在 collect_messages 分支。增加物理行号计数（每读一行 +1，含跳过行），推入消息时附带 `line_index`。纯增量，不动 stats 语义。消息不进持久化索引缓存（`CachedSessionComputation` 无 messages）→ **无需 bump HISTORY_INDEX_CACHE_VERSION**。
2. **展示文本 ≠ 可编辑文本**：`extract_content` 是有损展示提取（能从 thinking/tool_use.input 抽文本）。编辑必须基于**规范文本块**：
   - Claude：`message.content` 为 string → 该串；为 blocks[] → 所有 `type=="text"` 块的 text 以 "\n\n" 连接。
   - Codex：`response_item.payload.content[]` 中 `input_text`/`output_text` 块。
   - 读取时为每条消息计算 `editable_text: Option<String>`；None → 前端禁用编辑/删除（覆盖 tool_use 行、function_call patch 行、thinking 行等危险目标）。
3. **HistoryMessage 新增字段**（additive，serde camelCase）：`line_index: Option<usize>`、`editable_text: Option<String>`。`merge_session_detail_parts`（aggregate 子任务合并）对子任务 part 清空这两个字段（跨文件行号无意义；实时面板不编辑）。
4. **写回语义**：
   - 编辑：重读文件全部行 → 校验 `session_file_fingerprint().updated_at == expected_updated_at`（不一致 → `history_file_changed`）→ 目标行重新 parse 校验 role + editable_text == expected（不一致 → `history_line_conflict`）→ 替换文本块（string 直接替换；blocks[] 首个 text 块替换、其余 text 块删除、非 text 块原位保留）→ tmp+rename 原子写。
   - Codex 编辑同步：按 `payload.message == 旧文本` 就近查找配对 `event_msg`（user_message/agent_message）同步改写；找不到只改 response_item。
   - 删除：移除目标行；Claude 将所有 `parentUuid == 被删行 uuid` 的行重链到被删行的 parentUuid；Codex 同步删配对 event_msg。
   - 插入：在锚点消息（须 editable_text 存在）之后插入。Claude 复用 `build_claude_conversion_lines` 的行形状（新 uuid、parentUuid=锚点 uuid、后继重链到新 uuid；cwd/sessionId/version 从锚点行克隆）；Codex 插入 `response_item` + `event_msg` 对（跳过锚点已有配对行再落位）。时间戳沿用锚点行。
5. **安全网**：首次写某文件前备份到 `.cli-manager/history-backups/<sha256(path)[..16]>__<stem>.jsonl.bak`（存在则不覆盖）。`history_restore_session_backup` 整文件还原。
6. **审计**：SQLite 新表 `history_edit_audit`（migration v18，lib.rs 追加；historyStore.ensureMetaTable 同步 CREATE IF NOT EXISTS 兜底，与 snapshots 同款双保险）。**前端写审计**（与 session_meta/snapshots 一致的架构：Rust 不碰 cli-manager.db）。命令返回 before/after 文本供前端落库。
7. **命令返回刷新后的 detail**：写命令内部完成写入 + `invalidate_history_caches()` + `build_session_detail` 重建，单次 IPC 返回 `{detail, beforeText, afterText, backupPath}`，前端原地替换 activeSession、同步收藏快照、更新列表摘要。

## 新增后端（src-tauri/src/commands/history_edit.rs）

```
history_update_message(file_path, claude_config_dir?, codex_config_dir?, source, project_key,
                       line_index, expected_role, expected_text, new_text, expected_updated_at)
history_delete_message(..., line_index, expected_role, expected_text, expected_updated_at)
history_insert_message(..., after_line_index, role(user|assistant), text, expected_updated_at)
history_restore_session_backup(file_path, dirs?, source, project_key)
history_get_backup_status(file_path, dirs?, source, project_key) -> {hasBackup, backupAt?}
```
- 路径校验复用 `validate_session_file_ref`（canonicalize + scope 检查），需将 history.rs 相关 helper 改 `pub(crate)`。
- 错误码稳定字符串：`history_file_changed` / `history_line_conflict` / `message_not_editable` / `invalid_insert_role` / `backup_not_found`。
- 全部注册进 lib.rs invoke_handler。

## 前端

- `types.ts`：HistoryMessage + `line_index?` / `editable_text?`；新增 HistoryEditAuditEntry。
- `historyStore.ts`：normalize 新字段；actions：updateMessage / deleteMessage / insertMessage / restoreBackup / listEditAudit；成功后写审计行 + 更新 activeSession/sessions + 收藏快照同步；`history_file_changed` → 自动 reload + 提示重试。
- `SessionDetailPane.tsx`：气泡 hover 操作栏（复制/编辑/删除/插入），编辑态 textarea（预填 editable_text），插入行内小表单（角色选择默认 user）；操作仅在 `editable_text != null && line_index != null && !favoriteSnapshot` 时可用。头部新增「编辑记录」入口。
- 新组件 `EditAuditModal.tsx`：审计列表 + before/after diff（复用 react-diff-view createPatch 渲染）+ 还原备份按钮。
- 活跃会话警告：操作前检查 `terminalStore.sessions.some(s => s.cliSessionId === session_id)` → 确认弹窗。
- i18n zh/en 全量补齐。

## 测试（cargo test，history_edit.rs 内）

1. line_index 映射正确（混合跳过行）
2. editable_text：Claude string / blocks 混合 image / thinking-only=None / tool_use=None；Codex input_text/output_text
3. Claude 编辑 string 与 blocks（保留 image 块）
4. Claude 删除重链 parentUuid（含多子行）
5. Claude 插入链接 uuid 链
6. Codex 编辑/删除/插入同步 event_msg 配对
7. fingerprint 不匹配拒写；行冲突拒写
8. 备份仅创建一次；restore 还原
9. 原子写后文件行数/其他行字节不变（除目标行）

## 风险与缓解

- `scan_session_inner` 影响面 HIGH（4 条链路共用）→ 纯增量改动 + 全量 cargo test 回归。
- 编辑活跃会话可能被 CLI 覆写 → fingerprint 守卫 + 警告弹窗（用户知情）。
- resume 生效性 → 用户人工在真实 CLI 验收（AI 不启动应用）。
