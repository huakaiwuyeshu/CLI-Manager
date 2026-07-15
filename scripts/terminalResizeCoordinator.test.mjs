import assert from "node:assert/strict";
import test from "node:test";
import {
  clampTerminalGridSize,
  LatestTerminalGridResizeScheduler,
  LatestTerminalPtyResizeQueue,
  TerminalFitTaskScheduler,
} from "../src/lib/terminalResizeCoordinator.ts";

test("fit scheduler coalesces a continuous drag into one post-render task", () => {
  let nextId = 1;
  const callbacks = new Map();
  const fits = [];
  const scheduler = new TerminalFitTaskScheduler(
    (force) => fits.push(force),
    (callback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    (id) => callbacks.delete(id),
  );

  for (let index = 0; index < 100; index += 1) scheduler.schedule(index === 72);
  assert.equal(callbacks.size, 1);
  callbacks.values().next().value();
  assert.deepEqual(fits, [true]);

  scheduler.schedule(false);
  assert.equal(callbacks.size, 2, "the test frame map retains the completed callback id");
  [...callbacks.values()][1]();
  assert.deepEqual(fits, [true, false]);
});

test("fit scheduler cancellation drops the pending task", () => {
  const callbacks = new Map();
  const fits = [];
  const scheduler = new TerminalFitTaskScheduler(
    (force) => fits.push(force),
    (callback) => {
      callbacks.set(1, callback);
      return 1;
    },
    (id) => callbacks.delete(id),
  );
  scheduler.schedule(true);
  scheduler.cancel();
  assert.equal(callbacks.size, 0);
  assert.deepEqual(fits, []);
});

test("terminal grid clamps to the runtime minimum advertised by the PTY host", () => {
  assert.deepEqual(
    clampTerminalGridSize({ cols: 18, rows: 4 }, { cols: 40, rows: 8 }),
    { cols: 40, rows: 8 },
  );
  assert.deepEqual(
    clampTerminalGridSize({ cols: 18, rows: 4 }, { cols: 2, rows: 1 }),
    { cols: 18, rows: 4 },
  );
});

test("PTY resize queue is serial and keeps only the latest pending size", async () => {
  const sent = [];
  const resolvers = [];
  const queue = new LatestTerminalPtyResizeQueue((size) => {
    sent.push(size);
    return new Promise((resolve) => resolvers.push(resolve));
  });

  queue.enqueue({ cols: 80, rows: 24 });
  queue.enqueue({ cols: 79, rows: 24 });
  queue.enqueue({ cols: 61, rows: 18 });
  assert.deepEqual(sent, [{ cols: 80, rows: 24 }]);

  resolvers.shift()();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(sent, [
    { cols: 80, rows: 24 },
    { cols: 61, rows: 18 },
  ]);

  resolvers.shift()();
  await Promise.resolve();
  queue.dispose();
});

test("PTY resize queue ignores invalid and duplicate dimensions", async () => {
  const sent = [];
  const queue = new LatestTerminalPtyResizeQueue(async (size) => {
    sent.push(size);
  });
  queue.enqueue({ cols: 1, rows: 24 });
  queue.enqueue({ cols: 80.5, rows: 24 });
  queue.enqueue({ cols: 80, rows: 24 });
  await Promise.resolve();
  queue.enqueue({ cols: 80, rows: 24 });
  await Promise.resolve();
  assert.deepEqual(sent, [{ cols: 80, rows: 24 }]);
});

test("legacy runtime clamp collapses a narrow drag to one PTY grid", async () => {
  const sent = [];
  const queue = new LatestTerminalPtyResizeQueue(async (size) => {
    sent.push(size);
  });
  const legacyMinimum = { cols: 40, rows: 8 };

  for (const proposedCols of [39, 31, 18, 7, 2]) {
    queue.enqueue(clampTerminalGridSize(
      { cols: proposedCols, rows: 24 },
      legacyMinimum,
    ));
    await Promise.resolve();
  }

  assert.deepEqual(sent, [{ cols: 40, rows: 24 }]);
});

test("grid resize scheduler keeps local TUI reflow on one latest-wins cadence", () => {
  let now = 0;
  let nextTimerId = 1;
  const timers = new Map();
  const applied = [];
  const scheduler = new LatestTerminalGridResizeScheduler(
    (size) => applied.push(size),
    {
      now: () => now,
      requestTimer: (callback, delayMs) => {
        const id = nextTimerId++;
        timers.set(id, { callback, delayMs });
        return id;
      },
      cancelTimer: (id) => timers.delete(id),
    },
  );

  scheduler.schedule({ cols: 100, rows: 30 }, 34);
  scheduler.schedule({ cols: 96, rows: 30 }, 34);
  scheduler.schedule({ cols: 91, rows: 30 }, 34);

  assert.deepEqual(applied, [{ cols: 100, rows: 30 }]);
  assert.equal(timers.size, 1);
  const [{ callback, delayMs }] = timers.values();
  assert.equal(delayMs, 34);

  timers.clear();
  now = 34;
  callback();
  assert.deepEqual(applied, [
    { cols: 100, rows: 30 },
    { cols: 91, rows: 30 },
  ]);

  scheduler.schedule({ cols: 88, rows: 30 }, 34);
  scheduler.schedule({ cols: 86, rows: 30 }, 0);
  assert.deepEqual(applied, [
    { cols: 100, rows: 30 },
    { cols: 91, rows: 30 },
    { cols: 86, rows: 30 },
  ]);
  assert.equal(timers.size, 0);
  scheduler.dispose();
});
