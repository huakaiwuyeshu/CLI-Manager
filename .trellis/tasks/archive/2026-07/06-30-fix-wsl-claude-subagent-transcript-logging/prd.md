# 修复 WSL Claude 子任务 transcript 发现并增强日志

## Goal

修复 Claude Code 在 WSL 环境下没有拿到独立子任务 transcript 时的发现/推导路径，并增强 Claude/Codex 子任务链路日志，便于下次定位 hook payload、路径推导、订阅和 replay 写入问题。

## Requirements

* 当 Claude hook 只产生 `ToolStart`/`ToolStop` 但携带 `agentId/sessionId/cwd` 时，也进入子任务 transcript 处理链路。
* WSL UNC cwd（如 `\\wsl.localhost\Ubuntu\...`）在 `wslDistroName` 缺失时，从 cwd 推导 distro 作为 fallback。
* 子任务 transcript 推导/发现失败时保留降级状态，不渲染父会话 transcript 为子任务内容。
* Codex 子任务 rollout transcript 发现增加更明确日志：root、agentId、候选数、parentThreadId 匹配情况。
* AI replay 事件写入避免 `MAX(event_index)+1` 并发竞争导致唯一键冲突，并添加冲突/重试日志。

## Acceptance Criteria

* [ ] WSL Claude `ToolStart/ToolStop` + `agentId` 能打开/更新子任务 transcript pane，并尝试推导 `subagents/agent-<agentId>.jsonl`。
* [ ] `wslDistroName=null` 且 cwd 是 WSL UNC 时，后端/前端日志能看到 fallback distro。
* [ ] 找不到独立 transcript 时仍显示降级提示，不重复显示父会话正文。
* [ ] Codex 子任务发现日志包含 root、agentId、候选检查和未找到原因。
* [ ] `npx tsc --noEmit` 通过。
* [ ] `cd src-tauri && cargo check` 通过。

## Definition of Done

* 遵守 CLI Hook 与 WSL Path contracts。
* 不新增依赖。
* 不启动 Tauri 桌面应用。
* 保留现有 hook payload schema 兼容性。

## Technical Approach

* 前端 `App` hook listener 将 Claude `ToolStart/ToolStop` 且带 `agentId` 的事件纳入子任务处理。
* 前端 `terminalStore` 放宽 Claude 派生订阅触发条件，并在调用后端时传入从 WSL UNC cwd 推导出的 distro fallback。
* 后端 `subagent_transcript` 在 `wsl_distro_name` 缺失时从 cwd 解析 WSL UNC distro，并增加关键路径日志。
* `replayStore` 写入 event_index 时使用短重试，遇到唯一键冲突重新读取 max index 后再写入。

## Decision (ADR-lite)

Context: Claude Code 在某些 WSL hook 场景只暴露父 transcript，且日志事件是 `ToolStart/ToolStop`，现有逻辑只处理 AgentTool/Subagent 事件。
Decision: 保守地只对 `source=claude && ToolStart/ToolStop && agentId` 扩展子任务路径，不把普通工具事件当子任务。
Consequences: 可覆盖当前日志中的真实场景，同时避免普通工具调用创建子任务 pane。

## Out of Scope

* 不修改 Claude Code 自身 transcript 生成行为。
* 不扫描无关会话或全量历史目录。
* 不改 UI 文案和视觉样式。

## Technical Notes

* Log sample: `agentTranscriptPath=null`, `transcriptPath=/home/silver/.claude/projects/-data-test-sys/<session>.jsonl`, `cwd=\\wsl.localhost\Ubuntu\data\test\sys`, `wslDistroName=null`。
* Relevant specs: `.trellis/spec/backend/cli-hook-contracts.md`, `.trellis/spec/backend/wsl-path-contracts.md`, `.trellis/spec/frontend/state-management.md`, `.trellis/spec/frontend/quality-guidelines.md`。
