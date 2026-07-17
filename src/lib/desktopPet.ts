import type { Project, TerminalSession } from "./types";
import type { TabNotificationState, TabStatusDetails } from "../stores/terminalStore";
import type { DesktopPetSettings, LanguagePreference } from "../stores/settingsStore";

export const DESKTOP_PET_WINDOW_LABEL = "desktop-pet";
export const DESKTOP_PET_CONFIG_EVENT = "desktop-pet-config";
export const DESKTOP_PET_SNAPSHOT_EVENT = "desktop-pet-snapshot";
export const DESKTOP_PET_READY_EVENT = "desktop-pet-ready";
export const DESKTOP_PET_OPEN_TARGET_EVENT = "desktop-pet-open-target";
export const DESKTOP_PET_OPEN_SETTINGS_EVENT = "desktop-pet-open-settings";
export const DESKTOP_PET_POSITION_EVENT = "desktop-pet-position";

export type DesktopPetMood = "idle" | "working" | "waiting" | "success" | "error" | "sleeping";

export interface PetLocalizedText {
  "zh-CN": string;
  "en-US": string;
}

export interface PetStateAsset {
  file: string;
  row?: number;
  frames?: number;
}

export interface PetManifest {
  schemaVersion: number;
  id: string;
  version: string;
  name: PetLocalizedText;
  description: PetLocalizedText;
  author: string;
  license: string;
  engine: "image-v1" | "codex-sprite";
  canvas: { width: number; height: number };
  states: Partial<Record<DesktopPetMood, PetStateAsset>> & { idle: PetStateAsset };
  spriteVersionNumber?: 1 | 2;
}

export interface PetCatalogEntry {
  id: string;
  version: string;
  name: PetLocalizedText;
  description: PetLocalizedText;
  author: string;
  license: string;
  minAppVersion: string;
  previewUrl: string;
  previewDataUrl?: string | null;
  downloadUrl: string;
  sha256: string;
  sizeBytes: number;
}

export interface PetCatalogResponse {
  items: PetCatalogEntry[];
  source: "remote" | "cache" | "bundled" | string;
  warning?: string | null;
}

export interface InstalledPet {
  manifest: PetManifest;
  baseDir: string;
  source: "cli-manager" | "codex";
  format: "clipet" | "codex";
  removable: boolean;
}

export interface BackgroundPetTask {
  sessionId: string;
  cwd?: string | null;
  alive: boolean;
  taskStatus?: TabNotificationState | null;
  taskUpdatedAtMs?: number | null;
  createdAtMs: number;
}

export interface DesktopPetSnapshot {
  mood: DesktopPetMood;
  sessionId: string | null;
  daemonOnly: boolean;
  sessionTitle: string | null;
  projectName: string | null;
  runningCount: number;
  attentionCount: number;
  updatedAt: number;
}

export interface DesktopPetConfigPayload {
  language: "zh-CN" | "en-US";
  settings: DesktopPetSettings;
  labels: {
    openMain: string;
    openSettings: string;
    hide: string;
    idle: string;
    working: string;
    waiting: string;
    success: string;
    error: string;
    sleeping: string;
    runningCount: string;
  };
}

export interface DesktopPetPositionPayload {
  x: number;
  y: number;
}

export interface DesktopPetOpenTargetPayload {
  sessionId: string | null;
  daemonOnly: boolean;
}

const STATUS_PRIORITY: Record<TabNotificationState, number> = {
  none: 0,
  done: 1,
  running: 2,
  failed: 3,
  attention: 4,
};

function moodFromStatus(status: TabNotificationState): DesktopPetMood {
  if (status === "running") return "working";
  if (status === "attention") return "waiting";
  if (status === "done") return "success";
  if (status === "failed") return "error";
  return "idle";
}

function timestampFromDetails(details: TabStatusDetails | undefined): number {
  if (!details?.updatedAt) return 0;
  const parsed = Date.parse(details.updatedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daemonTaskStatus(task: BackgroundPetTask): TabNotificationState {
  if (
    task.taskStatus === "running" ||
    task.taskStatus === "attention" ||
    task.taskStatus === "done" ||
    task.taskStatus === "failed"
  ) {
    return task.taskStatus;
  }
  return task.alive ? "running" : "done";
}

interface DeriveDesktopPetSnapshotInput {
  sessions: TerminalSession[];
  persistedSessions: TerminalSession[];
  activeSessionId: string | null;
  tabNotifications: Record<string, TabNotificationState>;
  tabStatusDetails: Record<string, TabStatusDetails>;
  projects: Project[];
  backgroundTasks: BackgroundPetTask[];
}

export function deriveDesktopPetSnapshot(input: DeriveDesktopPetSnapshotInput): DesktopPetSnapshot {
  const openPtySessions = input.sessions.filter((session) => !session.kind || session.kind === "pty");
  const openIds = new Set(openPtySessions.map((session) => session.id));
  const projectById = new Map(input.projects.map((project) => [project.id, project]));
  const persistedById = new Map(input.persistedSessions.map((session) => [session.id, session]));
  const candidates = openPtySessions.map((session) => {
    const status = input.tabNotifications[session.id] ?? "none";
    const project = session.projectId ? projectById.get(session.projectId) : undefined;
    return {
      sessionId: session.id,
      daemonOnly: false,
      status,
      updatedAt: timestampFromDetails(input.tabStatusDetails[session.id]),
      sessionTitle: session.title || null,
      projectName: project?.name ?? null,
      active: session.id === input.activeSessionId,
    };
  });
  for (const task of input.backgroundTasks) {
    if (openIds.has(task.sessionId)) continue;
    const persisted = persistedById.get(task.sessionId);
    const project = persisted?.projectId ? projectById.get(persisted.projectId) : undefined;
    candidates.push({
      sessionId: task.sessionId,
      daemonOnly: true,
      status: daemonTaskStatus(task),
      updatedAt: task.taskUpdatedAtMs ?? task.createdAtMs,
      sessionTitle: persisted?.title || task.cwd || null,
      projectName: project?.name ?? null,
      active: false,
    });
  }

  if (candidates.length === 0) {
    return {
      mood: "sleeping",
      sessionId: null,
      daemonOnly: false,
      sessionTitle: null,
      projectName: null,
      runningCount: 0,
      attentionCount: 0,
      updatedAt: Date.now(),
    };
  }

  candidates.sort((left, right) => {
    const priority = STATUS_PRIORITY[right.status] - STATUS_PRIORITY[left.status];
    if (priority !== 0) return priority;
    if (left.active !== right.active) return left.active ? -1 : 1;
    return right.updatedAt - left.updatedAt;
  });
  const selected = candidates[0];
  return {
    mood: moodFromStatus(selected.status),
    sessionId: selected.sessionId,
    daemonOnly: selected.daemonOnly,
    sessionTitle: selected.sessionTitle,
    projectName: selected.projectName,
    runningCount: candidates.filter((candidate) => candidate.status === "running").length,
    attentionCount: candidates.filter((candidate) => candidate.status === "attention").length,
    updatedAt: selected.updatedAt || Date.now(),
  };
}

export function desktopPetScale(size: DesktopPetSettings["size"]): number {
  if (size === "small") return 0.8;
  if (size === "large") return 1.25;
  return 1;
}

export function localizedPetText(text: PetLocalizedText, language: LanguagePreference): string {
  return language === "en-US" ? text["en-US"] : text["zh-CN"];
}

export function joinPetAssetPath(baseDir: string, relativePath: string): string {
  const separator = baseDir.includes("\\") ? "\\" : "/";
  return `${baseDir.replace(/[\\/]$/, "")}${separator}${relativePath.replace(/^[\\/]/, "")}`;
}
