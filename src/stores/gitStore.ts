import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { GitFileChange, GitTreeNode, GitBranchStatus } from "../lib/types";

type GitStatusFilter = "all" | "M" | "A" | "D" | "U";

// 判断已跟踪文件是否匹配当前筛选。未跟踪(U/??)单独成组展示，不参与此处筛选。
function matchTrackedFilter(status: string, filter: GitStatusFilter): boolean {
  if (filter === "all" || filter === "U") return true;
  return status === filter;
}

function isUntracked(status: string): boolean {
  return status === "U" || status === "??";
}

interface GitStore {
  changes: GitFileChange[];
  tree: GitTreeNode[];
  untrackedTree: GitTreeNode[];
  collapsedDirs: Set<string>;
  /** 未跟踪文件的「选中」集合（前端态）：勾选不立即 git add，提交时才统一 add。 */
  selectedUntracked: Set<string>;
  /** 已加入跟踪（状态 A）但被取消勾选的文件：保持暂存/跟踪，仅本次提交不包含。 */
  deselectedAdded: Set<string>;
  loading: boolean;
  discarding: boolean;
  committing: boolean;
  pushing: boolean;
  pulling: boolean;
  branchStatus: GitBranchStatus | null;
  error: string | null;
  currentProjectPath: string | null;
  statusFilter: GitStatusFilter;

  fetchChanges: (projectPath: string, silent?: boolean) => Promise<void>;
  fetchBranchStatus: (projectPath: string) => Promise<void>;
  discardFile: (filePath: string, status: string) => Promise<void>;
  discardAll: () => Promise<void>;
  revertHunk: (diffText: string, hunkIndex: number) => Promise<void>;
  revertLines: (diffText: string, selectedLines: { side: "old" | "new"; lineNumber: number }[]) => Promise<void>;
  stageFile: (filePath: string) => Promise<void>;
  unstageFile: (filePath: string) => Promise<void>;
  stagePaths: (paths: string[]) => Promise<void>;
  unstagePaths: (paths: string[]) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  /** 设置一组未跟踪文件的选中态（仅前端）。 */
  setUntrackedSelection: (paths: string[], selected: boolean) => void;
  /** 切换一组未跟踪文件：全选中→全取消，否则全选中。 */
  toggleUntrackedSelection: (paths: string[]) => void;
  /** 清空未跟踪选中集合。 */
  clearUntrackedSelection: () => void;
  /** 切换一组已加入跟踪(A)文件的「取消勾选」态：不动 git 索引，仅影响本次提交是否包含。 */
  toggleAddedDeselection: (paths: string[]) => void;
  /** 设置一组 A 文件的取消勾选态（true=取消勾选/不提交，false=勾选/提交）。 */
  setAddedDeselection: (paths: string[], deselected: boolean) => void;
  commit: (message: string) => Promise<string>;
  push: () => Promise<string>;
  pullFfOnly: () => Promise<string>;
  toggleDir: (path: string) => void;
  collapseAllDirs: () => void;
  expandAllDirs: () => void;
  setStatusFilter: (filter: GitStatusFilter) => void;
  reset: () => void;
}

function buildTree(changes: GitFileChange[]): GitTreeNode[] {
  const root: GitTreeNode[] = [];
  const dirMap = new Map<string, GitTreeNode>();

  // 按路径排序
  const sorted = [...changes].sort((a, b) => a.path.localeCompare(b.path));

  for (const change of sorted) {
    const parts = change.path.split(/[/\\]/);
    let currentLevel = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (i === parts.length - 1) {
        // 文件节点
        currentLevel.push({
          type: "file",
          name: part,
          path: currentPath,
          change,
        });
      } else {
        // 目录节点
        let dir = dirMap.get(currentPath);
        if (!dir) {
          dir = {
            type: "directory",
            name: part,
            path: currentPath,
            children: [],
          };
          dirMap.set(currentPath, dir);
          currentLevel.push(dir);
        }
        currentLevel = dir.children!;
      }
    }
  }

  return root;
}

// 构建「已跟踪变更树」与「未跟踪文件树」。未跟踪文件单独成组（仿 JetBrains Unversioned Files）。
function rebuildTrees(
  changes: GitFileChange[],
  filter: GitStatusFilter
): { tree: GitTreeNode[]; untrackedTree: GitTreeNode[] } {
  const tracked = changes.filter((c) => !isUntracked(c.status) && matchTrackedFilter(c.status, filter));
  const untracked = changes.filter((c) => isUntracked(c.status));
  return { tree: buildTree(tracked), untrackedTree: buildTree(untracked) };
}

function collectDirectoryPaths(nodes: GitTreeNode[], treeId: string): string[] {
  const paths: string[] = [];

  const visit = (items: GitTreeNode[]) => {
    for (const node of items) {
      if (node.type !== "directory") continue;
      paths.push(`${treeId}:${node.path}`);
      visit(node.children ?? []);
    }
  };

  visit(nodes);
  return paths;
}

export const useGitStore = create<GitStore>((set, get) => ({
  changes: [],
  tree: [],
  untrackedTree: [],
  collapsedDirs: new Set(),
  selectedUntracked: new Set(),
  deselectedAdded: new Set(),
  loading: false,
  discarding: false,
  committing: false,
  pushing: false,
  pulling: false,
  branchStatus: null,
  error: null,
  currentProjectPath: null,
  statusFilter: "all",

  fetchChanges: async (projectPath: string, silent = false) => {
    // silent 模式用于聚焦轮询：不 set loading，避免每次刷新闪烁 spinner。
    if (silent) {
      set({ currentProjectPath: projectPath });
    } else {
      console.log(`[GitStore] 开始获取 Git 变更, projectPath: "${projectPath}"`);
      set({ loading: true, error: null, currentProjectPath: projectPath });
    }

    try {
      const changes = await invoke<GitFileChange[]>("git_get_changes", { projectPath });

      // 应用筛选并拆分已跟踪 / 未跟踪两棵树
      const { statusFilter } = get();
      const { tree, untrackedTree } = rebuildTrees(changes, statusFilter);
      // 选中集合按当前未跟踪文件裁剪：已被 add/删除的路径不再保留，避免悬挂选中。
      const untrackedNow = new Set(changes.filter((c) => isUntracked(c.status)).map((c) => c.path));
      const prevSelected = get().selectedUntracked;
      const selectedUntracked = new Set([...prevSelected].filter((p) => untrackedNow.has(p)));
      // 取消勾选集合按当前 A 文件裁剪：已提交/已不再是 A 的路径移除。
      const addedNow = new Set(changes.filter((c) => c.status === "A").map((c) => c.path));
      const prevDeselected = get().deselectedAdded;
      const deselectedAdded = new Set([...prevDeselected].filter((p) => addedNow.has(p)));
      set({ changes, tree, untrackedTree, selectedUntracked, deselectedAdded, loading: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 获取 Git 变更失败:`, err);
      // silent 失败（轮询）不清空已有数据、不弹错，避免打扰；仅非静默时显式报错。
      if (silent) {
        set({ loading: false });
      } else {
        set({ error: errorMsg, loading: false, changes: [], tree: [] });
      }
    }

    // 分支状态独立刷新，失败不影响变更列表展示。
    void get().fetchBranchStatus(projectPath);
  },

  fetchBranchStatus: async (projectPath: string) => {
    try {
      const branchStatus = await invoke<GitBranchStatus>("git_branch_status", { projectPath });
      // 仅当仍是当前项目时写入，避免切换项目时的竞态覆盖。
      if (get().currentProjectPath === projectPath) {
        set({ branchStatus });
      }
    } catch (err) {
      console.warn(`[GitStore] 获取分支状态失败:`, err);
      if (get().currentProjectPath === projectPath) {
        set({ branchStatus: null });
      }
    }
  },

  discardFile: async (filePath: string, status: string) => {
    const { currentProjectPath } = get();
    if (!currentProjectPath) return;
    set({ discarding: true, error: null });
    try {
      await invoke("git_discard_file", { projectPath: currentProjectPath, filePath, status });
      await get().fetchChanges(currentProjectPath, true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 回滚文件失败:`, err);
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ discarding: false });
    }
  },

  discardAll: async () => {
    const { currentProjectPath, changes } = get();
    if (!currentProjectPath) return;
    // 仅回滚已跟踪改动，排除未跟踪文件（U/??）。
    const trackable = changes.filter((c) => c.status !== "U" && c.status !== "??");
    if (trackable.length === 0) return;
    set({ discarding: true, error: null });
    try {
      for (const c of trackable) {
        await invoke("git_discard_file", {
          projectPath: currentProjectPath,
          filePath: c.path,
          status: c.status,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 批量回滚失败:`, err);
      set({ error: errorMsg });
    } finally {
      // 无论成功或部分失败都刷新，反映真实状态。
      await get().fetchChanges(currentProjectPath, true);
      set({ discarding: false });
    }
  },

  revertHunk: async (diffText: string, hunkIndex: number) => {
    const { currentProjectPath } = get();
    if (!currentProjectPath) return;
    set({ discarding: true, error: null });
    try {
      await invoke("git_revert_hunk", { projectPath: currentProjectPath, diffText, hunkIndex });
      await get().fetchChanges(currentProjectPath, true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 回滚 hunk 失败:`, err);
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ discarding: false });
    }
  },

  revertLines: async (diffText, selectedLines) => {
    const { currentProjectPath } = get();
    if (!currentProjectPath) return;
    set({ discarding: true, error: null });
    try {
      await invoke("git_revert_lines", { projectPath: currentProjectPath, diffText, selectedLines });
      await get().fetchChanges(currentProjectPath, true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 回滚选中行失败:`, err);
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ discarding: false });
    }
  },

  stageFile: async (filePath: string) => {
    const { currentProjectPath } = get();
    if (!currentProjectPath) return;
    try {
      await invoke("git_stage_file", { projectPath: currentProjectPath, filePath });
      await get().fetchChanges(currentProjectPath, true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 暂存文件失败:`, err);
      set({ error: errorMsg });
      throw err;
    }
  },

  unstageFile: async (filePath: string) => {
    const { currentProjectPath } = get();
    if (!currentProjectPath) return;
    try {
      await invoke("git_unstage_file", { projectPath: currentProjectPath, filePath });
      await get().fetchChanges(currentProjectPath, true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 取消暂存文件失败:`, err);
      set({ error: errorMsg });
      throw err;
    }
  },

  stageAll: async () => {
    const { currentProjectPath } = get();
    if (!currentProjectPath) return;
    try {
      await invoke("git_stage_all", { projectPath: currentProjectPath });
      await get().fetchChanges(currentProjectPath, true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 全部暂存失败:`, err);
      set({ error: errorMsg });
      throw err;
    }
  },

  stagePaths: async (paths: string[]) => {
    const { currentProjectPath } = get();
    if (!currentProjectPath || paths.length === 0) return;
    try {
      await invoke("git_stage_paths", { projectPath: currentProjectPath, paths });
      await get().fetchChanges(currentProjectPath, true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 批量暂存失败:`, err);
      set({ error: errorMsg });
      throw err;
    }
  },

  unstagePaths: async (paths: string[]) => {
    const { currentProjectPath } = get();
    if (!currentProjectPath || paths.length === 0) return;
    try {
      await invoke("git_unstage_paths", { projectPath: currentProjectPath, paths });
      await get().fetchChanges(currentProjectPath, true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 批量取消暂存失败:`, err);
      set({ error: errorMsg });
      throw err;
    }
  },

  unstageAll: async () => {
    const { currentProjectPath } = get();
    if (!currentProjectPath) return;
    try {
      await invoke("git_unstage_all", { projectPath: currentProjectPath });
      await get().fetchChanges(currentProjectPath, true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 全部取消暂存失败:`, err);
      set({ error: errorMsg });
      throw err;
    }
  },

  setUntrackedSelection: (paths: string[], selected: boolean) => {
    if (paths.length === 0) return;
    set((state) => {
      const next = new Set(state.selectedUntracked);
      for (const p of paths) {
        if (selected) next.add(p);
        else next.delete(p);
      }
      return { selectedUntracked: next };
    });
  },

  toggleUntrackedSelection: (paths: string[]) => {
    if (paths.length === 0) return;
    const selected = get().selectedUntracked;
    const allSelected = paths.every((p) => selected.has(p));
    get().setUntrackedSelection(paths, !allSelected);
  },

  clearUntrackedSelection: () => {
    if (get().selectedUntracked.size === 0) return;
    set({ selectedUntracked: new Set() });
  },

  toggleAddedDeselection: (paths: string[]) => {
    if (paths.length === 0) return;
    const deselected = get().deselectedAdded;
    // 全部已取消勾选 → 重新勾选；否则全部取消勾选。
    const allDeselected = paths.every((p) => deselected.has(p));
    get().setAddedDeselection(paths, !allDeselected);
  },

  setAddedDeselection: (paths: string[], deselected: boolean) => {
    if (paths.length === 0) return;
    set((state) => {
      const next = new Set(state.deselectedAdded);
      for (const p of paths) {
        if (deselected) next.add(p);
        else next.delete(p);
      }
      return { deselectedAdded: next };
    });
  },

  commit: async (message: string) => {
    const { currentProjectPath, selectedUntracked, deselectedAdded, changes } = get();
    if (!currentProjectPath) throw new Error("no_project");
    set({ committing: true, error: null });
    try {
      // 提交前先 add 选中的未跟踪文件（延迟到此刻才真正 git add）。
      const toAdd = [...selectedUntracked];
      if (toAdd.length > 0) {
        await invoke("git_stage_paths", { projectPath: currentProjectPath, paths: toAdd });
      }

      let shortId: string;
      if (deselectedAdded.size === 0) {
        // 无「取消勾选的 A 文件」→ 走整库索引提交（保持既有语义）。
        shortId = await invoke<string>("git_commit", { projectPath: currentProjectPath, message });
      } else {
        // 有取消勾选的 A 文件 → 仅提交选中的路径（pathspec），被取消勾选者保持暂存不提交。
        const includedStaged = changes
          .filter((c) => c.staged && !(c.status === "A" && deselectedAdded.has(c.path)))
          .map((c) => c.path);
        const commitPaths = [...new Set([...includedStaged, ...toAdd])];
        if (commitPaths.length === 0) throw new Error("nothing_staged");
        shortId = await invoke<string>("git_commit_paths", {
          projectPath: currentProjectPath,
          message,
          paths: commitPaths,
        });
      }

      set({ selectedUntracked: new Set() });
      await get().fetchChanges(currentProjectPath, true);
      return shortId;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 提交失败:`, err);
      set({ error: errorMsg });
      // 失败后刷新一次：若已 add 部分未跟踪，让 UI 反映真实索引状态。
      await get().fetchChanges(currentProjectPath, true);
      throw err;
    } finally {
      set({ committing: false });
    }
  },

  push: async () => {
    const { currentProjectPath, branchStatus } = get();
    if (!currentProjectPath) throw new Error("no_project");
    // 无 upstream 时建立跟踪：push -u origin <branch>。
    const setUpstream = !!branchStatus && !branchStatus.hasUpstream;
    const branch = branchStatus?.branch ?? null;
    if (setUpstream && !branch) throw new Error("empty_branch");
    set({ pushing: true, error: null });
    try {
      const out = await invoke<string>("git_push", {
        projectPath: currentProjectPath,
        setUpstream,
        branch: setUpstream ? branch : null,
      });
      await get().fetchBranchStatus(currentProjectPath);
      return out;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 推送失败:`, err);
      set({ error: errorMsg });
      // 推送被拒可能因落后远端，刷新状态以便展示 behind / 拉取入口。
      void get().fetchBranchStatus(currentProjectPath);
      throw err;
    } finally {
      set({ pushing: false });
    }
  },

  pullFfOnly: async () => {
    const { currentProjectPath } = get();
    if (!currentProjectPath) throw new Error("no_project");
    set({ pulling: true, error: null });
    try {
      const out = await invoke<string>("git_pull_ff_only", { projectPath: currentProjectPath });
      // 拉取改动工作区与提交，需同时刷新变更列表与分支状态。
      await get().fetchChanges(currentProjectPath, true);
      return out;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GitStore] 拉取失败:`, err);
      set({ error: errorMsg });
      throw err;
    } finally {
      set({ pulling: false });
    }
  },

  toggleDir: (path: string) => {
    set((state) => {
      const newCollapsed = new Set(state.collapsedDirs);
      if (newCollapsed.has(path)) {
        newCollapsed.delete(path);
      } else {
        newCollapsed.add(path);
      }
      return { collapsedDirs: newCollapsed };
    });
  },

  collapseAllDirs: () => {
    set((state) => ({
      collapsedDirs: new Set([
        ...collectDirectoryPaths(state.tree, "tracked"),
        ...collectDirectoryPaths(state.untrackedTree, "untracked"),
      ]),
    }));
  },

  expandAllDirs: () => {
    set({ collapsedDirs: new Set() });
  },

  setStatusFilter: (filter: GitStatusFilter) => {
    set((state) => {
      const { tree, untrackedTree } = rebuildTrees(state.changes, filter);
      return { statusFilter: filter, tree, untrackedTree };
    });
  },

  reset: () => {
    set({
      changes: [],
      tree: [],
      untrackedTree: [],
      collapsedDirs: new Set(),
      selectedUntracked: new Set(),
      deselectedAdded: new Set(),
      loading: false,
      discarding: false,
      committing: false,
      pushing: false,
      pulling: false,
      branchStatus: null,
      error: null,
      currentProjectPath: null,
      statusFilter: "all",
    });
  },
}));
