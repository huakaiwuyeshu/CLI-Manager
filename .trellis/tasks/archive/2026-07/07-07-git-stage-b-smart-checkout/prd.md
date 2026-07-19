# V1.2.6 Git Stage B Smart Checkout

## Goal

Stage A 已补齐 Git 分支菜单、Fetch、本地切换、远程 checkout 和新建分支。Stage B 继续补高频但风险更高的 checkout 冲突处理：当切换分支会覆盖本地未提交改动时，提供 JetBrains 风格的安全选择，而不是只报错。

## Changelog Target

V1.2.6

## What I Already Know

* Stage A 已完成并提交：
  * `9f2a103 feat: enhance git branch workflow`
  * `4983802 docs: record git branch workflow contracts`
  * `4977506 docs: refresh GitNexus index metadata`
* 用户已手工验证 Stage A 的新建分支、切换分支可用。
* Stage A 当前对 checkout 冲突只提示“本地改动会被覆盖，请先提交或暂存”。
* 之前 JetBrains 对比中，Smart Checkout 评分 78，因会移动用户改动被推迟到 Stage B。
* 本项目不能自动强制覆盖用户工作区；Git 操作必须由后端 Tauri command 执行，前端不拼 shell 命令。
* 2026-07-07：用户确认 Stage B 采用方案 1：Smart Checkout only。

## Assumptions

* Stage B 优先做 Smart Checkout 的最小安全闭环，不做完整 Git Log、三方合并编辑器或复杂 Shelf UI。
* 自动 stash 只在用户明确选择时执行，不默认迁移未提交改动。
* stash 信息要可读，便于用户后续在终端或未来 UI 中识别。

## Open Questions

* 已确认：Stage B 选择方案 1，只做 Smart Checkout only。

## Requirements

* 当 `git_checkout_branch` 返回 `checkout_conflict` 时，前端不只显示 toast，应弹出明确选择。
* 弹窗至少提供：
  * 取消：不修改工作区，不切换分支。
  * 暂存并切换：执行 stash，checkout 目标分支，再尝试 apply stash。
* Smart Checkout 必须避免强制 checkout。
* stash/apply 失败时必须提示用户当前状态和下一步建议。
* 所有新增可见文案必须走 `src/lib/i18n.ts`，兼容 `zh-CN` 与 `en-US`。
* 操作完成后刷新 changes、branch status、branch list 和 repository list。

## Acceptance Criteria

* [x] checkout 冲突时弹出 Smart Checkout 选择，而不是只 toast。
* [x] 选择取消后当前分支、工作区文件和变更列表不变。
* [x] 选择暂存并切换后，后端执行 `git stash push`、`git checkout`、`git stash apply` 的安全序列。
* [x] stash/apply 成功后目标分支生效，本地改动被恢复。
* [x] apply 出现冲突时不吞错误，提示用户去解决冲突，并刷新 Git 面板。
* [x] 不引入新依赖。
* [x] `npx tsc --noEmit` 通过。
* [x] Rust 侧若有修改，`cd src-tauri && cargo check` 通过。
* [x] 必要 Rust 单测覆盖 Smart Checkout 命令参数校验和错误映射。
* [x] `CHANGELOG.md` 和 `docs/功能清单.md` 更新 Stage B 能力。

## Recommended MVP

**Smart Checkout only**（用户已确认）：

* 后端新增一个明确命令，例如 `git_smart_checkout_branch(project_path, branch, remote)`。
* 命令内部顺序：
  1. 校验分支名。
  2. `git stash push -u -m "CLI-Manager smart checkout: <branch>"`
  3. 执行本地或远程 checkout。
  4. `git stash apply` 最近 stash。
  5. 返回阶段化结果，前端据此提示成功、checkout 失败、apply 冲突。
* 前端只在普通 checkout 失败且错误码是 `checkout_conflict` 时展示 Smart Checkout 弹窗。

## Deferred

* 完整 stash 列表、命名、drop、pop 历史管理。
* Git Log / commit graph。
* 三方冲突合并编辑器。
* 强制 checkout。
* 自动删除 stash。Stage B 先不做自动 drop，避免 apply 后用户失去兜底恢复点。

## Technical Notes

* 复用 Stage A 的分支菜单和错误映射。
* 复用后端 `run_git_cli`，保持系统 Git、Credential Manager、SSH 配置行为一致。
* 复用 `validate_branch_name_with_git`，不要在前端重复实现完整 Git ref 校验。
* 参考已归档 Stage A 研究：`.trellis/tasks/archive/2026-07/07-07-git-feature-enhancement-v1-2-6/research/jetbrains-git-comparison.md`。

## Decision (Draft)

**Context**: Stage A 分支切换功能已经可用，但 checkout 冲突时仍需要用户离开 UI 手动 stash/commit。

**Decision**: Stage B 只做 Smart Checkout 的受控闭环，先不做完整 Stash 管理 UI，也不顺手补最近 stash apply/pop。

**Consequences**: 能补齐 JetBrains 高频体验里最痛的一段；但 stash 历史管理仍留给后续阶段。
