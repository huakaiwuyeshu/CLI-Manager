# Move Debug Mode to General Settings

## Changelog Target

[TEMP]

## Goal

Move the existing debug mode switch from Terminal settings to the bottom of General settings, and allow F12 to open DevTools only when debug mode is enabled.

## Requirements

- Reuse the existing `debugMode` setting and persistence behavior.
- Remove the debug mode switch from Terminal settings.
- Add the debug mode switch at the bottom of General settings.
- When `debugMode` is enabled, pressing F12 opens DevTools.
- When `debugMode` is disabled, pressing F12 does nothing.

## Acceptance Criteria

- [x] Terminal settings no longer render the debug mode switch.
- [x] General settings render the debug mode switch as the last setting card.
- [x] Existing debug logging toggle behavior still works.
- [x] F12 opens DevTools only while debug mode is enabled.
- [x] TypeScript and Rust checks pass.

## Definition of Done

- Type-check and Rust compile checks run.
- `CHANGELOG.md` updated under `[TEMP]`.
- `docs/功能清单.md` updated if product functionality description changes.

## Technical Approach

Use the existing settings store key and i18n keys. Add a small Rust command to open DevTools and a frontend F12 listener gated by `debugMode`.

## Decision (ADR-lite)

Context: Release builds need explicit DevTools support, and the user wants F12 available only under debug mode.

Decision: Enable Tauri `devtools` feature and expose a gated `open_devtools` command invoked only by the frontend debug-mode key handler.

Consequences: Release builds contain DevTools capability, but the product UI only exposes it through the debug mode preference.

## Out of Scope

- No new debug setting key.
- No changes to terminal behavior, logging semantics, or shortcut configuration UI.

## Technical Notes

- Existing debug mode state is in `src/stores/settingsStore.ts`.
- Existing debug mode UI is in `src/components/settings/pages/ThemeSettingsPage.tsx`.
- Target General settings UI is `src/components/settings/pages/GeneralSettingsPage.tsx`.
- Tauri entry point and command registration are in `src-tauri/src/lib.rs`.
