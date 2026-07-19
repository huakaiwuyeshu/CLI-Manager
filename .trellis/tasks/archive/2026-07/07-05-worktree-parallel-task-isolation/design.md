# Design: Git Worktree 并行任务隔离

## 目标

在 CLI-Manager 中把 `git worktree` 产品化：当用户在同一项目并行开启多个 AI/CLI 任务时，自动识别冲突风险，引导或自动创建隔离工作区，并提供从开发到提交、合并、清理的闭环。

设计原则：

- **用户不需要懂 worktree**：在正确场景提示，在 UI 中持续标明当前代码位置。
- **不做隐形魔法**：改变目录/分支/合并/删除前都给可见提示；自动策略必须是项目级显式设置。
- **后端执行 Git，前端只编排 UI**：不通过终端自动输入 Git 命令；Rust command 自己校验路径和参数。
- **绝不留下半状态**：主工作区脏时不合并；合并冲突立即 abort。

## 数据模型

### projects 新字段（migration v14）

在 `projects` 表追加字段：

```sql
ALTER TABLE projects ADD COLUMN worktree_strategy TEXT NOT NULL DEFAULT 'prompt';
ALTER TABLE projects ADD COLUMN worktree_root TEXT NOT NULL DEFAULT '';
```

TypeScript：

```ts
export type WorktreeIsolationStrategy = "prompt" | "disabled" | "autoParallel" | "always";

interface Project {
  // ...现有字段
  worktree_strategy: WorktreeIsolationStrategy;
  worktree_root: string;
}
```

含义：

- `prompt`：默认。项目已配置 CLI 工具且已有同项目终端会话时弹窗提醒；不依赖 running 状态。
- `disabled`：不处理。无论是否已有同项目终端、CLI 工具是否已配置，都按普通终端打开；不弹提醒、不自动创建 worktree。
- `autoParallel`：项目已配置 CLI 工具且已有同项目终端会话时，第 2+ 个会话静默创建 worktree。
- `always`：每个从项目打开的新会话都创建 worktree；仍只对支持 Git worktree 的本地 Git 项目生效。
- `worktree_root`：空字符串表示使用默认根目录；非空为用户自定义 worktree 根目录。

### 新表 worktrees（migration v14）

```sql
CREATE TABLE IF NOT EXISTS worktrees (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  branch                TEXT NOT NULL,
  path                  TEXT NOT NULL,
  base_branch           TEXT NOT NULL DEFAULT '',
  deps_prompt_dismissed INTEGER NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'active',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_worktrees_project ON worktrees(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worktrees_project_name ON worktrees(project_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worktrees_path ON worktrees(path);
```

`status`：MVP 只使用 `active | missing`。应用加载时对账目录是否存在，外部删除则标记 `missing` 或清理记录。

不做重命名：`name` 创建后稳定，避免目录/分支重命名风险。

## 后端命令设计

建议新增文件 `src-tauri/src/commands/git_worktree.rs`，避免 `git.rs` 继续膨胀；在 `commands/mod.rs` 和 `lib.rs invoke_handler` 注册。

### 类型

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktreeCreateRequest {
    pub project_path: String,
    pub task_name: String,
    pub worktree_root: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktreeCreateResult {
    pub name: String,
    pub branch: String,
    pub path: String,
    pub base_branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktreeMergeResult {
    pub merged: bool,
    pub output: String,
    pub conflict_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktreeDepsCheckResult {
    pub needs_install: bool,
    pub command: Option<String>,
    pub reason: Option<String>,
}
```

### 命令清单

```rust
#[tauri::command]
pub async fn git_worktree_create(req: GitWorktreeCreateRequest) -> Result<GitWorktreeCreateResult, String>

#[tauri::command]
pub async fn git_worktree_merge(project_path: String, worktree_branch: String) -> Result<GitWorktreeMergeResult, String>

#[tauri::command]
pub async fn git_worktree_remove(project_path: String, worktree_path: String, branch: String, delete_branch: bool) -> Result<String, String>

#[tauri::command]
pub async fn git_worktree_check_deps(worktree_path: String) -> Result<GitWorktreeDepsCheckResult, String>

#[tauri::command]
pub async fn git_worktree_validate(project_path: String) -> Result<bool, String>
```

### 参数校验

- `project_path` 必须存在，且 `Repository::open` 成功；WSL 配置路径本期返回 `unsupported_wsl`。
- `task_name` 清洗：仅 `[A-Za-z0-9_-]`，非空，不以 `-` 开头，长度建议 1..64。
- `branch = wt/<task_name>`，复用并加强现有 `validate_branch_name` / `validate_snapshot_branch_name` 思路。
- 默认根目录由后端计算：`<project_parent>/<project_name>-worktrees`；前端不传最终任意路径。
- 自定义 `worktree_root` 必须是绝对路径，后端 join `task_name` 后 canonicalize 父目录，确保最终路径位于 root 下。
- `worktree_remove` 要验证 `worktree_path` 是主仓库登记的 worktree 路径，避免删除任意目录。

### Git 实现选型

- 创建/删除/合并建议使用系统 `git` CLI（数组参数，非 shell）：
  - `git worktree add -b wt/<task> <path> HEAD`
  - `git worktree remove <path>`
  - `git branch -D wt/<task>`（仅清理时且确认已合并/用户二次确认）
  - `git merge --no-ff --no-edit wt/<task>` 或根据后续实现决定允许快进
- 原因：项目已有 `run_git_cli` 与 `run_git_conflict_aware` 先例；系统 Git 对 worktree CLI 语义完整，避免 libgit2 worktree API 差异。
- 网络操作不涉及；仍继承用户 Git 配置与凭据环境。

### 合并策略

1. 打开主仓库 `project_path`。
2. 检查主工作区是否干净：复用 `collect_git_changes_from_repo` 或 `git status --porcelain`。非空 → `dirty_main_worktree`，阻止。
3. 检查主仓库当前分支：
   - 若当前分支等于 worktree 记录的 `base_branch`，继续。
   - 若不同但工作区干净，可自动 `git checkout <base_branch>`；向导展示等价命令。
4. 执行 `git merge --no-edit <branch>`。
5. 若输出/退出码显示冲突：收集冲突文件（`git diff --name-only --diff-filter=U`），立即 `git merge --abort`，返回 `merge_conflict` + 文件列表；保证主工作区无半合并状态。
6. 成功后进入清理步骤。

不做 auto-stash。

### 依赖检测

MVP 用简单启发式，不做包管理器全覆盖：

| 特征文件 | 缺失目录 | 建议命令 |
|---|---|---|
| `package-lock.json` 或 `package.json` | `node_modules` | `npm install` |
| `pnpm-lock.yaml` | `node_modules` | `pnpm install` |
| `yarn.lock` | `node_modules` | `yarn install` |
| `Cargo.toml` | `target` | `cargo fetch`（或不建议自动，按实现再定） |

提醒只在 `deps_prompt_dismissed = 0` 且 `needs_install = true` 时出现。用户允许后新开终端 Tab 执行安装命令；原业务 Tab 不受影响。

## 前端设计

### 类型与 store

新增 `src/stores/worktreeStore.ts`：

职责：

- 加载/维护 `worktrees` 表。
- 计算项目的隔离策略。
- 判断是否需要提示或自动创建。
- 调用后端 `git_worktree_*` 命令。
- 提供完成任务向导所需 action。
- 标记 `deps_prompt_dismissed`。

核心 API：

```ts
interface WorktreeStore {
  worktrees: WorktreeRecord[];
  loadWorktrees: () => Promise<void>;
  createWorktreeForProject: (project: Project, name?: string) => Promise<WorktreeRecord>;
  shouldIsolateNewSession: (project: Project, sessions: TerminalSession[]) => "prompt" | "auto" | "none";
  checkDeps: (worktree: WorktreeRecord) => Promise<GitWorktreeDepsCheckResult>;
  dismissDepsPrompt: (worktreeId: string) => Promise<void>;
  mergeWorktree: (worktree: WorktreeRecord) => Promise<GitWorktreeMergeResult>;
  removeWorktree: (worktree: WorktreeRecord, deleteBranch: boolean) => Promise<void>;
}
```

`TerminalSession` 增加：

```ts
worktreeId?: string;
```

`TreeNode` 扩展：

```ts
| { type: "worktree"; project: Project; worktree: WorktreeRecord }
```

项目树 build 逻辑：project 节点下渲染 worktree 子项。若当前项目没有 worktree，保持现状。

### 打开项目流程

统一在 `sidebar/index.tsx` 的 `openProjectInternal(project)` 进入隔离判断：

1. 读取项目 `worktree_strategy`。
2. 若非 git 项目或 WSL 项目：不触发，按现状打开。
3. `disabled`：不做 Git 校验、不弹提醒、不自动创建 worktree，直接按现状打开普通项目终端。
4. `always`：自动创建 worktree → cwd = worktree.path → createSession，session.worktreeId = id。
5. `autoParallel`：若项目已配置 CLI 工具且已有打开的同项目 PTY 终端会话，则自动创建；否则按现状。
6. `prompt`：若项目已配置 CLI 工具且已有打开的同项目 PTY 终端会话，则弹窗；用户选择：
   - 隔离打开：创建 worktree 后打开。
   - 直接打开：按现状。
   - 本项目不再提醒：更新项目 `worktree_strategy = autoParallel` 或新增单独 dismiss 字段？MVP 建议语义改为 `autoParallel` 不合适；应增加本地/项目字段 `worktree_strategy = manual` 会膨胀。更简单：按钮文案改成「并行时自动隔离」，设置为 `autoParallel`。
7. 创建 worktree 后执行依赖检测：若需要提醒，弹依赖对话框；用户允许则新建安装 Tab 执行安装命令，原 Tab 正常执行 startup_cmd。

> 注意：依赖安装 Tab 也应带 `worktreeId`，但 title 标为 `安装依赖：<name>`。
> prompt/autoParallel 不读取 Tab visible running、`npm run dev`、startup_cmd 或 shell 运行状态；没有配置 CLI 工具的普通终端项目不触发这两档策略。

### UI 入口

- Tab：worktree 会话显示 `wt/<name>` 或 `<name>` 小徽标；徽标/右键菜单提供：查看改动、完成任务、安装依赖、丢弃、在资源管理器中打开。
- 项目树：worktree 子条目显示在项目下，点击打开该 worktree 终端；右键同样提供完成/丢弃/打开目录。
- 实时统计面板：只展示会话所属 worktree 标识，不放操作入口。
- 项目设置：新增「Worktree 隔离策略」四档（提醒/不处理/并行时自动隔离/始终自动隔离）和「Worktree 根目录」输入；默认显示仍为「提醒」。

### 完成任务向导

新增组件建议：`src/components/worktree/WorktreeFinishDialog.tsx`。

状态机：

1. `review`：展示 worktree 变更摘要（可复用 Git store 或直接调用 `git_get_changes(worktree.path)`）。
2. `commit`：用户填写 commit message；执行 stage/commit（优先 `git_stage_all` + `git_commit`，或用户分文件选择后复用现有 Git 面板能力）。MVP 可采用「提交全部 worktree 改动」。
3. `merge`：执行 `git_worktree_merge`；主工作区脏/冲突则显示错误和下一步引导。
4. `cleanup`：执行 `git_worktree_remove(deleteBranch=true)`，删除 DB 记录，关闭/保留相关 Tab 按现有关闭逻辑提示。

MVP 不做三方冲突编辑器。

## 国际化

新增中文/英文 i18n key，避免硬编码：

- worktree.strategy.prompt / disabled / autoParallel / always
- worktree.prompt.title / description / isolate / direct / autoParallel
- worktree.deps.title / install / skip
- worktree.finish.*
- worktree.errors.*

## 兼容与边界

- 非 git 项目：入口置灰或不出现，不弹提醒。
- WSL 项目：本期 `unsupported_wsl`，不触发提醒。
- 外部删除 worktree 目录：项目树加载时对账，标记 missing 或清理记录；不会尝试恢复。
- 删除项目：`worktrees` 表记录级联删除，但磁盘 worktree 不自动删，避免删除用户数据；项目删除已有确认流程外，不扩大破坏面。
- WebDAV 同步：不同步 worktree 记录。

## 风险与控制

- **破坏性删除**：删除 worktree 前后端都校验为登记的 worktree；前端二次确认。
- **分支误删**：只删除 `wt/` 前缀且记录匹配的分支。
- **半合并状态**：冲突立即 abort；主工作区脏时拒绝。
- **路径越界**：所有路径由后端根据项目路径/根目录/任务名计算或校验，不能让前端提交任意删除路径。
- **UI 噪音**：依赖提醒每个 worktree 一次；装完条件自愈。
