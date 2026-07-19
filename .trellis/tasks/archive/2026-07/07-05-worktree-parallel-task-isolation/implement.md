# Implement Plan: Git Worktree 并行任务隔离

## 顺序清单

### 1. 数据模型与迁移

- 在 `src-tauri/src/lib.rs` 追加 migration v14：
  - `projects.worktree_strategy TEXT NOT NULL DEFAULT 'prompt'`
  - `projects.worktree_root TEXT NOT NULL DEFAULT ''`
  - 新表 `worktrees` + indexes
- 更新 `src/lib/types.ts`：
  - `WorktreeIsolationStrategy`
  - `WorktreeRecord`
  - `Project/CreateProjectInput/UpdateProjectInput`
  - `TerminalSession.worktreeId?`
  - `TreeNode` 增加 `worktree` 节点类型

### 2. Rust 后端命令

- 新增 `src-tauri/src/commands/git_worktree.rs`。
- 在 `src-tauri/src/commands/mod.rs` 注册模块，在 `src-tauri/src/lib.rs invoke_handler` 注册命令。
- 实现：
  - `git_worktree_validate`
  - `git_worktree_create`
  - `git_worktree_check_deps`
  - `git_worktree_merge`
  - `git_worktree_remove`
- 复用/复制必要的安全工具函数：路径存在、任务名清洗、分支名校验、数组参数执行 git CLI。
- 加 Rust 单测：
  - 任务名校验
  - 默认 worktree 路径计算
  - 非登记路径 remove 拒绝（如果实现可测）
  - 依赖检测 matrix

### 3. Worktree 前端 store

- 新增 `src/stores/worktreeStore.ts`。
- 功能：
  - 加载/写入 `worktrees` 表
  - 对账 missing worktree
  - 创建 worktree 并保存 DB 记录
  - 判断 `prompt/disabled/autoParallel/always`
  - 依赖提醒 dismissed 状态
  - merge/remove action
- 注意所有 DB 写入参数化；类型不使用 `any`。

### 4. 项目设置

- `ConfigModal.tsx` 增加：
  - Worktree 隔离策略 select：提醒（默认）/不处理/并行时自动/始终自动
  - Worktree 根目录输入（可空）
- `projectStore.createProject/updateProject` 支持新字段。
- i18n 增加中文/英文文本。

### 5. 打开项目流程接入

- 在 `src/components/sidebar/index.tsx` 的 `openProjectInternal` 前接入 worktree 决策。
- `disabled` 直接普通打开，不做 Git 校验、不弹提醒、不自动创建 worktree。
- `prompt` 且项目已配置 CLI 工具并已有同项目终端：弹隔离提醒。
- `autoParallel` 在项目已配置 CLI 工具并已有同项目终端时自动创建 worktree；`always` 每次自动创建 worktree。
- 创建 worktree 后调用 `createSession`，cwd 指向 worktree.path，session 记录 `worktreeId`。
- 依赖提醒：若 `checkDeps` 需要安装且未 dismissed，弹窗；允许则新开安装 Tab 执行安装命令，原 Tab 继续执行项目 startup_cmd。

### 6. 项目树与 Tab UI

- 扩展 `projectStore.buildTree` / `ProjectTree` / `TreeNodeItem` 支持 worktree 子节点。
- worktree 子节点：点击打开 worktree 终端，右键完成/丢弃/打开目录。
- `TerminalTabs.tsx`：worktree session 显示小徽标；右键菜单增加 worktree 操作。
- 实时统计面板仅显示 worktree 标识（如果改动范围过大，可先在 Tab/项目树完成，统计面板作为验收项后置）。

### 7. 完成任务向导

- 新增 `src/components/worktree/WorktreeFinishDialog.tsx`。
- MVP：提交全部改动 → merge → cleanup。
- 复用现有 git command：`git_stage_all`、`git_commit`、`git_get_changes`。
- merge/remove 调后端新命令。
- 错误分支：主工作区脏、冲突中止、无 git identity、nothing staged。

### 8. 文档与变更记录

- `CHANGELOG.md` V1.2.5 记录功能。
- `docs/功能清单.md` 更新功能清单。
- 如最终形成稳定后端合约，补 `.trellis/spec/backend/worktree-isolation-contracts.md` 并在 backend index 加链接（可在 finish/spec-update 阶段执行）。

## 验证命令

> 按项目规则，不自动运行 dev/build；用户未要求时不启动 Tauri 应用。

- 前端：`npx tsc --noEmit`
- 后端：`cd src-tauri && cargo check`
- 后端测试：`cd src-tauri && cargo test`

## 人工验证清单

- 默认提醒模式：项目 CLI 工具已配置且已有同项目 Tab 时，新开终端触发提醒；不要求 `npm run dev` 或 Tab visible running。
- 四档隔离策略行为正确；`不处理` 始终普通打开；未配置 CLI 工具的项目不因普通启动命令或 shell 状态触发 prompt/autoParallel。
- worktree Tab 徽标、项目树子节点、右键菜单可见。
- 依赖提醒只出现一次，允许后新 Tab 安装，原 Tab 继续 startup_cmd。
- 完成任务：提交、合并、清理闭环。
- 主工作区脏时阻止合并。
- 合并冲突时自动 abort，无半合并状态。
- 丢弃有未合并改动时二次确认。

## 风险文件 / 回滚点

- `src-tauri/src/lib.rs` migration 与 invoke_handler：任何漏注册会导致前端 invoke 失败。
- `src/stores/terminalStore.ts`：只增加 `worktreeId` 与创建元数据，不破坏现有会话生命周期。
- `src/components/sidebar/index.tsx`：项目打开流程是核心入口，保持直接打开 fallback。
- `src/components/TerminalTabs.tsx`：Tab 菜单已有大量交互，避免把完成向导状态塞进 render；用事件回调与外层状态控制弹窗。

## 实现注意

- 后端 command 参数一律视为不可信输入。
- 不通过 shell 拼接命令；只用 `Command::new("git").args([...])`。
- 不做 auto-stash。
- 不做重命名。
- 不支持 WSL/远程路径，返回稳定错误码并让前端不弹提醒。
- 不把依赖安装命令塞进原 Tab。
