# 修复 Claude 子 Agent transcript 晚到路径升级

## Goal

修复 Claude Code 子 Agent 分屏在独立 child transcript 路径晚于 `SubagentStart` 到达时，CLI-Manager 仍停留在 `parent-jsonl` 降级态的问题；在不渲染父 transcript 作为子输出的前提下，尽量接住晚到的独立 child transcript。

## What I Already Know

* Hook 客户端会透传 `agent_transcript_path`、`transcript_path`、`agent_id`、`tool_use_id` 等字段。
* 前端只在 `agentTranscriptPath` 存在且与父 `transcriptPath` 不同时，才认定为 `child-jsonl` 并订阅独立子 transcript。
* 当前 `SubagentStop` 的“先升级 transcript，再 finish”逻辑只对 `source === "codex"` 且带 `agentTranscriptPath` 的情况生效。
* `cli-hook-contracts.md` 明确禁止把父 transcript 当成子 transcript 正文渲染。
* 项目已有诊断日志，会记录子任务 Hook 是否带 `agentTranscriptPath` / `transcriptPath`。

## Requirements

* Claude `SubagentStop` 若首次携带独立 child transcript 路径，前端必须像 Codex 一样先调用 `openSubagentTranscript(payload)`，等待订阅/回填后再 `finishSubagentTranscript(payload)`。
* 保持现有 `child-jsonl` 判定规则，不允许把父 transcript 当作子 transcript 正文渲染。
* 若 Claude 晚到字段仍为空或与父路径相同，继续维持现有降级行为。
* 尽量最小改动，不改主终端、历史回放和其他 Hook 事件的行为。

## Acceptance Criteria

* [ ] Claude 子 Agent 在 `SubagentStop` 才提供独立 child transcript 路径时，分屏可升级到 child transcript，而不是直接结束在降级提示。
* [ ] Codex 现有 `SubagentStop` 晚到路径升级行为保持不变。
* [ ] 父 transcript 与子 transcript 路径相同或独立路径缺失时，仍不渲染父会话内容为子输出。
* [ ] `npx tsc --noEmit` 通过。

## Definition of Done

* 改动遵守 `.trellis/spec/backend/cli-hook-contracts.md`。
* 不新增依赖。
* 完成必要的静态检查，并列出需要人工验证的 Claude 子任务场景。

## Technical Approach

最小方案：把 `SubagentStop` 的晚到 child transcript 升级逻辑从“仅 Codex”放宽到“任一 source 只要携带独立 `agentTranscriptPath` 就先升级再 finish”，其余 source 判定和保护逻辑保持不变。

## Decision (ADR-lite)

**Context**: 当前前端只对 Codex 做 `SubagentStop` 晚到 child transcript 升级，导致 Claude 若在 stop 阶段才提供独立路径，会直接走 finish，错过订阅与回填。

**Decision**: 复用现有 Codex 分支能力，让 Claude 在满足相同条件时走同一条“先订阅、再结束”的路径；不放宽 `child-jsonl` 判定。

**Consequences**: 修复面集中在前端 Hook 事件路由；如果上游完全不提供独立 child transcript，应用仍只能保留状态降级提示。

## Out of Scope

* 修改 Claude Code 本身的 Hook/transcript 输出格式。
* 用父 transcript 冒充子 transcript 正文。
* 历史回放的子任务 transcript 关联修复。
* 新增设置项或新的 UI 入口。

## Technical Notes

* 相关文件：
  * `src/App.tsx`
  * `src/stores/terminalStore.ts`
  * `src-tauri/src/hook_client.rs`
  * `src-tauri/src/claude_hook.rs`
* 相关规约：
  * `.trellis/spec/backend/cli-hook-contracts.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
