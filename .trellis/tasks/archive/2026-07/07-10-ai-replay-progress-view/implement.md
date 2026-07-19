# Implementation Plan

1. Add the pure progress model and tests for turn construction, exact lifecycle pairing, validation recognition, history overlay, file mapping, and fallback behavior.
2. Replace SessionReplayPanel summary cards, filter rail, raw timeline, and fixed detail panel with the compact header, progress/log modes, turn cards, and inline expansion.
3. Reuse exact history session loading and existing transcript/Diff renderers; preserve snapshot actions.
4. Add zh-CN/en-US copy and update product documentation/changelog under `[TEMP]`.
5. Run the focused Node test and `npx tsc --noEmit`; inspect diffs and affected scope.
