# Fix Terminal Duplicate Cursor

## Goal

Reduce cursor confusion in the embedded xterm terminal: avoid users seeing a misleading thick/block cursor in Codex/Claude TUI input areas, and make the visible xterm cursor consistently use a thin bar style.

## What I already know

* User reported two visible cursors in the terminal UI and frequent typing at the wrong perceived cursor position.
* User explicitly requested the cursor to be fixed as a thin cursor.
* Terminal rendering is implemented in `src/components/XTermTerminal.tsx`.
* Current xterm initialization sets `cursorStyle: "block"` and `cursorBlink: false`.
* Local `@xterm/xterm` type definitions confirm `cursorStyle` supports `"block" | "underline" | "bar"` and `cursorWidth` controls bar cursor width.
* GitNexus upstream impact for `XTermTerminal` is LOW: 0 direct callers/processes/modules reported.

## Requirements

* Embedded terminal cursor should use a thin bar style instead of a block cursor.
* Cursor behavior changes should be scoped to the xterm terminal component.
* Existing IME/helper textarea anchoring logic should remain intact unless direct inspection proves it is the root cause.

## Acceptance Criteria

* [ ] `XTermTerminal` initializes xterm with a thin bar cursor.
* [ ] TypeScript check passes.
* [ ] No dependency or Rust backend change is introduced.
* [ ] Existing focus/IME positioning code is not broadly refactored.

## Definition of Done

* Minimal code change implemented.
* `npx tsc --noEmit` passes or any failure is reported with exact reason.
* GitNexus `detect_changes` run before wrap-up.

## Technical Approach

Set xterm's cursor style to `"bar"` and define a narrow `cursorWidth` so the terminal uses a stable thin caret. Keep the existing delayed cursor visibility and IME anchoring logic unchanged for this MVP.

## Out of Scope

* Adding a user-facing cursor style setting.
* Reworking Codex/Claude TUI cursor detection heuristics.
* Changing PTY backend behavior.

## Technical Notes

* `src/components/XTermTerminal.tsx:509` currently sets `cursorBlink: false`.
* `src/components/XTermTerminal.tsx:510` currently sets `cursorStyle: "block"`.
* `node_modules/@xterm/xterm/typings/xterm.d.ts:68` defines `cursorStyle?: 'block' | 'underline' | 'bar'`.
* `node_modules/@xterm/xterm/typings/xterm.d.ts:73` defines `cursorWidth?: number`.
