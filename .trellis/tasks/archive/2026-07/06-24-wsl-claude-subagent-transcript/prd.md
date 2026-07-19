# WSL Claude Subagent Transcript

## Goal

在 Windows + WSL 运行 Claude Code 时，让 CLI-Manager 的子 Agent 分屏能够读取并展示独立子 Agent transcript，而不是降级为“只检测到父会话 transcript，仅保留子任务状态”。

## What I Already Know

* 用户当前在 WSL 子任务分屏看到降级提示：Claude Code 未暴露独立子 Agent transcript。
* 实时子 Agent 面板由 hook 事件驱动：`SubagentStart` / `AgentToolStart` 打开或更新分屏，`SubagentStop` / `AgentToolStop` 标记结束。
* 前端不会把父会话 transcript 当作子任务输出渲染；这是现有规约要求，避免重复显示主会话内容。
* 后端 `subagent_transcript_subscribe` 当前优先使用显式 `agentTranscriptPath`，否则用 `cwd + sessionId + agentId` 推导 `.claude/projects/<cwd-slug>/<sessionId>/subagents/agent-<agentId>.jsonl`。
* `src-tauri/src/commands/subagent_transcript.rs` 顶部注释明确写着 WSL 暂不支持。
* 项目已有 WSL 路径规约：访问 WSL 文件系统时不能依赖 Windows 原生目录枚举，应优先用 `wsl.exe` 规避 Plan 9 限制。
* `src-tauri/src/wsl.rs` 已提供 Windows 路径转 `/mnt/<drive>`、WSL UNC 解析、Linux 路径转 UNC、定位 `wsl.exe` 等工具。

## Assumptions

* Claude Code 在 WSL 内生成的子 Agent transcript 路径可能是 Linux 路径，例如 `/home/<user>/.claude/...` 或基于 `/mnt/<drive>/...` 的项目 slug。
* MVP 不应改动前端“不要渲染父 transcript”的保护逻辑。
* 最小可行方案优先补后端路径解析/订阅能力，并保留现有前端事件流。

## Requirements

* 支持 WSL 场景下的独立子 Agent transcript 路径解析。
* 当 hook payload 提供独立 `agentTranscriptPath` 时，能读取 WSL/Linux 路径对应的 JSONL。
* 当 hook payload 没有独立路径但有 `cwd/sessionId/agentId` 时，能按 WSL cwd 推导子 Agent JSONL 路径。
* 不允许把父会话 transcript 当作子 Agent 输出渲染。
* 失败时继续优雅降级为 pending/lifecycle-only/parent-jsonl 状态，不影响主终端。

## Acceptance Criteria

* [ ] WSL 下触发 Claude 子 Agent 时，分屏显示子 Agent JSONL 内容而不是固定降级提示。
* [ ] 非 WSL Windows 本地路径行为保持兼容。
* [ ] 父 transcript 与子 transcript 路径相同或缺失时，仍不渲染父会话内容。
* [x] Rust 单测覆盖 WSL 路径推导/解析的核心情况。
* [x] `cd src-tauri && cargo test` 或至少相关 Rust 测试通过。
* [x] `npx tsc --noEmit` 通过，若前端类型受影响。

## Definition of Done

* 代码改动遵循 `cli-hook-contracts.md` 和 `wsl-path-contracts.md`。
* 后端边界对缺失字段、不可解析路径、`wsl.exe` 不可用有明确错误或降级。
* 不新增依赖。
* 验证命令通过或明确说明无法验证的原因。

## Out of Scope

* 不修改 Claude Code 本身的 transcript 格式。
* 不渲染或过滤父会话 transcript 作为子任务输出。
* 不做历史回放里的子任务 transcript 关联。
* 不新增用户设置项。

## Technical Notes

* 相关文件：
  * `src-tauri/src/commands/subagent_transcript.rs`
  * `src-tauri/src/hook_client.rs`
  * `src-tauri/src/claude_hook.rs`
  * `src-tauri/src/wsl.rs`
  * `src/stores/terminalStore.ts`
  * `src/components/terminal/SubagentTranscriptView.tsx`
* 相关规约：
  * `.trellis/spec/backend/cli-hook-contracts.md`
  * `.trellis/spec/backend/wsl-path-contracts.md`
* 影响分析：
  * `subagent_transcript_subscribe`：GitNexus 风险 LOW，未发现上游直接调用符号。
  * `resolve_transcript_path`：GitNexus 风险 LOW，直接影响 `subagent_transcript_subscribe` 和现有单测。
  * `try_notify`：GitNexus 风险 LOW，直接上游为 `run_and_exit`，最终入口为 `main`。
  * `openSubagentTranscript` / `subagent_transcript_discover`：GitNexus 当前索引未命中符号，已用直接代码阅读确认调用面。

## Technical Approach

推荐最小方案：

* hook 客户端透传 WSL 发行版名（优先 `WSL_DISTRO_NAME`），保持现有 payload 向后兼容。
* 后端订阅/发现命令在收到 Linux 绝对路径或 WSL cwd 时，使用发行版名把 Linux 路径转换为 `\\wsl.localhost\<distro>\...` 形式作为 tail 路径；目录发现仍按 WSL 规约通过 `wsl.exe find`，避免 UNC 目录枚举不可靠。
* 前端只把 `wslDistroName` 从 hook payload 转发给 subscribe/discover；不改变父 transcript 保护逻辑。

## Decision (ADR-lite)

**Context**: WSL 下 Claude Code 运行在 Linux 文件系统，当前后端只会按 Windows home/cwd 推导子 Agent JSONL，导致独立 transcript 订阅失败。

**Decision**: 在现有 hook payload 和 transcript command 上补充 WSL 发行版上下文，后端完成路径解析和 WSL 感知发现；前端保持现有 source 状态机。

**Consequences**: 改动面集中在 hook payload、Rust transcript command、前端调用参数。多发行版场景依赖 hook 环境提供 `WSL_DISTRO_NAME`；若缺失则继续优雅降级。
