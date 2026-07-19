# 退出时任务转入后台继续执行（托盘常驻，Phase 1）

## Goal

Issue #123 增强：退出应用时若存在运行中的任务（claude/codex/长 shell 命令），允许"转入后台继续执行"——窗口隐藏、进程与 PTY 存活，任务完成后系统通知，重开窗口 reattach 画面连续。

契约（先于本 PRD 定稿，实施以其为准）：`.trellis/spec/frontend/background-task-continuation-contracts.md`

## Requirements

- `terminalStore` 新增 `getRunningTaskSessionIds()`：合并态（hook+shell）为 `running` 的真实 PTY 会话，伪会话/exited 排除。
- 新增设置 `exitWithRunningTasksBehavior: "ask" | "background" | "exit"`，默认 `"ask"`，设置页紧邻 `closeBehavior`。
- 窗口关闭（closeBehavior=exit / 弹窗选退出）与托盘"退出"两条入口在有 running 任务时按上述设置分流；新增 `RunningTasksExitDialog`（转入后台 / 仍然退出 / 取消 + 记住选择）。
- 转入后台 = `hide()`，严禁触碰退出链路（`runExitCleanup`/`pty_close_all`/flush）；快照 10s 节流后台继续。
- 后台模式下 hook 事件 `Stop`/`StopFailure`/`PermissionRequest`/attention 必发系统通知；点击通知/托盘左键 → show+focus，不触发 restoreSessions/resume。
- 托盘退出在后台模式下需先 show 窗口再弹询问，不得静默杀任务。
- 全部任务终结后不自动退出，仅通知，进程留在托盘。
- 新增用户可见文案同时支持 `zh-CN` 与 `en-US`。

## Acceptance Criteria

- [ ] 任务运行中点关闭 → 三选一弹窗；选"转入后台"→ 窗口隐藏、任务继续、完成收系统通知、点通知回来画面连续（无 resume/清屏重绘）。
- [ ] 选"仍然退出"→ 正常退出，重开走既有快照恢复弹窗，CLI 会话 resume 续上。
- [ ] 无 running 任务时所有退出行为与现状一致，零新增交互。
- [ ] 后台模式下托盘"退出"→ 先恢复窗口再询问，不静默杀任务。
- [ ] 后台运行 >10s 后强杀进程 → 重启快照恢复兜底可用。
- [ ] 三档设置各生效一次；"记住选择"正确写入设置。
- [ ] 普通 shell 长命令视为 running，同样触发询问。
- [ ] `npx tsc --noEmit` 通过；`workspace-session-restore-contracts.md` 用例不回归。

## Technical Approach

- `App.tsx`：`onCloseRequested` 与 `tray-quit-requested` 监听中插入 running 判定 + 分流；新增 `enterBackgroundMode`（hide + 内存标记 `isInBackgroundMode`）。
- 通知策略：后台标记下 `claude-hook-notification` 处理分支改走 `send_notification_via_windows`（已有命令），绕过窗口聚焦抑制。
- 复用 CloseDialog 组件模式实现新弹窗。

## Out of Scope

- 独立 daemon 进程 / 应用真退出后任务续跑（Phase 2，见 `07-12-pty-daemon-process`）。
- Tab 状态判定逻辑本身的改动（沿用双源合并与超时回退）。

## Changelog Target

`[TEMP]`

## Notes

- 实施前对 `App`（onCloseRequested 链路）、`terminalStore` 跑 GitNexus 影响分析。
