import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CliCat } from "../components/desktop-pet/CliCat";
import { PetArtwork } from "../components/desktop-pet/PetArtwork";
import {
  DESKTOP_PET_CONFIG_EVENT,
  DESKTOP_PET_OPEN_SETTINGS_EVENT,
  DESKTOP_PET_OPEN_TARGET_EVENT,
  DESKTOP_PET_POSITION_EVENT,
  DESKTOP_PET_READY_EVENT,
  DESKTOP_PET_SNAPSHOT_EVENT,
  type DesktopPetConfigPayload,
  type DesktopPetMood,
  type DesktopPetSnapshot,
  type InstalledPet,
} from "../lib/desktopPet";
import { translate } from "../lib/i18n";
import { BUILTIN_DESKTOP_PET_ID } from "../stores/settingsStore";
import "./desktopPet.css";

const DEFAULT_CONFIG: DesktopPetConfigPayload = {
  language: "zh-CN",
  settings: {
    enabled: true,
    petId: BUILTIN_DESKTOP_PET_ID,
    alwaysOnTop: true,
    size: "medium",
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
};

function moodLabel(config: DesktopPetConfigPayload, mood: DesktopPetMood): string {
  return config.labels[mood];
}

function localPetName(pet: InstalledPet, language: DesktopPetConfigPayload["language"]): string {
  return language === "en-US" ? pet.manifest.name["en-US"] : pet.manifest.name["zh-CN"];
}

export default function DesktopPetApp() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [snapshot, setSnapshot] = useState(DEFAULT_SNAPSHOT);
  const [displayMood, setDisplayMood] = useState<DesktopPetMood>(DEFAULT_SNAPSHOT.mood);
  const [installedPet, setInstalledPet] = useState<InstalledPet | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const moveTimerRef = useRef<number | null>(null);
  const dragResetTimerRef = useRef<number | null>(null);
  const userDraggingRef = useRef(false);

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
      void unlistenMoved.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (snapshot.mood !== "success") {
      setDisplayMood(snapshot.mood);
      return;
    }
    setDisplayMood("success");
    const timer = window.setTimeout(() => setDisplayMood("idle"), 3500);
    return () => window.clearTimeout(timer);
  }, [snapshot]);

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

  const openTarget = () => {
    void emitTo("main", DESKTOP_PET_OPEN_TARGET_EVENT, {
      sessionId: snapshot.sessionId,
      daemonOnly: snapshot.daemonOnly,
    });
  };

  return (
    <main
      className="desktop-pet-root"
      data-mood={displayMood}
      onPointerDown={handlePointerDown}
      onDoubleClick={openTarget}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen((open) => !open);
      }}
      aria-label={moodLabel(config, displayMood)}
    >
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
            width={132}
            height={132}
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

      {menuOpen ? (
        <div className="desktop-pet-menu" role="menu">
          <button type="button" role="menuitem" onClick={openTarget}>{config.labels.openMain}</button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void emitTo("main", DESKTOP_PET_OPEN_SETTINGS_EVENT)}
          >
            {config.labels.openSettings}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              void invoke("desktop_pet_window_hide");
            }}
          >
            {config.labels.hide}
          </button>
        </div>
      ) : null}
    </main>
  );
}
