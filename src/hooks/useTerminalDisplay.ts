import { useRef, type RefObject } from "react";
import type { ITheme, Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { refreshTerminalViewport } from "../lib/terminalVisibility";
import { isLightTerminalTheme } from "../lib/terminalThemes";
import { debugConsoleWarn } from "../lib/debugConsole";
import { logInfo, logWarn } from "../lib/logger";
import { markTerminalSnapshotDirty } from "../lib/sessionSnapshotPersistence";
import {
  clampTerminalGridSize,
  LatestTerminalGridResizeScheduler,
  TerminalFitTaskScheduler,
  type TerminalGridSize,
} from "../lib/terminalResizeCoordinator";
import { useSettingsStore } from "../stores/settingsStore";

const HIDDEN_WEBGL_DISPOSE_DELAY_MS = 10_000;
const TUI_GRID_RESIZE_INTERVAL_MS = 34;
const TUI_RESIZE_URGENT_OUTPUT_WINDOW_MS = 120;
const TUI_ATOMIC_WRITE_BUDGET = 256 * 1024;
const TUI_RESIZE_SNAPSHOT_SAFETY_MS = 240;
const ACTIVE_WRITE_FRAME_BUDGET = 64 * 1024;
const ACTIVE_WRITE_QUEUE_MAX_CHARS = 16 * 1024 * 1024;
const ACTIVE_WRITE_QUEUE_LOG_INTERVAL_MS = 2000;
const INACTIVE_BUFFER_MIN_CHARS = 256 * 1024;
const INACTIVE_BUFFER_MAX_CHARS = 8 * 1024 * 1024;
const INACTIVE_BUFFER_CHARS_PER_SCROLLBACK_ROW = 256;

type NormalizeTerminalOutput = (text: string) => string;
type TransformTerminalOutput = (text: string) => string;
type AfterTerminalWrite = (terminal: Terminal) => void;

interface ActiveWriteQueueItem {
  text: string;
  inactiveReplay: boolean;
}

interface TuiResizeSnapshotState {
  terminal: Terminal;
  screen: HTMLElement;
  previousVisibility: string;
  overlay: HTMLElement;
}

const getInactiveBufferLimit = (scrollbackRows: number) => Math.min(
  INACTIVE_BUFFER_MAX_CHARS,
  Math.max(INACTIVE_BUFFER_MIN_CHARS, scrollbackRows * INACTIVE_BUFFER_CHARS_PER_SCROLLBACK_ROW)
);

interface UseTerminalDisplayOptions {
  sessionId: string;
  containerRef: RefObject<HTMLDivElement | null>;
  terminalRef: RefObject<Terminal | null>;
  fitAddonRef: RefObject<FitAddon | null>;
  minimumGridRef: RefObject<TerminalGridSize>;
  isVisibleRef: RefObject<boolean>;
  isComposingRef: RefObject<boolean>;
  lowMemoryMode: boolean;
  terminalScrollbackRows: number;
  preferDomRenderer: boolean;
  shouldCoordinateTuiResize: (terminal: Terminal) => boolean;
  disableHardwareAcceleration: boolean;
  linuxGraphicsDisableWebgl: boolean;
  isTransparentRef: RefObject<boolean>;
  normalizeOutputRef: RefObject<NormalizeTerminalOutput>;
  transformOutputRef: RefObject<TransformTerminalOutput>;
  afterTerminalWriteRef: RefObject<AfterTerminalWrite | null>;
  onInactiveReplayPendingChange: (pending: boolean) => void;
  onPtyOutputListenError: (err: unknown) => void;
  onViewportRefreshNeeded?: () => void;
}

export interface UseTerminalDisplayResult {
  syncWebglRenderer: (terminal: Terminal, theme: ITheme) => boolean;
  scheduleHiddenWebglDispose: (enabled: boolean) => void;
  clearHiddenWebglDisposeTimer: () => void;
  clearWebglTextureAtlas: () => void;
  disposeWebglRenderer: () => boolean;
  scheduleFit: (force?: boolean) => void;
  scheduleViewportRefresh: () => void;
  markViewportRefreshNeeded: () => void;
  enqueueActiveWrite: (text: string, inactiveReplay?: boolean) => void;
  getOutputRestorePlanState: () => {
    inactiveBufferLength: number;
    activeWriteQueueLength: number;
    activeWriteRafScheduled: boolean;
  };
  flushInactiveBufferForReplay: () => void;
  resumeActiveWriteQueue: () => void;
  getPendingOutputSnapshot: () => string;
  attachPtyOutput: () => () => void;
  resetOutputState: () => void;
  cancelScheduledFit: () => void;
  resumeDeferredFitAfterWrite: () => void;
  resetViewportRefreshState: () => void;
}

export function useTerminalDisplay({
  sessionId,
  containerRef,
  terminalRef,
  fitAddonRef,
  minimumGridRef,
  isVisibleRef,
  isComposingRef,
  lowMemoryMode,
  terminalScrollbackRows,
  preferDomRenderer,
  shouldCoordinateTuiResize,
  disableHardwareAcceleration,
  linuxGraphicsDisableWebgl,
  isTransparentRef,
  normalizeOutputRef,
  transformOutputRef,
  afterTerminalWriteRef,
  onInactiveReplayPendingChange,
  onPtyOutputListenError,
  onViewportRefreshNeeded,
}: UseTerminalDisplayOptions): UseTerminalDisplayResult {
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const webglDisposeTimerRef = useRef<number | null>(null);
  const webglContextLostRef = useRef(false);
  const fitRunnerRef = useRef<(force: boolean) => void>(() => {});
  const fitSchedulerRef = useRef<TerminalFitTaskScheduler | null>(null);
  const fitMicrotaskSequenceRef = useRef(0);
  const cancelledFitMicrotasksRef = useRef<Set<number>>(new Set());
  const tuiGridResizeSchedulerRef = useRef<LatestTerminalGridResizeScheduler | null>(null);
  const tuiResizeUrgentOutputUntilRef = useRef(0);
  const tuiResizeSnapshotRef = useRef<TuiResizeSnapshotState | null>(null);
  const tuiResizeSnapshotRevealRafRef = useRef<number | null>(null);
  const tuiResizeSnapshotSafetyTimerRef = useRef<number | null>(null);
  const lastFitContainerHeightRef = useRef<number | null>(null);
  const synchronizedOutputFitDeferredRef = useRef(false);
  const synchronizedOutputForcePendingRef = useRef(false);
  const needsViewportRefreshRef = useRef(false);
  const inactiveBufferLimitRef = useRef(getInactiveBufferLimit(terminalScrollbackRows));
  const inactiveBufferRef = useRef<string[]>([]);
  const inactiveBufferSizeRef = useRef(0);
  const activeWriteQueueRef = useRef<ActiveWriteQueueItem[]>([]);
  const activeWriteQueueSizeRef = useRef(0);
  const activeWriteQueueLastDropLogAtRef = useRef(0);
  const activeWriteRafRef = useRef<number | null>(null);
  const activeWritePendingCallbacksRef = useRef(0);
  const inactiveReplayStickToBottomRef = useRef(false);
  const inactiveReplayPendingWritesRef = useRef(0);
  const inactiveReplayPendingRef = useRef(false);
  const ptyPendingChunksRef = useRef<string[]>([]);
  const ptyWriteRafIdRef = useRef<number | null>(null);
  const ptyUnlistenRef = useRef<UnlistenFn | null>(null);

  inactiveBufferLimitRef.current = getInactiveBufferLimit(terminalScrollbackRows);

  const clearHiddenWebglDisposeTimer = () => {
    if (webglDisposeTimerRef.current === null) return;
    window.clearTimeout(webglDisposeTimerRef.current);
    webglDisposeTimerRef.current = null;
  };

  const disposeWebglRenderer = () => {
    if (!webglAddonRef.current) return false;
    webglAddonRef.current.dispose();
    webglAddonRef.current = null;
    return true;
  };

  const canUseWebglRenderer = (theme: ITheme) => (
    !preferDomRenderer
    && !disableHardwareAcceleration
    && !linuxGraphicsDisableWebgl
    && !webglContextLostRef.current
    && !isTransparentRef.current
    && !isLightTerminalTheme(theme)
  );

  const createWebglAddon = () => {
    const addon = new WebglAddon();
    addon.onContextLoss(() => {
      webglContextLostRef.current = true;
      addon.dispose();
      if (webglAddonRef.current === addon) {
        webglAddonRef.current = null;
      }
      logWarn("Terminal WebGL context lost; keeping the default renderer for this session", { sessionId });
    });
    return addon;
  };

  const syncWebglRenderer = (terminal: Terminal, theme: ITheme) => {
    if (!canUseWebglRenderer(theme)) {
      return disposeWebglRenderer();
    }
    if (lowMemoryMode && !isVisibleRef.current) return false;
    if (webglAddonRef.current) return false;
    try {
      const addon = createWebglAddon();
      terminal.loadAddon(addon);
      webglAddonRef.current = addon;
      return true;
    } catch {
      return false;
    }
  };

  const scheduleHiddenWebglDispose = (enabled: boolean) => {
    clearHiddenWebglDisposeTimer();
    if (!enabled || !webglAddonRef.current) return;
    webglDisposeTimerRef.current = window.setTimeout(() => {
      webglDisposeTimerRef.current = null;
      if (isVisibleRef.current) return;
      if (disposeWebglRenderer()) {
        needsViewportRefreshRef.current = true;
        onViewportRefreshNeeded?.();
      }
    }, HIDDEN_WEBGL_DISPOSE_DELAY_MS);
  };

  const clearWebglTextureAtlas = () => {
    webglAddonRef.current?.clearTextureAtlas();
  };

  const clearTuiResizeSnapshotRevealSchedule = () => {
    if (tuiResizeSnapshotRevealRafRef.current !== null) {
      cancelAnimationFrame(tuiResizeSnapshotRevealRafRef.current);
      tuiResizeSnapshotRevealRafRef.current = null;
    }
    if (tuiResizeSnapshotSafetyTimerRef.current !== null) {
      window.clearTimeout(tuiResizeSnapshotSafetyTimerRef.current);
      tuiResizeSnapshotSafetyTimerRef.current = null;
    }
  };

  const revealTuiResizeSnapshot = () => {
    clearTuiResizeSnapshotRevealSchedule();
    const snapshot = tuiResizeSnapshotRef.current;
    tuiResizeSnapshotRef.current = null;
    if (!snapshot) return;
    snapshot.screen.style.visibility = snapshot.previousVisibility;
    snapshot.overlay.remove();
  };

  const scheduleTuiResizeSnapshotReveal = () => {
    if (!tuiResizeSnapshotRef.current || tuiResizeSnapshotRevealRafRef.current !== null) return;
    // xterm schedules its renderer while parsing the synchronous redraw. Our
    // RAF is registered afterwards, so revealing here exposes the completed
    // frame instead of the intermediate local reflow.
    tuiResizeSnapshotRevealRafRef.current = requestAnimationFrame(() => {
      tuiResizeSnapshotRevealRafRef.current = null;
      revealTuiResizeSnapshot();
    });
  };

  const beginTuiResizeSnapshot = (terminal: Terminal) => {
    const existing = tuiResizeSnapshotRef.current;
    if (existing?.terminal === terminal) {
      if (tuiResizeSnapshotRevealRafRef.current !== null) {
        cancelAnimationFrame(tuiResizeSnapshotRevealRafRef.current);
        tuiResizeSnapshotRevealRafRef.current = null;
      }
      if (tuiResizeSnapshotSafetyTimerRef.current !== null) {
        window.clearTimeout(tuiResizeSnapshotSafetyTimerRef.current);
      }
      tuiResizeSnapshotSafetyTimerRef.current = window.setTimeout(
        revealTuiResizeSnapshot,
        TUI_RESIZE_SNAPSHOT_SAFETY_MS,
      );
      return;
    }
    if (existing) revealTuiResizeSnapshot();

    const root = terminal.element;
    const screen = root?.querySelector<HTMLElement>(".xterm-screen");
    if (!root || !screen) return;
    const rootRect = root.getBoundingClientRect();
    const screenRect = screen.getBoundingClientRect();
    const overlay = screen.cloneNode(true) as HTMLElement;
    overlay.classList.add("ui-terminal-resize-snapshot");
    overlay.setAttribute("aria-hidden", "true");
    Object.assign(overlay.style, {
      position: "absolute",
      left: `${screenRect.left - rootRect.left}px`,
      top: `${screenRect.top - rootRect.top}px`,
      width: `${screenRect.width}px`,
      height: `${screenRect.height}px`,
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "20",
    });
    const previousVisibility = screen.style.visibility;
    screen.style.visibility = "hidden";
    root.appendChild(overlay);
    tuiResizeSnapshotRef.current = { terminal, screen, previousVisibility, overlay };
    tuiResizeSnapshotSafetyTimerRef.current = window.setTimeout(
      revealTuiResizeSnapshot,
      TUI_RESIZE_SNAPSHOT_SAFETY_MS,
    );
  };

  const setInactiveReplayPendingVisible = (pending: boolean) => {
    if (inactiveReplayPendingRef.current === pending) return;
    inactiveReplayPendingRef.current = pending;
    onInactiveReplayPendingChange(pending);
  };

  const hasQueuedInactiveReplay = () => activeWriteQueueRef.current.some((item) => item.inactiveReplay);

  const finishInactiveReplayIfReady = (terminal: Terminal) => {
    if (!inactiveReplayStickToBottomRef.current) return;
    if (
      hasQueuedInactiveReplay()
      || inactiveReplayPendingWritesRef.current > 0
    ) {
      return;
    }
    inactiveReplayStickToBottomRef.current = false;
    terminal.scrollToBottom();
    setInactiveReplayPendingVisible(false);
  };

  const flushActiveWriteQueue = () => {
    activeWriteRafRef.current = null;
    if (!isVisibleRef.current || activeWriteQueueRef.current.length === 0) {
      if (!isVisibleRef.current && activeWriteQueueRef.current.length > 0 && useSettingsStore.getState().debugMode) {
        logInfo("[terminal-visibility] active write flush deferred while hidden", {
          sessionId,
          queuedChars: activeWriteQueueSizeRef.current,
          queuedChunks: activeWriteQueueRef.current.length,
        });
      }
      return;
    }
    const terminal = terminalRef.current;
    if (!terminal) return;

    const writeTerminalChunk = (chunk: string, inactiveReplay: boolean) => {
      activeWritePendingCallbacksRef.current += 1;
      if (inactiveReplay) inactiveReplayPendingWritesRef.current += 1;
      terminal.write(chunk, () => {
        activeWritePendingCallbacksRef.current = Math.max(0, activeWritePendingCallbacksRef.current - 1);
        if (inactiveReplay) {
          inactiveReplayPendingWritesRef.current = Math.max(0, inactiveReplayPendingWritesRef.current - 1);
        }
        if (terminalRef.current !== terminal) return;
        if (inactiveReplay) terminal.scrollToBottom();
        afterTerminalWriteRef.current?.(terminal);
        if (inactiveReplay) finishInactiveReplayIfReady(terminal);
        if (
          activeWritePendingCallbacksRef.current === 0
          && activeWriteQueueRef.current.length === 0
        ) {
          scheduleTuiResizeSnapshotReveal();
        }
      });
    };

    let budget = ACTIVE_WRITE_FRAME_BUDGET;
    while (budget > 0 && activeWriteQueueRef.current.length > 0) {
      const item = activeWriteQueueRef.current[0];
      const chunk = item.text;
      if (chunk.length <= budget) {
        writeTerminalChunk(chunk, item.inactiveReplay);
        activeWriteQueueRef.current.shift();
        activeWriteQueueSizeRef.current = Math.max(0, activeWriteQueueSizeRef.current - chunk.length);
        budget -= chunk.length;
        continue;
      }
      writeTerminalChunk(chunk.slice(0, budget), item.inactiveReplay);
      activeWriteQueueRef.current[0] = { ...item, text: chunk.slice(budget) };
      activeWriteQueueSizeRef.current = Math.max(0, activeWriteQueueSizeRef.current - budget);
      budget = 0;
    }

    if (activeWriteQueueRef.current.length > 0) {
      activeWriteRafRef.current = requestAnimationFrame(flushActiveWriteQueue);
    } else {
      finishInactiveReplayIfReady(terminal);
    }
  };

  const flushActiveWriteQueueSynchronously = () => {
    if (!isVisibleRef.current || activeWriteQueueRef.current.length === 0) return false;
    const terminal = terminalRef.current;
    const core = (
      terminal as typeof terminal & {
        _core?: {
          writeSync?: (data: string | Uint8Array, maxSubsequentCalls?: number) => void;
        };
      }
    )?._core;
    if (!terminal || !core?.writeSync) return false;

    if (activeWriteRafRef.current !== null) {
      cancelAnimationFrame(activeWriteRafRef.current);
      activeWriteRafRef.current = null;
    }

    let budget = TUI_ATOMIC_WRITE_BUDGET;
    while (budget > 0 && activeWriteQueueRef.current.length > 0) {
      const item = activeWriteQueueRef.current[0];
      const chunk = item.text.length <= budget ? item.text : item.text.slice(0, budget);
      if (item.inactiveReplay) inactiveReplayPendingWritesRef.current += 1;
      core.writeSync.call(core, chunk);
      activeWriteQueueSizeRef.current = Math.max(0, activeWriteQueueSizeRef.current - chunk.length);
      if (item.text.length <= budget) {
        activeWriteQueueRef.current.shift();
      } else {
        activeWriteQueueRef.current[0] = { ...item, text: item.text.slice(budget) };
      }
      if (item.inactiveReplay) {
        inactiveReplayPendingWritesRef.current = Math.max(0, inactiveReplayPendingWritesRef.current - 1);
        terminal.scrollToBottom();
      }
      afterTerminalWriteRef.current?.(terminal);
      budget -= chunk.length;
    }

    if (activeWriteQueueRef.current.length > 0) {
      activeWriteRafRef.current = requestAnimationFrame(flushActiveWriteQueue);
    } else {
      finishInactiveReplayIfReady(terminal);
      if (activeWritePendingCallbacksRef.current === 0) {
        scheduleTuiResizeSnapshotReveal();
      }
    }
    return true;
  };

  const enqueueActiveWrite = (text: string, inactiveReplay = false, synchronous = false) => {
    if (!text) return;
    let nextText = transformOutputRef.current(text);
    let droppedChars = 0;
    if (nextText.length >= ACTIVE_WRITE_QUEUE_MAX_CHARS) {
      droppedChars += activeWriteQueueSizeRef.current + nextText.length - ACTIVE_WRITE_QUEUE_MAX_CHARS;
      nextText = nextText.slice(-ACTIVE_WRITE_QUEUE_MAX_CHARS);
      activeWriteQueueRef.current = [];
      activeWriteQueueSizeRef.current = 0;
    }
    activeWriteQueueRef.current.push({ text: nextText, inactiveReplay });
    activeWriteQueueSizeRef.current += nextText.length;
    while (activeWriteQueueSizeRef.current > ACTIVE_WRITE_QUEUE_MAX_CHARS && activeWriteQueueRef.current.length > 0) {
      const overflow = activeWriteQueueSizeRef.current - ACTIVE_WRITE_QUEUE_MAX_CHARS;
      const head = activeWriteQueueRef.current[0];
      if (!head || head.text.length <= overflow) {
        const removed = activeWriteQueueRef.current.shift();
        const removedLength = removed?.text.length ?? 0;
        activeWriteQueueSizeRef.current -= removedLength;
        droppedChars += removedLength;
        continue;
      }
      activeWriteQueueRef.current[0] = { ...head, text: head.text.slice(overflow) };
      activeWriteQueueSizeRef.current -= overflow;
      droppedChars += overflow;
    }
    if (droppedChars > 0) {
      const now = Date.now();
      if (now - activeWriteQueueLastDropLogAtRef.current >= ACTIVE_WRITE_QUEUE_LOG_INTERVAL_MS) {
        activeWriteQueueLastDropLogAtRef.current = now;
        debugConsoleWarn("[oom-diagnostics:webview]", {
          area: "xterm",
          phase: "activeWriteQueueTrim",
          sessionId,
          droppedChars,
          queuedChars: activeWriteQueueSizeRef.current,
          maxQueuedChars: ACTIVE_WRITE_QUEUE_MAX_CHARS,
          thresholdExceeded: true,
        });
      }
    }
    if (synchronous && flushActiveWriteQueueSynchronously()) return;
    if (activeWriteRafRef.current === null) {
      activeWriteRafRef.current = requestAnimationFrame(flushActiveWriteQueue);
    }
  };

  const stashInactiveText = (text: string) => {
    if (!text) return;
    const maxBufferChars = inactiveBufferLimitRef.current;
    if (text.length >= maxBufferChars) {
      const suffix = text.slice(-maxBufferChars);
      inactiveBufferRef.current = [suffix];
      inactiveBufferSizeRef.current = suffix.length;
      return;
    }

    inactiveBufferRef.current.push(text);
    inactiveBufferSizeRef.current += text.length;
    while (inactiveBufferSizeRef.current > maxBufferChars && inactiveBufferRef.current.length > 0) {
      const overflow = inactiveBufferSizeRef.current - maxBufferChars;
      const head = inactiveBufferRef.current[0];
      if (!head || head.length <= overflow) {
        const removed = inactiveBufferRef.current.shift();
        if (removed) inactiveBufferSizeRef.current -= removed.length;
        continue;
      }
      inactiveBufferRef.current[0] = head.slice(overflow);
      inactiveBufferSizeRef.current -= overflow;
    }
  };

  const getOutputRestorePlanState = () => ({
    inactiveBufferLength: inactiveBufferRef.current.length,
    activeWriteQueueLength: activeWriteQueueRef.current.length,
    activeWriteRafScheduled: activeWriteRafRef.current !== null,
  });

  const flushInactiveBufferForReplay = () => {
    const terminal = terminalRef.current;
    if (!terminal || inactiveBufferRef.current.length === 0) return;
    const combined = inactiveBufferRef.current.join("");
    inactiveBufferRef.current = [];
    inactiveBufferSizeRef.current = 0;
    inactiveReplayStickToBottomRef.current = true;
    inactiveReplayPendingWritesRef.current = 0;
    setInactiveReplayPendingVisible(true);
    terminal.scrollToBottom();
    enqueueActiveWrite(combined, true);
  };

  const resumeActiveWriteQueue = () => {
    if (activeWriteRafRef.current !== null) return;
    activeWriteRafRef.current = requestAnimationFrame(flushActiveWriteQueue);
  };

  const getPendingOutputSnapshot = () => [
    ...activeWriteQueueRef.current.map((item) => item.text),
    ...ptyPendingChunksRef.current,
    ...inactiveBufferRef.current,
  ].join("");

  const attachPtyOutput = () => {
    const textDecoder = new TextDecoder("utf-8");
    let cancelled = false;
    const flushPendingWrites = (synchronous = false) => {
      ptyWriteRafIdRef.current = null;
      if (cancelled || ptyPendingChunksRef.current.length === 0) return;
      const combined = ptyPendingChunksRef.current.length === 1 ? ptyPendingChunksRef.current[0] : ptyPendingChunksRef.current.join("");
      ptyPendingChunksRef.current = [];
      if (isVisibleRef.current) {
        enqueueActiveWrite(combined, false, synchronous);
      } else {
        stashInactiveText(combined);
      }
    };
    void listen<string>(`pty-output-${sessionId}`, (event) => {
      if (cancelled) return;
      const binaryString = atob(event.payload);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const text = normalizeOutputRef.current(textDecoder.decode(bytes, { stream: true }));
      if (!text) return;
      markTerminalSnapshotDirty(sessionId);
      if (isVisibleRef.current) {
        ptyPendingChunksRef.current.push(text);
        if (performance.now() <= tuiResizeUrgentOutputUntilRef.current) {
          if (ptyWriteRafIdRef.current !== null) {
            cancelAnimationFrame(ptyWriteRafIdRef.current);
            ptyWriteRafIdRef.current = null;
          }
          flushPendingWrites(true);
          return;
        }
        if (ptyWriteRafIdRef.current === null) {
          ptyWriteRafIdRef.current = requestAnimationFrame(() => flushPendingWrites());
        }
      } else {
        stashInactiveText(text);
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        ptyUnlistenRef.current = fn;
      }
    }).catch(onPtyOutputListenError);

    return () => {
      cancelled = true;
      if (ptyWriteRafIdRef.current !== null) {
        cancelAnimationFrame(ptyWriteRafIdRef.current);
        ptyWriteRafIdRef.current = null;
      }
      ptyPendingChunksRef.current = [];
      ptyUnlistenRef.current?.();
      ptyUnlistenRef.current = null;
    };
  };

  const resetOutputState = () => {
    if (activeWriteRafRef.current !== null) {
      cancelAnimationFrame(activeWriteRafRef.current);
      activeWriteRafRef.current = null;
    }
    if (ptyWriteRafIdRef.current !== null) {
      cancelAnimationFrame(ptyWriteRafIdRef.current);
      ptyWriteRafIdRef.current = null;
    }
    ptyPendingChunksRef.current = [];
    activeWriteQueueRef.current = [];
    activeWriteQueueSizeRef.current = 0;
    activeWritePendingCallbacksRef.current = 0;
    inactiveReplayStickToBottomRef.current = false;
    inactiveReplayPendingWritesRef.current = 0;
    inactiveReplayPendingRef.current = false;
    inactiveBufferRef.current = [];
    inactiveBufferSizeRef.current = 0;
    onInactiveReplayPendingChange(false);
  };

  const getTuiGridResizeScheduler = () => {
    if (!tuiGridResizeSchedulerRef.current) {
      tuiGridResizeSchedulerRef.current = new LatestTerminalGridResizeScheduler((size) => {
        const terminal = terminalRef.current;
        if (!terminal || (terminal.cols === size.cols && terminal.rows === size.rows)) return;
        if (shouldCoordinateTuiResize(terminal)) {
          tuiResizeUrgentOutputUntilRef.current = performance.now() + TUI_RESIZE_URGENT_OUTPUT_WINDOW_MS;
          if (size.cols < terminal.cols) beginTuiResizeSnapshot(terminal);
        }
        terminal.resize(size.cols, size.rows);
      });
    }
    return tuiGridResizeSchedulerRef.current;
  };

  const fitWhenStable = (force = false) => {
    const container = containerRef.current;
    const fitAddon = fitAddonRef.current;
    const terminal = terminalRef.current;
    if (!container || !fitAddon || !terminal) return;
    if (!force && (!isVisibleRef.current || isComposingRef.current)) return;
    if (container.offsetWidth <= 0 || container.offsetHeight <= 0) return;
    if (terminal.modes.synchronizedOutputMode) {
      synchronizedOutputFitDeferredRef.current = true;
      synchronizedOutputForcePendingRef.current ||= force;
      return;
    }

    const containerHeight = container.getBoundingClientRect().height;
    const previousContainerHeight = lastFitContainerHeightRef.current;
    const containerHeightChanged = previousContainerHeight === null
      || Math.abs(previousContainerHeight - containerHeight) >= 1;
    lastFitContainerHeightRef.current = containerHeight;
    const proposed = fitAddon.proposeDimensions();
    if (!proposed) return;
    const beforeRows = terminal.rows;
    const clamped = clampTerminalGridSize(proposed, minimumGridRef.current);
    const dims = {
      cols: clamped.cols,
      // A horizontal panel drag must not change rows while the measured height
      // is stable. Only columns reflow as the pane becomes wider or narrower.
      rows: !force && !containerHeightChanged
        ? Math.max(minimumGridRef.current.rows, beforeRows)
        : clamped.rows,
    };
    // A full-screen TUI must observe the same grid cadence as xterm. If local
    // reflow runs every frame while SIGWINCH is slower, the display alternates
    // between wrapped-down local rows and the application's next full redraw.
    // Coordinate both through terminal.onResize at ~30Hz, latest-wins. Normal
    // shell buffers still use interval 0 and therefore resize immediately.
    getTuiGridResizeScheduler().schedule(
      dims,
      !force && shouldCoordinateTuiResize(terminal) ? TUI_GRID_RESIZE_INTERVAL_MS : 0,
    );
    if (force || needsViewportRefreshRef.current) {
      refreshTerminalViewport(terminal);
      needsViewportRefreshRef.current = false;
    }
  };
  fitRunnerRef.current = fitWhenStable;

  const getFitScheduler = () => {
    if (!fitSchedulerRef.current) {
      fitSchedulerRef.current = new TerminalFitTaskScheduler(
        (force) => fitRunnerRef.current(force),
        (callback) => {
          const terminal = terminalRef.current;
          if (webglAddonRef.current || (terminal && shouldCoordinateTuiResize(terminal))) {
            // WebGL clears its backing canvas during resize. TUIs also need a
            // complete frame before resize so SIGWINCH output gets the full next
            // frame budget to replace local reflow before it can be painted.
            return window.setTimeout(callback, 0);
          }

          // ResizeObserver runs after layout and before paint. The side panel
          // already commits at most once per RAF, so a microtask both coalesces
          // observers and fits the DOM renderer before that same frame paints.
          // This removes the shrink-only frame where old wide rows are clipped
          // first and then suddenly wrap downward.
          const taskId = -(fitMicrotaskSequenceRef.current + 1);
          fitMicrotaskSequenceRef.current += 1;
          queueMicrotask(() => {
            if (cancelledFitMicrotasksRef.current.delete(taskId)) return;
            callback();
          });
          return taskId;
        },
        (taskId) => {
          if (taskId < 0) {
            cancelledFitMicrotasksRef.current.add(taskId);
          } else {
            window.clearTimeout(taskId);
          }
        },
      );
    }
    return fitSchedulerRef.current;
  };

  const cancelScheduledFit = () => {
    fitSchedulerRef.current?.cancel();
    tuiGridResizeSchedulerRef.current?.dispose();
    tuiGridResizeSchedulerRef.current = null;
    lastFitContainerHeightRef.current = null;
    synchronizedOutputFitDeferredRef.current = false;
    synchronizedOutputForcePendingRef.current = false;
    tuiResizeUrgentOutputUntilRef.current = 0;
    revealTuiResizeSnapshot();
  };

  const scheduleFit = (force = false) => {
    getFitScheduler().schedule(force);
  };

  const resumeDeferredFitAfterWrite = () => {
    const terminal = terminalRef.current;
    if (
      !terminal
      || !synchronizedOutputFitDeferredRef.current
      || terminal.modes.synchronizedOutputMode
    ) {
      return;
    }
    const force = synchronizedOutputForcePendingRef.current;
    synchronizedOutputFitDeferredRef.current = false;
    synchronizedOutputForcePendingRef.current = false;
    scheduleFit(force);
  };

  const scheduleViewportRefresh = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const terminal = terminalRef.current;
        if (!terminal) return;
        refreshTerminalViewport(terminal);
        scheduleFit(true);
      });
    });
  };

  const markViewportRefreshNeeded = () => {
    needsViewportRefreshRef.current = true;
  };

  const resetViewportRefreshState = () => {
    needsViewportRefreshRef.current = false;
  };

  return {
    syncWebglRenderer,
    scheduleHiddenWebglDispose,
    clearHiddenWebglDisposeTimer,
    clearWebglTextureAtlas,
    disposeWebglRenderer,
    scheduleFit,
    scheduleViewportRefresh,
    markViewportRefreshNeeded,
    enqueueActiveWrite,
    getOutputRestorePlanState,
    flushInactiveBufferForReplay,
    resumeActiveWriteQueue,
    getPendingOutputSnapshot,
    attachPtyOutput,
    resetOutputState,
    cancelScheduledFit,
    resumeDeferredFitAfterWrite,
    resetViewportRefreshState,
  };
}
