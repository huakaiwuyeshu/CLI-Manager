import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { RefreshCw, GitBranch, Undo2, Files, FilePen, FilePlus, FileMinus, GitCommitHorizontal, ArrowUp, ArrowDown, Upload, Download } from "lucide-react";
import { useGitStore } from "../../stores/gitStore";
import { GitChangesTree } from "./GitChangesTree";
import { StageCheckbox, type StageState } from "./StageCheckbox";
import { STATUS_CONFIG } from "./GitStatusIcon";
import { DiffViewerModal } from "./DiffViewerModal";
import { ConfirmDialog } from "../ConfirmDialog";
import { TERM, EmptyHint } from "../stats/termStatsUi";
import type { GitTreeNode } from "../../lib/types";

interface GitChangesPanelProps {
  open: boolean;
  projectPath: string | null;
  visible?: boolean;
  embedded?: boolean;
}

// 降级慢轮询间隔：仅当 fs-watcher 初始化失败（网络盘/WSL 等 notify 不可用）时启用。
const FALLBACK_POLL_INTERVAL_MS = 15000;

// 把后端 git 网络错误码（形如 "auth_failed: <原文>"）映射为可读中文 toast。
function formatGitNetError(prefix: string, raw: string): string {
  if (raw.includes("auth_failed")) return `${prefix}：认证失败，请检查远端凭据`;
  if (raw.includes("not_fast_forward")) return `${prefix}：远端有新提交，请先拉取`;
  if (raw.includes("no_upstream")) return `${prefix}：当前分支未跟踪远端`;
  if (raw.includes("no_remote")) return `${prefix}：未配置远端或无法连接远端`;
  if (raw.includes("git_not_found")) return `${prefix}：未找到 git，可执行文件不在 PATH`;
  // 其余去掉错误码前缀，保留原始片段。
  return `${prefix}：${raw.replace(/^[a-z_]+:\s*/, "")}`;
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

export function GitChangesPanel({ open, projectPath, visible = true, embedded = false }: GitChangesPanelProps) {
  const {
    fetchChanges,
    reset,
    changes,
    tree,
    untrackedTree,
    collapsedDirs,
    loading,
    statusFilter,
    setStatusFilter,
    collapseAllDirs,
    expandAllDirs,
    discardFile,
    discardAll,
    discarding,
    stageFile,
    unstageFile,
    stagePaths,
    unstagePaths,
    commit,
    committing,
    branchStatus,
    pushing,
    pulling,
    push,
    pullFfOnly,
    selectedUntracked,
    setUntrackedSelection,
    clearUntrackedSelection,
    deselectedAdded,
    setAddedDeselection,
  } = useGitStore();
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string; status: string } | null>(null);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<{ path: string; name: string; status: string } | null>(null);
  const [commitMsg, setCommitMsg] = useState("");
  const panelActive = open && visible;

  useEffect(() => {
    if (panelActive && projectPath) {
      fetchChanges(projectPath);
    } else if (!open) {
      reset();
    }
  }, [panelActive, open, projectPath, fetchChanges, reset]);

  // fs-watcher 驱动刷新：后端监听项目目录，命中当前项目且窗口活跃时静默刷新。
  // 替代旧的固定轮询；watcher 初始化失败时降级为慢轮询。失焦/隐藏不刷新，重新聚焦立即刷新一次。
  useEffect(() => {
    if (!panelActive || !projectPath) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;
    let fallbackTimer: number | undefined;

    const isActive = () => document.visibilityState === "visible" && document.hasFocus();
    const refreshIfActive = () => {
      if (isActive()) void fetchChanges(projectPath, true);
    };
    const startFallback = () => {
      if (fallbackTimer === undefined) {
        fallbackTimer = window.setInterval(refreshIfActive, FALLBACK_POLL_INTERVAL_MS);
      }
    };
    const stopFallback = () => {
      if (fallbackTimer !== undefined) {
        window.clearInterval(fallbackTimer);
        fallbackTimer = undefined;
      }
    };

    // 订阅后端文件变化事件；按 projectPath 过滤（多窗口天然隔离）。
    void listen<{ projectPath: string }>("git-changed", (event) => {
      if (disposed) return;
      if (event.payload.projectPath === projectPath) refreshIfActive();
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });

    // 启动 watcher；失败则降级为慢轮询。
    void invoke("git_watch_start", { projectPath }).catch((err) => {
      console.warn("[GitChangesPanel] git_watch_start 失败，降级慢轮询:", err);
      if (!disposed) startFallback();
    });

    // 重新聚焦/变可见时立即刷新一次（事件可能在失焦期间被忽略）。
    const onFocus = () => refreshIfActive();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshIfActive();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      stopFallback();
      if (unlisten) unlisten();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      void invoke("git_watch_stop").catch(() => {});
    };
  }, [panelActive, projectPath, fetchChanges]);

  const directoryPaths = useMemo(
    () => [...collectDirectoryPaths(tree, "tracked"), ...collectDirectoryPaths(untrackedTree, "untracked")],
    [tree, untrackedTree]
  );
  const hasDirectories = directoryPaths.length > 0;
  const allCollapsed = hasDirectories && directoryPaths.every((path) => collapsedDirs.has(path));

  if (!open || !visible) return null;

  const handleRefresh = () => {
    if (projectPath) {
      fetchChanges(projectPath);
    }
  };

  const handleFileClick = (filePath: string) => {
    const fileName = filePath.split(/[\\/]/).pop() || filePath;
    const fileChange = changes.find(c => c.path === filePath);
    if (fileChange) {
      setSelectedFile({ path: filePath, name: fileName, status: fileChange.status });
      setDiffModalOpen(true);
    }
  };

  const handleRequestDiscard = (path: string, name: string, status: string) => {
    setDiscardTarget({ path, name, status });
  };

  const allCount = changes.length;
  const modifiedCount = changes.filter((c) => c.status === "M").length;
  const addedCount = changes.filter((c) => c.status === "A" || c.status === "U" || c.status === "??").length;
  const deletedCount = changes.filter((c) => c.status === "D").length;
  // 可回滚（已跟踪）文件数：排除未跟踪 U/??。
  const trackableCount = changes.filter((c) => c.status !== "U" && c.status !== "??").length;
  // 总增删行数聚合（真实 diff 行数，后端 git_get_changes 提供）。
  const totalAdded = changes.reduce((sum, c) => sum + (c.added || 0), 0);
  const totalDeleted = changes.reduce((sum, c) => sum + (c.deleted || 0), 0);
  // 已暂存文件数（真实 git 索引，含 A/M/D/R）。
  const stagedCount = changes.filter((c) => c.staged).length;
  // 被取消勾选的已加入跟踪(A)文件：仍暂存/跟踪，但本次提交不计入。
  const deselectedAddedCount = changes.filter((c) => c.status === "A" && deselectedAdded.has(c.path)).length;
  // 选中的未跟踪文件数（前端态，提交时才 git add）。
  const selectedUntrackedCount = selectedUntracked.size;
  // 待提交总数 = 已暂存 − 取消勾选的 A 文件 + 选中未跟踪。
  const committableCount = stagedCount - deselectedAddedCount + selectedUntrackedCount;
  // 顶部全选三态：以「待提交」与总变更数比较。
  const selectAllState: StageState =
    changes.length === 0 || committableCount === 0
      ? "unchecked"
      : committableCount >= changes.length
        ? "checked"
        : "indeterminate";

  // 各类路径分组，用于全选/全不选。
  const allUntrackedPaths = changes.filter((c) => c.status === "U" || c.status === "??").map((c) => c.path);
  const addedPaths = changes.filter((c) => c.status === "A").map((c) => c.path);
  // 已跟踪且非新增(M/D/R)的路径：全选/全不选时走真实 stage/unstage。
  const trackedModPaths = changes
    .filter((c) => c.status !== "U" && c.status !== "??" && c.status !== "A")
    .map((c) => c.path);

  const handleToggleSelectAll = () => {
    if (selectAllState === "checked") {
      // 全部取消：取消暂存 M/D/R + 清空未跟踪选中 + 取消勾选全部 A（A 保持跟踪，不 unstage）。
      if (trackedModPaths.length > 0) {
        void unstagePaths(trackedModPaths).catch(() => toast.error("全部取消暂存失败"));
      }
      clearUntrackedSelection();
      if (addedPaths.length > 0) setAddedDeselection(addedPaths, true);
    } else {
      // 全选：暂存 M/D/R + 选中全部未跟踪 + 勾选回全部 A。
      if (trackedModPaths.length > 0) {
        void stagePaths(trackedModPaths).catch(() => toast.error("全部暂存失败"));
      }
      if (allUntrackedPaths.length > 0) setUntrackedSelection(allUntrackedPaths, true);
      if (addedPaths.length > 0) setAddedDeselection(addedPaths, false);
    }
  };

  const handleToggleStage = (filePath: string, staged: boolean) => {
    void (staged ? unstageFile(filePath) : stageFile(filePath)).catch(() => {
      toast.error("暂存操作失败，请刷新后重试");
    });
  };

  const handleToggleStagePaths = (paths: string[], allStaged: boolean) => {
    void (allStaged ? unstagePaths(paths) : stagePaths(paths)).catch(() => {
      toast.error("批量暂存操作失败，请刷新后重试");
    });
  };

  const handleCommit = async () => {
    const msg = commitMsg.trim();
    if (!msg || committableCount === 0 || committing) return;
    try {
      const shortId = await commit(msg);
      setCommitMsg("");
      toast.success(`已提交 ${shortId}`);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      if (m.includes("no_git_identity")) {
        toast.error("提交失败：未配置 git 身份（user.name / user.email）");
      } else if (m.includes("nothing_staged")) {
        toast.error("没有已暂存的改动");
      } else {
        toast.error(`提交失败：${m}`);
      }
    }
  };

  const handlePush = async () => {
    if (pushing) return;
    const settingUpstream = !!branchStatus && !branchStatus.hasUpstream;
    try {
      await push();
      toast.success(settingUpstream ? "已建立跟踪分支并推送" : "已推送到远端");
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      toast.error(formatGitNetError("推送失败", m));
    }
  };

  const handlePull = async () => {
    if (pulling) return;
    try {
      await pullFfOnly();
      toast.success("已拉取远端更新");
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      if (m.includes("not_fast_forward")) {
        toast.error("远端与本地分叉，无法快进。请到终端手动合并/变基。");
      } else {
        toast.error(formatGitNetError("拉取失败", m));
      }
    }
  };

  const filterButtons = [
    { label: "全部", value: "all" as const, count: allCount, color: TERM.fg, icon: Files },
    { label: "修改", value: "M" as const, count: modifiedCount, color: STATUS_CONFIG.M.color, icon: FilePen },
    { label: "新增", value: "A" as const, count: addedCount, color: STATUS_CONFIG.A.color, icon: FilePlus },
    { label: "删除", value: "D" as const, count: deletedCount, color: STATUS_CONFIG.D.color, icon: FileMinus },
  ];

  const panelClassName = embedded
    ? "flex h-full min-h-0 flex-col overflow-hidden font-mono"
    : "relative z-[1] flex w-[290px] shrink-0 flex-col overflow-hidden border-l border-border font-mono";
  const Container = embedded ? "div" : "aside";

  return (
    <Container
      className={panelClassName}
      style={{ backgroundColor: TERM.bg }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5" style={{ borderColor: TERM.dim }}>
        <span className="flex items-center gap-2 text-[11px] font-bold" style={{ color: TERM.fg }}>
          <GitBranch size={12} strokeWidth={2} />
          Git 变更
        </span>
        <span className="flex items-center gap-1.5">
          {changes.length > 0 && (
            <StageCheckbox
              state={selectAllState}
              onToggle={handleToggleSelectAll}
              title={selectAllState === "checked" ? "全部取消（取消暂存 + 清空未跟踪选中）" : "全选（暂存已跟踪改动 + 选中未跟踪文件）"}
            />
          )}
          {hasDirectories && (
            <button
              type="button"
              onClick={allCollapsed ? expandAllDirs : collapseAllDirs}
              className="ui-focus-ring rounded px-1 py-0.5 text-[10px] transition-colors"
              style={{ color: TERM.cyan, backgroundColor: `${TERM.cyan}12` }}
              title={allCollapsed ? "全部展开 Git 文件树" : "全部收起 Git 文件树"}
              aria-label={allCollapsed ? "全部展开 Git 文件树" : "全部收起 Git 文件树"}
            >
              {allCollapsed ? "展开" : "收起"}
            </button>
          )}
          {trackableCount > 0 && (
            <button
              type="button"
              onClick={() => setConfirmAllOpen(true)}
              disabled={discarding}
              className="ui-focus-ring rounded p-0.5 disabled:opacity-40"
              style={{ color: TERM.red }}
              title="丢弃全部已跟踪改动"
              aria-label="丢弃全部已跟踪改动"
            >
              <Undo2 size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            className={`ui-focus-ring rounded p-0.5 ${loading ? "animate-spin" : ""}`}
            style={{ color: TERM.cyan }}
            title="刷新"
            aria-label="刷新 Git 变更"
          >
            <RefreshCw size={11} />
          </button>
        </span>
      </div>

      {/* Filter */}
      {changes.length > 0 && (
        <div className="flex shrink-0 gap-1 border-b px-2 py-1.5" style={{ borderColor: TERM.dim }}>
          {filterButtons.map((btn) => {
            const Icon = btn.icon;
            const active = statusFilter === btn.value;
            return (
              <button
                key={btn.value}
                type="button"
                onClick={() => setStatusFilter(btn.value)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors"
                style={{
                  backgroundColor: active ? `${btn.color}30` : "transparent",
                  color: active ? btn.color : TERM.dim,
                  border: `1px solid ${active ? btn.color : "transparent"}`,
                }}
              >
                <Icon size={11} strokeWidth={2} style={{ color: btn.color }} />
                <span>{btn.label}</span>
                <span className="font-bold">{btn.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {changes.length > 0 && (
        <div className="shrink-0 border-b px-2 py-1.5 text-[10px]" style={{ borderColor: TERM.dim, color: TERM.dim }}>
          <span style={{ color: TERM.fg }}>{allCount}</span> 个文件
          {modifiedCount > 0 && (
            <>
              {" · "}
              <span style={{ color: STATUS_CONFIG.M.color }}>{modifiedCount}</span> 修改
            </>
          )}
          {addedCount > 0 && (
            <>
              {" · "}
              <span style={{ color: STATUS_CONFIG.A.color }}>{addedCount}</span> 新增
            </>
          )}
          {deletedCount > 0 && (
            <>
              {" · "}
              <span style={{ color: STATUS_CONFIG.D.color }}>{deletedCount}</span> 删除
            </>
          )}
          {(totalAdded > 0 || totalDeleted > 0) && (
            <>
              {" · "}
              {totalAdded > 0 && <span style={{ color: TERM.green }}>+{totalAdded}</span>}
              {totalAdded > 0 && totalDeleted > 0 && " "}
              {totalDeleted > 0 && <span style={{ color: TERM.red }}>-{totalDeleted}</span>}
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2 ui-thin-scroll">
        {!projectPath ? (
          <EmptyHint text="当前终端未关联项目" />
        ) : loading && changes.length === 0 ? (
          <EmptyHint text="加载中…" />
        ) : changes.length === 0 ? (
          <EmptyHint text="无文件变更" />
        ) : (
          <>
            {tree.length > 0 && (
              <div>
                <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: TERM.dim }}>
                  改动
                </div>
                <GitChangesTree
                  nodes={tree}
                  treeId="tracked"
                  onFileClick={handleFileClick}
                  onRequestDiscard={handleRequestDiscard}
                  onToggleStage={handleToggleStage}
                  onToggleStagePaths={handleToggleStagePaths}
                />
              </div>
            )}
            {/* 未跟踪文件单独成组（仿 JetBrains Unversioned Files），M/D 筛选下隐藏 */}
            {untrackedTree.length > 0 && statusFilter !== "M" && statusFilter !== "D" && (
              <div className={tree.length > 0 ? "mt-2 border-t pt-2" : ""} style={{ borderColor: TERM.dim }}>
                <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: TERM.dim }}>
                  未跟踪文件
                </div>
                <GitChangesTree
                  nodes={untrackedTree}
                  treeId="untracked"
                  onFileClick={handleFileClick}
                  onRequestDiscard={handleRequestDiscard}
                  onToggleStage={handleToggleStage}
                  onToggleStagePaths={handleToggleStagePaths}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* 分支状态行：分支名 + ↑ahead ↓behind + 推送/拉取按钮。提交后即使无变更也展示，便于推送已有提交。 */}
      {projectPath && branchStatus && (branchStatus.branch || branchStatus.detached) && (() => {
        const { branch, ahead, behind, hasUpstream, detached } = branchStatus;
        const canPush = !detached && !!branch && (ahead > 0 || !hasUpstream);
        const showPull = !detached && hasUpstream && behind > 0;
        return (
          <div className="flex shrink-0 items-center justify-between gap-2 border-t px-2 py-1.5" style={{ borderColor: TERM.dim }}>
            <span className="flex min-w-0 items-center gap-1.5 text-[11px]" style={{ color: TERM.fg }}>
              <GitBranch size={12} strokeWidth={2} style={{ color: TERM.dim }} className="shrink-0" />
              <span className="truncate">{detached ? "detached HEAD" : branch}</span>
              {!detached && hasUpstream && (
                <span className="flex shrink-0 items-center gap-1.5" style={{ color: TERM.dim }}>
                  <span className="flex items-center" style={{ color: ahead > 0 ? TERM.fg : TERM.dim }}>
                    <ArrowUp size={10} strokeWidth={2} />{ahead}
                  </span>
                  <span className="flex items-center" style={{ color: behind > 0 ? TERM.fg : TERM.dim }}>
                    <ArrowDown size={10} strokeWidth={2} />{behind}
                  </span>
                </span>
              )}
              {!detached && branch && !hasUpstream && (
                <span className="shrink-0 text-[10px]" style={{ color: TERM.dim }}>未跟踪远端</span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {showPull && (
                <button
                  type="button"
                  onClick={() => void handlePull()}
                  disabled={pulling}
                  className="ui-focus-ring flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ color: TERM.cyan, border: `1px solid ${TERM.cyan}55` }}
                  title="拉取远端更新（仅快进）"
                >
                  <Download size={12} />
                  {pulling ? "拉取中…" : `拉取 ${behind}`}
                </button>
              )}
              <button
                type="button"
                onClick={() => void handlePush()}
                disabled={pushing || !canPush}
                className="ui-focus-ring flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ color: TERM.green, border: `1px solid ${TERM.green}55` }}
                title={hasUpstream ? "推送到远端" : "推送并建立远端跟踪分支"}
              >
                <Upload size={12} />
                {pushing ? "推送中…" : ahead > 0 ? `推送 ${ahead}` : "推送"}
              </button>
            </span>
          </div>
        );
      })()}

      {/* 提交栏：仅文件级 stage + commit（无 AI） */}
      {projectPath && changes.length > 0 && (
        <div className="shrink-0 border-t px-2 py-2" style={{ borderColor: TERM.dim }}>
          <textarea
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/Cmd+Enter 提交
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void handleCommit();
              }
            }}
            rows={2}
            placeholder={committableCount > 0 ? "提交信息（Ctrl+Enter 提交）" : "勾选文件后再提交"}
            className="ui-thin-scroll w-full resize-none rounded px-2 py-1 text-[11px] outline-none"
            style={{ backgroundColor: TERM.bg, color: TERM.fg, border: `1px solid ${TERM.dim}` }}
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px]" style={{ color: TERM.dim }}>
              待提交 <span style={{ color: committableCount > 0 ? TERM.green : TERM.dim }}>{committableCount}</span> 个文件
              {selectedUntrackedCount > 0 && (
                <span style={{ color: TERM.dim }}>（含 {selectedUntrackedCount} 未跟踪）</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => void handleCommit()}
              disabled={committing || committableCount === 0 || commitMsg.trim().length === 0}
              className="ui-focus-ring flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ color: TERM.green, border: `1px solid ${TERM.green}55` }}
              title="提交已暂存与选中的改动"
            >
              <GitCommitHorizontal size={12} />
              {committing ? "提交中…" : `提交 (${committableCount})`}
            </button>
          </div>
        </div>
      )}

      {/* Diff Modal */}
      {selectedFile && projectPath && (
        <DiffViewerModal
          open={diffModalOpen}
          onClose={() => setDiffModalOpen(false)}
          projectPath={projectPath}
          filePath={selectedFile.path}
          fileName={selectedFile.name}
          status={selectedFile.status}
          onRequestDiscard={handleRequestDiscard}
        />
      )}

      {/* 单文件回滚确认 */}
      <ConfirmDialog
        open={!!discardTarget}
        title="回滚改动？"
        message={discardTarget ? `将永久丢弃对 ${discardTarget.name} 的未提交改动，无法通过 git 撤销。` : undefined}
        confirmText="回滚"
        cancelText="取消"
        danger
        onConfirm={() => {
          if (discardTarget) void discardFile(discardTarget.path, discardTarget.status);
          setDiscardTarget(null);
        }}
        onClose={() => setDiscardTarget(null)}
      />

      {/* 丢弃全部确认 */}
      <ConfirmDialog
        open={confirmAllOpen}
        title="丢弃全部改动？"
        message={`将永久丢弃 ${trackableCount} 个已跟踪文件的未提交改动，无法通过 git 撤销。未跟踪文件不受影响。`}
        confirmText="全部丢弃"
        cancelText="取消"
        danger
        onConfirm={() => {
          setConfirmAllOpen(false);
          void discardAll();
        }}
        onClose={() => setConfirmAllOpen(false)}
      />
    </Container>
  );
}
