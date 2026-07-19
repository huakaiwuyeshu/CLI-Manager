# hook 模块按需选装

## Goal

让 Hook 设置页支持按模块选装，而不是只能整组安装/整组卸载，减少不需要的 Hook 写入并让用户按实际需求启用对应事件。

## What I already know

* 当前设置页的 Hook 模块卡片只展示安装状态，不支持点击安装或卸载。
* Claude 安装入口是 `src/components/settings/pages/HookSettingsPage.tsx` 中的 `handleClaudeInstall` / `handleClaudeUninstall`，Codex 安装入口是 `handleCodexInstall` / `handleCodexUninstall`。
* 后端 `src-tauri/src/commands/hook_settings.rs` 中的 `hook_settings_install` / `hook_settings_install_codex` 当前都会一次性写入整套 Hook 事件。
* Claude 当前成组写入 `SessionStart`、`UserPromptSubmit`、`Notification`、`Stop`、`StopFailure`、`SubagentStart`、`SubagentStop`、`PreToolUse`、`PostToolUse`。
* Codex 当前成组写入 `SessionStart`、`UserPromptSubmit`、`PermissionRequest`、`Stop`、`SubagentStart`、`SubagentStop`，并同时确保 `config.toml` 的 `[features].hooks = true`。
* 页面中已经有模块粒度的状态计算，例如 `claudeSessionStartInstalled`、`codexSubagentInstalled`，说明前端展示层已经具备模块级状态基础。

## Assumptions (temporary)

* “对应模块按需要选装”按当前页面卡片粒度实现，而不是只区分 Claude 整体和 Codex 整体。
* 模块之间允许存在依赖关系，例如某些模块需要一起安装。

## Open Questions

* 无

## Requirements (evolving)

* Hook 设置页支持按当前卡片粒度触发安装或卸载。
* Claude/Codex 的 `子 Agent` 模块作为一个整体模块处理，不继续拆分到底层单事件。
* 模块卡片未安装时点击安装，已安装时点击卸载。
* 底部现有按钮区保留，不额外新增模块操作按钮。
* 保留现有状态展示与通知开关能力。
* 不破坏用户自己已有的 Hook 配置。

## Acceptance Criteria (evolving)

* [ ] 用户可以在 Hook 设置页按卡片粒度安装或卸载 Claude Hook 模块。
* [ ] 用户可以在 Hook 设置页按卡片粒度安装或卸载 Codex Hook 模块。
* [ ] `子 Agent` 模块以单卡片形式处理其关联事件，不暴露更细粒度开关。
* [ ] 点击未安装卡片会安装对应模块；点击已安装卡片会卸载对应模块。
* [ ] 底部现有按钮区保持可用，不因模块化安装而移除。
* [ ] 已安装模块状态能在刷新后正确显示。
* [ ] 不需要的模块不会被整包写入。

## Technical Approach

* 前端将现有 Hook 状态卡片升级为可触发模块安装/卸载的交互单元。
* 后端安装/卸载命令从“整组写入”改为“按模块写入/移除”，并保留必要的模块依赖处理。
* 底部原有整组安装/删除按钮保留，作为批量操作入口。

## Definition of Done (team quality bar)

* Tests added/updated where appropriate
* Lint / typecheck / compile checks green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 改造 Hook 桥接协议本身
* 改造实时通知事件语义
* 改动项目级 `.claude` / `.codex` 局部配置策略

## Technical Notes

* 前端主文件：`src/components/settings/pages/HookSettingsPage.tsx`
* 后端主文件：`src-tauri/src/commands/hook_settings.rs`
* 相关后端规约：`.trellis/spec/backend/cli-hook-contracts.md`
