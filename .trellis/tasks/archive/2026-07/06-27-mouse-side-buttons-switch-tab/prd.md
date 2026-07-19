# Bind Mouse Side Buttons To Switch Terminal Tabs

## Goal

Allow mouse side buttons to switch terminal tabs in CLI-Manager: backward button goes to the previous tab, forward button goes to the next tab.

## Changelog Target

`[TEMP]`

## Requirements

* Mouse button 3 (`button === 3`, usually Back) switches to the previous terminal tab.
* Mouse button 4 (`button === 4`, usually Forward) switches to the next terminal tab.
* Reuse the existing terminal tab order logic used by keyboard tab switching.
* Prevent browser/webview back/forward navigation for handled side-button events.
* Do nothing when compact mode is active or fewer than two sessions exist.

## Acceptance Criteria

* [ ] With two or more terminal sessions, mouse Back activates the previous tab.
* [ ] With two or more terminal sessions, mouse Forward activates the next tab.
* [ ] The behavior follows the existing pane-aware tab order.
* [ ] Side-button clicks do not navigate the WebView history.
* [ ] TypeScript check passes.

## Definition of Done

* `npx tsc --noEmit` passes.
* Manual desktop verification items are listed for the user.

## Technical Approach

Add a global `mouseup` listener near the existing keyboard shortcut hook. The listener reads `useTerminalStore.getState()`, calls `getNextSessionIdForShortcut(-1 | 1)`, and then calls `setActive(nextSessionId)`.

## Decision (ADR-lite)

**Context**: The project already has keyboard tab switching and a pane-aware resolver in `terminalStore`.

**Decision**: Implement mouse side-button switching as an input shortcut that reuses `getNextSessionIdForShortcut`.

**Consequences**: No new setting or translation key is needed. Users who expect mouse side buttons to navigate app history inside the WebView will get tab switching instead.

## Out of Scope

* Customizable mouse shortcut settings.
* Visual UI changes.
* Changing keyboard shortcut behavior.

## Technical Notes

* `src/hooks/useKeyboardShortcuts.ts` owns global keyboard shortcut handling and already switches tabs through `terminalStore.getNextSessionIdForShortcut`.
* `src/stores/terminalStore.ts` owns `setActive` and pane-aware tab order.
* Relevant spec: `.trellis/spec/frontend/quality-guidelines.md` says AI agents should use static checks and list manual desktop checks for runtime UI behavior.
