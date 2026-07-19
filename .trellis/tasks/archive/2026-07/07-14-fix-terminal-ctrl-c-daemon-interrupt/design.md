# Design

## Root Cause

Windows daemon 自举时同时使用 `DETACHED_PROCESS`、`CREATE_NEW_PROCESS_GROUP` 与 `CREATE_NO_WINDOW`。PTY 从应用进程迁入 daemon 后，ConPTY 的 Ctrl+C 控制事件投递不再具备回归前的进程关系，导致 ETX (`0x03`) 能写入但无法中断运行任务。

## Change

1. 抽取 Windows daemon creation flags 为纯函数，仅返回 `CREATE_NO_WINDOW`。
2. `spawn_daemon_process` 使用该函数，保持无窗口启动。
3. 单元测试锁定 flags 不再包含 detached/new-process-group。
4. 撤回 `XTermTerminal` 中两次无效的显式 Ctrl+C 补丁，恢复 xterm 原生 Ctrl+C 数据生成；保留 macOS Cmd+C 复制支持。

## Risk Control

- 不修改 daemon TCP 协议、PTY 写入格式或会话恢复逻辑。
- 不修改 Unix daemon `process_group(0)` 行为。
- 手动验证应用退出后 daemon 仍存活并可重新 attach。
