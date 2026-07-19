# PTY 守护进程：应用退出后任务继续执行（orca 式，Phase 2）

## Goal

把 PTY 宿主从主进程抽成独立守护进程 `cli-manager-daemon`（参考 stablyai/orca 的 client-server 模型 / tmux 语义）：UI 进程只是客户端，应用真退出后 daemon 与任务继续运行，重启应用 attach 回放。

**前置**：Phase 1（`07-12-background-task-tray-continuation`）落地并稳定运行至少一个版本；实施前必须先出 `.trellis/spec/backend/pty-daemon-contracts.md` 契约并经用户确认。

## Requirements（初版规划，出契约时细化）

- 新增 sidecar 二进制 `cli-manager-daemon`：持有全部 PTY 会话与 scrollback ring buffer（每会话限行，对齐 `SNAPSHOT_MAX_LINES`）。
- 发现与鉴权：loopback TCP + 端口/token 写 `~/.cli-manager/daemon.json`（照抄 `claude_hook.rs` 的一次性 token 模式）；dev/安装版隔离（不同文件名，对齐 sessions.dev.json 约定）。
- 主应用启动：探测 daemon → 存活则 attach 全部会话并回放 buffer；不存活则拉起（Windows `DETACHED_PROCESS`）或降级为进程内 PTY（daemon 拉起失败不得阻塞应用可用）。
- 协议：create/attach/detach/input/resize/close/list + 输出流式推送；`commands/terminal.rs` 的 PTY 命令改为转发，前端 `terminalStore` 与 `pty-output-{sessionId}` 事件契约不变（前端无感知）。
- 应用退出 = detach（daemon 续跑）；用户显式选"仍然退出"时向 daemon 下发 close_all。
- daemon 生命周期：无会话且无客户端 N 分钟自动退出；提供版本握手，版本不匹配时优雅重启 daemon（不杀会话的升级路径出契约时决策）。
- Shell 集成 OSC 边界解析（`boundary.rs`）与 Tab 状态上报在 daemon 侧或转发链路中保持等价。
- 快照落盘机制保留为 daemon 也挂掉时的兜底（resume 链路不删）。

## Acceptance Criteria（初版）

- [ ] 任务运行中真退出应用 → daemon 存活任务续跑；重开应用自动 attach，scrollback 回放完整，可继续输入。
- [ ] daemon 未运行/拉起失败 → 应用降级进程内 PTY，功能与现状一致。
- [ ] token 鉴权：无 token 连接被拒；daemon 仅监听 127.0.0.1。
- [ ] 无会话且无客户端超时后 daemon 自动退出，无僵尸进程。
- [ ] dev 与安装版 daemon 互不串扰。
- [ ] WSL/PowerShell/CMD/Pwsh 各 shell 类型经 daemon 创建行为与现状一致。
- [ ] `cargo test` 覆盖协议编解码与发现/鉴权逻辑；`npx tsc --noEmit` 通过。

## Technical Approach

- `pty/manager.rs` 逻辑迁入 daemon crate（workspace 内新 crate 或 feature 分立）；主进程保留薄客户端层。
- Tauri `externalBin` 注册 sidecar；升级/卸载时的 daemon 清理纳入安装器考量。
- IPC 首选 loopback TCP + 长度前缀 JSON（与 hook 桥接同栈），必要再评估 named pipe。

## Out of Scope

- 远程/移动端客户端（orca 的 remote serve 场景）。
- Claude Code 内置 daemon（`claude agents`）对接——可另立调研任务作为补充。

## Changelog Target

`[TEMP]`

## Notes

- 高风险重构：动 IPC 边界与 PTY 生命周期，实施前 GitNexus 对 `pty_create`/`PtyManager`/terminal 命令全链路做影响分析，预期 HIGH。
- 关键决策留待契约阶段：daemon 崩溃检测与会话孤儿回收、多窗口/多实例并发 attach、输出背压策略。
