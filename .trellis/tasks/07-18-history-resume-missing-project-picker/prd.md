# 历史会话缺失匹配项目时支持手动恢复

## Goal

历史会话恢复时若找不到匹配项目，不再直接报错；改为让用户从全部项目中选择，或选择“使用新窗口”，并确保恢复命令在目标工作目录中执行。

## Requirements

- 仍保留现有精确匹配行为：唯一匹配项目时直接恢复，多个匹配项目时弹出选择器。
- 零匹配项目时打开选择器，展示全部项目，并增加“使用新窗口”选项。
- 选择项目时使用该项目配置启动恢复会话。
- 选择“使用新窗口”时不绑定项目，以历史会话可解析出的工作目录创建内部终端，再执行 Claude/Codex 恢复命令。
- “使用新窗口”是用户可见文案，不能写成“新增窗口”。
- 新增或修改文案同时支持 zh-CN 与 en-US。
- Changelog Target: `[TEMP]`。

## Acceptance Criteria

- [ ] 零匹配项目时不再显示“未找到项目”错误，而是显示全部项目和“使用新窗口”。
- [ ] 选择任一项目后能在目标工作目录恢复会话。
- [ ] 选择“使用新窗口”后先进入历史会话工作目录，再执行恢复命令。
- [ ] 历史会话缺少可解析工作目录时仍显示本地化错误，且不创建终端。
- [ ] 详情页“继续对话”和列表右键“恢复会话”行为一致。
- [ ] 唯一匹配、多匹配、Worktree 现有行为不回归。
- [ ] zh-CN / en-US 文案和 aria 标签完整。
- [ ] `npx tsc --noEmit` 通过。

## Technical Approach

- 在 `HistoryWorkspace` 的零候选分支打开现有项目选择弹窗，而非 toast 报错。
- 扩展 `HistoryResumeProjectDialog` 支持固定的“使用新窗口”操作。
- 复用 `terminalStore.createSession`；项目模式传入项目配置，新窗口模式不传 `projectId`，以历史会话目录作为 PTY cwd 后执行恢复命令。

## Root Cause

恢复入口把“零个自动匹配项目”误判为不可恢复状态并在候选分流层直接终止；该状态实际仍可由用户选择其他项目或创建不绑定项目的终端恢复，因此修复应落在候选分流和启动参数层，而不是修改错误提示。

## Out of Scope

- 不新增依赖。
- 不修改历史会话解析或后端 IPC。
- 不改变唯一匹配、多匹配和 Worktree 的自动匹配规则。

## Discovery List

- `src/components/HistoryWorkspace.tsx`：恢复候选分流、工作目录解析、终端创建。
- `src/components/history/HistoryResumeProjectDialog.tsx`：项目选择及“使用新窗口”入口。
- `src/lib/i18n.ts`：中英文用户文案与 aria 文案。
- `.trellis/spec/frontend/history-session-contracts.md`：现有零候选即报错契约需同步调整。
- `CHANGELOG.md`：用户可见行为变更，目标版本 `[TEMP]`。
- `docs/功能清单.md`：历史会话恢复能力说明。
- `src/stores/terminalStore.ts`：已确认 `createSession` 支持无 `projectId` 且先以 `cwd` 创建 PTY；本任务无需修改。
- `src-tauri/src/commands/history.rs`：历史数据提供方，确认与本次分流无关。
