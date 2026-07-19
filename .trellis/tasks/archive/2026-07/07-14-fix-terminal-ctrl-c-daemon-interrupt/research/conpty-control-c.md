# ConPTY Ctrl+C 与进程组

## 结论

- `portable-pty 0.8.1` 的 Windows 后端使用 `PSEUDOCONSOLE_WIN32_INPUT_MODE`，写入 ETX (`0x03`) 是正确的 Ctrl+C 输入方式。
- ConPTY 收到 ETX 后不是简单把字符交给前台程序，而是尝试向同一控制台进程组派发 Ctrl+C 控制事件。
- Microsoft 的复现说明：如果伪控制台宿主和被控进程不在兼容的进程组中，普通输入仍正常，但正在运行的 `ping` 等任务无法被 ETX 中断。
- CLI-Manager 在 `735123d` / `4e53641` 后将 PTY 移入 daemon；Windows 自举 daemon 使用 `DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW`。这正是相较旧进程内 PTY 新增的进程边界。
- 当前前端已确认发送 `\x03` 仍无效，因此继续修改快捷键或 daemon JSON 编码不能解决控制事件投递问题。

## 可选方案

### A. daemon 仅使用 `CREATE_NO_WINDOW`（推荐）

- 不再显式创建 detached/new process group。
- GUI 主进程本身没有控制台，daemon 不会因 Ctrl+C 误伤主应用。
- 保留 daemon 托管和后台任务能力，恢复与旧进程内 PTY 相近的 ConPTY 进程关系。
- 需要验证主应用退出后 daemon 仍继续运行。

### B. Windows 暂时禁用 daemon PTY

- Windows 回退到进程内 `PtyManager`，Ctrl+C 行为最接近回归前。
- 会失去 Windows 后台任务与应用重启 attach 能力。
- 改动面和产品影响更大。

### C. 增加独立 `pty_interrupt` RPC

- 如果底层仍只写 `0x03`，无法绕过进程组问题。
- `GenerateConsoleCtrlEvent` 需要正确控制台/进程组上下文，daemon 当前也无法可靠从外部直接补救。
- 不推荐作为首选。

## 来源

- portable-pty `MasterPty::take_writer`: https://docs.rs/portable-pty/latest/portable_pty/trait.MasterPty.html
- Microsoft ConPTY Ctrl+C/进程组复现：https://learn.microsoft.com/en-us/answers/questions/5832200/c-sent-to-the-stdin-of-a-program-running-under-a-p
- Microsoft ConPTY Win32 input mode spec: https://github.com/microsoft/terminal/blob/main/doc/specs/%234999%20-%20Improved%20keyboard%20handling%20in%20Conpty.md

