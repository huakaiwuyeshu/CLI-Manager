# Close Terminal Tab Confirmation

## Goal

Add an optional confirmation prompt when closing terminal tabs so users can avoid accidentally closing live PTY sessions. The prompt is controlled from Settings.

## What I already know

- User wants a popup prompt when closing terminal tabs to avoid accidental closure.
- User wants this prompt to be enabled from Settings.
- Existing terminal tab UI is in `src/components/TerminalTabs.tsx`.
- Existing close action ultimately calls `closeSession` from `src/stores/terminalStore.ts`.
- Existing global close shortcut is handled in `src/hooks/useKeyboardShortcuts.ts`.
- Existing settings persistence is in `src/stores/settingsStore.ts` using `tauri-plugin-store`.
- General settings page uses Mantine controls and already has app close behavior settings in `src/components/settings/pages/GeneralSettingsPage.tsx`.

## Assumptions (temporary)

- New setting defaults to disabled because the user said it can be enabled in Settings.
- Confirmation should protect terminal tab closes from visible tab UI and keyboard shortcut, not app window close.
- Batch close menu items should show one confirmation for all target tabs, not one dialog per tab.

## Open Questions

- Confirm whether the MVP should use the recommended scope/default: default off, prompt all terminal-tab close entry points when enabled.

## Requirements (evolving)

- Add a persisted boolean setting for terminal tab close confirmation.
- Add a Settings switch for the user to enable/disable the prompt.
- When enabled, closing terminal tabs should show an in-app bubble/popover confirmation before `closeSession` is called.
- The prompt must appear before any terminal session is closed, including tab close buttons, terminal context menu close actions, and the close-terminal keyboard shortcut.
- When disabled, existing close behavior should stay unchanged.

## Acceptance Criteria (evolving)

- [ ] Settings has a switch for terminal tab close confirmation.
- [ ] Existing installs default to no prompt unless the switch is enabled.
- [ ] Clicking a terminal tab close button shows an app-styled bubble confirmation before closing when enabled.
- [ ] Terminal tab context menu close actions show one app-styled bubble confirmation before closing when enabled.
- [ ] Keyboard shortcut close action shows an app-styled bubble confirmation before closing when enabled.
- [ ] No terminal session is closed until the user clicks the bubble confirm action.
- [ ] `npx tsc --noEmit` passes.
- [ ] Manual desktop UI verification checklist is provided instead of auto-starting the Tauri app.

## Definition of Done

- Types compile with `npx tsc --noEmit`.
- Existing terminal close behavior remains unchanged when the setting is disabled.
- Docs/spec updates are only added if a new reusable pattern emerges.
- Manual UI verification items are listed for the user.

## Out of Scope

- Changing app window close behavior.
- Adding per-terminal dirty/running-process detection.
- Adding “do not ask again” inside the terminal-tab close prompt.
- Backend/PT到Y close behavior changes.

## Technical Notes

- Relevant specs read:
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/state-management.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/guides/code-reuse-thinking-guide.md`
- Existing setting pattern: add a field to `Settings`, `DEFAULTS`, load migration/type guard, and update via `useSettingsStore.update`.
- Existing setting UI pattern: Mantine `Card` + `Switch` in `GeneralSettingsPage`.
- GitNexus impact checks before planning edits:
  - `TerminalTabs`: LOW, 0 direct upstream callers found.
  - `GeneralSettingsPage`: LOW, 0 direct upstream callers found.
  - `useKeyboardShortcuts`: LOW, 1 direct caller (`App`).
  - `useSettingsStore`: LOW, 0 direct upstream callers found.
