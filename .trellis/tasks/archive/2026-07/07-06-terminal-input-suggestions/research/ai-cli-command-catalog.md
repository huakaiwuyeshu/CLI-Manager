# AI CLI 内置命令库调研

调研日期：2026-07-06

## 目标

为 CLI-Manager 终端输入提示补充只读内置 AI 命令库。命令仅用于 prefix 补全建议，不写入 SQLite，不自动执行，不替代用户历史和模板。

## 来源

| 工具 | 来源 | 备注 |
| --- | --- | --- |
| Claude Code | https://code.claude.com/docs/en/cli-reference | 官方 CLI 命令、flags、会话恢复、MCP、权限、headless 模式 |
| Claude Code | https://code.claude.com/docs/en/commands | 官方 TUI slash commands |
| OpenAI Codex CLI | https://developers.openai.com/codex/cli/reference | 官方 Codex CLI reference；本地 curl 访问返回 403，保留官方 URL 作为来源 |
| OpenAI Codex CLI | https://developers.openai.com/codex/cli/slash-commands | 官方 Codex slash command reference；本地 curl 访问返回 403，保留官方 URL 作为来源 |
| Gemini CLI | https://geminicli.com/docs/reference/commands/ | Gemini CLI command reference |
| Aider | https://aider.chat/docs/usage/commands.html | Aider in-chat commands |
| Aider | https://aider.chat/docs/usage/options.html | Aider CLI options |
| OpenCode | https://opencode.ai/docs/cli/ | OpenCode CLI options and commands |
| OpenCode | https://opencode.ai/docs/tui/ | OpenCode TUI commands |
| GitHub Copilot CLI | https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference | GitHub Copilot CLI command reference |

## 实现取舍

| 决策 | 原因 |
| --- | --- |
| 内置命令放在前端静态文件 `src/lib/builtinAiCommands.ts` | 不污染用户模板，不新增数据库迁移，不增加启动 I/O |
| 命令包含 `tool/category/description/sourceUrl/interactive/tags` 元数据 | 后续可扩展为候选列表、来源展示、分类过滤或帮助面板 |
| 当前 UI 仍只显示 ghost 后缀 | 遵守第一阶段输入提示形态，避免引入弹窗复杂度 |
| slash command 标记 `interactive: true` | 明确这些命令只在对应 AI TUI 内有效 |
| 排序低于个人历史和会话/项目模板 | 用户真实习惯优先，内置命令只兜底 |
| AI provider 继续空实现 | `gpt-5.3-codex-spark` 接入留到下一阶段 |

## Claude Code

### CLI 命令候选

| 命令 | 用途 | 分类 |
| --- | --- | --- |
| `claude` | 启动交互式 Claude Code | launch |
| `claude "explain this project"` | 带初始提示启动 | launch |
| `claude -p "explain this function"` | print/headless 模式，完成后退出 | headless |
| `cat logs.txt \| claude -p "explain"` | 管道输入处理日志或文件内容 | headless |
| `claude --continue` / `claude -c` | 继续当前目录最近会话 | session |
| `claude -c -p "Check for type errors"` | 继续最近会话并以 print 模式执行 | session |
| `claude --resume auth-refactor` | 恢复指定会话 | session |
| `claude -r "auth-refactor" "Finish this PR"` | 恢复会话并发送新提示 | session |
| `claude update` | 更新 Claude Code | config |
| `claude install stable` | 安装或重装稳定版原生命令 | config |
| `claude auth login` | 登录 Anthropic 账号 | auth |
| `claude auth login --console` | 使用 Anthropic Console 登录 | auth |
| `claude auth status` | 查看登录状态 | auth |
| `claude auth logout` | 退出登录 | auth |
| `claude agents` / `claude agents --json` | 查看后台 agent 会话 | workflow |
| `claude attach <session-id>` | 附加到后台会话 | session |
| `claude logs <session-id>` | 查看后台会话输出 | diagnostic |
| `claude respawn <session-id>` | 重启后台会话 | session |
| `claude rm <session-id>` | 从列表移除后台会话 | session |
| `claude daemon status` | 查看后台 supervisor 状态 | diagnostic |
| `claude daemon stop --any --keep-workers` | 停止 supervisor 但保留 worker | diagnostic |
| `claude mcp` | 管理 MCP server | mcp |
| `claude mcp login sentry` | MCP OAuth 登录 | mcp |
| `claude mcp logout sentry` | 清除 MCP OAuth 凭据 | mcp |
| `claude plugin` | 管理插件 | config |
| `claude project purge . --dry-run` | 预览清理项目本地 Claude 状态 | diagnostic |
| `claude --model sonnet` / `claude --model opus` | 指定模型别名 | model |
| `claude --permission-mode plan` | 以 plan 权限模式启动 | permission |
| `claude --permission-mode acceptEdits` | 以自动接受编辑模式启动 | permission |
| `claude --permission-mode auto` | 以 auto 权限模式启动 | permission |
| `claude --dangerously-skip-permissions` | 跳过权限提示 | permission |
| `claude --add-dir <path>` | 授权额外目录 | permission |
| `claude --mcp-config ./mcp.json` | 指定 MCP 配置 | mcp |
| `claude --strict-mcp-config --mcp-config ./mcp.json` | 只使用显式 MCP 配置 | mcp |
| `claude --settings ./settings.json` | 本次调用覆盖设置 | config |
| `claude --safe-mode` | 禁用自定义项排障 | diagnostic |
| `claude -p "query" --output-format json` | print 模式 JSON 输出 | headless |
| `claude -p --output-format stream-json --verbose "query"` | stream-json 输出 | headless |
| `claude -p --prompt-suggestions --output-format stream-json --verbose "query"` | 输出下一步 prompt 建议事件 | headless |
| `claude --system-prompt "..."` | 替换系统提示词 | config |
| `claude --append-system-prompt "..."` | 追加系统提示词 | config |
| `claude --teleport` | 把 web 会话拉到本地终端 | session |
| `claude --worktree feature-auth` | 在隔离 git worktree 中启动 | git |

### slash command 候选

| 命令 | 用途 |
| --- | --- |
| `/help` | 查看帮助 |
| `/init` | 生成 starter `CLAUDE.md` |
| `/memory` | 管理项目记忆 |
| `/mcp` | 管理 MCP server |
| `/permissions` | 管理权限规则 |
| `/plan` | 进入计划模式 |
| `/model` | 切换模型 |
| `/effort` | 调整 reasoning effort |
| `/context` | 查看上下文占用 |
| `/compact` | 压缩上下文 |
| `/btw` | 旁路问题 |
| `/clear` | 开新会话 |
| `/resume` | 恢复会话 |
| `/branch` | 分支当前会话 |
| `/background` | 后台运行当前会话 |
| `/batch` | 分解大任务并行执行 |
| `/diff` | 查看变更 |
| `/review` | 审查 PR |
| `/code-review` | 审查当前 diff |
| `/code-review --fix` | 审查并应用可修复项 |
| `/security-review` | 安全审查 |
| `/simplify` | 简化/清理审查 |
| `/rewind` | 回退检查点 |
| `/doctor` / `/debug` | 诊断问题 |
| `/status` | 状态页 |
| `/usage` | 用量与费用 |
| `/tui fullscreen` | 切换 fullscreen TUI |
| `/theme` | 切换主题 |
| `/config` | 配置 |

## OpenAI Codex CLI

| 命令 | 用途 | 分类 |
| --- | --- | --- |
| `codex` | 启动交互式 Codex CLI | launch |
| `codex exec "explain this project"` | 非交互式执行 | headless |
| `codex login` / `codex logout` | 登录/退出 | auth |
| `codex resume` | 恢复历史会话 | session |
| `codex mcp` | 管理 MCP | mcp |
| `codex mcp add <name> -- <command>` | 添加 MCP server | mcp |
| `codex mcp list` | 列出 MCP server | mcp |
| `codex mcp remove <name>` | 删除 MCP server | mcp |
| `codex --model gpt-5.1-codex` | 指定模型 | model |
| `codex --sandbox read-only` | 只读沙箱 | permission |
| `codex --sandbox workspace-write` | 工作区写沙箱 | permission |
| `codex --ask-for-approval on-request` | 按需审批 | permission |
| `codex --ask-for-approval never` | 不请求审批 | permission |
| `codex --config model="gpt-5.1-codex"` | 覆盖配置 | config |
| `/help` / `/clear` / `/compact` / `/model` / `/status` / `/diff` / `/review` / `/new` / `/init` / `/mcp` | Codex TUI 内 slash commands | interactive |

## Gemini CLI

| 命令 | 用途 |
| --- | --- |
| `gemini` | 启动 Gemini CLI |
| `gemini --model gemini-2.5-pro` | 指定模型 |
| `gemini -p "explain this project"` | 直接发送 prompt |
| `/help` | 帮助 |
| `/chat save feature-work` | 保存/管理聊天检查点 |
| `/clear` | 清理当前上下文/屏幕 |
| `/compress` | 压缩上下文 |
| `/memory show` | 查看 memory |
| `/mcp` | MCP 状态/管理 |
| `/tools` | 工具列表 |
| `/stats` | 会话统计 |
| `/theme` | 主题 |
| `/auth` | 认证方式 |
| `/editor` | 编辑器设置 |
| `/restore` | 恢复检查点 |
| `/quit` | 退出 |

## Aider

| 命令 | 用途 |
| --- | --- |
| `aider` | 启动 Aider |
| `aider --model sonnet` | 指定模型 |
| `aider --architect` | architect/editor 工作流 |
| `aider --message "review this diff"` | 一次性消息 |
| `aider --yes --message "fix lint errors"` | 自动确认提示 |
| `aider --no-auto-commits` | 禁止自动提交 |
| `aider --watch-files` | 监听文件变化 |
| `aider --edit-format diff` | 指定编辑格式 |
| `aider --api-key openai=<key>` | 设置 provider key |
| `/help` | 帮助 |
| `/ask` | 只问问题不改代码 |
| `/code` | 请求改代码 |
| `/add` / `/drop` / `/read-only` / `/ls` | 管理上下文文件 |
| `/diff` / `/commit` | 查看 diff / 提交 |
| `/run` / `/test` | 运行命令 / 测试 |
| `/tokens` | 查看 token 占用 |
| `/model` | 切换模型 |
| `/clear` / `/reset` | 清理历史/上下文 |

## OpenCode

| 命令 | 用途 |
| --- | --- |
| `opencode` | 启动 OpenCode TUI |
| `opencode run Explain the use of context in Go` | 非交互式运行 |
| `opencode run --model anthropic/claude-sonnet-4-5 "review this diff"` | 指定 provider/model |
| `opencode run --format json "summarize this repo"` | JSON events 输出 |
| `opencode run --attach http://localhost:4096 "Explain async/await in JavaScript"` | 附加到 server |
| `opencode serve` | 启动 headless server |
| `opencode models` / `opencode models anthropic` / `opencode models --refresh` | 查看/刷新模型 |
| `opencode auth login` / `opencode auth list` | 认证管理 |
| `opencode github install` / `opencode github run` | GitHub 集成 |
| `opencode mcp add/list/auth/logout/debug` | MCP 管理 |
| `/help` / `/compact` / `/init` / `/models` / `/new` / `/redo` / `/sessions` / `/share` / `/themes` / `/thinking` / `/undo` / `/unshare` | OpenCode TUI slash commands |
| `!git status` | TUI 内运行 shell command |

## GitHub Copilot CLI

| 命令 | 用途 |
| --- | --- |
| `copilot` | 启动 GitHub Copilot CLI |
| `copilot "explain this repository"` | 直接提问 |
| `copilot --allow-all "fix failing tests"` | 自动允许全部权限 |
| `copilot --allow-tool="shell(git:*)" "inspect repository status"` | 允许部分工具 |
| `copilot --allow-tool="shell(git:*)" --deny-tool="shell(git push)" "prepare release notes"` | 允许 git 命令但拒绝 push |
| `copilot --allow-tool="MyMCP(create_issue)" "file a tracking issue"` | 允许特定 MCP 工具 |
| `gh copilot suggest` | GitHub CLI 扩展：建议 shell 命令 |
| `gh copilot explain` | GitHub CLI 扩展：解释 shell 命令 |
| `gh copilot config` | GitHub CLI 扩展：配置 |

## 风险

| 风险 | 控制 |
| --- | --- |
| AI CLI 命令变更快 | 每条命令带 sourceUrl；文档记录调研日期 |
| slash command 只在 TUI 内有效 | 元数据 `interactive: true` 标注，后续 UI 可显示 |
| 候选太多影响质量 | prefix 匹配、去重、只返回 top 1；个人历史和项目模板优先 |
| 内置命令误补全 | 只补后缀，不自动回车执行；无候选时 `Tab` 继续交给 shell |
