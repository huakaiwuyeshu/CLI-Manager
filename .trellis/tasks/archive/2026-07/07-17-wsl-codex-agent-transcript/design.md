# WSL Codex 子 Agent Transcript 故障分析与修复方向

## 问题现象

Windows 宿主上的 CLI-Manager 启动 WSL Codex 后，Trellis 可以成功拆分多个子任务，CLI-Manager 也能收到 `SubagentStart` 并创建对应分屏，但所有分屏长期停留在 `PENDING`：

```text
已捕获子 Agent 事件，正在等待独立 transcript。
CLI-Manager 只会按当前父会话关联发现对应 transcript，不会扫描无关终端输出。
```

Windows 原生 Codex 不复现。

## 根因

问题位于 Hook 事件到 Rust Codex rollout discovery 的跨平台边界。

1. WSL Hook 已提供 `WSL_DISTRO_NAME`，前端也能解析出 `resolvedWslDistroName`。
2. `openSubagentTranscript` 调用 `codex_subagent_transcript_discover` 时只传递父会话 ID、Agent ID 和 Codex 配置目录，没有传递 WSL 发行版与父 transcript 路径。
3. Rust discovery 因缺少 WSL 上下文，默认扫描 Windows 进程用户的 `%USERPROFILE%\.codex\sessions`。
4. 实际子 Agent rollout 位于 WSL 用户的 `$HOME/.codex/sessions`，因此每次 discovery 和有界重试都返回空。
5. 分屏创建依赖 Hook 事件，所以 UI 能正常出现；内容升级依赖 rollout discovery，所以一直保持 `PENDING`。

单纯增加重试无法解决该问题，因为重试持续扫描的是错误目录。

## WSL 路径边界

需要同时识别以下路径形式：

| 类型 | 示例 |
|---|---|
| Linux 原生路径 | `/root/.codex/sessions/...` |
| WSL 标准 UNC | `\\wsl.localhost\Ubuntu\root\.codex\sessions\...` |
| WSL 兼容 UNC | `\\wsl$\Ubuntu\root\.codex\sessions\...` |
| Windows 配置目录 | `C:\Users\user\.codex`，在 WSL 中转换为 `/mnt/c/Users/user/.codex` |

WSL 目录枚举不能依赖 Windows `fs::read_dir`。按照 `wsl-path-contracts.md`，目录发现应通过 `wsl.exe -d <distro> find ...` 完成，匹配出的 Linux 文件路径再转换为 WSL UNC，交给现有 transcript tail 读取。

## 修复方向

### 前端

`src/stores/terminalStore.ts` 调用 `codex_subagent_transcript_discover` 时增加：

- `wslDistroName`：确定目标 WSL 发行版。
- `parentTranscriptPath`：从父 rollout 反推出实际 sessions 根，避免 WSL 默认用户与运行 Codex 的用户不同。

### Rust 后端

`src-tauri/src/commands/subagent_transcript.rs` 的 Codex discovery 按以下优先级解析 sessions 根：

1. 用户明确配置的 `codexConfigDir`。
2. 父 transcript 路径中的 `/sessions/` 根。
3. 目标 WSL 发行版的 `$HOME/.codex/sessions`。
4. 没有 WSL 上下文时保持原有 Windows/Linux 原生目录逻辑。

候选文件仍按 `agentId` 筛选，并读取首行 `session_meta.payload.parent_thread_id` 校验父会话，禁止扫描结果串到无关终端。

## 风险控制

- 不使用父 transcript 冒充子 Agent 内容。
- 不扫描未关联的终端输出。
- 不修改 pane tree、分屏 UI 或 transcript 解析器。
- 不猜测默认 WSL 发行版；缺少 WSL 上下文时继续安全降级。
- Windows 原生 Codex 和 Claude 子 Agent 保持原有逻辑。

## 验证要求

- WSL Codex 并行启动三个子 Agent，三个分屏分别从 `PENDING` 升级并显示自己的 rollout。
- 日志中的 Codex discovery 根指向父 transcript 对应的 WSL sessions 根，而不是 Windows `%USERPROFILE%\.codex\sessions`。
- 覆盖 Linux路径、`\\wsl.localhost`、`\\wsl$`、Windows盘符配置目录和默认 WSL `$HOME`。
- `cargo test subagent_transcript --lib`、`cargo check`、`npx tsc --noEmit` 通过。
