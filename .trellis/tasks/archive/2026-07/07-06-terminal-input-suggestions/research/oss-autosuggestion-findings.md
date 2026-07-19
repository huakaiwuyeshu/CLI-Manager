# 开源输入提示实现研究

## 下载的参考源码

源码下载位置：`research/sources/`

| 项目 | 本地目录 | Commit | 许可证 | 结论 |
|---|---|---:|---|---|
| Atuin | `sources/atuin` | `ba0ce4fbdec53217e9997d536a2ead1b5174642d` | MIT | 可参考/可复用兼容片段；重点是上下文过滤和历史评分。 |
| zsh-autosuggestions | `sources/zsh-autosuggestions` | `85919cd1ffa7d2d5412f6d3fe437ebdbeeec4fc5` | MIT | 可参考/可复用兼容片段；第一阶段最贴近输入建议策略。 |
| based.fish | `sources/based.fish` | `aa00038f28534bd45cb463b8bdfdafbc51331157` | MIT | 可参考/可复用兼容片段；重点是 cwd、频率、最近使用的组合排序。 |
| McFly | `sources/mcfly` | `b5b8ba1eb95316184a769b69712daed7d56522db` | MIT | 可参考/可复用兼容片段；重点是多特征评分和历史上下文。 |
| fish-shell | `sources/fish-shell` | `5b933cacdc82cd8103899c6130c0c91a8bb2bc6c` | GPLv2 为主 | 只作行为参考，不复制源码进产品代码。 |

## zsh-autosuggestions

关键文件：

| 文件 | 可借鉴点 |
|---|---|
| `sources/zsh-autosuggestions/src/fetch.zsh` | 多策略 provider 链：按顺序尝试策略，第一条有效建议即返回；返回前强制验证建议必须以当前输入为前缀。 |
| `sources/zsh-autosuggestions/src/strategies/history.zsh` | 最近历史前缀匹配。 |
| `sources/zsh-autosuggestions/src/strategies/match_prev_cmd.zsh` | “上一条命令上下文”策略：优先选择历史中曾经跟随相同上一条命令的候选。 |
| `sources/zsh-autosuggestions/src/widgets.zsh` | 只显示后缀、接受建议时追加后缀；执行建议是单独动作。 |

对本项目的映射：

* 保留“策略链”概念，但实现为 TypeScript provider。
* 强制 `suggestion.command.startsWith(input)` 后才允许一键补全。
* 接受建议只写入 suffix，不发送回车。
* `execute suggestion` 不进入第一阶段。

## Atuin

关键文件：

| 文件 | 可借鉴点 |
|---|---|
| `sources/atuin/crates/atuin/src/command/client/search/engines.rs` | `SearchState` 统一携带输入、filter mode、context；`SearchEngine` trait 隔离具体搜索实现。 |
| `sources/atuin/crates/atuin-client/src/settings.rs` | `FilterMode` 支持 global、host、session、directory、workspace、session-preload。 |
| `sources/atuin/crates/atuin/src/command/client/search/engines/skim.rs` | fuzzy 结果按频率、时间衰减、路径距离、匹配起点加权；去重后保留高分项。 |

对本项目的映射：

* 定义 `TerminalSuggestionContext`，统一携带 `input`、`projectId`、`cwd`、`sessionId`、`previousCommand`、`model`。
* 第一阶段只实现 `project` / `cwd` / `global` 三类过滤；`session` 和 `workspace` 作为后续扩展。
* 排序采用简单可解释权重，不引入 Atuin 的完整 fuzzy 引擎。

## based.fish

关键文件：

| 文件 | 可借鉴点 |
|---|---|
| `sources/based.fish/functions/__based.fish` | SQLite 查询将当前路径、导入历史、频率、最近使用组合排序。 |
| `sources/based.fish/README.md` | 当前目录优先、频率优先、最近命令优先；空输入时先给当前目录最近命令，再给高频命令。 |

对本项目的映射：

* 如果 `command_history` 扩展 `cwd` 字段，排序可优先 `cwd` 精确匹配。
* 空输入时展示当前项目/目录最近命令和高频命令。
* 非空输入时优先前缀匹配；可选 fuzzy 仅用于列表排序，不能直接绕过安全补全。

## McFly

关键文件：

| 文件 | 可借鉴点 |
|---|---|
| `sources/mcfly/src/history/history.rs` | `Features` 包含年龄、长度、退出状态、目录、重叠度、选择次数、出现次数等多维特征。 |
| `sources/mcfly/src/history/schema.rs` | `selected_commands` 记录用户从 UI 选择过的命令，可反哺排序。 |
| `sources/mcfly/src/node.rs` | 多特征加权评分。 |

对本项目的映射：

* 第一阶段不引入神经网络或训练机制。
* 可新增轻量字段/统计：`usage_count`、`last_used_at`、`selected_count`、`cwd`。
* 先用透明可调的线性权重，方便后续 AI provider 接入前保持行为可解释。

## fish-shell

关键文件：

| 文件 | 参考点 |
|---|---|
| `sources/fish-shell/src/reader/reader.rs` | autosuggestion 生成/接受的行为边界。 |
| `sources/fish-shell/src/screen.rs` | autosuggestion 如何作为视觉层显示，不等于真实输入。 |
| `sources/fish-shell/src/complete.rs` | autosuggest 模式与普通补全分离。 |

限制：

* `COPYING` 明确 fish-shell 大部分为 GPLv2。
* 本项目不能直接复制 fish-shell 代码；只能参考交互行为。

## 推荐融合方案

第一阶段采用“本地策略链 + 公共 provider 接口”：

1. `previous-command` 策略：借鉴 zsh `match_prev_cmd`，如果能从本会话最近命令推导上一条命令，则优先推荐曾跟随它的候选。
2. `cwd/project` 策略：借鉴 based.fish 和 Atuin，当前项目/目录历史优先。
3. `recent/frequency` 策略：当前上下文无命中时，回退到最近和高频历史。
4. `template` 策略：命令模板作为低风险候选源。
5. `ai` 策略：仅预留 provider，不执行请求。

版权策略：

* 可以复用 MIT 项目的算法思想和少量必要逻辑，但实现应改写为本项目 TypeScript 风格。
* 如果后续确实复制 MIT 项目的具体代码片段，需要新增第三方版权说明。
* 不复制 fish-shell GPL 源码。
