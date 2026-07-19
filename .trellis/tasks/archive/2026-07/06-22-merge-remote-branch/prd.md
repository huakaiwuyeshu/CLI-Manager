# merge-remote-branch

## Goal

拉取并合并默认远程主分支 `origin/master` 的最新代码，同时保护当前工作区中已恢复的本地改动，必要时解决冲突。

## Requirements

* 目标远程分支：`origin/master`。
* 合并前保护当前未提交改动和未跟踪文件。
* 优先使用 `fetch` + 显式合并流程，而不是在脏工作区直接 `pull`。
* 合并后恢复本地改动并解决冲突。
* 不执行 commit、push、reset --hard 等高风险操作。

## Acceptance Criteria

* [ ] 已拉取 `origin/master` 最新引用。
* [ ] 当前 `master` 已与 `origin/master` 合并或确认无需合并。
* [ ] 本地改动已恢复到工作区。
* [ ] 没有未解决的 Git 冲突标记。
* [ ] 运行 `npx tsc --noEmit` 验证，或明确报告失败原因。

## Definition of Done

* 汇总 merge/fetch 结果、冲突处理结果、验证结果和最终 `git status --short --branch`。

## Out of Scope

* 不合并 `fork/*` 或其它未指定分支。
* 不提交、不推送。
* 不删除用户已有未跟踪文件。

## Technical Notes

* 2026-06-22 用户已确认按 `origin/master` + 先保护本地改动的策略执行。
* 当前工作区有恢复 IDEA shelf 产生的 5 个修改文件，以及多个未跟踪任务目录/历史组件文件。
