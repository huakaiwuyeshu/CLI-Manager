import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { LogicalSize, PhysicalPosition, type PhysicalSize } from "@tauri-apps/api/dpi";
import { emit, emitTo, listen } from "@tauri-apps/api/event";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import {
  AppWindow,
  EyeOff,
  LockKeyhole,
  MonitorUp,
  PauseCircle,
  RadioTower,
  Settings,
} from "lucide-react";
import { CliCat } from "../components/desktop-pet/CliCat";
import { PetArtwork } from "../components/desktop-pet/PetArtwork";
import {
  DESKTOP_PET_CONFIG_EVENT,
  DESKTOP_PET_CLOSE_MENU_EVENT,
  DESKTOP_PET_HANDOFF_CANCEL_EVENT,
  DESKTOP_PET_HANDOFF_START_EVENT,
  DESKTOP_PET_OPEN_SETTINGS_EVENT,
  DESKTOP_PET_OPEN_TARGET_EVENT,
  DESKTOP_PET_POSITION_EVENT,
  DESKTOP_PET_READY_EVENT,
  DESKTOP_PET_SNAPSHOT_EVENT,
  calculateDesktopPetMenuWindowGeometry,
  desktopPetScale,
  type DesktopPetConfigPayload,
  type DesktopPetMenuWindowGeometry,
  type DesktopPetMood,
  type DesktopPetSnapshot,
  type DesktopPetTarget,
  type InstalledPet,
} from "../lib/desktopPet";
import { translate } from "../lib/i18n";
import { logWarn } from "../lib/logger";
import { BUILTIN_DESKTOP_PET_ID } from "../stores/settingsStore";
import "./desktopPet.css";

const DEFAULT_CONFIG: DesktopPetConfigPayload = {
  language: "zh-CN",
  settings: {
    enabled: true,
    petId: BUILTIN_DESKTOP_PET_ID,
    alwaysOnTop: true,
    size: "medium",
    workingBounceEnabled: false,
    workingBounceDistancePx: 5,
    showStatus: true,
    showSessionName: false,
    autoHideFullscreen: true,
    lockPosition: false,
    position: null,
  },
  labels: {
    openMain: translate("zh-CN", "desktopPet.actions.openMain"),
    openSettings: translate("zh-CN", "desktopPet.actions.openSettings"),
    hide: translate("zh-CN", "desktopPet.actions.hide"),
    idle: translate("zh-CN", "desktopPet.mood.idle"),
    working: translate("zh-CN", "desktopPet.mood.working"),
    waiting: translate("zh-CN", "desktopPet.mood.waiting"),
    success: translate("zh-CN", "desktopPet.mood.success"),
    error: translate("zh-CN", "desktopPet.mood.error"),
    sleeping: translate("zh-CN", "desktopPet.mood.sleeping"),
    runningCount: translate("zh-CN", "desktopPet.mood.runningCount"),
    taskList: translate("zh-CN", "desktopPet.actions.taskList"),
    currentTask: translate("zh-CN", "desktopPet.actions.currentTask"),
    unnamedTask: translate("zh-CN", "desktopPet.actions.unnamedTask"),
    openCurrent: translate("zh-CN", "desktopPet.actions.openCurrent"),
    remoteHandoff: translate("zh-CN", "desktopPet.actions.remoteHandoff"),
    cancelHandoff: translate("zh-CN", "desktopPet.actions.cancelHandoff"),
    handoffSessions: translate("zh-CN", "desktopPet.actions.handoffSessions"),
    handoffPending: translate("zh-CN", "remoteHandoff.overlay.pending"),
    handoffCancelling: translate("zh-CN", "remoteHandoff.overlay.cancelling"),
    handedOff: translate("zh-CN", "desktopPet.actions.handedOff"),
    handoffRecoveryFailed: translate("zh-CN", "desktopPet.actions.handoffRecoveryFailed"),
    noHandoffSessions: translate("zh-CN", "desktopPet.actions.noHandoffSessions"),
  },
};

const DEFAULT_SNAPSHOT: DesktopPetSnapshot = {
  mood: "sleeping",
  sessionId: null,
  daemonOnly: false,
  sessionTitle: null,
  projectName: null,
  runningCount: 0,
  attentionCount: 0,
  updatedAt: Date.now(),
  targets: [],
  handoff: null,
  handoffBusy: false,
};

function moodLabel(config: DesktopPetConfigPayload, mood: DesktopPetMood): string {
  return config.labels[mood];
}

function localPetName(pet: InstalledPet, language: DesktopPetConfigPayload["language"]): string {
  return language === "en-US" ? pet.manifest.name["en-US"] : pet.manifest.name["zh-CN"];
}

function targetStatusLabel(config: DesktopPetConfigPayload, target: DesktopPetTarget): string {
  if (target.handoffPhase === "pending") return config.labels.handoffPending;
  if (target.handoffPhase === "cancelling") return config.labels.handoffCancelling;
  if (target.handoffPhase === "recovery_failed") {
    return config.labels.handoffRecoveryFailed;
  }
  if (target.handedOff) return config.labels.handedOff;
  const mood: DesktopPetMood =
    target.status === "running"
      ? "working"
      : target.status === "attention"
        ? "waiting"
        : target.status === "done"
          ? "success"
          : target.status === "failed"
            ? "error"
            : "idle";
  return moodLabel(config, mood);
}

interface CollapsedPetWindowGeometry {
  position: PhysicalPosition;
  size: PhysicalSize;
  scaleFactor: number;
}

function targetFanStyle(index: number, count: number): CSSProperties {
  const visibleCount = Math.min(Math.max(count, 1), 5);
  const slot = Math.min(index, visibleCount - 1);
  const center = (visibleCount - 1) / 2;
  const normalized = center <= 0 ? 0 : (slot - center) / center;
  return {
    "--fan-angle": `${normalized * 2.4}deg`,
    "--fan-shift": `${(1 - Math.abs(normalized)) * 18}px`,
    "--fan-delay": `${Math.min(index, 8) * 28}ms`,
    zIndex: count - index,
  } as CSSProperties;
}

export default function DesktopPetApp() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [snapshot, setSnapshot] = useState(DEFAULT_SNAPSHOT);
  const [displayMood, setDisplayMood] = useState<DesktopPetMood>(DEFAULT_SNAPSHOT.mood);
  const [installedPet, setInstalledPet] = useState<InstalledPet | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<"open" | "handoff">("open");
  const [menuGeometry, setMenuGeometry] = useState<DesktopPetMenuWindowGeometry | null>(null);
  const menuTargets = targetMode === "handoff"
    ? snapshot.targets.filter((target) => target.handoffEligible)
    : snapshot.targets;
  const moveTimerRef = useRef<number | null>(null);
  const dragResetTimerRef = useRef<number | null>(null);
  const userDraggingRef = useRef(false);
  const collapsedWindowGeometryRef = useRef<CollapsedPetWindowGeometry | null>(null);
  const menuWindowTaskRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const rootElements = [document.documentElement, document.body, document.getElementById("root")];
    rootElements.forEach((element) => {
      if (element) element.style.background = "transparent";
    });
    document.documentElement.dataset.window = "desktop-pet";
    let disposed = false;
    const unlistenConfig = listen<DesktopPetConfigPayload>(DESKTOP_PET_CONFIG_EVENT, (event) => {
      if (!disposed) setConfig(event.payload);
    });
    const unlistenSnapshot = listen<DesktopPetSnapshot>(DESKTOP_PET_SNAPSHOT_EVENT, (event) => {
      if (!disposed) setSnapshot(event.payload);
    });
    const unlistenCloseMenu = listen(DESKTOP_PET_CLOSE_MENU_EVENT, () => {
      if (!disposed) {
        setMenuOpen(false);
        setTargetMode("open");
      }
    });
    const appWindow = getCurrentWindow();
    const unlistenMoved = appWindow.onMoved(({ payload }) => {
      if (!userDraggingRef.current) return;
      if (moveTimerRef.current !== null) window.clearTimeout(moveTimerRef.current);
      moveTimerRef.current = window.setTimeout(() => {
        userDraggingRef.current = false;
        moveTimerRef.current = null;
        if (dragResetTimerRef.current !== null) {
          window.clearTimeout(dragResetTimerRef.current);
          dragResetTimerRef.current = null;
        }
        void emitTo("main", DESKTOP_PET_POSITION_EVENT, { x: payload.x, y: payload.y });
      }, 400);
    });
    void emit(DESKTOP_PET_READY_EVENT);
    return () => {
      disposed = true;
      if (moveTimerRef.current !== null) window.clearTimeout(moveTimerRef.current);
      if (dragResetTimerRef.current !== null) window.clearTimeout(dragResetTimerRef.current);
      void unlistenConfig.then((unlisten) => unlisten());
      void unlistenSnapshot.then((unlisten) => unlisten());
      void unlistenCloseMenu.then((unlisten) => unlisten());
      void unlistenMoved.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    menuWindowTaskRef.current = menuWindowTaskRef.current
      .catch(() => {})
      .then(async () => {
        if (menuOpen) {
          let collapsed = collapsedWindowGeometryRef.current;
          if (!collapsed) {
            const [position, size, scaleFactor] = await Promise.all([
              appWindow.outerPosition(),
              appWindow.outerSize(),
              appWindow.scaleFactor(),
            ]);
            collapsed = { position, size, scaleFactor };
            collapsedWindowGeometryRef.current = collapsed;
          }
          const monitor = await currentMonitor().catch(() => null);
          const geometry = calculateDesktopPetMenuWindowGeometry(
            {
              x: collapsed.position.x,
              y: collapsed.position.y,
              width: collapsed.size.width,
              height: collapsed.size.height,
            },
            collapsed.scaleFactor,
            menuTargets.length,
            monitor
              ? {
                  x: monitor.workArea.position.x,
                  y: monitor.workArea.position.y,
                  width: monitor.workArea.size.width,
                  height: monitor.workArea.size.height,
                }
              : null
          );
          setMenuGeometry(geometry);
          try {
            await appWindow.setSize(new LogicalSize(geometry.logicalWidth, geometry.logicalHeight));
            await appWindow.setPosition(new PhysicalPosition(geometry.x, geometry.y));
          } catch (err) {
            await Promise.allSettled([
              appWindow.setSize(collapsed.size),
              appWindow.setPosition(collapsed.position),
            ]);
            collapsedWindowGeometryRef.current = null;
            setMenuGeometry(null);
            setMenuOpen(false);
            setTargetMode("open");
            throw err;
          }
          return;
        }

        setMenuGeometry(null);
        const collapsed = collapsedWindowGeometryRef.current;
        if (!collapsed) return;
        try {
          await appWindow.setSize(collapsed.size);
          await appWindow.setPosition(collapsed.position);
        } finally {
          collapsedWindowGeometryRef.current = null;
        }
      });
    void menuWindowTaskRef.current.catch((err) => {
      logWarn("Failed to resize desktop pet menu window", err);
    });
  }, [menuOpen, menuTargets.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setTargetMode("open");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!config.settings.enabled) {
      setMenuOpen(false);
      setTargetMode("open");
    }
  }, [config.settings.enabled]);

  useEffect(() => {
    if (
      targetMode === "handoff"
      && !snapshot.targets.some((target) => target.handoffEligible)
    ) {
      setTargetMode("open");
    }
  }, [snapshot.targets, targetMode]);

  useEffect(() => {
    if (snapshot.mood !== "success") {
      setDisplayMood(snapshot.mood);
      return;
    }
    const remaining = 3500 - Math.max(0, Date.now() - snapshot.updatedAt);
    if (remaining <= 0) {
      setDisplayMood("idle");
      return;
    }
    setDisplayMood("success");
    const timer = window.setTimeout(() => setDisplayMood("idle"), remaining);
    return () => window.clearTimeout(timer);
  }, [snapshot.mood, snapshot.updatedAt]);

  useEffect(() => {
    if (config.settings.petId === BUILTIN_DESKTOP_PET_ID) {
      setInstalledPet(null);
      return;
    }
    let cancelled = false;
    void invoke<InstalledPet | null>("desktop_pet_get_installed", { petId: config.settings.petId })
      .then((pet) => {
        if (!cancelled) setInstalledPet(pet);
      })
      .catch(() => {
        if (!cancelled) setInstalledPet(null);
      });
    return () => {
      cancelled = true;
    };
  }, [config.settings.petId]);

  const detail = config.settings.showSessionName
    ? [snapshot.projectName, snapshot.sessionTitle].filter(Boolean).join(" · ")
    : "";
  const runningDetail = snapshot.runningCount > 1
    ? `${snapshot.runningCount} ${config.labels.runningCount}`
    : "";
  const petScale = desktopPetScale(config.settings.size);
  const stageSize = Math.round(144 * petScale);
  const rootStyle = {
    "--pet-stage-size": `${stageSize}px`,
    "--pet-cat-width": `${Math.round(132 * petScale)}px`,
    "--pet-cat-height": `${Math.round(96 * petScale)}px`,
    "--pet-work-bounce-offset": `${-config.settings.workingBounceDistancePx}px`,
    ...(menuGeometry
      ? {
          "--pet-anchor-width": `${menuGeometry.anchorWidth}px`,
          "--pet-anchor-height": `${menuGeometry.anchorHeight}px`,
          "--pet-menu-panel-width": `${menuGeometry.panelWidth}px`,
          "--pet-target-list-height": `${menuGeometry.targetListHeight}px`,
        }
      : {}),
  } as CSSProperties;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || config.settings.lockPosition || menuOpen) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    userDraggingRef.current = true;
    if (dragResetTimerRef.current !== null) window.clearTimeout(dragResetTimerRef.current);
    dragResetTimerRef.current = window.setTimeout(() => {
      userDraggingRef.current = false;
      dragResetTimerRef.current = null;
    }, 5000);
    void getCurrentWindow().startDragging().catch(() => {
      userDraggingRef.current = false;
      if (dragResetTimerRef.current !== null) {
        window.clearTimeout(dragResetTimerRef.current);
        dragResetTimerRef.current = null;
      }
    });
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setTargetMode("open");
  };

  const openTarget = (target?: DesktopPetTarget) => {
    closeMenu();
    void emitTo("main", DESKTOP_PET_OPEN_TARGET_EVENT, {
      sessionId: target?.sessionId ?? snapshot.sessionId,
      daemonOnly: target?.daemonOnly ?? snapshot.daemonOnly,
    }).catch((err) => logWarn("Failed to request desktop pet target activation", err));
  };

  const requestHandoff = (target: DesktopPetTarget) => {
    closeMenu();
    void emitTo("main", DESKTOP_PET_HANDOFF_START_EVENT, {
      sessionId: target.sessionId,
    }).catch((err) => logWarn("Failed to request remote handoff", err));
  };

  const cancelHandoff = () => {
    closeMenu();
    void emitTo("main", DESKTOP_PET_HANDOFF_CANCEL_EVENT).catch((err) => {
      logWarn("Failed to request remote handoff cancellation", err);
    });
  };

  const openMainWindow = () => {
    closeMenu();
    void invoke("app_show_main_window").catch((err) => {
      logWarn("Failed to open CLI-Manager from desktop pet", err);
    });
  };

  return (
    <main
      className="desktop-pet-root"
      data-mood={displayMood}
      data-work-bounce={
        config.settings.workingBounceEnabled && config.settings.workingBounceDistancePx > 0
          ? "true"
          : undefined
      }
      data-menu-open={menuGeometry ? "true" : undefined}
      style={rootStyle}
      onPointerDown={handlePointerDown}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        openTarget();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (menuOpen) {
          closeMenu();
        } else {
          setTargetMode("open");
          setMenuOpen(true);
        }
      }}
      aria-label={moodLabel(config, displayMood)}
    >
      <div className="desktop-pet-anchor">
        {config.settings.showStatus ? (
          <section className="desktop-pet-status" aria-live="polite">
            <strong>{moodLabel(config, displayMood)}</strong>
            {detail ? <span title={detail}>{detail}</span> : null}
            {runningDetail ? <small>{runningDetail}</small> : null}
          </section>
        ) : null}

        <div className="desktop-pet-stage" title={moodLabel(config, displayMood)}>
          {installedPet ? (
            <PetArtwork
              pet={installedPet}
              mood={displayMood}
              width={stageSize}
              height={stageSize}
              alt={localPetName(installedPet, config.language)}
              onError={() => setInstalledPet(null)}
            />
          ) : (
            <CliCat className="desktop-pet-cat" ariaLabel={moodLabel(config, displayMood)} />
          )}
          {snapshot.attentionCount > 0 ? (
            <span className="desktop-pet-badge" aria-label={moodLabel(config, "waiting")}>!</span>
          ) : null}
        </div>
      </div>

      {menuOpen && menuGeometry ? (
        <div
          className="desktop-pet-menu"
          data-has-targets={menuTargets.length > 0 || undefined}
          role="menu"
          aria-label={
            targetMode === "handoff"
              ? config.labels.handoffSessions
              : config.labels.taskList
          }
        >
          {menuTargets.length > 0 ? <div className="desktop-pet-target-list">
            {menuTargets.map((target, index) => {
              const primary =
                target.projectName ||
                target.sessionTitle ||
                `${config.labels.unnamedTask} ${index + 1}`;
              const secondary = target.projectName && target.sessionTitle ? target.sessionTitle : null;
              const status = targetStatusLabel(config, target);
              return (
                <button
                  key={target.sessionId}
                  type="button"
                  role="menuitem"
                  className="desktop-pet-target"
                  data-status={target.status}
                  data-active={target.active || undefined}
                  data-handed-off={target.handedOff || undefined}
                  data-recovery-failed={
                    target.handoffPhase === "recovery_failed" || undefined
                  }
                  aria-current={target.active ? "true" : undefined}
                  style={targetFanStyle(index, menuTargets.length)}
                  onClick={() => (
                    targetMode === "handoff" ? requestHandoff(target) : openTarget(target)
                  )}
                  title={[target.projectName, target.sessionTitle, status].filter(Boolean).join(" · ")}
                >
                  {target.handoffPhase ? (
                    <LockKeyhole className="desktop-pet-target-lock" size={14} aria-hidden="true" />
                  ) : (
                    <span className="desktop-pet-target-indicator" aria-hidden="true" />
                  )}
                  <span className="desktop-pet-target-copy">
                    <strong>{primary}</strong>
                    <small>
                      {secondary ? `${secondary} · ` : ""}
                      {status}
                    </small>
                  </span>
                  {target.active ? (
                    <span className="desktop-pet-target-current">{config.labels.currentTask}</span>
                  ) : null}
                </button>
              );
            })}
          </div> : null}
          <div className="desktop-pet-menu-actions">
            <button
              type="button"
              role="menuitem"
              disabled={!snapshot.sessionId}
              onClick={() => openTarget()}
            >
              <MonitorUp size={14} aria-hidden="true" />
              <span>{config.labels.openCurrent}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              data-active={targetMode === "handoff" || undefined}
              disabled={
                snapshot.handoffBusy
                || Boolean(snapshot.handoff)
                || !snapshot.targets.some((target) => target.handoffEligible)
              }
              onClick={() => setTargetMode((mode) => mode === "handoff" ? "open" : "handoff")}
            >
              <RadioTower size={14} aria-hidden="true" />
              <span>{config.labels.remoteHandoff}</span>
            </button>
            {snapshot.handoff ? (
              <button
                type="button"
                role="menuitem"
                className="desktop-pet-menu-danger"
                disabled={snapshot.handoffBusy}
                onClick={cancelHandoff}
              >
                <PauseCircle size={14} aria-hidden="true" />
                <span>{config.labels.cancelHandoff}</span>
              </button>
            ) : null}
            <button type="button" role="menuitem" onClick={openMainWindow}>
              <AppWindow size={14} aria-hidden="true" />
              <span>{config.labels.openMain}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                void emitTo("main", DESKTOP_PET_OPEN_SETTINGS_EVENT).catch((err) => {
                  logWarn("Failed to request desktop pet settings", err);
                });
              }}
            >
              <Settings size={14} aria-hidden="true" />
              <span>{config.labels.openSettings}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                void invoke("desktop_pet_window_hide").catch((err) => {
                  logWarn("Failed to hide desktop pet window", err);
                });
              }}
            >
              <EyeOff size={14} aria-hidden="true" />
              <span>{config.labels.hide}</span>
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
