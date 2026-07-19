# Research: Worktree 并行任务隔离代码证据

## 项目与数据库

- SQLite migrations 定义在 `src-tauri/src/lib.rs`，当前最后版本 v13（`add_cli_args_to_projects`）。新增 worktree 表/项目字段必须追加 v14 migration，历史 migration 不改。
- `projects` 表已有字段：`id/name/path/group_name/group_id/sort_order/cli_tool/cli_args/startup_cmd/env_vars/shell/provider_overrides/created_at/updated_at`。
- `Project` / `CreateProjectInput` / `UpdateProjectInput` 在 `src/lib/types.ts`，需要增加 worktree 策略与自定义根目录字段。
- `projectStore.fetchAll()` 目前只加载 groups + projects，并用 `buildTree(groups, projects, search)` 构造 `TreeNode[]`。worktree 子条目需要扩展 `TreeNode` 联合类型和项目树构造。
- 启动时终端会话不恢复（项目 CLAUDE.md 记录 `sessionStore.clear()`），因此 worktree 记录必须独立持久化，不能依赖 sessionStore。

## 终端与状态

- `TerminalSession` 位于 `src/lib/types.ts`，已有 `projectId/cwd/shell/envVars/startupCmd`，可新增 `worktreeId` 用于 Tab 徽标、实时统计标注和完成任务入口。
- `terminalStore.createSession(projectId, cwd, title, startupCmd, envVars, shell, paneId)` 已支持显式 cwd，worktree 只需传入 worktree path。
- `terminalStore` 的 Tab 状态模型：`TabNotificationState = none | running | attention | done | failed`，`TAB_STATUS_PRIORITY` 合并 hook 与 shell 两个来源，仅用于 UI 展示。按最新规则，prompt/autoParallel 的并行风险检测改为：项目已配置 CLI 工具 + 已有打开的同项目 PTY 会话；不再看 visible running、`npm run dev` 或 shell 运行状态。
- `TerminalTabs.tsx` 的 tab 右键菜单已有菜单扩展点，适合给 worktree 会话添加「查看改动 / 完成任务 / 安装依赖 / 丢弃」。

## Git 后端现状

- Git 命令集中在 `src-tauri/src/commands/git.rs` 并在 `src-tauri/src/lib.rs` 的 `invoke_handler` 注册；新增 Tauri command 必须注册。
- 现有 git 命令全部以 `project_path` 为参数。传 worktree path 可复用 `git_get_changes`、`git_stage_all`、`git_commit`、`git_branch_status` 等。
- 现有 `git_get_worktree_snapshot` / `git_fork_worktree_snapshot` 是补丁快照/分支切换能力，不是 `git worktree add`。新功能命名应避免混淆，建议使用 `git_worktree_*` 前缀。
- `run_git_cli(project_path, args)` 已有「数组参数 + current_dir + Windows 隐藏窗口」模式，可作为 worktree/merge 命令的实现模板；不要通过 shell 拼接字符串。
- `git_pull`/`git_pull_abort` 已有冲突感知与 abort 模式。完成任务合并可以借鉴：冲突时捕获输出/冲突文件，立即 `merge --abort`，保证主工作区不留半合并状态。
- `git2 = "0.19"`。Context7 查询显示 git2-rs 有 `Repository::worktree(name, path, opts)`、`WorktreeAddOptions`、`WorktreePruneOptions`。但系统 git CLI 对 `worktree add/remove/list` 和 `merge` 语义更完整，且项目已有 shell-out git 先例。设计建议：后端直执行，不通过终端；worktree/merge 使用系统 git CLI + 严格参数校验，状态/变更继续复用现有 libgit2 命令。

## Git 面板与子仓库任务关系

- 在途任务 `07-05-feat-git-sub-repo-monitor` 将 Git 面板扩展为项目根下多个子仓库切换；本任务的 worktree 是同一仓库的多个工作区，二者正交。
- `.trellis/spec/backend/git-status-contracts.md` 强调 Git 状态收集有三条链路（面板、Replay、WSL），过滤类变更要同步检查。本任务原则上不改状态过滤，但复用 git 命令时需注意不要破坏子仓库切换。

## Tauri 安全边界

- 全局 Tauri 规则要求前端不可信，Rust command 必须校验路径/分支/任务名，不能把安全判断只放在前端。
- `src-tauri/capabilities/default.json` 当前授予 main window 的 core/sql/store/dialog/fs/opener 等权限。新增 command 只需注册到 invoke handler；如引入新 plugin/权限才改 capabilities，本任务预计不需要。

## 关键设计结论

1. 新增 `worktrees` 表 + `projects.worktree_strategy/worktree_root`，由前端 SQL 管理记录，Rust 只做 Git/文件系统操作。
2. 新增 `worktreeStore.ts` 负责 DB 记录、自动隔离策略、依赖提醒状态与完成任务向导状态。
3. 后端新增 `commands/git_worktree.rs` 或在 `git.rs` 中新增 `git_worktree_*` 命令；优先新文件降低 `git.rs` 继续膨胀。
4. 创建 worktree 时后端根据 `project_path + task_name + root` 计算目录，前端不传最终任意路径；任务名清洗后才用于目录和 `wt/<task>` 分支。
5. 合并前必须检查主工作区干净；若主工作区不在 base branch，只有在干净时才可自动 checkout base branch，否则阻止。
