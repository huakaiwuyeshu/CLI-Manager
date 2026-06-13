# Add More Dark Terminal Themes

## Goal

Expand the built-in terminal theme library with additional mainstream dark palettes so users have more practical choices without changing terminal rendering behavior.

## What I already know

* User wants more dark themes, referencing mainstream market/terminal/editor configurations.
* Existing implementation is centralized in `src/lib/terminalThemes.ts`.
* `src/components/settings/pages/ThemeSettingsPage.tsx` already reads `TERMINAL_THEME_PRESETS` and groups presets via `TERMINAL_THEME_GROUPS`.
* Current working tree already has uncommitted theme grouping changes; avoid rewriting or restructuring them.
* Existing presets already include many major families: Dracula, Nord, Solarized, One Dark, GitHub Dark, Catppuccin, Gruvbox, Everforest, Rosé Pine, Kanagawa, Ayu, Night Owl, Material Palenight.

## Requirements

* Add only dark terminal theme presets.
* Keep the existing xterm `ITheme` object pattern.
* Keep existing theme ids stable.
* Do not change terminal rendering, persistence, settings state shape, or app theme palette behavior.
* Add new presets to the existing grouped theme library.

## Acceptance Criteria

* [x] New dark presets appear in the independent terminal theme library.
* [x] New presets have `group`, `family`, and `tone: "dark"` metadata.
* [x] Existing theme ids and auto theme resolution remain unchanged.
* [x] `npx tsc --noEmit` passes.
* [x] Human manually verifies terminal settings UI and terminal preview.

## Definition of Done

* Typecheck passes.
* No dependency/config/runtime architecture changes.
* Manual verification checklist is provided because this project requires human desktop UI verification.

## Technical Approach

Add a small set of missing mainstream dark palettes as constants in `src/lib/terminalThemes.ts`, then register them in `TERMINAL_THEME_PRESETS`. Keep UI code unchanged unless type errors expose a missing group assignment.

## Research Notes

### What similar tools do

* Dracula, Nord, One Dark, Catppuccin, Gruvbox, Tokyo Night are common cross-editor/terminal themes.
* Nightfox/Carbonfox, Cobalt2, Oceanic Next, and Tomorrow Night appear in large terminal scheme collections such as iTerm2 Color Schemes.
* Official theme sources usually define ANSI normal/bright colors plus background/foreground/selection.

### Constraints from repo/project

* Terminal themes are pure frontend constants.
* Existing settings store persists only the selected theme id; adding presets is backward-compatible.
* The project guideline requires static checks plus manual UI verification for terminal visual changes.
* GitNexus impact for `TERMINAL_THEME_PRESETS` is LOW.

### Feasible approaches

**Approach A: Fill mainstream gaps only (Recommended)**

* Add 4–5 missing dark palettes that are popular and visually distinct.
* Pros: smallest diff, less palette noise, easy to review.
* Cons: not an exhaustive terminal theme catalog.

**Approach B: Larger catalog expansion**

* Add 8–10 more dark palettes in one batch.
* Pros: more choices immediately.
* Cons: larger file, harder to curate quality/duplicates.

**Approach C: UI/catalog refactor**

* Move palette data to a separate data module or JSON-like structure.
* Pros: future scale.
* Cons: unnecessary for this request; touches more code.

## Decision (ADR-lite)

Pending user confirmation.

## Out of Scope

* Adding dependencies.
* Changing terminal renderer/xterm behavior.
* Changing persisted settings schema or migration logic.
* Adding custom theme import/export.
* Reorganizing settings navigation.

## Technical Notes

* Relevant files inspected: `src/lib/terminalThemes.ts`, `src/components/settings/pages/ThemeSettingsPage.tsx`.
* Relevant specs read: frontend component/state/quality guidelines and shared code reuse guide.
* Recommended implementation target: `src/lib/terminalThemes.ts` only.
