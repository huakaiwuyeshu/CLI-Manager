# fix codex git bash input theme

## Goal

修复 CLI-Manager 在浅色终端主题下运行 Codex + Git Bash 时，底部输入区显示为灰黑反色条、与白色终端背景割裂的问题。

## What I already know

* 用户现象：终端整体背景已设为白色，但 Codex 的 Git Bash 会话底部输入区仍显示为灰黑色块。
* `src/components/XTermTerminal.tsx` 已明确把 Claude Code / Codex 识别为 TUI，并有关于 `CSI 7m` 反色单元的注释。
* `node_modules/@xterm/xterm/src/browser/renderer/dom/DomRendererRowFactory.ts` 对 inverse 的处理是直接交换前景/背景色。
* 当前浅色终端预设（如 `windowsTerminalOneHalfLight`）使用深色前景 + 白色背景，因此 inverse 区域会显示为深灰底。
* 目前未发现 Git Bash 启动链路额外注入主题相关环境变量；更像是 Codex TUI 自身绘制方式触发的问题。

## Assumptions (temporary)

* 问题主要出现在 Codex TUI 的输入区反色绘制，不是普通 shell 提示符或 React 覆盖层输入控件。
* 最小可行修复应限制在前端终端输出处理层，不改后端 PTY 或全局主题预设。

## Open Questions

* 是否接受对 `codex + gitbash + 浅色背景` 做窄范围输出修正，而不是改全局终端主题行为。

## Requirements (evolving)

* 白色/浅色终端主题下，Codex 的 Git Bash 输入区不再显示为明显的深灰反色块。
* 修复范围只针对 Codex Git Bash 相关场景，避免影响普通 shell、Claude 或深色主题。

## Acceptance Criteria (evolving)

* [ ] 浅色终端主题下打开 Codex Git Bash，会话底部输入区视觉上跟随浅色终端背景。
* [ ] 普通 Git Bash、PowerShell、非 Codex 会话表现不回退。
* [ ] 前端类型检查通过。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 不重做整个 xterm 主题系统。
* 不修改 Git Bash / Codex 外部安装配置。
* 不调整用户自定义的终端主题预设值。

## Technical Notes

* 重点文件：`src/components/XTermTerminal.tsx`
* 参考实现：`node_modules/@xterm/xterm/src/browser/renderer/dom/DomRendererRowFactory.ts`
