# External Shell Prompt Integration

## Goal

在 CLI-Manager 中支持“终端提示符外观统一/增强”能力，但不在前端伪造 prompt，而是基于真实 shell 与外部 prompt engine 做跨平台集成，优先覆盖现有内嵌 shell 类型，并复用现有 PTY + OSC 运行态链路。

## What I already know

- 现有终端渲染层是 xterm.js，真实会话来自 Rust PTY，不适合在 React 层伪造 prompt。
- 前端已在 `src/components/XTermTerminal.tsx` 中解析 OSC 133/777 运行态事件。
- 后端已在 `src-tauri/src/pty/manager.rs` 中对 PowerShell/pwsh、Git Bash、cmd 注入运行态标记。
- shell 枚举已在 `src/lib/shell.ts` 统一，当前包含 `powershell`、`cmd`、`pwsh`、`wsl`、`gitbash`、`bash`、`zsh`、`fish`、`sh`。
- 设置页已有成熟的“检测状态 / 选择目录 / 一键安装 / 一键卸载 / 部分安装状态”模式，可参考 Hook 设置页。
- 通用 shell 运行监控已有设置入口，可作为 prompt 集成入口的相邻能力。
- 外部调研表明，VS Code 走的是 shell integration 注入路线；Oh My Posh / Starship 是更合理的 prompt 外观统一方案；`cmd` 通常需要 Clink。

## Assumptions (temporary)

- 用户要的是“CLI-Manager 对多平台多 shell 的 prompt 能力支持”，不是只为 PowerShell 做一次性特例。
- 默认应避免静默修改用户全局 profile，任何写配置动作都应显式触发，并可见目标文件与差异。
- MVP 优先考虑“外部 prompt engine 集成”而不是“CLI-Manager 自己实现 9 种 shell prompt 适配器”。

## Open Questions

- 无阻塞问题，已收敛到 MVP。

## Requirements (evolving)

- CLI-Manager 需要为现有内嵌 shell 提供可解释的 prompt 集成能力矩阵。
- 不得在前端伪造 prompt 文本，不得破坏真实 PTY 输入与 TUI。
- 需要复用现有设置页的安装状态与操作模式。
- 需要明确区分：
  - prompt 外观能力
  - shell runtime/status 集成能力
  - shell 本身/外部工具是否已安装
- 对不支持的一类 shell 必须显式降级，不装懂。
- 对用户配置写入操作，必须可见、可控、可回退。
- MVP 采用“检测 + 能力矩阵 + 生成初始化片段 + 可见 diff 后写入 profile”的档位，不负责自动下载外部工具。
- 首发 shell 范围：
  - 支持检测、生成片段、diff 后写入：`powershell`、`pwsh`、`bash`、`zsh`、`fish`、`gitbash`
  - 仅检测 + 引导：`cmd + Clink`
  - 明确降级说明：`wsl`、`sh`

## Acceptance Criteria (evolving)

- [ ] 能在设置页展示 shell/prompt engine 的能力与安装状态。
- [ ] 能区分“未安装 / 部分安装 / 已安装 / 不支持”。
- [ ] 对至少一种推荐方案提供明确接入路径。
- [ ] 能生成 shell 对应的初始化片段，并在用户确认可见 diff 后写入目标 profile/config。
- [ ] 不通过 React/xterm 伪造 prompt。
- [ ] 明确 MVP 的支持范围与降级范围。
- [ ] 首发支持的 6 类 shell 可完成“检测 -> 片段生成 -> diff 确认 -> 写入”闭环。
- [ ] `cmd` 明确展示 Clink 依赖与引导，但首发不直接写入 Clink 脚本。
- [ ] `wsl`、`sh` 在 UI 中有明确的降级说明，不伪装成已支持。

## Definition of Done (team quality bar)

- Tests added/updated where appropriate
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Research References

- [`research/prompt-engine-and-shell-integration.md`](research/prompt-engine-and-shell-integration.md) - Prompt engine、shell integration 与本仓库现状的收敛结论。

## Technical Approach

候选方向：

- Approach A（推荐）：
  以外部 prompt engine 集成为主，CLI-Manager 负责检测、配置引导、状态呈现、可选的一键配置。
- Approach B：
  CLI-Manager 为每种 shell 维护会话级 prompt 注入器。
- Approach C（拒绝）：
  在前端渲染 synthetic prompt。

当前建议优先推进 Approach A，并保留后续少量 shell 会话级补强能力。

MVP 已确认：

- 采用外部 prompt engine 集成路线
- 首发仅支持 Oh My Posh，但数据模型与 UI 预留 Starship 扩展位
- 首发提供：
  - 安装/状态检测
  - shell 能力矩阵
  - 初始化片段生成
  - 写入前 diff 预览与用户确认
- 首发不提供：
  - 自动下载/自动安装 Oh My Posh、Starship、Clink
  - 前端 synthetic prompt
  - `cmd + Clink` 自动写入
  - `wsl` 内部 shell 自动写入
  - `sh` 深度适配

实现分层：

- 前端：
  - 新增 Prompt Integration 设置区块/页面
  - 展示引擎状态、shell 能力矩阵、目标 profile/config 路径、生成片段预览、diff 确认入口
- 后端：
  - 检测 Oh My Posh 是否可用
  - 解析各 shell 的目标 profile/config 路径
  - 生成 shell 对应初始化片段
  - 返回“原文件内容 / 预期写入内容 / diff 预览所需数据”
  - 在用户确认后执行写入，并保留最小回退信息
- 运行态：
  - 继续复用现有 OSC 133/777 链路
  - prompt 外观归 shell/Oh My Posh 所有，不进 xterm 渲染逻辑

## Decision (ADR-lite)

**Context**

CLI-Manager 需要支持跨平台、多 shell 的 prompt 增强能力，但当前架构基于真实 PTY + xterm.js。若在前端伪造 prompt，会与真实 shell 输入、历史、补全、IME 和 TUI 冲突。

**Decision**

采用 `外部 prompt engine 集成` 路线，首发只支持 `Oh My Posh`，并预留 `Starship` 扩展位。CLI-Manager 负责：

- 检测引擎与 shell 支持状态
- 展示能力矩阵
- 生成初始化片段
- 在可见 diff + 用户确认后写入 profile/config

首发 shell 范围：

- 完整闭环：`powershell`、`pwsh`、`bash`、`zsh`、`fish`、`gitbash`
- 仅检测与引导：`cmd + Clink`
- 显式降级：`wsl`、`sh`

**Consequences**

- 优点：
  - 架构正确，不污染 xterm/PTY 语义
  - 可复用现有 Hook 设置页模式
  - 跨 shell 成本可控
- 代价：
  - 依赖外部工具
  - `cmd/wsl/sh` 首发体验不完全一致
  - 需要谨慎处理用户 profile 写入与 diff 展示

## Implementation Plan (small PRs)

- PR1: 后端能力建模
  - 定义 prompt engine / shell capability / install status 数据结构
  - 增加 Oh My Posh 检测、shell 目标 profile 定位、初始化片段生成命令
- PR2: 设置页与交互
  - 新增 Prompt Integration UI
  - 展示能力矩阵、状态、目标路径、片段预览
  - 接入 diff 确认与写入流程
- PR3: 边界与降级
  - `cmd + Clink` 引导
  - `wsl`、`sh` 降级说明
  - 文案/i18n、测试、文档收尾

## Out of Scope (explicit)

- 在 xterm/React 层自己拼接可交互 prompt
- 一次性承诺所有未知 shell 完整支持
- 静默覆盖用户全局 shell profile
- 在本任务第一阶段内实现所有 prompt engine 的深度兼容

## Technical Notes

- 相关文件：
  - `src/lib/shell.ts`
  - `src-tauri/src/pty/manager.rs`
  - `src/components/XTermTerminal.tsx`
  - `src/components/settings/pages/HookSettingsPage.tsx`
  - `src/components/settings/pages/ThemeSettingsPage.tsx`
- 可复用模式：
  - Hook 设置页的安装状态刷新、目录选择、安装/卸载流程
  - 现有 shell runtime monitoring 的设置开关与提示文案模式
