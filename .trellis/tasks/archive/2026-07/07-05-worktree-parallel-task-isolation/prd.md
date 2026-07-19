# PRD: Git Worktree 并行任务隔离

- Changelog Target: V1.2.5
- 类型: Feature
- 状态: 需求已收敛，待用户最终确认

## 背景 / 用户价值

用户常在同一个项目里并行跑多个 AI CLI 任务，多个任务同时修改同一份工作区代码，导致测试某个功能时被其他任务的半成品改动污染。把 git worktree 产品化：为每个并行任务提供隔离工作区（独立目录 + 独立分支），全生命周期（创建 → 开发 → 合并 → 清理）由 CLI-Manager 引导完成，不要求用户懂 git worktree。

**核心诉求：用户不会主动发现/使用手动创建功能，必须由 CLI-Manager 在正确的时机自动识别并提醒。**

## 已确认事实（代码库证据）

- 所有后端 git 命令以 `project_path` 为参数（`src-tauri/src/commands/git.rs`），传 worktree 路径即可复用 stage/commit/diff 等能力。
- `terminalStore.createSession(projectId, cwd, ...)` 支持显式 cwd（`src/stores/terminalStore.ts:165`）。
- Tab 状态（running/attention/done/failed）来自 CLI Hook + Shell OSC 双源合并（`TAB_STATUS_PRIORITY`），用于展示运行态；worktree 的 prompt/autoParallel 触发不再依赖该状态。
- `projects` 表：path/shell/startup_cmd/cli_args/env_vars/provider_overrides/group_id（migrations 当前 v13，新表需 v14+，只增不改）。
- 现有 `git_get_worktree_snapshot`/`git_fork_worktree_snapshot` 是补丁快照（类 stash），与 git 多工作树机制无关，命名需注意区分。
- 后端 git2 (libgit2)；git_watcher 递归监听项目根。
- 启动时 `sessionStore.clear()` 不恢复终端 → worktree 记录必须独立于会话持久化（新 SQLite 表）。
- 在途任务 `07-05-feat-git-sub-repo-monitor`（Git 面板子仓库切换）正交不冲突。

## 已确认决策

1. **入口形态**：worktree 挂在项目下（项目树子条目）；主操作入口 = 会话 Tab 分支徽标点击弹菜单（查看改动/完成任务/安装依赖/丢弃）；副入口 = 项目树子条目右键同组操作（覆盖终端已关场景）。实时统计面板仅做展示标注。
2. **自动识别（核心）**：项目已配置 CLI 工具（非空且非 none/未选择）且已有至少一个打开的同项目终端会话时，再打开同一项目 → 弹窗「是否在隔离的 Worktree 中打开？」[隔离打开] [直接打开] [本项目不再提醒]。不再依赖 Tab visible running、`npm run dev` 或 shell 运行状态。
3. **项目级"隔离策略"四档设置**：`提醒（默认） / 不处理 / 并行时自动隔离（CLI 工具已配置且已有同项目终端时静默进 worktree） / 始终自动隔离（每次都进 worktree；仅本地 Git 项目生效）`。`不处理` 表示完全保持旧行为，不提醒、不自动创建 worktree。
4. **代码可见性**：worktree 会话 Tab 常驻分支徽标；项目树 worktree 子条目（含"在资源管理器中打开"）；创建成功提示写明路径。
5. **依赖初始化**：不往原 Tab 自动输入。触发条件 = 特征文件存在（package.json/Cargo.toml 等）且依赖目录缺失（node_modules/target 等）→ 提醒；允许则**新开 Tab 执行安装命令**，原 Tab 照常跑项目 startup_cmd。防骚扰：条件自愈 + 跳过记入 worktree 元数据（一个 worktree 一生最多弹一次）+ 右键保留手动入口。
6. **完成任务向导（后端直执行，不往终端输命令）**：
   - 步骤 1 提交：列出未提交改动 → commit message → 复用 `git_commit`（传 worktree 路径）；
   - 步骤 2 合并：主仓库执行 merge 任务分支；**冲突即中止**（保证无半合并状态），列出冲突文件 + "在终端处理"引导；
   - 步骤 3 清理：删 worktree 目录 + 删任务分支，二次确认；
   - 每步展示等价 git 命令与执行结果（透明 + 教育）。
7. **合并前置检查（方案 P）**：主工作区有未提交改动 → 阻止合并，提示"先提交或等主工作区任务完成"，向导可稍后重试。不做 auto-stash。
8. **丢弃出口**：删 worktree + 删分支；存在未合并改动时明确警告 + 二次确认。

## 默认约定（低风险，采用合理默认值）

- **目录布局**：`<项目父目录>/<项目名>-worktrees/<任务名>/`（与主目录同级，用户易发现）；项目设置可自定义根目录。
- **分支命名**：`wt/<任务名>`；任务名默认自动生成 `task-MMdd-HHmm`（同分钟碰撞追加序号），提醒弹窗中预填可编辑（推荐用户改成有意义名字）；静默自动模式直接用自动值。清洗规则：仅字母/数字/`-`/`_`（需同时满足 git 分支与 Windows 目录命名，复用 `validate_snapshot_branch_name` 思路）。**不做重命名**（已确认）。
- **配置继承**：worktree 中开终端继承主项目的 shell/startup_cmd/cli_args/env_vars/provider_overrides。
- **持久化**：新增 SQLite 表 `worktrees`（id, project_id, path, branch, deps_prompt_dismissed, created_at），migration v14；应用重启后 worktree 子条目仍在项目树显示（终端会话本就不恢复）。
- **启动对账**：项目树加载时校验 worktree 目录是否仍存在（外部被删则标记失效/清理记录）。

## 超出范围（本期不做）

- 冲突解决 UI（三方对比编辑器）——冲突时引导去终端，Git 面板可承接后续迭代
- 合并时 auto-stash 主工作区（方案 Q）
- WSL / 远程路径项目的 worktree 支持（MVP 仅本地 Windows 路径 git 项目；WSL 项目不触发提醒、入口置灰）
- 嵌套子仓库的 worktree（仅对项目根仓库操作）
- 跨项目的 worktree 全局管理视图
- worktree 重命名（显示名的价值由提醒弹窗中的可编辑任务名承载）
- WebDAV 同步 worktree 记录（本机磁盘产物，同步无意义）

## 验收标准

1. 项目 A 已配置 CLI 工具（例如 codex）且已有一个打开的同项目终端会话，再为项目 A 新建终端 → 弹出隔离提醒；选择 [隔离打开] 后：自动创建 `<父目录>/A-worktrees/task-*/` 目录与 `wt/task-*` 分支，新终端 cwd 在该目录，Tab 显示分支徽标。
2. 选择 [直接打开] 行为与现状完全一致；选择 [本项目不再提醒] 后同场景不再弹窗。
3. 隔离策略设为"不处理"：无论是否已有同项目终端、CLI 工具是否已配置，都直接普通打开；设为"并行时自动"：项目已配置 CLI 工具且已有同项目终端时，第 2 个及以后会话静默进入新 worktree；设为"始终自动"：第 1 个会话也进 worktree，但非 Git/WSL 项目仍普通打开。
4. worktree 内 package.json 存在且 node_modules 缺失 → 开终端时弹依赖提醒；允许后新开 Tab 执行 npm install，原 Tab 执行 startup_cmd；安装完成后再开终端不再提醒；点跳过后同 worktree 永不再提醒。
5. 完成任务向导：在 worktree 有未提交改动时走完提交 → 合并 → 清理三步，master 上能看到合并结果，worktree 目录与分支被删除，项目树子条目消失。
6. 合并冲突场景：主仓库与 worktree 修改同一行 → 合并中止，主仓库无半合并状态（`git status` 干净），弹窗列出冲突文件。
7. 主工作区脏时点合并 → 被阻止并提示，主工作区无任何变化。
8. 丢弃：有未合并改动的 worktree 走丢弃 → 出现警告 + 二次确认，确认后目录与分支删除。
9. 未配置 CLI 工具的项目：即使已有普通终端或 startup_cmd 正在运行，也不触发 prompt/autoParallel。
10. 非 git 目录的项目：所有 worktree 入口不出现/置灰，不弹提醒。
11. `npx tsc --noEmit` 通过；`cd src-tauri && cargo test` 全绿（含 worktree 命令单测）；`CHANGELOG.md` V1.2.5 与 `docs/功能清单.md` 更新。

## 开放问题

（无——以下留给 design.md：worktrees 表精确 schema、后端命令清单与签名、libgit2 worktree API vs 命令行 git 的选型、弹窗与向导组件结构）
