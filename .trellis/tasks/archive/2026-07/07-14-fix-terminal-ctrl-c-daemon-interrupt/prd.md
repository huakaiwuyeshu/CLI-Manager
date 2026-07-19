# fix-terminal-ctrl-c-daemon-interrupt

## Goal

恢复终端 Ctrl+C 中断能力，定位并修复 2026-07-13 PTY daemon 接管输入链路后出现的回归，避免继续在前端快捷键判断层做无效修补。

## What I already know

- Ctrl+C 在没有可见文本选区时无法中断当前终端任务。
- 已尝试在 `XTermTerminal` 显式发送 `\x03`，并合并重复复制分支、兼容 `KeyboardEvent.code === "KeyC"`，用户实测均无效。
- 当前应用日志显示新建会话全部为 `daemon=true`。
- 当前 daemon 来自 `D:\ProgramFiles\CLI-Manager\cli-manager.exe __daemon`，通过共享 `~/.cli-manager/daemon.json` 被开发实例复用。
- 2026-07-13 的 `735123d` 将 `pty_write` 从进程内 `PtyManager` 改为经 daemon TCP 协议转发。
- daemon 协议当前没有 Ctrl+C/控制字符专项回归测试，也没有控制字符写入成功日志。
- GitNexus 对 `XTermTerminal` 的前端局部修改评估为 LOW，但真实问题可能跨前端、Tauri command、daemon client/server 与 ConPTY。

## Requirements

- 确认 Ctrl+C 键盘事件是否进入前端处理函数。
- 确认 `\x03` 是否依次经过 Tauri `pty_write`、daemon client、daemon server 和 `PtyManager::write`。
- 修复首次丢失或失效的层级，不增加新的终端中断抽象，除非普通 PTY 写入无法满足 Windows ConPTY 中断语义。
- 保持有选区时 Ctrl+C 复制行为不变。
- 保持 macOS Cmd+C 复制行为不变。
- Changelog Target: `[TEMP]`。

## Acceptance Criteria

- [ ] Windows PowerShell/Pwsh 中运行持续命令时，Ctrl+C 能立即中断并返回提示符。
- [ ] Git Bash 与 WSL 终端中的 Ctrl+C 行为不回退。
- [ ] Claude Code/Codex TUI 运行中可通过 Ctrl+C 取消当前操作。
- [ ] 有实际文本选区时 Ctrl+C 复制且不向 PTY 发送中断。
- [ ] daemon 模式与进程内回退模式的控制字符写入均有自动化覆盖。
- [ ] 前端类型检查和 Rust 相关测试通过。

## Out of Scope

- 重构完整终端快捷键系统。
- 修改其他全局快捷键。
- 重设计 PTY daemon 生命周期。

## Technical Notes

- 重点文件：`src/components/XTermTerminal.tsx`、`src-tauri/src/commands/terminal.rs`、`src-tauri/src/daemon/{client,protocol,server}.rs`、`src-tauri/src/pty/manager.rs`。
- 相关提交：`83ba170`、`7e061c2`、`735123d`、`4e53641`。
- 当前工作区存在其他并行任务改动，实施时必须只修改本任务相关区域。

## Research References

- [`research/conpty-control-c.md`](research/conpty-control-c.md) — ConPTY 的 Ctrl+C 依赖控制台进程组；daemon 新增的 detached/new-process-group 边界是当前最明确的回归差异。

## Feasible Approaches

### A. Windows daemon 仅使用 `CREATE_NO_WINDOW`（推荐）

- 保留 daemon 后台任务能力。
- 移除 `DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP`，恢复 ConPTY Ctrl+C 控制事件投递。
- 验证主应用退出后 daemon 仍可存活。

### B. Windows 禁用 daemon PTY

- 回退到旧进程内 PTY，风险较直观。
- Windows 后台任务和重启 attach 功能会退化。

### C. 独立中断 RPC

- 仍无法从根本上绕过 ConPTY 进程组不匹配。
- 不采用。

## Decision (ADR-lite)

**Context**: 前端已确认发送 ETX，但 daemon 模式下运行任务仍不响应 Ctrl+C；回归前进程内 PTY 正常。

**Decision**: 采用方案 A，最小调整 Windows daemon 自举 flags，并补充进程 flags 单元测试和 Ctrl+C 手动回归项。

**Consequences**: 必须额外验证应用退出后 daemon 的持续运行能力；若无法保持，再回退方案 B。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
