# Implement Mantine UI Adoption

## Goal

Introduce Mantine as a controlled UI framework trial for CLI-Manager, starting with the smallest useful implementation: app-level MantineProvider/theme bridge plus the General Settings page standard controls. The goal is to verify visual fit, theme integration, and dependency impact before migrating broader settings/stats surfaces.

## Requirements

* Add Mantine dependencies only after explicit implementation approval.
* Add app-level Mantine provider and required Mantine stylesheet import.
* Bridge existing app theme intent into Mantine:
  * resolved light/dark theme should choose Mantine color scheme.
  * `uiFontFamily` should drive Mantine font family.
  * existing app shell CSS variables must remain the source of truth for terminal/app shell during this trial.
* Migrate only `GeneralSettingsPage` standard UI controls/layout to Mantine equivalents where it reduces hand-written UI:
  * cards/sections
  * select-like choices
  * switches
  * text/color input where safe
  * option cards if visually better
* Preserve settings behavior and persisted schema.
* Preserve `SettingsTab` ids and all callers.
* Do not migrate terminal tabs, split panes, xterm, project tree, drag/drop, stats charts, or backend code in this task.
* Do not start the Tauri desktop app for AI-side runtime verification; provide manual UI checks.

## Acceptance Criteria

* [ ] Mantine package dependencies are added to `package.json` and lockfile after approval.
* [ ] React root is wrapped with a Mantine provider without removing existing `React.StrictMode`.
* [ ] Mantine color scheme follows existing resolved app theme.
* [ ] General Settings page renders with Mantine standard controls while keeping existing setting semantics.
* [ ] Existing theme palettes and terminal settings remain available and persist correctly.
* [ ] `npx tsc --noEmit` passes.
* [ ] Manual verification checklist is provided for settings page visual behavior.

## Definition of Done

* TypeScript static check passes.
* No unrelated refactor.
* No terminal/project-tree behavior changes.
* No persisted settings schema change.
* Dependency and lockfile changes are limited to Mantine and its required transitive updates.
* Manual UI verification items are listed for the user.

## Technical Approach

1. Add Mantine dependencies:
   * `@mantine/core`
   * `@mantine/hooks`
2. Import `@mantine/core/styles.css` once near the React entry.
3. Create a small Mantine provider bridge component in `src/components/ui/` or `src/lib/`:
   * read theme/font settings from `useSettingsStore`.
   * compute Mantine `defaultColorScheme`/`forceColorScheme` from existing resolved theme.
   * define a minimal theme with app font family and primary color tokens.
4. Wrap `<App />` with the provider in `src/main.tsx`.
5. Migrate `GeneralSettingsPage` to Mantine components only where it is straightforward and behavior-preserving.
6. Keep existing local `src/components/ui/*` components for other pages during the trial.

## Decision (ADR-lite)

**Context**: The design task selected Mantine as the full UI framework, but also identified high-risk terminal/project-tree areas that should remain custom.

**Decision**: Implement a Mantine trial with provider/theme bridge and General Settings page migration only.

**Consequences**: This introduces Mantine with a narrow blast radius. If the visual fit is good, later tasks can migrate Theme Settings and Stats shell. If not, rollback is limited to provider/dependency removal and one page migration.

## Out of Scope

* Replacing all shadcn/Radix local components.
* Migrating Theme Settings, Stats Panel, Settings Modal shell, Sidebar, ProjectTree, TerminalTabs, SplitTerminalView, or XTermTerminal in this task.
* Changing backend/Tauri commands.
* Changing persisted settings schema or migration functions.
* Starting the desktop app for AI-side visual verification.

## Technical Notes

* Source design PRD: `.trellis/tasks/06-09-design-ui-system-improvements/prd.md`.
* Existing dependencies already include Tailwind, Radix primitives, CVA, clsx, tailwind-merge, lucide, sonner, ECharts, and Zustand.
* Existing React entry is `src/main.tsx`.
* Existing settings page target is `src/components/settings/pages/GeneralSettingsPage.tsx`.
* Project frontend spec constraints:
  * keep settings tab ids stable.
  * prefer existing/shared patterns before duplicating code.
  * manual runtime UI verification is required for desktop visual behavior.
