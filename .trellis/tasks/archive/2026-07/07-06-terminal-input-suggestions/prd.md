# 终端输入提示

## Changelog Target

[TEMP]

## Goal

在 CLI-Manager 内置终端中实现输入提示能力：优先基于本项目已有命令历史、当前项目上下文和命令模板推测用户下一步输入；参考 fish autosuggestions、Atuin 及类似开源项目的成熟思路，但功能必须集成在 CLI-Manager 内，不能安装或修改用户的 PowerShell、cmd、fish、zsh、Claude、Codex 等终端工具。

## What I already know

* 用户希望下载并研究 fish autosuggestions、Atuin 及类似开源实现，把可复用能力融合进本项目。
* 第一阶段符合目标的是本地历史输入提示和历史搜索/排序，不是终端工具级插件。
* 后续需要预留 AI 推测能力，目标模型为 `gpt-5.3-codex-spark`，但本阶段只做可切换的公共方法和接口，不直接接入 AI。
* `CHANGELOG.md` 目标版本未指定，按 `[TEMP]` 记录。
* 计划文件已存在：`.claude/plan/terminal-input-suggestions.md`。

## Assumptions

* 本阶段不复制 GPL 代码；fish-shell 作为行为参考，不作为源码移植来源。
* 可直接复用的源码仅限许可证兼容的 MIT/BSD/Apache 等项目，并需要保留来源说明。
* AI 推测 provider 只做接口预留，不发起网络请求、不存储 API key、不新增模型配置 UI。

## Requirements

* 下载并研究至少这些开源实现：
  * Atuin：历史存储、上下文过滤、搜索排序。
  * zsh-autosuggestions：输入前缀匹配、接受/清除建议策略。
  * based.fish 或同类 fish 生态项目：cwd、频率、最近使用等排序策略。
  * McFly 或同类历史增强项目：历史评分特征参考。
* 形成可落地的公共建议接口，方便在本地历史策略和未来 AI 策略之间切换。
* 第一阶段默认 provider 为本地历史/模板推测。
* 本地 provider 还应提供只读内置 AI CLI 命令库，覆盖 Claude Code、OpenAI Codex CLI、Gemini CLI、Aider、OpenCode、GitHub Copilot CLI 等常用 AI 开发工具。
* 内置 AI 命令库必须带来源说明，不写入 `command_templates`，不污染用户自定义模板。
* 预留 AI provider：
  * provider 名称可配置为 `ai` 或类似稳定枚举。
  * 模型标识预留 `gpt-5.3-codex-spark`。
  * AI provider 本阶段返回未启用/空结果，不能影响本地提示。
* 终端输入提示必须运行在 CLI-Manager 前端层，不修改用户 shell 配置。
* 接受建议只能补全文本，不自动回车执行。
* 仅当当前存在 ghost 候选时拦截 `Tab` 接受建议；没有候选时必须把 `Tab` 继续交给 shell 和 CLI 自带补全。
* 输入提示展示为光标后的低透明内联 ghost 文本，类似 fish autosuggestions，不使用弹窗候选列表作为第一阶段默认形态。
* ghost 文本只是视觉层，不写入 xterm buffer，不进入 `inputBuffer`，不发送到 PTY。
* 新增用户可见文案必须支持 `zh-CN` 与 `en-US`。

## Acceptance Criteria

* [ ] 任务目录中保存开源实现研究记录和源码引用位置。
* [ ] PRD 明确哪些代码可复用、哪些只能参考。
* [ ] 设计中存在统一建议接口，可切换本地 provider 与预留 AI provider。
* [ ] 本地 provider 使用项目历史、命令模板和当前输入生成建议。
* [ ] 本地 provider 合并内置 AI CLI 命令候选，并且个人历史/会话模板优先于内置命令。
* [ ] 内置 AI CLI 命令库记录官方/可靠来源、适用范围和交互式命令限制。
* [ ] AI provider 预留 `gpt-5.3-codex-spark` 接口，但本阶段不发请求。
* [ ] 接受建议只追加安全后缀，不替换当前输入，不自动执行；`Tab` 仅在存在候选时消费，否则不拦截。
* [ ] 建议以光标后的内联 ghost 文本展示，样式跟随终端字体和主题色。
* [ ] ghost 文本不污染终端输出、复制内容、历史记录和 PTY 输入。
* [ ] 关闭设置后不展示建议、不拦截接受快捷键。
* [ ] TypeScript 类型检查通过。
* [ ] `CHANGELOG.md` 和 `docs/功能清单.md` 按项目规则更新。

## Definition of Done

* 开源参考和许可证判断写入 `research/`。
* 代码实现遵守本项目现有 React/Zustand/i18n 模式。
* 运行必要类型检查；不主动运行 dev/build，除非用户要求。
* 不引入全局安装、不改用户终端配置。

## Out of Scope

* 本阶段不接入真实 OpenAI 请求。
* 本阶段不实现 API key 管理。
* 本阶段不做云同步历史。
* 本阶段不把任何插件安装到 PowerShell/fish/zsh/cmd。
* 本阶段不复制 fish-shell GPL 源码进产品代码。

## Technical Notes

* 现有输入链路在 `src/components/XTermTerminal.tsx`：`terminal.onData` -> `forwardTerminalInput` -> `pty_write`。
* 现有历史存储在 `src/stores/commandHistoryStore.ts`，SQLite 表为 `command_history`。
* 现有模板存储在 `src/stores/templateStore.ts`，可作为建议候选。
* 终端设置在 `src/stores/settingsStore.ts` 和 `src/components/settings/pages/ThemeSettingsPage.tsx`。
* 研究源码应只放在 `.trellis/tasks/07-06-terminal-input-suggestions/research/sources/`，不进入产品发布包。

## Research References

* [`research/oss-autosuggestion-findings.md`](research/oss-autosuggestion-findings.md) — Atuin、zsh-autosuggestions、based.fish、McFly、fish-shell 的输入提示/历史排序研究与许可证判断。
* [`research/ai-cli-command-catalog.md`](research/ai-cli-command-catalog.md) — Claude Code、Codex、Gemini CLI、Aider、OpenCode、GitHub Copilot CLI 的内置命令清单与来源。

## Technical Approach

* 新增前端公共建议模块，统一暴露 `getTerminalInputSuggestions(context, options)` 一类方法。
* `TerminalSuggestionContext` 统一携带 `input`、`projectId`、`cwd`、`sessionId`、`previousCommand`、`templates`、`history`、`provider`、`model`。
* provider 使用稳定枚举：`local`、`ai`。第一阶段默认 `local`；`ai` 只注册空实现。
* `local` provider 使用历史命令、模板和内置 AI CLI 命令生成候选，并只允许前缀安全补全。
* 内置 AI CLI 命令以静态只读数据存在于前端模块，包含 `command`、`tool`、`category`、`description`、`sourceUrl`、`interactive` 等元数据。
* 候选排序：用户历史最高，会话/项目模板其次，内置 AI 命令作为兜底；普通全局模板和内置命令的优先级按分值控制，避免长期空历史时提示缺失。
* `ai` provider 预留模型标识 `gpt-5.3-codex-spark`，当前返回空列表或未启用状态，不发网络请求、不读取 API key。
* `XTermTerminal` 只消费公共建议方法，不关心候选来自本地还是 AI，后续切换只改 provider 配置和 provider 实现。
* UI 采用内联 ghost overlay：根据 xterm 光标位置计算 DOM 绝对定位，仅绘制建议后缀；接受时才通过现有 `forwardTerminalInput` 写入 suffix。

## Decision (ADR-lite)

**Context**: 用户明确要求下一步接入 `gpt-5.3-codex-spark` 做 AI 推测，但本阶段只实现第一阶段输入提示，并为后续切换保留公共方法。

**Decision**: 本阶段实现 provider 抽象与本地 provider；AI provider 只做类型、默认模型常量和空实现预留。

**Consequences**: 当前无 AI 网络风险和密钥管理成本；后续接入真实模型时可替换 `ai` provider，不需要重写终端输入链路。
