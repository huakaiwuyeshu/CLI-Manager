# 优化历史会话功能

## Goal

提升历史会话的加载速度、可定位性与阅读体验：减少首次/刷新扫描耗时，让用户能看到并复制 sessionId 以便恢复会话，同时补齐 ESC 关闭、代码块高亮、历史 Prompt 展示和更清晰的 Diff 对比。

## What I already know

* 用户明确提出 6 个问题：扫描慢、看不到 sessionId、关闭按钮缺 ESC、消息代码没有代码块/高亮、历史 Prompt 库未用对应组件、Diff 对比不明显。
* 历史入口主要在 `src/components/HistoryWorkspace.tsx`，列表在 `src/components/history/HistoryListPane.tsx`，详情在 `src/components/history/SessionDetailPane.tsx`。
* 状态管理在 `src/stores/historyStore.ts`，前端默认 `history_list_sessions` 一次请求 `DEFAULT_SESSION_LIMIT = 500` 条摘要。
* 后端历史命令在 `src-tauri/src/commands/history.rs`：`history_list_sessions` 递归收集 Claude/Codex jsonl 文件后，对每个文件读取/解析摘要并按更新时间排序。
* 后端已有内存缓存：文件列表 TTL 5 秒、按文件 updated_at 缓存摘要/统计；但首次全量扫描仍可能慢。
* 详情页当前展示标题、来源、项目、分支、更新时间、消息数，但没有显式展示 sessionId，也没有复制 sessionId/文件路径入口。
* 历史面板左侧有“关闭”按钮；`PromptLibrary` 自己用普通绝对层和按钮关闭；`DiffModal` 使用 Radix Dialog，理论上 Dialog 支持 ESC，但外层历史面板本身还没有显式 ESC 关闭策略。
* 会话消息当前用 `<pre>` 纯文本展示，只有搜索命中高亮，没有 Markdown/code fence 识别、代码语言标记或代码块视觉分组。
* 历史 Prompt 库当前用普通 `<pre>` 展示 prompt，没有复用详情消息渲染或 Prompt 专用展示组件。
* DiffModal 已有 worker 解析 diff，也有新增/删除/hunk/header 行级背景，但样式较弱，没有文件级统计、左右/块级强对比或更醒目的 gutter。
* 项目当前依赖里没有 Markdown/语法高亮库；默认不新增依赖，优先用轻量自研分段渲染。

## Assumptions (temporary)

* 本任务优先优化用户可感知体验，不引入新数据库或后台索引服务。
* 不修改 Claude/Codex 原始历史文件，只读取和展示。
* “还原会话”本轮先理解为展示/复制可定位所需的 `sessionId`、source、project、file path，并支持从搜索/Prompt/Diff 跳回对应消息；不承诺重建 CLI 运行时上下文，除非后续明确要求。
* “使用对应组件展示”理解为抽出统一的历史内容渲染组件，让详情消息和 Prompt 库复用，而不是继续各自写 `<pre>`。

## Requirements

* 历史会话列表加载应减少首次和刷新时的无效全量解析；至少要避免为了显示前 500 条而解析超过必要范围的旧文件。
* 历史会话详情应显式展示 sessionId，并提供复制 sessionId 和复制定位信息的操作。
* 历史面板、历史 Prompt 库、Diff 弹层应支持 ESC 关闭；焦点在输入框时不破坏正常输入体验。
* 历史消息内容应识别 Markdown fenced code block，并用代码块样式展示；普通文本保持可换行、可搜索高亮。
* 历史 Prompt 库中的 prompt 应复用同一内容渲染组件，并保留复制与跳转能力。
* Diff 视图应更突出差异：新增/删除行更明显，hunk/header 更易扫读，文件块信息更清晰。
* 改动应尽量局部，不新增依赖，除非后续确认必须引入成熟高亮库。

## Acceptance Criteria

* [ ] 打开历史面板时，列表加载耗时较当前实现下降；至少从实现上减少旧文件无谓解析，并保留现有 source filter / meta / 自动打开首个会话行为。
* [ ] 会话详情顶部能看到 sessionId，能一键复制 sessionId，必要时能复制包含 source/project/filePath 的定位信息。
* [ ] 历史面板打开时按 ESC 可以关闭；Prompt 库和 Diff 视图打开时按 ESC 优先关闭最上层弹层。
* [ ] 含 ``` fenced code block 的历史消息以独立代码块展示，显示语言标签（如果存在），并保留搜索命中高亮。
* [ ] 历史 Prompt 库中的 prompt 与详情消息使用一致的内容展示组件，不再只是裸 `<pre>`。
* [ ] Diff 视图对 `+` / `-` / hunk / file header 的视觉区分明显增强，横向滚动仍正常。
* [ ] `npm run build` 或至少 `npx tsc --noEmit` 通过；Rust 改动至少通过 `cd src-tauri && cargo check`。

## Definition of Done

* Tests/checks run: TypeScript typecheck/build and Rust cargo check where relevant.
* UI golden path manually verified: open history, refresh, open session, copy sessionId, open Prompt 库, open Diff, ESC close.
* No new dependency unless explicitly approved.
* No destructive file operations and no mutation of external Claude/Codex history logs.

## Technical Approach

* Backend scanning: keep existing Rust command shape, improve `history_list_sessions` by collecting file metadata first, sorting by modified time, then only parsing enough candidate files for requested limit/query; preserve cache by file path + updated_at.
* Frontend session identity: add compact metadata row/actions to `SessionDetailPane` for sessionId/source/project/filePath copy.
* ESC close: centralize at `HistoryWorkspace` for base panel and rely on/align modal behavior for topmost Prompt/Diff overlays.
* Content rendering: add a small reusable history content renderer that tokenizes fenced code blocks and renders text/code segments with existing CSS variables; no `dangerouslySetInnerHTML`.
* Prompt library: replace prompt `<pre>` with reusable content renderer.
* Diff visual: keep existing worker parser, strengthen `DiffCodeViewer` styles and add lightweight gutter/line classes/stat summary rather than introducing a diff library.

## Decision (ADR-lite)

**Context**: The feature touches Rust scanning and multiple React history UI surfaces. Existing dependencies do not include Markdown, syntax highlighting, or full diff viewer libraries. The user prefers a fuller component-based rendering result over the minimal no-dependency path.

**Decision**: Use mature frontend components for rendering quality: `react-markdown` for safe Markdown rendering, `react-syntax-highlighter` for code block syntax highlighting, and `react-diff-view` for parsed unified diff display. Keep backend performance work targeted and avoid persistent indexing in this task.

**Consequences**: Visual quality and maintainability improve, but `package.json` / lockfile will change and bundle size increases. Dependency installation and type/build checks are required before implementation is considered done.

## Out of Scope

* Building a persistent SQLite index of all external Claude/Codex history files.
* Reconstructing/rerunning a live Claude/Codex terminal session from historical sessionId.
* Modifying or cleaning external history files under `.claude` / `.codex`.
* Implementing a custom Markdown parser or custom full diff engine.

## Open Questions

* None for current MVP. Dependencies still require explicit implementation approval before installation.

## Technical Notes

* Inspected: `src/stores/historyStore.ts` (`loadSessions`, `openSession`, `loadPrompts`).
* Inspected: `src/components/HistoryWorkspace.tsx` (history shell, prompt/diff overlays, virtual-ish pagination).
* Inspected: `src/components/history/HistoryListPane.tsx` (list header, close, refresh, grouped sessions).
* Inspected: `src/components/history/SessionDetailPane.tsx` (session header, meta editor, message rendering).
* Inspected: `src/components/prompts/PromptLibrary.tsx` (scope filtering, prompt card rendering).
* Inspected: `src/components/history/DiffModal.tsx` and `src/lib/diffParser.worker.ts` (diff parsing/rendering).
* Inspected: `src-tauri/src/commands/history.rs` (session collection, summary scan, prompt scan, stats scan).
* Inspected: `package.json` dependencies; no existing Markdown/highlight/diff-view library.
