# Add General Dark Theme Palettes

## Goal

Add more dark palette choices to the General settings appearance section so the app shell can use additional mainstream dark visual styles.

## What I already know

* User wants new dark palettes for General settings, not terminal-only themes.
* Current dark palette options live in `src/components/settings/pages/GeneralSettingsPage.tsx`.
* Persisted dark palette type and defaults live in `src/stores/settingsStore.ts`.
* Actual app color variables are selected by `[data-theme="dark"][data-dark-palette="..."]` blocks in `src/App.css`.
* `src/App.tsx` writes `data-dark-palette` to `document.documentElement`.
* Terminal follow-app mode maps app dark palettes in `src/lib/terminalThemes.ts`, so new app palettes must also map to an existing terminal theme.
* GitNexus impact:
  * `getDefaultUiTextColor`: LOW, direct caller `GeneralSettingsPage`.
  * `resolveAutoDarkThemeId`: HIGH, affects terminal theme resolution in `ThemeSettingsPage`, `XTermTerminal`, and `TerminalTabs`.

## Requirements

* Add new dark app palette options in General settings.
* Keep existing dark palette ids stable.
* Add matching CSS variable blocks for each new dark palette.
* Add default UI text color entries for each new palette.
* Expand the persisted `DarkThemePalette` union.
* Update terminal auto-theme mapping so follow-app terminal mode remains type-safe and intentional.
* Do not change light palettes, terminal independent theme selection UI, storage schema keys, or dependencies.

## Acceptance Criteria

* [x] New dark palettes appear under General settings → Appearance → 暗色配色.
* [x] Selecting each new palette updates app shell CSS variables via `data-dark-palette`.
* [x] Existing palettes still work and keep their ids.
* [x] Terminal follow-app mode compiles with the expanded dark palette union.
* [x] `npx tsc --noEmit` passes.
* [x] Human manually verifies app appearance and terminal follow-app preview.

## Definition of Done

* Typecheck passes.
* No dependency/config changes.
* No runtime service/app launch by AI; manual UI checklist provided.

## Technical Approach

Add 5 curated dark app palettes with stable ids and no schema migration: GitHub Dark, Catppuccin Mocha, Nord Night, Dracula Purple, and Carbon Black. Update four files only: settings type, settings UI options/default text colors, CSS variables, and terminal follow-app mapping.

## Decision (ADR-lite)

**Context**: The initial 3-palette proposal was too small for the requested expansion.
**Decision**: Add 5 curated dark palettes and keep the implementation data-driven through existing constants/CSS selectors.
**Consequences**: More choices in General settings with a slightly larger CSS diff; terminal follow-app mapping must remain synchronized.

## Out of Scope

* Custom palette editor.
* Import/export of themes.
* Refactoring palette definitions into a shared data module.
* Adding or changing light palettes.
* Changing terminal independent theme library.

## Technical Notes

* Relevant files inspected: `src/stores/settingsStore.ts`, `src/components/settings/pages/GeneralSettingsPage.tsx`, `src/App.tsx`, `src/App.css`, `src/lib/terminalThemes.ts`.
* Relevant specs read earlier in session: frontend component/state/quality guidelines and shared code reuse guide.
