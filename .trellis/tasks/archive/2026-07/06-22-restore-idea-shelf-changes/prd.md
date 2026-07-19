# restore-idea-shelf-changes

## Goal

恢复 IDEA 在更新前自动 shelve 的代码，避免用户已写代码丢失，同时不覆盖当前工作区里已有的未提交文件。

## What I already know

* 用户要求：IDEA 把代码暂存了，需要恢复。
* 当前工作区有未跟踪文件/任务目录；需要避免误覆盖。
* 最新 IDEA shelf 位于 `.idea/shelf/在进行更新之前于_2026-06-22_21_48_取消提交了更改_[更改]/shelved.patch`。
* 该 patch 涉及 5 个文件：`src/components/terminal/TerminalSidePanel.tsx`、`src/App.css`、`src/components/history/SessionDetailPane.tsx`、`.trellis/spec/frontend/component-guidelines.md`、`src/components/TerminalTabs.tsx`。
* `git apply --check` 与 `git apply --3way --check` 均失败，主要原因是当前代码与 shelve 基线不完全一致，需要手动合并。
* GitNexus impact：`SessionDetailPane` 和 `TerminalTabs` upstream 风险 LOW；`TerminalSidePanel` 未被 GitNexus 索引命中，需要按文件和调用点谨慎处理。

## Requirements

* 只恢复最新 `2026-06-22 21:48` 的 IDEA shelved changes。
* 用最小改动手动合并 patch，不做额外重构。
* 保留当前文件中已经存在且与 patch 不冲突的后续修正。
* 恢复后运行前端类型检查。

## Acceptance Criteria

* [ ] shelf patch 中有意义的 5 个文件改动已恢复到工作区。
* [ ] 没有覆盖当前未跟踪文件。
* [ ] `npx tsc --noEmit` 通过，或明确报告失败原因。
* [ ] `git status --short` 能展示恢复后的变更范围。

## Definition of Done

* 类型检查完成。
* 说明恢复了哪些文件、哪些地方因当前代码已变化做了手动合并。
* 不执行 commit/push 等 Git 写入远端操作。

## Out of Scope

* 不恢复更早日期的 IDEA shelf。
* 不处理当前无关的未提交任务目录和未跟踪历史组件文件。
* 不启动桌面应用做人工 UI 验收。

## Technical Notes

* `git apply --stat` 统计：5 files changed, 281 insertions(+), 37 deletions(-)。
* `src/components/terminal/TerminalSidePanel.tsx` 当前默认宽度已经是 220，并包含 243 旧值迁移逻辑；恢复独立 stats/git 面板宽度时应保留这个迁移意图。
