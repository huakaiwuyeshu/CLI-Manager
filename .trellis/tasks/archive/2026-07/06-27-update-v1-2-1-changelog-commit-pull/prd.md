# 更新 V1.2.1 变更记录并合并主分支

## Goal

将当前本地变更和自上次 V1.2.1 changelog 更新后的提交补入 `CHANGELOG.md` 的 V1.2.1 小节，提交后拉取远程主分支并处理冲突。

## Requirements

- 补全 `CHANGELOG.md` 顶部 `V1.2.1` 小节。
- 提交前明确包含和排除的 dirty 文件范围。
- 使用符合仓库近期风格的 Conventional Commit 信息。
- 提交后拉取远程主分支代码，并在出现冲突时解决冲突。

## Acceptance Criteria

- [ ] `CHANGELOG.md` 的 V1.2.1 小节覆盖本次相关功能和修复。
- [ ] Git 提交只包含确认过的文件。
- [ ] 拉取远程主分支完成，冲突已解决或明确报告阻塞点。
- [ ] 提交后运行必要的状态检查，确认工作区状态可解释。

## Definition of Done

- Changelog 已更新。
- Commit 已创建。
- 远程主分支已拉取并处理冲突。
- 输出最终提交、拉取和验证结果。

## Out of Scope

- 不改业务逻辑，除非解决合并冲突必须。
- 不推送远程。
- 不删除用户未确认的未跟踪文件或任务目录。

## Technical Notes

- 当前分支：`master`。
- 上次 V1.2.1 changelog 更新提交：`420ad7a docs(changelog): 更新 V1.2.1 变更记录`。
- 远程主分支按当前仓库命名预期为 `origin/master`。
