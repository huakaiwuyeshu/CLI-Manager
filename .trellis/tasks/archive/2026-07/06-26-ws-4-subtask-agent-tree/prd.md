# WS-4 子任务树 / Agent 调用树增强

## Goal

将历史详情中的「子任务」页从当前基于消息正则识别的线索列表，升级为结构化的主会话 + 子 Agent 调用树。用户应能在一次 Claude Code / Codex CLI 历史会话中看清主任务和子任务的层级关系、状态、耗时、Token、改动文件、错误和最终摘要，并能点击节点定位到对应历史消息。

本任务不是“为了完成 WS-4 而堆功能”，而是要把 **历史会话复盘能力** 设计成后续 WS-5 文件变更时间轴、WS-6 上下文窗口仪表盘、WS-7 工具调用瀑布图都能复用的结构化历史分析底座。

---

## Product Value

用户现在能看到历史会话原文、过程时间线和 diff，但仍然无法回答这些问题：

- 主任务到底派生了哪些子 Agent / 子任务？
- 每个子任务是否成功？失败在哪里？
- 哪个子任务消耗了最多 Token？
- 哪个子任务修改了文件？修改了多少？
- 哪个子任务最终结论是什么？
- 点击某个子任务后，能否定位到它在历史 transcript 中的上下文？

WS-4 的产出应让用户从“看一堆日志”升级到“看一棵可解释的 Agent 调用树”。

---

## Background

当前代码已有基础能力：

- `SessionSubtaskTreeView` 已作为历史详情 tab 存在，但只展示 `sessionEvents.ts` 中由 `SUBTASK_PATTERN` 推断出来的 flat `subtaskEvents`。
- `history_get_session` 返回 `HistorySessionDetail { messages, usage, tool_events }`，并支持 `aggregate_subtasks`，但目前会把 parent + child transcript 扁平合并，丢失 provenance。
- Claude 历史子 Agent 可从 `parent_dir/subagents/agent-*.jsonl` 发现。
- Codex `parent_thread_id` 发现逻辑已存在于 live transcript 路径 `subagent_transcript.rs`，但尚未接入历史详情。
- WS-3 已完成历史详情「过程」时间线，`sessionEvents.ts`、`SessionTimelineView` 等可复用事件建模和 UI pattern。

---

## Design Principles

本任务的开发方案必须遵循以下设计原则。任何实现细节如果和这些原则冲突，应优先调整实现，而不是为了赶进度绕过原则。

### 1. Architecture-first, not feature-patching

每个功能点都必须回答：

- 它属于哪个架构层？Rust history parser、frontend store、view model、还是 UI？
- 它是否扩大了现有核心类型或核心 command 的职责？
- 它是否会影响其他历史详情 tab？
- 它是否能作为后续历史分析能力的通用基础？

WS-4 的目标不是在 `SessionSubtaskTreeView` 中继续写更多正则和 UI 分支，而是建立清晰的数据边界：

```text
Raw history files → Rust tree extraction API → frontend store/cache → view model → Subtask tree UI
```

### 2. Keep core contracts stable

`HistorySessionDetail` 是历史详情基础契约，被 Timeline / Tools / Changes / Context / Stats 等多处依赖。不能为了 WS-4 随意扩展它，使其继续膨胀。

因此：

- `history_get_session` 保持基础详情职责。
- `HistorySessionDetail` 不新增 WS-4 专属字段。
- 子任务树使用独立 API 按需加载。

### 3. Reuse before creating new logic

实现前必须优先复用或抽取现有能力：

- 会话文件校验 / roots / path scope：复用 `history.rs` 现有 session file validation。
- Claude 子 Agent 文件发现：复用 `collect_subtask_session_file_refs` 相关逻辑。
- Codex parent-thread 判断：后续复用 / 抽取 `subagent_transcript.rs` 中 `parent_thread_id` discovery 逻辑。
- token / cost / model stats：复用现有 `SessionStatsScan` / usage helpers。
- 工具事件解析：复用 `scan_tool_events`，不要重新解析 tool JSON。
- 前端跳转：复用 `onJumpToMessage` / `openSessionAtMessage` 既有链路。
- UI pattern：复用 WS-3 Timeline 的 toolbar/filter/chip/expand details 风格。

新 helper 只有在现有逻辑无法表达“树节点聚合”时才新增，并应保持小而可测试。

### 4. Single responsibility per layer

- Rust backend：负责从可信本地历史文件中识别 parent/child 关系，计算稳定的 tree payload。
- Frontend store：负责按 sessionKey lazy-load、缓存、loading/error 状态。
- `sessionEvents.ts`：继续负责时间线 / 过程模型，不承载子任务树主数据源。
- `SessionSubtaskTreeView`：只负责渲染 tree、filter、expand/collapse、click jump，不做 raw transcript parsing。

### 5. Conservative inference

状态、文件数、summary 等字段在 MVP 中可能来自启发式推断。必须保守：

- 有强错误信号才标记 failed。
- 无法判断时使用 unknown，不要假装 success。
- 文件数是 estimated modified file count，不作为权威 diff source。
- summary 使用最后有效 assistant / 非空消息压缩，不能生成模型式总结。

### 6. Performance by default

子任务树计算可能读取多个 transcript 文件，因此必须按需加载：

- 打开历史详情不触发 tree scan。
- 进入「子任务」tab 才调用 tree API。
- 同一 sessionKey 结果在 store 中缓存。
- MVP 不做递归无限扫描，不全量扫描 Codex sessions。

### 7. Testability and observability

每个新增 backend helper 应可通过小 fixture 测试：

- parent + child discovery
- message index range
- error/status inference
- file count inference
- no-child fallback

前端必须通过 typecheck，并支持手动验证 loading / error / fallback / structured tree 四种状态。

---

## Architecture Decision: Separate Subtask Tree API

原始方案是在 `HistorySessionDetail` 上新增 optional `subtask_tree`。经过 GitNexus impact analysis 后，`HistorySessionDetail` 被判定为 CRITICAL，因为它是前端历史详情核心类型，被大量文件 import / 间接依赖。

因此 WS-4 采用更符合整体架构的方案：**新增独立的 subtask tree 查询命令，历史详情基础 payload 不变**。

推荐新增：

```text
history_get_session_subtask_tree(filePath, source, projectKey, claudeConfigDir?, codexConfigDir?)
```

该决策不只是为了规避 CRITICAL 风险，更是因为它符合职责边界：

- `history_get_session`：基础历史详情，轻量、稳定、被多个 tab 共享。
- `history_get_session_subtask_tree`：子任务树分析，较重、按需、只服务子任务页和后续 Agent tree 能力。

优势：

- 不修改 `HistorySessionDetail`，保持核心契约稳定。
- 子任务树按需加载，只在进入「子任务」tab 时请求，避免每次打开历史详情都扫描子 Agent transcript。
- 后端职责更清晰，避免一个 command 无限膨胀。
- 前端可独立维护 loading / error / cache 状态，不影响 Timeline / Tools / Changes / Context。
- 未来 Codex `parent_thread_id` 支持可直接接入同一个 tree API，无需再扩大基础 detail schema。

---

## Requirements

### Structured tree data

- 新增后端命令 `history_get_session_subtask_tree` 返回结构化 `HistorySubtaskTree | null`。
- 根节点表示主会话，children 表示子 Agent / 子任务。
- MVP 优先支持 Claude 子 Agent：`subagents/agent-*.jsonl`。
- 保留现有 `history_get_session` 返回结构和行为，不新增 `HistorySessionDetail.subtask_tree`。
- 保留当前 regex inferred `subtaskEvents` 作为 fallback。

### Node metadata

每个节点至少包含：

- 节点 id、parent id、session id、source、kind
- title、file path、cwd、transcript path
- status：success / failed / running / unknown
- started / ended / duration
- message count
- message index range，用于点击后跳转 transcript
- token usage：input / output / cache / total / cost / dominant model
- modified file count
- error count 与错误摘要
- final summary
- children

### UI behavior

- 历史详情 → 子任务 tab 首次打开时按需加载 structured tree。
- 加载成功且 tree 存在时优先展示 structured tree。
- 加载失败或 tree 不存在时展示现有 heuristic fallback，并明确提示是历史消息线索。
- 支持展开 / 折叠节点。
- 支持全部展开 / 全部折叠。
- 支持筛选：失败、高 Token、有文件修改。
- 筛选命中子节点时保留 ancestor path。
- 点击节点时，如果 `message_index_range.start` 存在，跳转到对应 transcript 消息。
- 节点展示状态、kind、duration、tokens、files、errors、summary。

### i18n and style

- 新增所有前端可见文案的中文和英文。
- 样式沿用 `ui-session-process-*` / `ui-session-subtask-*`，不引入新 UI 框架。

---

## Non-goals / Out of Scope

- 不在 MVP 中实现 Codex `parent_thread_id` 历史树接入，但 schema 预留 `kind = codex_thread`。
- 不实现 live-running 状态同步；历史树基于已有 transcript 文件生成。
- 不新增独立 transcript modal；点击节点先复用现有 message jump。
- 不修改 `HistoryToolEvent` 结构。
- 不修改 `HistorySessionDetail` 结构。
- 不把子任务树逻辑塞进 `sessionEvents.ts` 的时间线事件推导中。

---

## Proposed Technical Plan

### Backend

修改 `src-tauri/src/commands/history.rs`：

- 新增 `HistorySubtaskTree`、`HistorySubtaskNode`、`HistorySubtaskUsage`、`HistoryMessageIndexRange`。
- 新增 Tauri command：`history_get_session_subtask_tree(...) -> Result<Option<HistorySubtaskTree>, String>`。
- 新命令复用现有 session file validation / roots / scanning 逻辑。
- 新增 `build_history_subtask_tree(...)`，基于 parent session + Claude child refs 生成 tree。
- 新增 provenance-aware merge helper，仅用于 tree API 内部，记录每个 node 在按时间合并后的 transcript 中的 message index range。
- 新增 helper 估算 modified file count、错误摘要、状态、final summary。
- 不改变 `history_get_session` 的既有返回 schema 和基础行为。

同时需要在 `src-tauri/src/lib.rs` 注册新 command。

### Frontend types/store

修改或新增：

- `src/lib/types.ts` 或新增 `src/lib/historySubtasks.ts`
- `src/stores/historyStore.ts`

新增 TS types：

- `HistorySubtaskStatus`
- `HistorySubtaskUsage`
- `HistoryMessageIndexRange`
- `HistorySubtaskNode`
- `HistorySubtaskTree`

在 `historyStore` 中新增独立状态和 action：

- `activeSubtaskTree: HistorySubtaskTree | null`
- `loadingSubtaskTree: boolean`
- `subtaskTreeError: string | null`
- `subtaskTreeCache: Record<string, HistorySubtaskTree | null>`
- `loadActiveSessionSubtaskTree()`

缓存按 `sessionKey` 存储，避免在同一会话多次切换 tab 时重复请求。

### Process model

修改 `src/components/history/sessionEvents.ts`：

- 保留 `SessionProcessModel.subtaskEvents` 作为 regex fallback。
- 不把 structured tree 塞进 `SessionProcessModel`，避免扩大它的职责。
- `SessionSubtaskTreeView` 单独接收 tree 和 fallback events。

### Detail pane / workspace glue

修改：

- `src/components/HistoryWorkspace.tsx`
- `src/components/history/SessionDetailPane.tsx`

目标：

- 当 detail view 切到 `subtasks` 时触发 `loadActiveSessionSubtaskTree()`。
- 将 `activeSubtaskTree / loadingSubtaskTree / subtaskTreeError` 传给 `SessionSubtaskTreeView`。
- 保留 `processModel.subtaskEvents` fallback。

### UI

修改 `src/components/history/SessionSubtaskTreeView.tsx`：

- structured tree 优先渲染。
- fallback flat clues 保留。
- 新增 loading / error / empty states。
- 新增 expand/collapse、filters、node metrics、selected state、jump behavior。

修改：

- `src/lib/i18n.ts`
- `src/styles/components.css`

补中英文文案和树样式。

---

## Reuse Checklist

实施前和 review 时必须逐项确认：

- [ ] session file validation 复用现有 `history.rs` 逻辑，没有引入新的不受控路径读取。
- [ ] Claude child discovery 复用 / 包装现有 `collect_subtask_session_file_refs`。
- [ ] token/cost/model 统计复用现有 stats scan，不重新发明 token parser。
- [ ] tool event 复用现有 `scan_tool_events`，不重复解析工具调用 JSON。
- [ ] 前端跳转复用 `onJumpToMessage`。
- [ ] UI 复用 `ui-session-process-*` 风格和 WS-3 filter/chip 模式。
- [ ] fallback 复用现有 `subtaskEvents`，不删除老能力。

---

## Compliance Checklist

- [ ] 不修改 `HistorySessionDetail`。
- [ ] 不修改 `HistoryToolEvent`。
- [ ] 新 Tauri command 在 Rust 侧校验路径 scope，不信任前端传入路径。
- [ ] 新 command 在 `src-tauri/src/lib.rs` 注册。
- [ ] 所有新增前端可见文案都有中文和英文。
- [ ] React state 最小化：tree 数据在 store，expand/filter/selected 是 view-local state。
- [ ] 不使用 `dangerouslySetInnerHTML`。
- [ ] 大 session 不默认扫描子任务树，必须 lazy-load。

---

## Acceptance Criteria

### Data / backend

- [ ] `history_get_session` 返回结构不变。
- [ ] 新增 `history_get_session_subtask_tree` 能对 Claude 父会话返回 `HistorySubtaskTree | null`。
- [ ] 对 Claude 父会话，能从 `subagents/agent-*.jsonl` 构建 root + children tree。
- [ ] 每个结构化节点包含可用的 `id / parent_id / session_id / kind / title / status / usage / modified_file_count / error_count / final_summary / children`。
- [ ] 子节点包含可定位的 `message_index_range`；range 指向合并后 transcript 中有效的消息下标。
- [ ] 不修改 `HistorySessionDetail` 和 `HistoryToolEvent` 结构。

### UI / interaction

- [ ] 打开历史详情时不额外加载 subtask tree；进入「子任务」tab 后才按需加载。
- [ ] 打开有 Claude 子 Agent 的父会话时，历史详情 → 子任务页展示 root + children tree。
- [ ] 子节点显示状态、耗时、Token、文件数、错误数、摘要；空值显示明确 fallback，不出现 `undefined` / `NaN`。
- [ ] 点击子节点能跳转到对应 transcript message range；无 range 的节点不会报错。
- [ ] 单节点展开 / 折叠正常；全部展开 / 全部折叠正常。
- [ ] 失败 / 高 Token / 修改文件筛选正常，并在命中子节点时保留 ancestor path。
- [ ] 没有 structured tree 的会话仍显示现有 heuristic fallback，并有明确说明。
- [ ] Timeline / Tools / Changes / Context 不回归。
- [ ] 中英文文案完整，切换语言后所有新增 UI 文案同步变化。

### Quality gates

- [ ] GitNexus impact analysis 已在编辑核心 symbols 前完成，且无未处理的 HIGH / CRITICAL 风险；若有 CRITICAL，已说明并采用规避方案。
- [ ] `npx tsc --noEmit` 通过。
- [ ] `cd src-tauri && cargo test history` 或等价 history 相关 Rust 测试通过。
- [ ] `gitnexus detect-changes` 已执行，影响面符合预期。

---

## Verification Plan

### 1. Pre-edit safety

1. 在 `F:/github/CLI-Manager` 运行 GitNexus impact analysis：
   - `history_get_session_subtask_tree`（新增后）
   - `build_history_subtask_tree`（新增后）
   - `history_get_session`
   - `build_session_detail`
   - `collect_subtask_session_file_refs`
   - `HistoryWorkspace`
   - `SessionDetailPane`
   - `SessionSubtaskTreeView`
2. 避免修改 `HistorySessionDetail`；如必须修改，需重新评估 CRITICAL 风险。

### 2. Automated checks

1. 前端类型检查：
   ```bash
   cd F:/github/CLI-Manager
   npx tsc --noEmit
   ```
2. Rust history 测试：
   ```bash
   cd F:/github/CLI-Manager/src-tauri
   cargo test history
   ```
3. 变更影响检查：
   ```bash
   cd F:/github/CLI-Manager
   npx gitnexus detect-changes --repo "F:\\github\\CLI-Manager"
   ```

### 3. Backend behavior verification

1. 使用测试 fixture 或本地真实历史数据，确认 Claude parent 会话下的 `subagents/agent-*.jsonl` 被识别为 children。
2. 检查 `HistorySubtaskTree.root.children.length > 0`。
3. 检查每个 child 的 token、duration、error、file count、summary 字段有稳定 fallback。
4. 检查 `message_index_range.start/end` 在合并视图范围内有效。
5. 直接打开 child transcript 时，不递归把 sibling subagents 当作 children。
6. 打开无子 Agent 的普通会话时，新 command 返回 `null` 或 root-only empty tree，前端不报错。

### 4. Manual UI verification

1. 启动应用：
   ```bash
   cd F:/github/CLI-Manager
   npm run tauri dev
   ```
2. 打开一个包含 Claude 子 Agent 的历史父会话。
3. 进入 `历史详情 → 子任务`。
4. 验证子任务页出现 loading，然后展示 root 和 child 节点。
5. 验证节点上状态、耗时、Token、文件数、错误数、摘要显示正确。
6. 点击 child 节点，确认 transcript 定位到对应消息。
7. 测试单节点展开 / 折叠、全部展开 / 全部折叠。
8. 分别启用失败 / 高 Token / 修改文件筛选，确认结果和 ancestor path 正确。
9. 打开一个没有 structured tree 的普通会话，确认 fallback 线索视图正常。
10. 切换中文 / 英文，确认新增文案完整。
11. 回归 WS-3：检查 `过程 / Timeline`、`工具 / Tools`、`变更 / Changes`、`上下文 / Context` tab 正常。

---

## Risks

- 新增 command 需要在 `src-tauri/src/lib.rs` 注册；遗漏会导致前端 invoke 失败。
- tree API 会额外扫描 child transcript；通过 tab lazy-load 和缓存降低影响。
- file count / status / summary 初版是 conservative inference，不能当作完全权威事实。
- 大会话 + 多子 Agent 可能增加读取成本；MVP 不做递归扫描和 Codex 全量 discovery。
