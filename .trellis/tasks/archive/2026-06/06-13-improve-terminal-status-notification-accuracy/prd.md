# 优化终端 Tab 状态通知回调的准确性

## Goal

终端 Tab 状态（running / attention / done / failed）目前由两条来源驱动：CLI hook（claude/codex 经本地 TCP bridge）与 shell runtime（仅 PowerShell prompt 注入 + 前端猜回车）。两条链路都有明确的误判/漏判场景。本任务目标：提高状态判定准确性，并扩展检测手段。

## What I already know（现状梳理）

- **CLI hook 链路**：`hook_settings.rs` 安装 PS1 脚本到 `~/.claude/hooks`，注册 Claude（UserPromptSubmit/Notification/Stop/StopFailure）与 Codex（UserPromptSubmit/PermissionRequest/Stop）；脚本用 `Invoke-RestMethod` POST 到 `claude_hook.rs` 的本地 TCP bridge（随机端口 + Bearer token，环境变量注入 PTY）。
- **Shell runtime 链路**：`pty/manager.rs:79` 仅对 powershell/pwsh 注入自定义 `prompt` 函数，发自定义 OSC `777;cli-manager`（command_finished/prompt_shown）；`command_started` 由前端 `XTermTerminal.tsx:552` 猜测“回车 + inputBuffer 非空”触发。
- **状态合并**：`terminalStore.ts` 双来源按优先级合并（attention > failed > running > done）。
- 已验证（官方文档）：`StopFailure` 是 Claude Code 原生事件（turn 因 API 错误结束）；`Notification` 事件支持 matcher 细分：`permission_prompt` / `idle_prompt` / `auth_success` 等。

## 当前准确性问题

1. `command_started` 靠前端猜回车：历史命令（↑+回车，buffer 为空）漏判；TUI 内回车、多行续行、粘贴误判。
2. PowerShell prompt 注入：空回车/Ctrl+C 会触发 `command_finished(0)` → 状态被错误刷成 done；用户 profile 中 oh-my-posh/starship 重定义 prompt 时监控静默失效。
3. 覆盖范围：cmd / WSL / bash / gitbash 完全没有 shell 级状态。
4. CLI hook：每个事件起一个 powershell.exe（数百 ms 延迟）；事件可能乱序；`Stop` 丢失时 Tab 永远停留 running，无超时回退。
5. OSC 解析为手写字符串扫描（`XTermTerminal.tsx:231`），仅支持 BEL 终止符，不支持标准 ST（`ESC \`），无法复用外部 shell integration 序列。

## Research Notes

### 业界做法（OSC 133 / 633 shell integration）

- FinalTerm/iTerm2/Windows Terminal/VS Code 标准：`OSC 133;A`（prompt 开始）、`B`（命令输入开始）、`C`（命令开始执行=输出开始）、`D[;exitCode]`（命令结束）。
- 关键语义：`C` 由 shell 在真正执行命令时发出（替代前端猜回车）；`D` 不带 exit code 表示“没跑命令”（空回车/Ctrl+C），不应改变状态。
- xterm.js 原生不解析 133，但 VS Code 通过 `terminal.parser.registerOscHandler(133/633)` 以 addon 方式实现，CLI-Manager 可同样接入。
- oh-my-posh / VS Code shell integration / Windows Terminal 集成脚本本身就发 133/633 → 识别这些序列可在用户自定义 prompt 覆盖注入脚本后仍然工作。

### Feasible approaches

**方案 A：shell 端标准化 OSC 133 + xterm.js parser hook（推荐，主体）**
- 注入脚本改发标准 OSC 133 A/B/C/D（含 exit code），`command_started` 改由 shell `C` 序列驱动，删除前端猜回车逻辑。
- 前端用 `registerOscHandler(133)` + `(633)` +（兼容期保留 777）替代手写扫描；同时免费兼容用户自带 shell integration。
- 扩展 bash/gitbash/WSL（PROMPT_COMMAND/PS0 注入）与 cmd（PROMPT 变量打 133 标记，无 exit code）。

**方案 B：CLI hook 链路加固（与 A 互补）**
- `Notification` 按 matcher 细分：permission_prompt → attention，idle_prompt → attention/独立状态。
- running 超时回退：hook running 超过阈值且无后续事件 → 降级，避免永久 running。
- 事件带 timestamp/seq，store 丢弃乱序旧事件；PS1 脚本换 `curl.exe`（Win10+ 自带）降低每事件延迟。

**方案 C：进程级兜底信号（暂不推荐进 MVP）**
- Rust 侧轮询 PTY 子进程树判断 busy/idle（WSL 不可见，拿不到 exit code），或输出静默启发，作为第三来源低置信度 fallback。复杂度高、增益有限。

## Decision (ADR-lite)

**Context**：双来源状态判定存在系统性误判（前端猜回车、空回车误报 done、hook 丢事件永久 running、shell 覆盖不全）。
**Decision**：MVP = 方案 A（OSC 133 标准化，覆盖全部 shell 含 cmd）+ 方案 B（hook 链路加固）；方案 C（进程树轮询/静默启发）不做。
**Consequences**：
- WSL 主动注入受限（wsl.exe 启动默认发行版默认 shell，无法可靠注入 rc）→ WSL 为 best-effort：识别用户已有 shell integration 发出的 133/633，不保证主动注入。
- cmd 经 PROMPT 变量打标记，天然无 exit code → cmd 下 done/failed 不区分，只有 running/done。
- 过渡期保留 OSC 777 解析兼容。

### 实现期修正

1. **不用 `registerOscHandler`，改为原始流解析**：后台 Tab 的输出先进 inactive ring buffer（256KB 上限，可能截断丢弃），状态事件必须在丢弃前提取，xterm parser hook 拿不到被丢弃的序列。重写的扫描器支持 133/633/777、BEL/ST 终止符与跨 chunk 前缀缓冲（修复旧实现前缀被切分时漏检的隐患）。
2. **"bash" shell 键不注入**：`resolve_shell("bash")` 解析为 `bash.exe`（System32 的 WSL 启动器），rcfile 路径无法可靠传入 Linux 侧，与 WSL 同样走"识别外部序列"策略；主动注入实际覆盖 powershell / pwsh / gitbash / cmd。
3. **cmd 保留输入侧回车猜测**：cmd 无法注入 C 序列，回车猜测（store 按 `origin: "input"` 过滤，仅 cmd 接受）是其唯一 command_started 信号；prompt 重现（A 序列）时把 shell 来源的 running 收口为 done。
4. **安装即升级**：install hook 前先按脚本名清理旧注册条目（命令串加了 `-NoProfile`、Notification 加了 matcher，旧条目已过时）。

## Requirements

1. 前端用 `terminal.parser.registerOscHandler` 解析 OSC 133 / 633 / 777（兼容期），替代手写字符串扫描；支持 BEL 与 ST 两种终止符。
2. `command_started` 改由 shell `133;C`（或 633;C）驱动；删除 `XTermTerminal.tsx` 回车猜测触发状态的逻辑（命令历史记录 addCommand 保留，不受影响）。
3. `133;D` 不带 exit code（空回车/Ctrl+C）不变更 Tab 状态。
4. PowerShell/pwsh 注入脚本升级为发 OSC 133 A/B/C/D（D 携带 exit code）。
5. bash / gitbash 经 rcfile 包装注入 PROMPT_COMMAND + PS0 发 133 序列；cmd 经 PROMPT 变量追加 133 标记（保留用户已有 PROMPT）。
6. WSL：识别外部 133/633 序列（best-effort，不主动注入）。
7. Claude `Notification` hook 按 matcher 细分：`permission_prompt` → attention；`idle_prompt` → attention；其余忽略。
8. hook running 状态超时回退：超过阈值无后续事件则降级，Tab 不永久 running。
9. hook 事件携带 timestamp，store 丢弃乱序旧事件。
10. hook PS1 脚本上报改用 `curl.exe`（Win10+ 自带）降低每事件延迟，失败回退 Invoke-RestMethod。

## Acceptance Criteria

- [ ] 历史命令（↑+回车）能正确进入 running（shell C 序列驱动）。
- [ ] 空回车 / Ctrl+C 不再把状态刷成 done。
- [ ] 多行输入/粘贴执行不再误判 command_started。
- [ ] cmd / gitbash / bash 会话有 running/done 状态（cmd 不要求 failed）。
- [ ] Claude hook `Stop` 丢失时，Tab 超时后不再停留 running。
- [ ] 用户使用 oh-my-posh / VS Code shell integration 自定义 prompt 时，状态监控仍工作（识别外部 133/633）。
- [ ] Notification permission_prompt/idle_prompt 正确触发 attention，auth_success 等不误触发。

## Definition of Done (team quality bar)

- `npx tsc --noEmit` / `cargo check` 通过
- 行为变化更新 CHANGELOG
- 运行态 UI 验收由用户人工完成（项目约定：AI 不启动服务检查）

## Out of Scope (explicit)

- 方案 C：进程树轮询、输出静默启发兜底信号。
- WSL 主动注入 shell integration 脚本（仅 best-effort 识别外部序列）。
- 命令历史记录（addCommand）机制改造。
- Codex hook 事件扩展（沿用现有 UserPromptSubmit/PermissionRequest/Stop）。

## Technical Notes

- 相关文件：`src/stores/terminalStore.ts`、`src/components/XTermTerminal.tsx`、`src-tauri/src/pty/manager.rs`、`src-tauri/src/claude_hook.rs`、`src-tauri/src/commands/hook_settings.rs`
- 参考：VS Code shell integration（OSC 633/133）、Windows Terminal shell integration 文档、xterm.js `parser.registerOscHandler`
