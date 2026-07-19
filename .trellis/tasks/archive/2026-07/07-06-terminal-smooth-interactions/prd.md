# Terminal Smooth Interactions

## Goal

Make terminal interaction feel smoother for typing-adjacent UI operations: split panes, pane fullscreen, terminal fullscreen, font zoom controls, and the terminal action/sidebar panels.

## Changelog Target

[V1.2.6]

## What I Already Know

* User requested updating `master` first, creating a worktree from `master`, then implementing the optimization.
* `master` was refreshed to `origin/master` at `e3573fb`; this task runs in `.codex/worktrees/terminal-smooth-ui` on `feat/terminal-smooth-ui`.
* Existing terminal UI is React + xterm.js. Terminal output/input path already uses requestAnimationFrame batching and `terminal.paste`.
* `Ctrl + wheel` already changes global terminal font size through `settingsStore.fontSize`.
* Split panes are rendered by `SplitTerminalView` with absolute `left/top/width/height` and `display: none` for hidden fullscreen panes.
* Terminal side panels use `ResizableTerminalPanelFrame`; dragging width writes directly to the DOM on animation frames and persists only on mouseup.

## Requirements

* Split pane resize must stay responsive while dragging.
* Split pane layout changes and pane fullscreen enter/exit should transition instead of snapping.
* Side panel open/width changes should feel smoother without making resize drag laggy.
* Terminal font zoom should be directly reachable from the terminal action sidebar in addition to existing `Ctrl + wheel`.
* Do not change PTY, shell, or xterm input semantics.
* Do not add dependencies.

## Acceptance Criteria

* [ ] Dragging a split divider updates at animation-frame cadence and does not lag behind the pointer due to CSS transition.
* [ ] Pane fullscreen enter/exit animates size/opacity without unmounting the live terminal.
* [ ] Terminal side panel appears with a small slide/fade and stored-width changes transition, while active resize drag has no width transition.
* [ ] Font decrease/reset/increase buttons update the same persisted `fontSize` setting and respect the existing 8-32 bounds.
* [ ] New user-visible labels are present in `zh-CN` and `en-US`.
* [ ] `npx tsc --noEmit` passes.

## Definition of Done

* Static type check passes.
* Changelog and feature inventory are updated if behavior changes.
* Manual verification items are listed because this project forbids AI-run Tauri UI verification.

## Technical Approach

Keep changes in the frontend interaction layer:

* Add state/data attributes and CSS transitions for split pane child geometry, opacity, and divider hover/drag affordances.
* Add a panel-frame class/data attribute so width transitions apply only outside active drag.
* Add compact font zoom controls to `TerminalTabs` using existing settings store values and i18n.

## Decision

Context: The request is about interaction smoothness, not terminal protocol behavior.

Decision: Prefer CSS/layout-level improvements and reuse existing persisted `fontSize` settings. Avoid new dependencies and avoid changing xterm input/PTY code.

Consequences: Runtime UI still needs human desktop verification; static checks can verify TypeScript/i18n wiring only.

## Out of Scope

* Replacing xterm.js or changing PTY backend behavior.
* Adding a new animation library.
* Redesigning the whole terminal toolbar/sidebar settings model.

## Technical Notes

* Relevant files found by fast-context:
  * `src/components/TerminalTabs.tsx`
  * `src/components/SplitTerminalView.tsx`
  * `src/components/XTermTerminal.tsx`
  * `src/components/terminal/TerminalSidePanel.tsx`
  * `src/stores/terminalStore.ts`
  * `src/stores/terminalPaneTree.ts`
  * `src/styles/components.css`
* Relevant spec files read:
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/guides/task-delivery-checklist.md`
  * `.trellis/spec/guides/code-reuse-thinking-guide.md`
