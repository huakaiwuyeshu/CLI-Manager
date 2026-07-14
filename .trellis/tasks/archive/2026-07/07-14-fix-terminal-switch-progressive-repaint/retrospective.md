# Bug Analysis: Terminal switch progressive repaint

## 1. Root Cause Category

- **Category**: E - Implicit Assumption, with D - Test Coverage Gap.
- **Specific Cause**: The visibility recovery path assumed that returning from `Terminal.refresh()` meant the viewport was already painted. xterm only schedules the refresh, so the visible container exposed intermediate row rendering. Existing tests asserted that a full refresh was requested, but did not cover when the drawing layer should become visible.

## 2. Why Fixes Failed

1. `d6ab946`: removed only the extra `scheduleViewportRefresh()` call. The visibility plan still set `needsViewportRefreshRef`, and `scheduleFit(true)` still performed a full refresh through the `force` branch, so the progressive repaint remained.
2. Initial Workspan hypothesis: correctly identified a frequently exercised visibility path, but confused exposure frequency with the original cause. Full viewport refresh on every hidden-to-visible transition existed before Workspan.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|---|---|---|---|
| P0 | Architecture | Preserve the recovery refresh but gate visibility on xterm's public `onRender` completion signal. | DONE |
| P0 | Runtime safety | Add a bounded reveal timeout and cleanup on hide/retry/unmount. | DONE |
| P1 | Test coverage | Add full/partial/empty viewport render-range regression tests. | DONE |
| P1 | Documentation | Record the visibility-restoration masking contract in frontend component guidelines. | DONE |
| P2 | Manual verification | Repeatedly switch normal tabs, Workspans, background-output terminals, and low-memory WebGL-restored terminals. | TODO (human desktop check) |

## 4. Systematic Expansion

- **Similar Issues**: Initial snapshot restoration, foreground WebGL atlas rebuild, and resize-triggered full refreshes also repaint the viewport, but they are not ordinary hidden-to-visible switches and remain outside this task.
- **Design Improvement**: Treat terminal rendering completion and terminal buffer/write completion as separate signals. `refresh()` schedules pixels; `write(..., callback)` confirms parser completion; neither should be inferred from arbitrary delays.
- **Process Improvement**: For visual rendering regressions, trace every remaining call path to the actual renderer operation before declaring a duplicate-call removal sufficient.

## 5. Knowledge Capture

- [x] Updated `.trellis/spec/frontend/component-guidelines.md`.
- [x] Added executable render-range tests.
- [x] Recorded the root-cause history in this task.
- [ ] Spec template sync skipped because this repository has no `src/templates/markdown/spec/` or equivalent template mirror.
