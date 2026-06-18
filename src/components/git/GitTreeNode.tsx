import { ChevronRight, Undo2, Check, Minus } from "../icons";
import type { GitTreeNode, GitFileChange } from "../../lib/types";
import { GitStatusIcon } from "./GitStatusIcon";
import { useGitStore } from "../../stores/gitStore";
import { TERM } from "../stats/termStatsUi";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "../ui/context-menu";
import { getMaterialFileIcon, getMaterialFolderIcon } from "@baybreezy/file-extension-icon";
import { StageCheckbox, type StageState } from "./StageCheckbox";

// 收集某节点下所有文件变更（含子目录），用于目录级三态勾选框与批量操作。
function collectFileChanges(node: GitTreeNode): GitFileChange[] {
  if (node.type === "file") return node.change ? [node.change] : [];
  return (node.children ?? []).flatMap(collectFileChanges);
}

interface GitTreeNodeProps {
  node: GitTreeNode;
  depth: number;
  treeId: string;
  onFileClick: (filePath: string) => void;
  onRequestDiscard: (path: string, name: string, status: string) => void;
  onToggleStage: (filePath: string, staged: boolean) => void;
  onToggleStagePaths: (paths: string[], allStaged: boolean) => void;
}

export function GitTreeNodeComponent({ node, depth, treeId, onFileClick, onRequestDiscard, onToggleStage, onToggleStagePaths }: GitTreeNodeProps) {
  const { collapsedDirs, toggleDir, selectedUntracked, toggleUntrackedSelection, deselectedAdded, toggleAddedDeselection, setAddedDeselection } = useGitStore();
  // 折叠 key 按分区前缀隔离：已跟踪树与未跟踪树同名目录互不影响。
  const collapseKey = `${treeId}:${node.path}`;
  const isCollapsed = collapsedDirs.has(collapseKey);
  const indentPx = depth * 12 + 4;

  if (node.type === "file") {
    // 获取 Material Design 文件图标（base64 data URI）
    const iconDataUri = getMaterialFileIcon(node.name);

    // 根据 Git 状态给文件名着色
    let fileNameColor = TERM.fg;
    if (node.change) {
      switch (node.change.status) {
        case "M":
          fileNameColor = TERM.blue;
          break;
        case "A":
          fileNameColor = TERM.green;
          break;
        case "D":
          fileNameColor = "#808080";
          break;
        case "U":
        case "??":
          fileNameColor = TERM.red;
          break;
        case "R":
          fileNameColor = TERM.magenta;
          break;
        default:
          fileNameColor = TERM.fg;
      }
    }

    // 已跟踪文件才可回滚；未跟踪(U/??)排除。
    const canDiscard = !!node.change && node.change.status !== "U" && node.change.status !== "??";
    // 未跟踪文件：复选框走前端「选中」态，勾选不立即 git add，提交时再统一 add。
    const isUntracked = node.change?.status === "U" || node.change?.status === "??";
    const untrackedSelected = isUntracked && selectedUntracked.has(node.path);
    // 已加入跟踪(A)文件：复选框为「本次是否提交」选择态，取消勾选不会 unstage（保持跟踪）。
    const isAdded = node.change?.status === "A";
    const addedSelected = isAdded && !deselectedAdded.has(node.path);

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="group flex items-center gap-1.5 rounded py-0.5 px-1 cursor-pointer text-[13px]"
            style={{ paddingLeft: indentPx, backgroundColor: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${TERM.cyan}20`)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            onClick={() => onFileClick(node.path)}
          >
            {/* 占位对齐：文件行无 chevron，补一个等宽占位让复选框列与目录行对齐 */}
            <span className="inline-flex shrink-0" style={{ width: 10 }} aria-hidden="true" />
            <StageCheckbox
              state={
                isUntracked
                  ? untrackedSelected
                    ? "checked"
                    : "unchecked"
                  : isAdded
                    ? addedSelected
                      ? "checked"
                      : "unchecked"
                    : node.change?.staged
                      ? "checked"
                      : "unchecked"
              }
              onToggle={() => {
                if (!node.change) return;
                if (isUntracked) toggleUntrackedSelection([node.path]);
                else if (isAdded) toggleAddedDeselection([node.path]);
                else onToggleStage(node.path, node.change.staged);
              }}
              title={
                isUntracked
                  ? "选中以在提交时纳入（提交时才执行 git add）"
                  : isAdded
                    ? addedSelected
                      ? "取消勾选（保持跟踪，本次提交不包含）"
                      : "勾选以本次提交包含"
                    : node.change?.staged
                      ? "取消暂存（移出暂存区）"
                      : "暂存此文件（git add）"
              }
            />
            <img
              src={iconDataUri}
              alt=""
              width={14}
              height={14}
              className="shrink-0"
              style={{ objectFit: "contain" }}
            />
            <span className="flex-1 truncate" style={{ color: fileNameColor }}>{node.name}</span>
            {canDiscard && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDiscard(node.path, node.name, node.change!.status);
                }}
                className="ui-focus-ring shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: TERM.dim }}
                title="回滚此文件改动"
                aria-label="回滚此文件改动"
              >
                <Undo2 size={11} />
              </button>
            )}
            {node.change && (
              <>
                <GitStatusIcon status={node.change.status} size={12} />
                {(node.change.added > 0 || node.change.deleted > 0) && (
                  <span className="text-[11px]" style={{ color: TERM.dim }}>
                    {node.change.added > 0 && (
                      <span style={{ color: TERM.green }}>+{node.change.added}</span>
                    )}
                    {node.change.added > 0 && node.change.deleted > 0 && " "}
                    {node.change.deleted > 0 && (
                      <span style={{ color: TERM.red }}>-{node.change.deleted}</span>
                    )}
                  </span>
                )}
              </>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {isUntracked ? (
            // 未跟踪文件右键：真实「加入跟踪（git add）」立即操作（与复选框的「选中」区分开）。
            <ContextMenuItem
              className="flex items-center gap-2"
              onSelect={() => {
                if (node.change) onToggleStage(node.path, false);
              }}
            >
              <Check size={12} />
              加入跟踪（git add）
            </ContextMenuItem>
          ) : (
            <ContextMenuItem
              className="flex items-center gap-2"
              onSelect={() => {
                if (node.change) onToggleStage(node.path, node.change.staged);
              }}
            >
              {node.change?.staged ? <Minus size={12} /> : <Check size={12} />}
              {node.change?.staged ? "取消暂存" : "暂存（git add）"}
            </ContextMenuItem>
          )}
          <ContextMenuItem
            danger
            disabled={!canDiscard}
            className="flex items-center gap-2"
            onSelect={() => {
              if (canDiscard) onRequestDiscard(node.path, node.name, node.change!.status);
            }}
          >
            <Undo2 size={12} />
            回滚改动
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  // 目录节点 - 使用 Material Design 文件夹图标
  const hasChildren = node.children && node.children.length > 0;
  const folderIconDataUri = getMaterialFolderIcon(node.name, !isCollapsed);
  const dirFiles = collectFileChanges(node);
  // 目录下全部为未跟踪文件时，复选框走「选中」态（与文件行一致）。
  const dirAllUntracked =
    dirFiles.length > 0 && dirFiles.every((f) => f.status === "U" || f.status === "??");
  const dirSelectedCount = dirAllUntracked
    ? dirFiles.filter((f) => selectedUntracked.has(f.path)).length
    : 0;
  const dirUntrackedState: StageState =
    dirSelectedCount === 0 ? "unchecked" : dirSelectedCount === dirFiles.length ? "checked" : "indeterminate";

  // 「改动」树目录：M/D/R 走真实暂存态，A 文件走「本次是否提交」选择态（取消不 unstage，保持跟踪）。
  const dirModFiles = dirFiles.filter((f) => f.status !== "A" && f.status !== "U" && f.status !== "??");
  const dirAddedFiles = dirFiles.filter((f) => f.status === "A");
  const dirCheckedCount =
    dirModFiles.filter((f) => f.staged).length + dirAddedFiles.filter((f) => !deselectedAdded.has(f.path)).length;
  const dirTrackedState: StageState =
    dirCheckedCount === 0 ? "unchecked" : dirCheckedCount === dirFiles.length ? "checked" : "indeterminate";
  // 目录复选框最终三态：未跟踪目录用选中态，否则用「改动」组合态。
  const dirState: StageState = dirAllUntracked ? dirUntrackedState : dirTrackedState;

  // 目录级切换：未跟踪→切选中；改动→M/D/R 真实暂存切换 + A 文件仅切换勾选（不 unstage）。
  const handleDirToggle = () => {
    if (dirFiles.length === 0) return;
    if (dirAllUntracked) {
      toggleUntrackedSelection(dirFiles.map((f) => f.path));
      return;
    }
    const makeChecked = dirTrackedState !== "checked"; // 部分/未选 → 全选；全选 → 全不选
    if (dirModFiles.length > 0) {
      // onToggleStagePaths(paths, allStaged): allStaged=true → 取消暂存；false → 暂存。
      onToggleStagePaths(dirModFiles.map((f) => f.path), !makeChecked);
    }
    if (dirAddedFiles.length > 0) {
      setAddedDeselection(dirAddedFiles.map((f) => f.path), !makeChecked);
    }
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="flex items-center gap-1.5 rounded py-0.5 px-1 hover:bg-opacity-10 cursor-pointer font-medium text-[13px]"
            style={{ paddingLeft: indentPx, backgroundColor: "transparent" }}
            onClick={() => toggleDir(collapseKey)}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${TERM.cyan}20`)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <span
              className="inline-flex items-center justify-center shrink-0 transition-transform"
              style={{
                transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                color: TERM.dim,
              }}
            >
              <ChevronRight size={10} strokeWidth={2} />
            </span>
            {dirFiles.length > 0 && (
              <StageCheckbox
                state={dirState}
                onToggle={handleDirToggle}
                title={dirAllUntracked ? "选中以在提交时纳入（提交时才执行 git add）" : dirState === "checked" ? "取消勾选该目录（A 文件保持跟踪，仅本次不提交）" : "勾选该目录全部文件"}
              />
            )}
            <img
              src={folderIconDataUri}
              alt=""
              width={14}
              height={14}
              className="shrink-0"
              style={{ objectFit: "contain" }}
            />
            <span className="flex-1 truncate" style={{ color: TERM.fg }}>{node.name}</span>
            {hasChildren && (
              <span className="text-[11px] rounded px-1 py-0" style={{ color: TERM.dim, backgroundColor: `${TERM.dim}20` }}>
                {node.children!.length}
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            className="flex items-center gap-2"
            disabled={dirFiles.length === 0}
            onSelect={() => {
              if (dirAllUntracked) {
                // 未跟踪目录右键：真实「加入跟踪」立即 git add 全部文件。
                onToggleStagePaths(dirFiles.map((f) => f.path), false);
              } else {
                // 改动目录：M/D/R 真实切换暂存，A 文件仅切换勾选（不 unstage，保持跟踪）。
                handleDirToggle();
              }
            }}
          >
            {dirAllUntracked ? (
              <Check size={12} />
            ) : dirTrackedState === "checked" ? (
              <Minus size={12} />
            ) : (
              <Check size={12} />
            )}
            {dirAllUntracked
              ? "加入跟踪该目录（git add）"
              : dirTrackedState === "checked"
                ? "取消勾选该目录"
                : "勾选该目录"}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {!isCollapsed && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <GitTreeNodeComponent key={child.path} node={child} depth={depth + 1} treeId={treeId} onFileClick={onFileClick} onRequestDiscard={onRequestDiscard} onToggleStage={onToggleStage} onToggleStagePaths={onToggleStagePaths} />
          ))}
        </div>
      )}
    </div>
  );
}
