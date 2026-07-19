# update-v1.2.1-changelog

## Goal

把 2026-06-26 这批已提交与当前未提交的改动整理到 `CHANGELOG.md` 的 `V1.2.1` 条目中，保证版本归档准确、表述简洁且不遗漏关键行为变化。

## What I already know

* `CHANGELOG.md` 当前最新版本是 `V1.2.0`，尚无 `V1.2.1` 条目。
* 已提交记录包含：
  * `457d7c3 fix: 调整设置页调试模式开关卡片样式`
  * `82eab2a fix: 限制应用单实例启动`
  * `94a02f5 feat(hooks): 支持 Hook 模块按需选装`
* 当前未提交改动集中在 `src-tauri/src/pty/manager.rs` 与 `.trellis/spec/backend/terminal-runtime-monitoring-contracts.md`，内容对应 Git Bash 终端首次启动卡住修复。
* 对应任务 `prd.md` 已存在，可作为变更描述依据：
  * `.trellis/tasks/06-26-hook-optional-install-selection/prd.md`
  * `.trellis/tasks/06-26-settings-debug-switch-card/prd.md`
  * `.trellis/tasks/06-26-single-instance-startup/prd.md`
  * `.trellis/tasks/06-26-fix-git-bash-terminal-startup-hang/prd.md`

## Requirements

* 在 `CHANGELOG.md` 顶部新增 `## [V1.2.1] - 2026-06-26`。
* 只记录本次确认过的四项变更，不扩展到无关任务。
* 文案与现有 changelog 风格保持一致，使用中文分组和要点描述。
* 不改动已有历史版本内容。

## Acceptance Criteria

* [ ] `CHANGELOG.md` 新增 `V1.2.1` 条目。
* [ ] 条目准确覆盖 Hook 模块按需选装、单实例启动、设置页调试开关卡片样式、Git Bash 首次启动修复。
* [ ] 既有版本内容未被误改。

## Definition of Done

* 改动限制在文档范围
* 通过文件检查确认条目已写入目标版本

## Out of Scope

* 不补写其他未确认任务
* 不修改源码或发布脚本

## Technical Notes

* 目标文件：`CHANGELOG.md`
* 依据来源：近期提交记录、当前 diff、相关任务 `prd.md`
