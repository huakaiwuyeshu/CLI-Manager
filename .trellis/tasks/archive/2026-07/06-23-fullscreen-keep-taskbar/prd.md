# Fullscreen Keep Taskbar

## Goal

Change the terminal immersive fullscreen behavior so it no longer enters OS-level fullscreen that covers the Windows taskbar. The app should keep the existing in-app immersive terminal layout while preserving the system taskbar/application bar.

## Requirements

* Clicking the existing terminal fullscreen button should keep the Windows taskbar visible.
* The terminal should still use the existing immersive in-app layout that hides the sidebar/title chrome.
* Exiting the mode should restore the window from maximized state when the app maximized it for this mode.
* Browser/non-Tauri fallback should keep the current local UI-state behavior.

## Acceptance Criteria

* [ ] Entering terminal fullscreen does not call OS fullscreen and does not cover the Windows taskbar.
* [ ] The terminal area still fills the available app window space in immersive mode.
* [ ] Exiting terminal fullscreen restores from maximized state when entered through this control.
* [ ] `npx tsc --noEmit` passes.

## Definition of Done

* Static type check passes.
* Manual desktop verification items are listed because project guidelines prohibit AI-started Tauri runtime verification.

## Technical Approach

Replace `getCurrentWindow().setFullscreen(nextFullscreen)` in `src/App.tsx` with maximize/unmaximize behavior while keeping the existing `terminalFullscreen` React state that drives in-app immersive layout.

## Out of Scope

* No redesign of terminal layout or toolbar.
* No dependency or config changes.
* No changes to global window title bar behavior outside this control.

## Technical Notes

* Current implementation is in `src/App.tsx` inside `handleToggleTerminalFullscreen`.
* Fullscreen button UI is in `src/components/TerminalTabs.tsx` and already labels the behavior as immersive fullscreen.
* Tauri capability already allows `toggle-maximize`, `is-maximized`, and `unmaximize`; no capability change is expected.
* GitNexus impact tool is not exposed in the current tool list, so impact analysis must be approximated by direct code reads and type checks.
