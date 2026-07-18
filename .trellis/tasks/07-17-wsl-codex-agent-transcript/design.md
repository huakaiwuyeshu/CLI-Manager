# WSL Codex 子 Agent Transcript 故障分析与修复方向

## 问题现象

WSL Codex/Trellis 能创建多个子任务分屏，但分屏长期停留在 `PENDING`，Windows 原生 Codex 不复现。

## 根因

Hook 已提供 `WSL_DISTRO_NAME`，前端也已解析发行版，但调用 `codex_subagent_transcript_discover` 时丢失该上下文。Rust 因此默认扫描 Windows `%USERPROFILE%\.codex\sessions`，而真实 rollout 位于 WSL 用户的 `$HOME/.codex/sessions`。有界重试持续扫描错误目录，所以无法升级分屏内容。

## 修改方向

- 前端向 discovery 透传 `wslDistroName` 和 `parentTranscriptPath`。
- 后端优先从父 transcript 定位实际 sessions 根，避免 WSL 默认用户与运行 Codex 的用户不同。
- 无父路径时解析 WSL `$HOME/.codex/sessions`；显式配置目录继续优先。
- WSL 目录枚举通过 `wsl.exe find`，结果转换为 UNC 后复用现有 tail。
- 保持 `agentId + parent_thread_id` 关联校验，不扫描或展示无关终端输出。

## 路径范围

- Linux：`/root/.codex/sessions/...`
- WSL UNC：`\\wsl.localhost\...`、`\\wsl$\...`
- Windows 配置目录：转换为 `/mnt/<drive>/...`

## 验证

- `cargo test subagent_transcript --lib`
- `cargo check`
- `npx tsc --noEmit`
- WSL Codex 并行三个子任务桌面实测

