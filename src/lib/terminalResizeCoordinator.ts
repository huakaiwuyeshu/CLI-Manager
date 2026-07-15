export const TERMINAL_MIN_COLS = 2;
export const TERMINAL_MIN_ROWS = 1;
export const LEGACY_TERMINAL_MIN_COLS = 40;
export const LEGACY_TERMINAL_MIN_ROWS = 8;

export interface TerminalGridSize {
  cols: number;
  rows: number;
}

export type TerminalTaskRequest = (callback: () => void) => number;
export type TerminalTaskCancel = (taskId: number) => void;
export type TerminalDelayTaskId = ReturnType<typeof setTimeout>;
export type TerminalDelayTaskRequest = (callback: () => void, delayMs: number) => TerminalDelayTaskId;
export type TerminalDelayTaskCancel = (taskId: TerminalDelayTaskId) => void;

export function clampTerminalGridSize(
  proposed: TerminalGridSize,
  minimum: TerminalGridSize,
): TerminalGridSize {
  return {
    cols: Math.max(TERMINAL_MIN_COLS, minimum.cols, proposed.cols),
    rows: Math.max(TERMINAL_MIN_ROWS, minimum.rows, proposed.rows),
  };
}

/**
 * Coalesces resize observations into one pending browser task. The caller
 * chooses the phase used to run that task for the active renderer.
 *
 * DOM rendering can fit in a microtask after ResizeObserver so geometry is
 * reconciled before the same frame paints. WebGL should use a post-render task:
 * it clears the canvas synchronously during resize and redraws in its own RAF.
 */
export class TerminalFitTaskScheduler {
  private taskId: number | null = null;
  private forcePending = false;
  private readonly runFit: (force: boolean) => void;
  private readonly requestTask: TerminalTaskRequest;
  private readonly cancelTask: TerminalTaskCancel;

  constructor(
    runFit: (force: boolean) => void,
    requestTask: TerminalTaskRequest,
    cancelTask: TerminalTaskCancel,
  ) {
    this.runFit = runFit;
    this.requestTask = requestTask;
    this.cancelTask = cancelTask;
  }

  schedule(force = false): void {
    this.forcePending ||= force;
    if (this.taskId !== null) return;
    this.taskId = this.requestTask(() => {
      this.taskId = null;
      const shouldForce = this.forcePending;
      this.forcePending = false;
      this.runFit(shouldForce);
    });
  }

  cancel(): void {
    if (this.taskId !== null) {
      this.cancelTask(this.taskId);
      this.taskId = null;
    }
    this.forcePending = false;
  }
}

function sameGridSize(left: TerminalGridSize | null, right: TerminalGridSize): boolean {
  return left?.cols === right.cols && left.rows === right.rows;
}

export interface LatestTerminalGridResizeSchedulerOptions {
  now?: () => number;
  requestTimer?: TerminalDelayTaskRequest;
  cancelTimer?: TerminalDelayTaskCancel;
}

/**
 * Keeps a renderer and its PTY producer on one resize cadence. The first size
 * is applied immediately, intermediate sizes collapse to the newest value, and
 * the final trailing size is always applied after the interval.
 */
export class LatestTerminalGridResizeScheduler {
  private pending: TerminalGridSize | null = null;
  private lastAppliedAt: number | null = null;
  private timerId: TerminalDelayTaskId | null = null;
  private disposed = false;
  private readonly apply: (size: TerminalGridSize) => void;
  private readonly now: () => number;
  private readonly requestTimer: TerminalDelayTaskRequest;
  private readonly cancelTimer: TerminalDelayTaskCancel;

  constructor(
    apply: (size: TerminalGridSize) => void,
    options: LatestTerminalGridResizeSchedulerOptions = {},
  ) {
    this.apply = apply;
    this.now = options.now ?? (() => performance.now());
    this.requestTimer = options.requestTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.cancelTimer = options.cancelTimer ?? ((taskId) => clearTimeout(taskId));
  }

  schedule(size: TerminalGridSize, minimumIntervalMs: number): void {
    if (this.disposed) return;
    this.pending = { cols: size.cols, rows: size.rows };
    const intervalMs = Math.max(0, minimumIntervalMs);
    const elapsed = this.lastAppliedAt === null
      ? Number.POSITIVE_INFINITY
      : this.now() - this.lastAppliedAt;
    const delayMs = intervalMs - elapsed;

    if (delayMs <= 0) {
      this.clearTimer();
      this.applyPending();
      return;
    }
    if (this.timerId !== null) return;
    this.timerId = this.requestTimer(() => {
      this.timerId = null;
      this.applyPending();
    }, delayMs);
  }

  dispose(): void {
    this.disposed = true;
    this.pending = null;
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timerId === null) return;
    this.cancelTimer(this.timerId);
    this.timerId = null;
  }

  private applyPending(): void {
    if (this.disposed || !this.pending) return;
    const next = this.pending;
    this.pending = null;
    this.lastAppliedAt = this.now();
    this.apply(next);
  }
}

/**
 * Serializes PTY resize requests and keeps only the newest pending dimensions.
 * Local xterm reflow remains frame-rate responsive, while the native PTY never
 * receives stale sizes out of order when IPC calls complete at different times.
 */
export class LatestTerminalPtyResizeQueue {
  private pending: TerminalGridSize | null = null;
  private inFlight = false;
  private disposed = false;
  private lastSent: TerminalGridSize | null = null;
  private readonly send: (size: TerminalGridSize) => Promise<void>;
  private readonly onError?: (error: unknown, size: TerminalGridSize) => void;

  constructor(
    send: (size: TerminalGridSize) => Promise<void>,
    onError?: (error: unknown, size: TerminalGridSize) => void,
  ) {
    this.send = send;
    this.onError = onError;
  }

  enqueue(size: TerminalGridSize): void {
    if (this.disposed) return;
    if (!Number.isSafeInteger(size.cols) || !Number.isSafeInteger(size.rows)) return;
    if (size.cols < TERMINAL_MIN_COLS || size.rows < TERMINAL_MIN_ROWS) return;
    this.pending = { cols: size.cols, rows: size.rows };
    void this.flush();
  }

  dispose(): void {
    this.disposed = true;
    this.pending = null;
  }

  private async flush(): Promise<void> {
    if (this.disposed || this.inFlight || !this.pending) return;
    const next = this.pending;
    this.pending = null;
    if (sameGridSize(this.lastSent, next)) {
      if (this.pending) void this.flush();
      return;
    }

    this.inFlight = true;
    try {
      await this.send(next);
      this.lastSent = next;
    } catch (error) {
      this.onError?.(error, next);
    } finally {
      this.inFlight = false;
      if (!this.disposed && this.pending) void this.flush();
    }
  }
}
