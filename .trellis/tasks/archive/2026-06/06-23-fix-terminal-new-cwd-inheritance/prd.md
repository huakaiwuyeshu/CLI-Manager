# 修复新建终端继承当前目录但保持普通终端

## Goal

修复 GitHub issue #44：在已有终端中点击“新建终端”时，新终端应像“复制”一样使用当前终端的工作目录，但不能复制启动命令或环境变量注入，必须保持为一个普通空终端。

## Requirements

* 从终端页工具栏/Tab 区、全局快捷键、命令面板触发“新建终端”时，如果当前有活跃普通终端且存在 `cwd`，新终端使用该 `cwd`。
* 从上述入口触发“新建终端”时，如果当前有活跃普通终端，新终端显示标题继承当前终端标题。
* 新终端不继承当前终端的 `projectId`、`startupCmd`、`envVars`，避免自动执行项目启动命令或注入项目环境变量。
* 子 Agent 转录伪会话不作为继承来源，新终端回退为无 `cwd` 且标题为普通 `Terminal`。
* “复制”行为保持不变：继续复制项目、目录、标题、启动命令、环境变量和 shell。
* 外部终端模式也应只传递当前目录和显示标题，不传递启动命令。

## Acceptance Criteria

* [ ] 在项目终端中点击“新建终端”，新 Tab 打开在当前终端目录。
* [ ] 在已重命名/项目终端中点击“新建终端”，新 Tab 显示标题继承当前终端标题。
* [ ] 从子 Agent 转录伪会话触发“新建终端”时，新 Tab 标题为 `Terminal` 且不继承目录。
* [ ] 新建的 Tab 不会执行当前终端的 `startupCmd`。
* [ ] 新建的 Tab 不会继承当前终端的 `envVars`。
* [ ] 右键/菜单“复制”仍保留原有完整复制行为。
* [ ] 前端类型检查通过：`npx tsc --noEmit`。

## Definition of Done

* 前端实现匹配现有 React/Zustand 代码风格。
* 变更范围仅限终端新建入口及必要辅助逻辑。
* 不改变后端 PTY 创建语义。
* 不主动提交 git commit。

## Technical Approach

在 `TerminalTabs` 中基于 `activeSession` 计算普通新终端可继承的 `cwd`，并在 `handleNewTab` 调用 `createSession(undefined, cwd, "Terminal")`。外部终端模式调用 `openWindowsTerminal([{ title: "Terminal", cwd }])`。由于 `createSession` 的第四、五个参数未传入，新终端不会写入启动命令，也不会带入调用方环境变量。

## Decision (ADR-lite)

**Context**: 当前“复制”会完整复制终端配置；issue 要求“新建终端”只复用当前目录，不能执行命令或继承环境。

**Decision**: 只在 UI 新建入口继承当前 `cwd`，不修改 `createSession` 的默认语义，也不改变“复制”。

**Consequences**: 影响面小；快捷键/命令面板是否继承 cwd 可后续单独统一，本次优先修复 issue 指向的终端页新建按钮行为。

## Out of Scope

* 不改变项目列表双击、命令面板项目启动、命令模板执行逻辑。
* 不改变“复制”菜单的完整复制语义。
* 不新增设置项。
* 不修改后端 shell/PTY 目录解析。

## Technical Notes

* 相关入口：`src/components/TerminalTabs.tsx` 的 `handleNewTab` 与 `handleDuplicateSession`。
* `src/stores/terminalStore.ts` 中 `createSession` 只有传入 `startupCmd` 时才会延迟写入命令；只有传入 `envVars` 时才会合并调用方环境变量。
* “复制”当前位于 `TerminalTabs`，传入 `session.startupCmd` 与 `session.envVars`，本任务不改。
* GitHub issue #44 URL: https://github.com/dark-hxx/CLI-Manager/issues/44
