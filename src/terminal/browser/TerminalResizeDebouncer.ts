/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See NOTICE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Terminal } from "@xterm/xterm";

const START_DEBOUNCING_THRESHOLD = 200;
const HORIZONTAL_RESIZE_DELAY_MS = 100;

type ResizeCallback = (value: number) => void;

export class TerminalResizeDebouncer {
  private latestCols = 0;
  private latestRows = 0;
  private horizontalTimer: number | null = null;
  private horizontalIdleJob: number | null = null;
  private verticalIdleJob: number | null = null;
  private disposed = false;

  constructor(
    private readonly isVisible: () => boolean,
    private readonly getTerminal: () => Terminal | null,
    private readonly resizeBoth: (cols: number, rows: number) => void,
    private readonly resizeHorizontal: ResizeCallback,
    private readonly resizeVertical: ResizeCallback,
  ) {}

  resize(cols: number, rows: number, immediate = false): void {
    if (this.disposed) return;
    const terminal = this.getTerminal();
    if (!terminal) return;

    this.latestCols = cols;
    this.latestRows = rows;

    if (immediate || terminal.buffer.normal.length < START_DEBOUNCING_THRESHOLD) {
      this.cancel();
      this.resizeBoth(cols, rows);
      return;
    }

    if (!this.isVisible()) {
      if (this.horizontalIdleJob === null) {
        this.horizontalIdleJob = this.scheduleIdle(() => {
          this.horizontalIdleJob = null;
          if (!this.disposed) this.resizeHorizontal(this.latestCols);
        });
      }
      if (this.verticalIdleJob === null) {
        this.verticalIdleJob = this.scheduleIdle(() => {
          this.verticalIdleJob = null;
          if (!this.disposed) this.resizeVertical(this.latestRows);
        });
      }
      return;
    }

    this.resizeVertical(rows);
    if (this.horizontalTimer !== null) window.clearTimeout(this.horizontalTimer);
    this.horizontalTimer = window.setTimeout(() => {
      this.horizontalTimer = null;
      if (!this.disposed) this.resizeHorizontal(this.latestCols);
    }, HORIZONTAL_RESIZE_DELAY_MS);
  }

  flush(): void {
    if (this.disposed || !this.hasPendingResize()) return;
    this.cancel();
    this.resizeBoth(this.latestCols, this.latestRows);
  }

  cancel(): void {
    if (this.horizontalTimer !== null) {
      window.clearTimeout(this.horizontalTimer);
      this.horizontalTimer = null;
    }
    if (this.horizontalIdleJob !== null) {
      this.cancelIdle(this.horizontalIdleJob);
      this.horizontalIdleJob = null;
    }
    if (this.verticalIdleJob !== null) {
      this.cancelIdle(this.verticalIdleJob);
      this.verticalIdleJob = null;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
  }

  private hasPendingResize(): boolean {
    return this.horizontalTimer !== null || this.horizontalIdleJob !== null || this.verticalIdleJob !== null;
  }

  private scheduleIdle(callback: () => void): number {
    if (typeof window.requestIdleCallback === "function") {
      return window.requestIdleCallback(callback, { timeout: HORIZONTAL_RESIZE_DELAY_MS });
    }
    return window.setTimeout(callback, 0);
  }

  private cancelIdle(handle: number): void {
    if (typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(handle);
      return;
    }
    window.clearTimeout(handle);
  }
}
