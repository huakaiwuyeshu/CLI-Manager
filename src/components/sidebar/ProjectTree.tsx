import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors, type CollisionDetection, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { TreeNode as TNode } from "../../lib/types";
import type { SessionStatus } from "../../stores/terminalStore";
import { SidebarSkeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import { Popover, PopoverAnchor, PopoverContent } from "../ui/popover";
import { Folder, Plus, Terminal } from "../icons";
import { VendorIcon, inferVendor } from "../VendorIcon";
import { TreeNodeItem } from "./TreeNodeItem";
import { useTreeActions, type TreeActions } from "./TreeContext";
import { useI18n } from "../../lib/i18n";

interface ProjectTreeProps {
  tree: TNode[];
  initialLoading: boolean;
  loadError: string | null;
  collapsed: boolean;
  density: "compact" | "comfortable";
  newGroupParentId: string | null;
  onCreateRootGroup: (name: string) => void;
  onCancelRootGroup: () => void;
  onQuickAddProject: () => void;
  onRetry: () => void;
  onExpandSidebar: () => void;
}

const STATUS_COLORS: Record<SessionStatus, string> = {
  running: "#9ece6a",
  exited: "#ff9e64",
  error: "#f7768e",
};

function countProjects(node: TNode): number {
  if (node.type === "project") return 1;
  return node.children.reduce((sum, child) => sum + countProjects(child), 0);
}

interface VisibleTreeNode {
  key: string;
  kind: "group" | "project";
  parentGroupKey: string | null;
  groupId?: string;
  groupName?: string;
  projectId?: string;
  isOpen?: boolean;
  hasChildren?: boolean;
  firstChildKey?: string | null;
}

function nodeKey(node: TNode): string {
  return node.type === "group" ? `g:${node.group.id}` : `p:${node.project.id}`;
}

// 指针在节点行的中部 40% → 命中 into:groupId（进入该分组）
// 指针在边缘 30%（上/下） → 命中 group 节点本身（触发同层 reorder）
// 这样可以让用户把分组内项目自然拖到根级（命中根级 group 边缘 = 同层 reorder）
const treeCollisionDetection: CollisionDetection = (args) => {
  const collisions = closestCenter(args);
  const activeId = args.active.id;
  const filtered = collisions.filter((c) => c.id !== activeId);
  if (filtered.length === 0) return [];

  const pointer = args.pointerCoordinates;
  if (pointer) {
    const containingInto = filtered.find((c) => {
      if (typeof c.id !== "string" || !c.id.startsWith("into:")) return false;
      const rect = c.data?.droppableContainer?.rect?.current;
      return !!rect && pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
    });
    if (containingInto) return [containingInto];
  }

  const pointerY = pointer?.y;
  const intoIds = new Set<string>();
  for (const c of filtered) {
    if (typeof c.id === "string" && c.id.startsWith("into:")) intoIds.add(c.id);
  }

  // 找最近的非-into 命中（即 sibling 节点）
  const sibling = filtered.find((c) => typeof c.id !== "string" || !c.id.startsWith("into:"));
  if (sibling && pointerY != null) {
    const rect = sibling.data?.droppableContainer?.rect?.current;
    if (rect) {
      const ratio = (pointerY - rect.top) / Math.max(1, rect.height);
      const intoId = `into:${String(sibling.id)}`;
      // 仅当节点本身是 group（有对应 into:）且指针在中部 30%~70% 时进入它
      if (intoIds.has(intoId) && ratio >= 0.3 && ratio <= 0.7) {
        const intoCollision = filtered.find((c) => c.id === intoId);
        if (intoCollision) return [intoCollision];
      }
      return [sibling];
    }
  }

  // 没拿到 rect 时，回退到「优先 into:groupId」
  const intoNonRoot = filtered.find(
    (c) => typeof c.id === "string" && c.id.startsWith("into:")
  );
  if (intoNonRoot) return [intoNonRoot];
  return [filtered[0]];
};

function flattenVisibleTree(
  nodes: TNode[],
  collapsedIds: Set<string>,
  parentGroupKey: string | null = null,
  out: VisibleTreeNode[] = []
): VisibleTreeNode[] {
  for (const node of nodes) {
    if (node.type === "group") {
      const currentKey = `g:${node.group.id}`;
      const isOpen = !collapsedIds.has(node.group.id);
      const firstChildKey = node.children.length > 0 ? nodeKey(node.children[0]) : null;
      out.push({
        key: currentKey,
        kind: "group",
        parentGroupKey,
        groupId: node.group.id,
        groupName: node.group.name,
        isOpen,
        hasChildren: node.children.length > 0,
        firstChildKey,
      });
      if (isOpen) {
        flattenVisibleTree(node.children, collapsedIds, currentKey, out);
      }
      continue;
    }

    out.push({
      key: `p:${node.project.id}`,
      kind: "project",
      parentGroupKey,
      projectId: node.project.id,
    });
  }
  return out;
}

export function ProjectTree({
  tree,
  initialLoading,
  loadError,
  collapsed,
  density,
  newGroupParentId,
  onCreateRootGroup,
  onCancelRootGroup,
  onQuickAddProject,
  onRetry,
  onExpandSidebar,
}: ProjectTreeProps) {
  const { t } = useI18n();
  const actions = useTreeActions();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [focusedNodeKey, setFocusedNodeKey] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const visibleNodes = useMemo(
    () => flattenVisibleTree(tree, actions.collapsedIds),
    [actions.collapsedIds, tree]
  );
  const visibleNodeIndex = useMemo(() => {
    const map = new Map<string, number>();
    visibleNodes.forEach((node, idx) => map.set(node.key, idx));
    return map;
  }, [visibleNodes]);
  const projectById = useMemo(() => {
    const map = new Map<string, TNode>();
    const walk = (nodes: TNode[]) => {
      for (const node of nodes) {
        if (node.type === "project") {
          map.set(node.project.id, node);
        } else {
          walk(node.children);
        }
      }
    };
    walk(tree);
    return map;
  }, [tree]);

  const focusTreeItem = useCallback((key: string) => {
    setFocusedNodeKey(key);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-tree-key="${key}"]`);
      el?.focus();
    });
  }, []);

  useEffect(() => {
    if (visibleNodes.length === 0) {
      if (focusedNodeKey !== null) {
        setFocusedNodeKey(null);
      }
      return;
    }
    if (focusedNodeKey && visibleNodeIndex.has(focusedNodeKey)) return;
    const selectedProjectKey =
      actions.selectedId && visibleNodeIndex.has(`p:${actions.selectedId}`)
        ? `p:${actions.selectedId}`
        : visibleNodes[0].key;
    setFocusedNodeKey(selectedProjectKey);
  }, [actions.selectedId, focusedNodeKey, visibleNodeIndex, visibleNodes]);

  const handleTreeKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.tagName === "SELECT" ||
      !!target?.closest("[contenteditable='true']")
    ) {
      return;
    }

    if (visibleNodes.length === 0) return;
    const currentKey = focusedNodeKey ?? visibleNodes[0].key;
    const index = visibleNodeIndex.get(currentKey) ?? 0;
    const current = visibleNodes[index];
    if (!current) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = visibleNodes[Math.min(index + 1, visibleNodes.length - 1)];
      if (next) focusTreeItem(next.key);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = visibleNodes[Math.max(index - 1, 0)];
      if (prev) focusTreeItem(prev.key);
      return;
    }

    if (event.key === "ArrowRight" && current.kind === "group" && current.groupId) {
      event.preventDefault();
      if (current.hasChildren && !current.isOpen) {
        actions.toggleCollapsed(current.groupId);
        return;
      }
      if (current.hasChildren && current.firstChildKey) {
        focusTreeItem(current.firstChildKey);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      if (current.kind === "group" && current.groupId && current.hasChildren && current.isOpen) {
        event.preventDefault();
        actions.toggleCollapsed(current.groupId);
        return;
      }
      if (current.parentGroupKey) {
        event.preventDefault();
        focusTreeItem(current.parentGroupKey);
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (current.kind === "group" && current.groupId) {
        actions.toggleCollapsed(current.groupId);
        return;
      }
      if (current.kind === "project" && current.projectId) {
        const projectNode = projectById.get(current.projectId);
        if (projectNode?.type === "project") {
          actions.onOpenProject(projectNode.project);
        }
      }
      return;
    }

    if (event.key === "Delete" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      if (current.kind === "project" && current.projectId) {
        const projectNode = projectById.get(current.projectId);
        if (projectNode?.type === "project") {
          actions.onRequestDeleteProject(projectNode.project);
        }
        return;
      }
      if (current.kind === "group" && current.groupId) {
        actions.onRequestDeleteGroup(current.groupId, current.groupName ?? "");
      }
      return;
    }

    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      if (current.kind === "project" && current.projectId) {
        const projectNode = projectById.get(current.projectId);
        if (projectNode?.type === "project") {
          actions.onSelectProjectByKeyboard(projectNode.project);
        }
      }
      if (current.kind === "group" && current.groupId) {
        actions.toggleCollapsed(current.groupId);
      }
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusTreeItem(visibleNodes[0].key);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusTreeItem(visibleNodes[visibleNodes.length - 1].key);
    }
  }, [actions, focusTreeItem, focusedNodeKey, projectById, visibleNodeIndex, visibleNodes]);

  if (initialLoading) {
    return (
      <div className="h-full overflow-y-auto overflow-x-hidden px-1.5 pb-2 pt-1">
        <SidebarSkeleton />
      </div>
    );
  }

  if (collapsed) {
    const buttonSize = density === "compact" ? "h-7 w-7" : "h-8 w-8";
    return (
      <div className={`h-full overflow-y-auto overflow-x-hidden ${density === "compact" ? "px-0.5 pb-1.5 pt-0.5" : "px-1 pb-2 pt-1"}`}>
        {tree.length === 0 ? (
          <div className={`flex flex-col items-center text-text-muted ${density === "compact" ? "gap-1.5 py-2.5" : "gap-2 py-3"}`}>
            <Terminal size={20} strokeWidth={1.2} className="opacity-50" />
            <button
              onClick={onQuickAddProject}
              className={`ui-flat-action ui-primary-action px-0 ${buttonSize}`}
              title={t("sidebar.tree.quickAddProject")}
              aria-label={t("sidebar.tree.quickAddProject")}
            >
              <Plus size={12} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            {tree.map((node) =>
              node.type === "group" ? (
                <CollapsedGroupButton
                  key={`g:${node.group.id}`}
                  node={node}
                  sizeClass={buttonSize}
                  onExpandSidebar={onExpandSidebar}
                />
              ) : (
                <CollapsedProjectButton key={`p:${node.project.id}`} node={node} sizeClass={buttonSize} />
              )
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`h-full overflow-y-auto overflow-x-hidden ${density === "compact" ? "px-1 pb-1.5 pt-0.5" : "px-1.5 pb-2 pt-1"}`}>
      {newGroupParentId === "__root__" && (
        <div className={`flex items-center px-2 ${density === "compact" ? "gap-1 py-1" : "gap-1.5 py-1.5"}`}>
          <span className="shrink-0 text-accent">
            <Folder size={16} strokeWidth={1.5} />
          </span>
          <input
            ref={(ref) => {
              ref?.focus();
            }}
            className="ui-tree-inline-input ui-focus-ring h-8 flex-1 px-2 text-xs text-on-surface outline-none"
            onBlur={(e) => {
              const value = e.currentTarget.value.trim();
              if (value) onCreateRootGroup(value);
              else onCancelRootGroup();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const value = e.currentTarget.value.trim();
                if (value) onCreateRootGroup(value);
                else onCancelRootGroup();
              }
              if (e.key === "Escape") onCancelRootGroup();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={treeCollisionDetection}
        onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={(event) => {
          setActiveId(null);
          actions.onDragEnd(event);
        }}
      >
        <SortableContext
          items={tree.map((n) => (n.type === "group" ? n.group.id : n.project.id))}
          strategy={verticalListSortingStrategy}
        >
          <div
            role="tree"
            aria-label={t("sidebar.tree.aria")}
            aria-multiselectable="true"
            onKeyDown={handleTreeKeyDown}
          >
            {tree.map((node) => (
              <TreeNodeItem
                key={node.type === "group" ? `g:${node.group.id}` : `p:${node.project.id}`}
                node={node}
                depth={0}
                density={density}
                focusedNodeKey={focusedNodeKey}
                onFocusNode={setFocusedNodeKey}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeId ? <DragGhost activeId={activeId} tree={tree} /> : null}
        </DragOverlay>
      </DndContext>

      {tree.length === 0 && loadError && (
        <EmptyState
          icon={<Terminal size={40} strokeWidth={1} />}
          title={t("sidebar.tree.loadFailed")}
          description={loadError}
          action={{ label: t("sidebar.tree.retry"), onClick: onRetry }}
        />
      )}

      {tree.length === 0 && !loadError && (
        <EmptyState
          icon={<Terminal size={40} strokeWidth={1} />}
          title={t("sidebar.tree.welcome")}
          description={t("sidebar.tree.welcomeDescription")}
          action={{ label: t("sidebar.tree.quickAddProject"), onClick: onQuickAddProject }}
        />
      )}
    </div>
  );
}

function CollapsedProjectButton({ node, sizeClass }: { node: TNode; sizeClass: string }) {
  const { t } = useI18n();
  const actions = useTreeActions();
  if (node.type !== "project") return null;
  const p = node.project;
  const status = actions.getProjectStatus(p.id);
  const selected = actions.selectedId === p.id || actions.selectedProjectIds.has(p.id);
  const cliVendor = p.cli_tool ? inferVendor(p.cli_tool) : null;
  return (
    <button
      className={`ui-tree-collapsed-item my-0.5 flex ${sizeClass} items-center justify-center rounded-xl transition-colors`}
      data-selected={selected ? "true" : "false"}
      title={p.name}
      aria-label={t("sidebar.tree.openProject", { name: p.name })}
      onClick={() => actions.onOpenProject(p)}
      onContextMenu={(e) => actions.onContextMenuProject(e, p)}
    >
      {status ? (
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
      ) : cliVendor ? (
        <VendorIcon vendor={cliVendor} size={15} />
      ) : (
        <Terminal size={15} strokeWidth={1.5} />
      )}
    </button>
  );
}

function CollapsedGroupButton({
  node,
  sizeClass,
  onExpandSidebar,
}: {
  node: TNode;
  sizeClass: string;
  onExpandSidebar: () => void;
}) {
  const actions = useTreeActions();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const count = useMemo(() => countProjects(node), [node]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const openNow = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  }, [cancelClose]);
  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  if (node.type !== "group") return null;
  const g = node.group;

  const handleClick = () => {
    cancelClose();
    setOpen(false);
    if (actions.collapsedIds.has(g.id)) actions.toggleCollapsed(g.id);
    onExpandSidebar();
  };

  return (
    <Popover open={open} onOpenChange={(next) => { if (!next) setOpen(false); }}>
      <PopoverAnchor asChild>
        <button
          className={`ui-flat-action ui-tree-collapsed-item relative my-0.5 px-0 text-primary ${sizeClass}`}
          title={g.name}
          aria-label={t("sidebar.tree.directoryProjectCount", { name: g.name, count })}
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
          onClick={handleClick}
          onContextMenu={(e) => actions.onContextMenuGroup(e, g.id, g.name)}
        >
          <Folder size={16} strokeWidth={1.5} />
          {count > 0 && <span className="ui-tree-collapsed-badge">{count > 99 ? "99+" : count}</span>}
        </button>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="ui-collapsed-flyout p-1.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
      >
        <GroupFlyout node={node} onPick={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function GroupFlyout({ node, onPick }: { node: TNode; onPick: () => void }) {
  const { t } = useI18n();
  const actions = useTreeActions();
  if (node.type !== "group") return null;
  return (
    <div className="flex max-h-[60vh] min-w-[176px] max-w-[280px] flex-col overflow-y-auto">
      <div className="truncate px-2 py-1 text-[11px] font-semibold text-on-surface-variant">{node.group.name}</div>
      {node.children.length === 0 ? (
        <div className="px-2 py-1 text-[11px] text-text-muted">{t("sidebar.tree.emptyDirectory")}</div>
      ) : (
        renderFlyoutNodes(node.children, 0, actions, onPick)
      )}
    </div>
  );
}

function renderFlyoutNodes(nodes: TNode[], depth: number, actions: TreeActions, onPick: () => void) {
  return nodes.map((child) => {
    const padLeft = 8 + depth * 12;
    if (child.type === "group") {
      return (
        <div key={`g:${child.group.id}`}>
          <div
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-on-surface-variant"
            style={{ paddingLeft: padLeft }}
          >
            <Folder size={13} strokeWidth={1.5} className="shrink-0" />
            <span className="truncate">{child.group.name}</span>
          </div>
          {renderFlyoutNodes(child.children, depth + 1, actions, onPick)}
        </div>
      );
    }
    const p = child.project;
    const status = actions.getProjectStatus(p.id);
    const cliVendor = p.cli_tool ? inferVendor(p.cli_tool) : null;
    return (
      <button
        key={`p:${p.id}`}
        className="ui-collapsed-flyout-item flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[12px] text-on-surface"
        style={{ paddingLeft: padLeft }}
        title={p.name}
        onClick={() => {
          actions.onOpenProject(p);
          onPick();
        }}
        onContextMenu={(e) => actions.onContextMenuProject(e, p)}
      >
        <span className="ui-tree-leading-icon flex shrink-0 items-center">
          {status ? (
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
          ) : cliVendor ? (
            <VendorIcon vendor={cliVendor} size={13} />
          ) : (
            <Terminal size={13} strokeWidth={1.5} />
          )}
        </span>
        <span className="flex-1 truncate">{p.name}</span>
      </button>
    );
  });
}

function findNodeById(nodes: TNode[], id: string): TNode | null {
  for (const n of nodes) {
    if (n.type === "group") {
      if (n.group.id === id) return n;
      const found = findNodeById(n.children, id);
      if (found) return found;
    } else if (n.project.id === id) {
      return n;
    }
  }
  return null;
}

function DragGhost({ activeId, tree }: { activeId: string; tree: TNode[] }) {
  const node = findNodeById(tree, activeId);
  if (!node) return null;
  const label = node.type === "group" ? node.group.name : node.project.name;
  const icon = node.type === "group" ? <Folder size={14} strokeWidth={1.5} /> : <Terminal size={14} strokeWidth={1.5} />;
  return (
    <div className="ui-tree-drag-ghost flex items-center gap-2 rounded-xl border border-border bg-surface-container-high px-3 py-1.5 text-[12px] font-medium shadow-lg">
      <span className="text-on-surface-variant">{icon}</span>
      <span className="truncate text-on-surface">{label}</span>
    </div>
  );
}
