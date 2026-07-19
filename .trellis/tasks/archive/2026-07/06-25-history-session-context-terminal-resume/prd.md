# 历史会话列表右键打开终端继续会话

## Goal

在历史会话列表里，通过会话项右键菜单直接打开一个终端并恢复对应的 Claude / Codex 历史会话，减少从历史记录手动复制 session id 再输入恢复命令的操作。

## Requirements

* 历史会话列表的会话项右键菜单新增“打开终端继续会话”。
* 点击后创建新的内置终端 Tab，并自动写入对应 CLI 的恢复命令。
* Claude 历史会话使用 `claude --resume <session_id>`。
* Codex 历史会话使用 `codex resume --no-alt-screen <session_id>`。
* 新终端 cwd 优先匹配已配置项目；匹配不到且 `project_key` 看起来像绝对路径时才使用它，否则使用默认 cwd，避免无效目录阻塞恢复。
* 恢复成功触发终端创建后关闭历史工作区，回到终端视图。
* 保留现有“删除”右键菜单行为。

## Acceptance Criteria

* [ ] 右键任意历史会话项可看到“打开终端继续会话”和“删除”。
* [ ] 点击 Claude 会话的继续操作会创建终端并执行 `claude --resume <session_id>`。
* [ ] 点击 Codex 会话的继续操作会创建终端并执行 `codex resume --no-alt-screen <session_id>`。
* [ ] 已配置项目能尽量使用项目路径、shell、env_vars 作为终端上下文。
* [ ] 未匹配到项目时仍能创建终端，不因无效 `project_key` 阻塞用户继续会话。
* [ ] 删除菜单项仍能正常打开确认弹窗并删除目标历史会话。

## Definition of Done

* 前端类型检查通过。
* 代码只改必要的前端串联逻辑，不新增依赖。
* 不修改后端历史解析合约。

## Technical Approach

`HistoryWorkspace` 负责把 `HistorySessionView` 转成终端创建参数：根据 `source` 生成恢复命令，根据项目列表解析 cwd/env/shell/title，再调用 `useTerminalStore.createSession`。`HistoryListPane` 只增加右键菜单项和 `onResumeSession` 回调，不直接依赖终端 store。

## Decision (ADR-lite)

**Context**: 当前历史列表只负责展示/删除，终端创建能力已有 `createSession` 和项目启动参数模式；后端历史 payload 不包含可靠原始 cwd 字段。

**Decision**: 先做前端最小串联，不新增后端接口。项目上下文通过已加载项目列表尽力匹配，匹配失败时只在 `project_key` 是路径形态时作为 cwd，否则让终端使用默认 cwd。

**Consequences**: 对历史文件里没有可匹配项目的老会话，cwd 可能不是原始项目路径，但仍能打开恢复命令。后续如果需要 100% 精确 cwd，可扩展后端 `HistorySessionSummary` 暴露扫描到的 cwd。

## Out of Scope

* 不新增后端历史字段。
* 不支持外部 Windows Terminal 恢复入口。
* 不实现批量恢复多个历史会话。
* 不改变历史会话删除逻辑。

## Technical Notes

* `src/components/history/HistoryListPane.tsx`：已有会话项右键菜单，目前只有删除。
* `src/components/HistoryWorkspace.tsx`：已有 projects/groups/history store 上下文，适合放恢复串联逻辑。
* `src/stores/terminalStore.ts`：`createSession(projectId, cwd, title, startupCmd, envVars, shell)` 会创建 PTY 并延迟写入 `startupCmd`。
* `src/lib/projectStartupCommand.ts`：项目普通启动命令已有 Codex `--no-alt-screen` 处理；本任务恢复命令需要单独生成。
* 本机 CLI 帮助确认：Claude 支持 `--resume [value]`，Codex 支持 `resume [SESSION_ID]` 和 `--no-alt-screen`。
