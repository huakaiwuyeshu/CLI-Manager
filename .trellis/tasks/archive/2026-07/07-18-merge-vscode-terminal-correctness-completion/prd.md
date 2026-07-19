# 合并 feat/vscode-terminal-correctness-completion

## Goal

将 `feat/vscode-terminal-correctness-completion` 合并到最新 `master`，保留主分支近期修复，并解决终端正确性改造带来的冲突。

## Changelog Target

`[TEMP]`

## Requirements

- 合并前先将本地 `master` 快进到 `origin/master`。
- 合并目标为本地及远端同一提交 `d366159` 的 `feat/vscode-terminal-correctness-completion`。
- 冲突按语义合并：保留主分支近期变更，同时接入目标分支的终端正确性与性能改造。
- `CHANGELOG.md` 合并记录使用临时版本 `[TEMP]`，不猜测正式版本号。
- 不引入目标分支之外的额外重构或依赖调整。

## Acceptance Criteria

- [x] `master` 包含目标分支 6 个提交，合并完成且无未解决冲突。
- [x] 冲突文件无冲突标记，工作树仅包含预期合并与任务记录。
- [x] 前端类型检查、相关 Node 测试及 Rust 检查通过；若已有基线问题，明确记录。
- [x] 已执行 GitNexus 影响分析与变更检测；索引因 `.gitnexus/lbug` 访问被拒绝不可用，按仓库规则降级为契约文档、直接差异与调用搜索核对。

## Out of Scope

- 不主动启动开发服务器或执行完整 Tauri 构建。
- 不修改与本次合并无关的功能。

## Technical Notes

- 合并前分叉情况：`master` 独有 22 个提交，目标分支独有 6 个提交。
- 目标分支相对共同祖先涉及 87 个文件，约 6966 行新增、1716 行删除。
- 预检测冲突：`.trellis/spec/backend/cli-hook-contracts.md`、`.trellis/tasks/07-17-wsl-codex-agent-transcript/design.md`、`.trellis/tasks/07-17-wsl-codex-agent-transcript/prd.md`、`CHANGELOG.md`、`src-tauri/src/commands/subagent_transcript.rs`、`src/hooks/useTerminalDisplay.ts`。
- 风险等级：高。变更覆盖 PTY daemon、平台适配、终端前端编排与会话恢复，需要针对性验证。
- 验证结果：`npx tsc --noEmit`、23 项相关 Node 测试、`cargo test subagent_transcript --lib`（14 项）及 `cargo check` 均通过；`git diff --cached --check` 通过。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
