# 修复内置终端运行 Claude Code 中断

## Goal

修复 CLI-Manager 内置终端中运行 Claude Code 时无操作等待一段时间后出现异常中断的问题，先捕获 PTY/Claude/Bun 的真实退出原因，再针对确认的触发链路做最小修复。

## What I already know

* 用户反馈：在本软件内使用 Claude 会出现中断，并附带 Bun v1.3.14 Windows x64 崩溃/报告输出。
* 项目内置终端由前端 `src/components/XTermTerminal.tsx` 基于 xterm.js 处理输入、输出、resize；后端 `src-tauri/src/pty/manager.rs` 基于 `portable_pty` 创建 Windows PTY。
* 前端当前逻辑：`Ctrl+C` 仅在 xterm 有选区时拦截为复制；没有选区时返回给 xterm，最终会向 PTY 发送 `\x03`，这会中断 Claude Code 当前请求。
* 前端当前逻辑：`Ctrl+V` 被拦截为剪贴板粘贴并写入 PTY。
* 后端当前逻辑：PTY resize 已限制最小尺寸为 40x8；前端也跳过小于 40x8 的 resize。
* 后端当前逻辑：PTY 输出通过 base64 传输，并有 UTF-8 / ANSI 边界保护，降低高吞吐输出污染 xterm 状态的概率。
* GitNexus impact：`XTermTerminal` upstream 风险 LOW；`PtyManager` upstream 风险 LOW。

## Assumptions (temporary)

* 用户已确认不是按 `Ctrl+C`、复制文本或类似复制操作后触发。
* 用户已确认更像是无操作等待一段时间后自行中断。
* 主要嫌疑转向 PTY reader 断流、Claude/Bun 子进程主动退出、高吞吐输出期间前端/后端没有暴露真实退出原因。
* Bun 崩溃输出可能是 Claude Code 子进程在 PTY 环境中崩溃后的报告，而不是 CLI-Manager 进程自身崩溃。

## Open Questions

* 用户确认：不是按 `Ctrl+C`、复制文本或类似复制操作后触发。
* 用户确认：更像是无操作等待一段时间后自行中断。
* 需要确认 PTY reader 结束时的错误/EOF、child exit code、以及 Claude/Bun 崩溃报告是否能从应用日志定位。

## Requirements (evolving)

* 内置终端运行 Claude Code 无操作等待后中断时，应用日志应能看到 PTY reader 结束原因、child exit code、会话 id、shell、cwd 和最后一次 resize 信息。
* 前端应在 PTY 状态变为 exited/error 时记录可定位的日志，避免只在终端输出里看到 Bun 报告但应用侧没有上下文。
* 修复优先做诊断增强，不改变 Ctrl+C、复制、粘贴或普通终端中断语义。
* 不引入新依赖，不重写 PTY 架构。

## Acceptance Criteria (evolving)

* [ ] Claude Code 无操作等待后中断时，Rust 日志包含 PTY reader EOF/error、exit_code、session_id、shell、cwd。
* [ ] 最近一次 `pty_resize` 的 cols/rows 会被记录到会话上下文，便于排除异常 resize。
* [ ] 前端收到 `pty-status-*` exited/error 时写入日志，包含 session title/project/cwd/startupCmd 摘要。
* [ ] `npx tsc --noEmit` 通过。
* [ ] `cd src-tauri && cargo check` 通过。

## Definition of Done

* Tests/checks added or updated where appropriate.
* Lint / typecheck / relevant build checks green.
* Docs/spec notes updated if behavior changes.
* Rollback risk considered.

## Out of Scope

* 不重写 PTY 架构。
* 不更换 xterm.js / portable_pty / Bun / Claude Code 依赖。
* 不处理 Claude Code 或 Bun 自身的上游崩溃 bug。

## Technical Notes

* `src/components/XTermTerminal.tsx:217`：自定义键盘处理；`Ctrl+C` 有选区时复制，无选区时放行给 PTY。
* `src/components/XTermTerminal.tsx:257`：xterm `onData` 统一写入 `pty_write`。
* `src/components/XTermTerminal.tsx:277`：xterm resize 写入 `pty_resize`。
* `src-tauri/src/pty/manager.rs:216`：PTY 写入。
* `src-tauri/src/pty/manager.rs:241`：PTY resize，已做最小行列限制。
* `src-tauri/src/pty/boundary.rs`：PTY 输出边界保护已有测试。

## Feasible approaches

**Approach A: 先补 PTY/前端诊断日志（推荐）**

* How it works: 在 Rust `PtyManager` 保存会话上下文与最近 resize；reader 退出时区分 EOF / read error 并记录 child exit code。前端 status listener 收到 exited/error 时记录 session 上下文。
* Pros: 与“无操作等待后自行中断”的现象匹配，不盲改终端行为；下一次复现可直接定位是 Bun/Claude 子进程退出、PTY 断流还是 resize 相关。
* Cons: 第一轮主要是可观测性增强，不一定立即消除上游 Bun 崩溃。

**Approach B: 直接加强 reader/resize 容错**

* How it works: 在未确认根因前继续钳制 resize、调整 reader flush 或忽略部分异常读错误。
* Pros: 可能直接缓解问题。
* Cons: 容易掩盖真实崩溃原因；可能引入终端输出延迟或尺寸不同步。

**Approach C: 暂不改代码，只指导开启调试模式复现**

* How it works: 让用户打开设置里的调试模式后复现，再看现有日志。
* Pros: 零代码风险。
* Cons: 现有日志没有 reader read error、last resize、session cwd/shell 等完整上下文，可能仍定位不了。
