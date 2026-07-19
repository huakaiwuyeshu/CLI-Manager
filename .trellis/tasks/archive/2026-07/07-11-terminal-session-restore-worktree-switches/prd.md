# 隔离终端会话恢复环境并增加开发者开关

## Goal

避免开发环境读取或覆盖安装版的终端会话恢复快照，并允许用户在“设置 -> 开发者”中关闭终端会话恢复及 Worktree开发入口。

## Requirements

- 开发环境与安装环境使用不同的终端会话恢复快照文件。
- 安装环境继续使用现有 `sessions.json`，开发环境使用独立快照文件，不迁移或清理安装环境快照。
- 新增“恢复上次终端会话”开发者设置，默认开启。
- 关闭会话恢复后，启动时不弹出恢复提示，并清理当前环境的恢复快照。
- 新增“Worktree开发”开发者设置，默认开启。
- 关闭 Worktree 配置后，新增/修改项目不显示 Worktree 配置区域。
- 关闭 Worktree 配置后，打开同项目新终端时直接普通打开，不弹出“该项目已有终端会话”，也不执行项目配置的自动 Worktree 隔离策略。
- 已有项目的 Worktree 配置和已有 Worktree 数据保持不变，手动 Worktree 操作不在本次范围内禁用。
- 新增用户可见文案必须同时支持 `zh-CN` 与 `en-US`。

## Acceptance Criteria

- [ ] `tauri dev` 使用的会话快照与安装版快照互不影响。
- [ ] 两个新设置默认开启，升级后保持当前行为。
- [ ] 关闭会话恢复后，重启不再显示恢复提示。
- [ ] 关闭 Worktree 配置后，新增和编辑项目均不显示 Worktree 配置区域。
- [ ] 关闭 Worktree 配置后，同项目已有终端时再次打开项目不出现 Worktree 提示，并直接创建普通终端。
- [ ] 编辑已有项目时，即使 Worktree 配置区域隐藏，也不会清空原 Worktree 字段。
- [ ] TypeScript 类型检查、Rust 编译检查及相关测试通过。

## Technical Approach

- 在后端数据路径解析中按调试构建选择独立的开发环境 sessions 文件名。
- 在 settings store 中增加两个布尔设置，并沿用现有持久化和默认值模式。
- 在应用启动恢复流程和项目终端打开流程入口处增加设置门控。

## Out of Scope

- 不隔离项目数据库、普通设置、同步配置或 Provider 配置。
- 不删除已有 Worktree，不隐藏侧边栏中已有 Worktree，也不禁用手动 Worktree 操作。

## Changelog Target

`[TEMP]`

## Notes

- GitNexus 初步影响分析：`App`、`DeveloperSettingsPage`、`ConfigModal`、`data_paths` 均为 LOW 风险。
- 已确认方案，无待决产品问题。
- 验证通过：`npx tsc --noEmit`、`cargo check`、`cargo test app_paths --lib`（4 tests passed）、`rustfmt --edition 2021 --check src/app_paths.rs`、`git diff --check`。
- GitNexus 全工作区扫描因其他并行修改显示 CRITICAL；本任务涉及的 `App`、`ConfigModal`、`DeveloperSettingsPage`、`Sidebar`、`data_paths` 单符号影响分析均为 LOW。
- 未启动 `tauri dev` 或安装包进行手动 UI 验证，遵守当前任务的启动命令限制。
