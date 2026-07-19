# 修复 WSL Codex 子 Agent transcript 发现

## Goal

修复 Windows 宿主上的 CLI-Manager 无法发现 WSL 内 Codex 子 Agent rollout，导致分屏长期停留在 PENDING 的问题。

## Changelog Target

`[TEMP]`

## Requirements

- Codex 子 Agent discovery 必须接收 Hook 已提供的 WSL 发行版上下文。
- Codex discovery 同时接收父 transcript 路径，并优先从中定位实际 sessions 根。
- WSL 场景通过 `wsl.exe` 获取 Linux `$HOME` 并扫描 `$HOME/.codex/sessions`，不得误扫 Windows 用户目录。
- 使用 `agentId` 筛选 rollout，并以 `session_meta.payload.parent_thread_id` 校验父会话关联。
- 匹配结果转换为 Windows 可读取的 WSL UNC 路径后复用现有 transcript tail。
- Windows 原生 Codex、Claude 子 Agent、父 transcript 隔离和有界重试行为保持不变。
- 不新增依赖，不重构分屏状态机。

## Acceptance Criteria

- [ ] WSL Codex 并行启动多个子 Agent 时，每个分屏能从 PENDING 升级并显示自己的 rollout 内容。
- [ ] discovery 不扫描 Windows `~/.codex/sessions` 代替 WSL sessions 根。
- [ ] `wslDistroName` 缺失时保持现有安全降级，不猜测默认发行版。
- [ ] Windows 原生 Codex discovery 回归测试通过。
- [ ] Rust 相关测试、`cargo check`、前端类型检查通过。

## Technical Approach

- 前端向 `codex_subagent_transcript_discover` 增加 `wslDistroName` 参数。
- 前端同时透传 `parentTranscriptPath`，避免 WSL 默认用户与实际运行用户不同。
- Rust command 在存在发行版时使用 `wsl.exe -d <distro> sh -lc` 定位 `$HOME/.codex/sessions` 并使用 `find` 枚举候选文件。
- WSL 候选文件读取继续使用转换后的 `\\wsl.localhost\<distro>\...` 路径；原生路径沿用现有实现。

## Out of Scope

- 修改 Codex/Trellis 的子任务生成逻辑。
- 扫描或展示无关终端输出。
- 重做 transcript UI 或 pane tree。

## Notes

- 根因与方案已经用户确认。
- 相关规约：`.trellis/spec/backend/cli-hook-contracts.md`、`.trellis/spec/backend/wsl-path-contracts.md`。
