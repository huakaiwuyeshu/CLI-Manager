# 强制 Codex 终端保留滚动历史

## Goal

让通过 CLI-Manager 启动的 Codex 终端默认保留宿主终端 scrollback，使用户能通过滚动条查看历史消息。

## What I already know

- 用户报告：Codex 有时没有滚动条，看不到历史消息，希望添加 Codex 启动参数强制需要滚动条。
- `codex --help` 明确支持 `--no-alt-screen`：禁用 alternate screen，以 inline 模式运行 TUI，并保留 terminal scrollback history。
- 当前项目启动命令来源是 `project.startup_cmd || project.cli_tool`，如果只配置 `cli_tool=codex`，实际写入 PTY 的就是 `codex`。
- 项目启动入口不止一个：侧边栏、命令面板、分屏项目启动、外部终端 compact 模式都存在自己的 `cmd` 组装逻辑。
- `src/components/XTermTerminal.tsx` 已配置 xterm scrollback 和滚动条样式；问题根因更接近 Codex alternate screen 没有把内容留在宿主 scrollback。

## Requirements

- 当项目配置的 `cli_tool` 是 Codex，且 `startup_cmd` 为空时，自动使用 `codex --no-alt-screen` 启动。
- 如果用户显式填写了 `startup_cmd`，不自动改写，避免破坏自定义命令。
- 不修改用户 `~/.codex/config.toml`、hooks 或历史文件。
- 尽量复用一个小工具函数，避免各启动入口行为不一致。

## Acceptance Criteria

- [ ] 侧边栏双击 Codex 项目时写入 PTY 的启动命令包含 `--no-alt-screen`。
- [ ] 命令面板启动 Codex 项目时同样包含 `--no-alt-screen`。
- [ ] 分屏启动 Codex 项目时同样包含 `--no-alt-screen`。
- [ ] 显式配置 `startup_cmd` 的项目不被自动追加参数。
- [ ] TypeScript 类型检查通过，或报告明确失败原因。

## Definition of Done

- 变更范围只限前端启动命令归一化及必要类型/测试。
- 执行最小验证。

## Out of Scope

- 不重新设计终端滚动条样式。
- 不改后端历史解析。
- 不保证所有 Codex TUI 行为都等价于默认 full-screen 模式。
- 不新增依赖。

## Technical Approach

新增一个前端小工具函数，根据 `Project` 生成启动命令：优先返回显式 `startup_cmd`；没有显式命令时，如果 `cli_tool` 识别为 Codex，则返回 `codex --no-alt-screen`；否则返回原 `cli_tool`。将现有启动入口改为复用该函数。

## Technical Notes

- 已确认命令参数来源：`codex --help`。
- 候选文件：`src/lib/types.ts` 或新增 `src/lib/projectStartupCommand.ts`、`src/components/TerminalTabs.tsx`、`src/components/CommandPalette.tsx`、`src/components/sidebar/index.tsx`。
