# VS Code 终端架构全量替换

## Changelog Target

`[TEMP]`

## Goal

以本地 `D:/work/pythonProject/vscode-main`（VS Code 1.130.0）终端源码为基准，将 CLI-Manager 的内置终端一次性替换为 Rust 等价的 VS Code 分层架构：React TerminalInstance → TerminalProcessManager → WebView 直连 PtyHost daemon → Windows ConPTY / Unix PTY。保留所有现有产品功能，移除会丢输出的前端裁剪、Base64 高频事件中转和 `portable-pty` 生产路径。

## Requirements

- 采用 Rust 等价架构，不引入 Node.js 或 `node-pty` sidecar。
- 生产环境一次性切换，不提供新旧终端开关。
- Windows、macOS、Linux、WSL、Git Bash 全平台保持。
- 同步本地 VS Code 使用的 xterm 6.1 Beta 组件版本。
- WebView 使用鉴权二进制 WebSocket 直连 PtyHost；控制帧 JSON，输出/replay 使用二进制帧。
- 前端建立 TerminalInstance、TerminalProcessManager、Capability Store、ResizeDebouncer 和懒加载 XtermAddonLoader。
- 输出采用 5ms 合并与字符 ACK 背压：100000 高水位、5000 低水位、5000 ACK 粒度；活跃会话禁止丢输出。
- 移除隐藏终端 inactive replay；隐藏终端持续解析输出，仅降低渲染和 resize 开销。
- daemon replay 记录 `{cols, rows, sequence, data}`，attach 严格按 replay → attach 期间 live → 后续 live 顺序交接。
- Windows 直接使用 ConPTY API；Unix 使用 PTY/进程组 API；删除生产路径的 `portable-pty`。
- 保留 Job Object、WSLENV、Provider 环境、hook、后台续跑、快照和 CLI resume 兜底。
- 现有 Tab、分屏、Pane 全屏、应用全屏、Workspan、IME、输入建议、图片、链接、搜索、主题、Replay、统计功能保持。
- 改写自 VS Code MIT 源码的部分保留版权说明，并更新项目 `NOTICE`。

## Acceptance Criteria

- [ ] 所有 PTY 输入输出调用统一经过 TerminalProcessManager，不再散落直接 invoke。
- [ ] 终端高频输出不再经过 Base64 Tauri event。
- [ ] 100 MiB 连续输出哈希一致，无字符丢失或重复。
- [ ] attach replay 与实时输出顺序正确，无空白、重叠或重复。
- [ ] 隐藏 Codex/Claude TUI 切回时不批量重放、不跳滚动位置。
- [ ] 横向 resize 采用 100ms debounce，纵向 resize 立即更新，隐藏终端在空闲时处理。
- [ ] WebGL context loss 自动降级，终端仍可输入和显示。
- [ ] PowerShell、pwsh、CMD、Git Bash、WSL、Bash、Zsh、Fish 可创建、输入、resize、Ctrl+C 和关闭。
- [ ] 应用退出后 daemon 会话继续运行，重开后自动 attach。
- [ ] daemon 不可恢复时 Claude/Codex 使用 resume，普通 shell 使用快照恢复。
- [ ] `npx tsc --noEmit`、`cargo check`、`cargo test` 和相关脚本测试通过。
- [ ] `CHANGELOG.md`、`docs/功能清单.md`、Trellis spec 和 `NOTICE` 更新。

## Definition of Done

- 新架构是唯一生产路径，旧 `PtyManager`、旧 PTY 高频事件和 `portable-pty` 已移除。
- 自动测试覆盖协议、流控、回放、心跳、平台 PTY 和前端生命周期。
- 手动场景矩阵覆盖焦点、分屏、托盘、多会话、全平台 Shell、Worktree 与 hook 状态。
- 变更范围通过 GitNexus detect_changes 核对。

## Technical Approach

- 前端按 VS Code 的 `terminalInstance.ts`、`terminalProcessManager.ts`、`xtermTerminal.ts`、`terminalResizeDebouncer.ts` 分层。
- daemon 按 `ptyHostService.ts`、`ptyService.ts`、`terminalProcess.ts` 建立独立进程、心跳、持久会话、背压和回放。
- 使用本项目现有 daemon 发现/鉴权/后台续跑作为迁移基础，不另建第二套守护进程。
- VS Code `@xterm/headless` 在 Rust-only 约束下以尺寸化 recorder、前端 Serialize checkpoint 与磁盘 spool 实现等价外部行为。

## Decision (ADR-lite)

**Context**: 当前前端已有 xterm.js，但底层通过 `portable-pty`、Tauri event、Base64 和多层自定义缓冲传输，隐藏输出重放和队列裁剪造成 TUI 跳动与潜在输出丢失。

**Decision**: 同步 VS Code xterm 版本；采用 Rust 原生 PtyHost 与 WebView 二进制 WebSocket；一次性替换所有终端路径。

**Consequences**: 性能和正确性路径更接近 VS Code，但改动跨越前端、IPC、daemon、PTY 和平台 API，风险等级 CRITICAL，必须按独立增量实现并在最终发布时一次切换。

## Out of Scope

- 不引入 Electron、Node.js 或 VS Code workbench 基础设施。
- 不复制 VS Code UI、命令系统或扩展 API。
- 不修改历史会话解析、统计口径和项目 CRUD 业务规则。
- 不新增远程网络终端服务；WebSocket 仅限本机 loopback。

## Technical Notes

- VS Code 参考源码与结论见 `research/vscode-terminal-architecture.md`。
- 现有 `07-15-xterm-subsystem-refactor` 的 Display/Input/Osc 拆分作为迁移基础，不并行重写同一文件。
- 用户确认：Rust 等价架构、一次性切换、全平台、同步 VS Code xterm 版本、直连 WebSocket。
