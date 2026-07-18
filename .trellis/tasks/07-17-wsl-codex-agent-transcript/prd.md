# 修复 WSL Codex 子 Agent transcript 发现

## Goal

修复 Windows 宿主上的 CLI-Manager 无法发现 WSL 内 Codex 子 Agent rollout，导致分屏长期停留在 PENDING 的问题。

## Changelog Target

`[TEMP]`

## Requirements

- Codex discovery 接收 WSL 发行版和父 transcript 路径。
- WSL 场景在正确的 Linux sessions 根中查找 rollout，不误扫 Windows 用户目录。
- 使用 `agentId` 筛选并以 `parent_thread_id` 校验父会话。
- Windows 原生 Codex、Claude 子 Agent 和父 transcript 隔离行为保持不变。

## Acceptance Criteria

- [ ] WSL Codex 并行子任务分屏能从 PENDING 升级并显示各自 rollout。
- [ ] Windows 原生 Codex discovery 不回归。
- [ ] Rust 相关测试、`cargo check` 和前端类型检查通过。

