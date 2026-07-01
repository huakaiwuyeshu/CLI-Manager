import { createContext, useContext, type MouseEvent as ReactMouseEvent } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import type { Project } from "../../lib/types";
import type { ProviderBadge } from "../../stores/projectStore";
import type { SessionStatus } from "../../stores/terminalStore";

export interface TreeActions {
  selectedId: string | null;
  selectedProjectIds: Set<string>;
  newGroupParentId: string | null;
  collapsedIds: Set<string>;
  renamingGroupId: string | null;
  providerBadges: Record<string, ProviderBadge>;
  onSelectProject: (e: ReactMouseEvent, p: Project) => void;
  onSelectProjectByKeyboard: (p: Project) => void;
  onOpenProject: (p: Project) => void;
  onStartGroup: (groupId: string) => void;
  onRequestDeleteProject: (p: Project) => void;
  onRequestDeleteGroup: (groupId: string, groupName: string) => void;
  onRenameConfirm: (id: string, newName: string) => void;
  onCancelRename: () => void;
  onContextMenuProject: (e: ReactMouseEvent, p: Project) => void;
  onContextMenuGroup: (e: ReactMouseEvent, groupId: string, groupName: string) => void;
  onCreateGroup: (parentId: string | null, name: string) => void;
  onCancelNewGroup: () => void;
  toggleCollapsed: (id: string) => void;
  getProjectStatus: (projectId: string) => SessionStatus | null;
  getProjectTerminalCount: (projectId: string) => number;
  isPathInvalid: (projectId: string) => boolean;
  onDragEnd: (event: DragEndEvent) => void;
}

export const TreeContext = createContext<TreeActions | null>(null);

export function useTreeActions(): TreeActions {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error("useTreeActions must be used within TreeContext.Provider");
  return ctx;
}
