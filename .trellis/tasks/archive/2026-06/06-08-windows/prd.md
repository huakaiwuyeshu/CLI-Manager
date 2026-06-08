# 修复 Windows 终端历史与粘贴错乱

## Goal

修复 Windows 10 环境下 CLI-Manager 内部终端在 PowerShell 场景中的两个可见问题：命令历史消息会自动消失，以及粘贴长文本时会出现行错乱。目标是让终端交互在 Windows/PowerShell 下稳定、可读、可复制。

## What I already know

* 用户反馈的环境是 Windows 10，内部终端在 PowerShell 时出现问题。
* 同一台机器上 CMD 窗口表现正常，异常只出现在 PowerShell。
* 问题 1：终端历史消息会自动消失，影响查看命令输出。
* 问题 2：Claude Code CLI 粘贴文档时会出现行错乱，表现为内容顺序/换行渲染异常。
* 当前仓库是 Tauri 2 + React + xterm.js + PTY 架构，前端负责终端展示，Rust 后端负责 PTY 会话管理。
* 后端开发前需要遵守终端运行时监控契约；前端开发前需要遵守组件/状态/质量规范。

## Assumptions (temporary)

* 问题主要出在 PowerShell 相关的终端输入/渲染链路，而不是 Windows PTY 全局问题。
* 粘贴错乱可能与前端 paste 处理、换行规范化、或 xterm.js 行缓冲/光标行为有关。
* 历史消息自动消失可能与终端重绘、清屏、滚动回收、会话重连、或输出被覆盖有关。

## Open Questions

* 粘贴错乱是否只发生在 Claude Code CLI 的交互输入框场景，还是所有长文本粘贴都会复现？
* 是否需要顺便处理粘贴时自动发送/回车语义，还是只修正文案换行顺序？

## Requirements (evolving)

* 保证 Windows 10 + PowerShell 下的终端历史内容可稳定查看。
* 清屏问题优先按 resize / 切换标签 / 自动 fit 后触发处理；普通执行命令不清屏。
* 保证长文本粘贴时的行顺序和换行不会错乱。
* 粘贴修复应优先恢复 xterm 原生 paste 语义，包括 CR 换行转换和 bracketed paste 支持。
* 尽量不改变现有终端行为边界，避免影响其他 shell 和平台。

## Acceptance Criteria (evolving)

* [ ] 在 Windows 10 + PowerShell 场景下，终端历史输出不会在正常交互后“消失”。
* [ ] 粘贴多行文档时，终端中显示的行顺序与源文本一致。
* [ ] 修复不破坏其他 shell 的正常输入行为。

## Definition of Done (team quality bar)

* Tests added/updated（如果有可自动化覆盖）
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 不重做整个终端架构。
* 不为未复现的问题引入大范围兼容层。
* 不修改与该问题无关的终端主题、布局或会话管理逻辑。

## Technical Notes

* 已读规范：`.trellis/spec/backend/index.md`、`.trellis/spec/frontend/index.md`、`.trellis/spec/guides/index.md`
* 终端契约：`.trellis/spec/backend/terminal-runtime-monitoring-contracts.md`
* 调研：`.trellis/tasks/06-08-windows/research/xterm-bracketed-paste-windows.md`
* 相关文件：`src/components/XTermTerminal.tsx`、`src/stores/terminalStore.ts`、`src-tauri/src/pty/manager.rs`、`src-tauri/src/commands/terminal.rs`
* 当前任务目录：`.trellis/tasks/06-08-windows/`
