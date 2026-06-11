# fix card border style

## Goal

Fix settings selection cards that visually miss borders after the previous attempt, while keeping the existing card design language.

## Requirements

* Selection cards using `ui-selection-card` must render a visible 1px border.
* Active selection cards must keep their selected border color.
* Sync mode cards must have enough height and padding so labels/descriptions do not sit close to the border.
* Keep the change scoped to shared UI CSS; do not change behavior or settings state.

## Acceptance Criteria

* [ ] Palette cards, sidebar density cards, and terminal theme cards show borders.
* [ ] Sync mode cards have comfortable inner spacing and do not clip or hug the border.
* [ ] Selected card borders still use the selected/accent color.
* [ ] `npx tsc --noEmit` passes or any failure is clearly reported.

## Definition of Done

* Static verification is run.
* Manual UI verification items are listed because the desktop UI is not auto-started by agents.

## Out of Scope

* Redesigning settings pages.
* Changing theme palette values or persisted settings.
* Starting the Tauri desktop app.

## Technical Notes

* `src/App.css` owns shared `ui-selection-card` styling.
* `GeneralSettingsPage` and `ThemeSettingsPage` render selection cards through Mantine `UnstyledButton`; Mantine base styles can reset button borders unless the shared selector has higher specificity.
* `SyncSettingsPage` has compact sync mode option cards; use explicit `minHeight` and `padding` on Mantine `UnstyledButton` rather than relying only on utility classes.
