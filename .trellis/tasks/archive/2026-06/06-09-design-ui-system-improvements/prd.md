# Design UI System Improvements

## Goal

Improve CLI-Manager's frontend visual quality by consolidating repeated hand-written UI patterns into a cleaner app-owned design system, while preserving the terminal-first desktop product feel and avoiding a risky full UI framework migration.

## What I already know

* The project is a React 19 + Tauri 2 desktop app using Tailwind CSS 4.
* Existing dependencies already include Radix primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, lucide icons, sonner, ECharts, xterm, dnd-kit, and Zustand.
* The codebase already has shadcn-style app-owned primitives under `src/components/ui/`, including `Button`, `Card`, `Input`, `Select`, `Switch`, `Dialog`, `ContextMenu`, and `Popover`.
* A large amount of visual styling still lives in `src/App.css`, including surface tokens, empty states, stats panel treatments, tab styling, tree styling, and terminal chrome.
* Settings pages are the best first target because they contain many standard form/layout patterns and are less coupled to terminal runtime behavior.
* Stats dashboard shell is a reasonable second target: keep ECharts, but standardize metric cards, filters, empty/loading states, and panel layout.
* Project tree and terminal tab/split interactions are high-coupling areas and should not be replaced with generic UI library widgets.

## Assumptions (temporary)

* The goal is visual polish and consistency, not a complete product redesign.
* The implementation should avoid adding a heavy full UI framework unless explicitly chosen.
* Existing theme palettes and terminal appearance behavior must remain intact.
* Runtime UI verification will be manual per project quality guidelines; AI should run static/build checks where relevant and list manual checks.

## Open Questions

* None.

## Requirements

* This task is design-only: produce a Mantine adoption plan without changing source code or installing dependencies.
* Chosen framework: Mantine.
* Chosen migration depth: design a phased Mantine adoption plan; do not implement in this task.
* Target standard UI surfaces first: settings pages, stats/dashboard shell, routine modals/popovers/tooltips, and repeated form/card patterns.
* Preserve existing settings tab ids such as `terminal-theme`; visual or label changes must not churn internal tab contracts.
* Keep terminal tabs, split terminal layout, xterm behavior, project tree drag/drop, and virtualization out of the framework migration scope.
* Prefer a bridge strategy where Mantine consumes existing app theme intent instead of replacing all palette/settings semantics.
* Avoid dependency additions unless a future implementation task explicitly approves package and lockfile changes.

## Acceptance Criteria

* [x] UI system direction is selected and documented.
* [x] Mantine is selected as the framework.
* [x] Design-only scope is explicit.
* [x] Out-of-scope high-risk areas are explicit.
* [x] Planned migration phases map to existing repeated UI patterns.
* [x] Static validation commands and manual UI checks are defined for future implementation.

## Definition of Done (team quality bar)

* TypeScript check passes where relevant: `npx tsc --noEmit`.
* Build/static checks are run if implementation changes frontend code.
* Manual UI verification checklist is provided for affected screens.
* No unrelated refactor or full-framework migration.
* No unapproved dependency or configuration changes.

## Research Notes

### What similar UI systems do

* shadcn/ui is an app-owned component approach built with TypeScript, Tailwind CSS, and Radix primitives.
* Mantine provides a broad React component set and `MantineProvider`; it manages light/dark color scheme through `data-mantine-color-scheme` and CSS variables.
* Ant Design v5 provides enterprise-class components through `ConfigProvider` theme tokens and supports CSS variable token mapping, but its enterprise/admin visual language is strong.
* MUI provides `ThemeProvider`, `CssBaseline`, `createTheme`, and CSS variables via `cssVariables`; its Material Design language is also strong.

### Constraints from this repo

* The app is a terminal-heavy desktop tool; generic SaaS web app styling may feel wrong.
* Terminal, split panes, drag overlays, project tree virtualization, and xterm appearance have project-specific behavior and should be protected.
* Existing palette settings and UI font settings are user-facing preferences, so a design refresh must respect persisted settings and migration rules.
* Project quality guidelines require manual runtime UI verification rather than AI-started desktop app checks.
* New dependencies require explicit approval and lockfile changes.

### Feasible framework choices here

**Approach A: Mantine for standard settings/dashboard surfaces** (Recommended)

* How it works: add Mantine, wrap the React app in `MantineProvider`, map existing theme mode/palette into Mantine theme tokens, and use Mantine for settings forms, cards, tabs, segmented controls, modals, tooltips, and dashboard filters.
* Pros: neutral modern style, broad component coverage, good dark/light support, less visually opinionated than Material/AntD, suitable for desktop utility UI.
* Cons: introduces a second component system beside existing Radix/shadcn primitives; theme bridging must be deliberate.

**Approach B: Ant Design for enterprise-style settings/dashboard**

* How it works: add Ant Design, use `ConfigProvider` theme tokens, and migrate standard controls to AntD components.
* Pros: very complete components, strong form/table/select/modal ecosystem, polished out of the box.
* Cons: enterprise web-admin feel may clash with terminal tool identity; heavier visual override work; CSS-in-JS/token integration must be managed.

**Approach C: MUI for Material-style settings/dashboard**

* How it works: add MUI, use `ThemeProvider`, `CssBaseline`, and CSS-variable theme mode, then migrate standard controls.
* Pros: mature, accessible, complete, strong theming.
* Cons: Material Design is visually distinctive and may make the app feel like a generic Google-style web app rather than a Windows terminal manager.

**Approach D: Revert to shadcn/Radix consolidation**

* How it works: no new full framework; continue expanding local components.
* Pros: lowest dependency and design-system conflict risk.
* Cons: user selected full framework MVP, so this is now only a fallback if dependency risk becomes unacceptable.

## Technical Approach

Design direction: introduce Mantine in a future implementation task as a standard UI layer for non-terminal surfaces, not as a replacement for CLI-Manager's terminal runtime UI.

### Phase 0: Dependency and theme bridge design

* Add Mantine only in a future implementation task after dependency approval.
* Wrap the React root with `MantineProvider` in the future implementation.
* Bridge existing settings-derived theme intent into Mantine theme values:
  * `themeMode` / resolved dark-light mode -> Mantine color scheme.
  * existing light/dark palettes -> Mantine primary/accent/surface-like tokens.
  * `uiFontFamily` -> Mantine font family.
* Keep existing CSS variables as the app shell and terminal source of truth during migration.

### Phase 1: Settings surfaces

* Replace repeated settings page layout patterns with Mantine equivalents:
  * sections/cards
  * form rows
  * selects
  * switches
  * segmented controls
  * radio/choice cards
  * tooltips/help text
* Keep `SettingsTab` ids stable.
* Do not change persisted settings schema unless a future task explicitly needs it.

### Phase 2: Stats/dashboard shell

* Keep ECharts and current chart data flow.
* Use Mantine for dashboard chrome:
  * metric cards
  * filter toolbar
  * date range inputs
  * empty/loading/error states
  * drawer/modal shell if needed

### Phase 3: Routine overlays and feedback

* Evaluate replacing routine dialogs/popovers/tooltips with Mantine components.
* Keep terminal-specific context menus and complex drag/drop overlays custom unless proven safe.
* Decide separately whether to keep `sonner` or move notification UI to Mantine notifications.

### Protected custom areas

* xterm construction/update behavior.
* Terminal tabs and split panes.
* Project tree virtualization and drag/drop collision behavior.
* Tauri runtime behavior and persisted settings migrations.

## Decision (ADR-lite)

**Context**: Current frontend already has Radix/Tailwind/shadcn-like primitives but still repeats visual patterns in feature components and `App.css`. The user prefers introducing a complete UI framework rather than only consolidating local primitives.

**Decision**: Use Mantine as the full UI framework for the MVP. Apply it to standard UI surfaces first, especially settings and stats/dashboard chrome, while preserving custom terminal, xterm, split-pane, drag/drop, and project-tree behavior.

**Consequences**: Mantine should speed up visual polish and standard controls, but it introduces a second component system beside the existing Radix/shadcn primitives. Theme bridging, dependency approval, lockfile changes, and manual UI verification are required.

## Out of Scope (explicit)

* Replacing xterm, terminal tabs, split pane behavior, or terminal drag/drop.
* Replacing the project tree with a generic TreeView.
* Migrating the entire app to Ant Design, MUI, Mantine, or another full UI framework without separate approval.
* Changing persisted settings schema unless explicitly needed and handled with migrators.
* Starting the Tauri desktop app for AI-side runtime verification.

## Technical Notes

* Relevant files inspected:
  * `package.json`
  * `src/App.css`
  * `src/components/ui/button.tsx`
  * `src/components/SettingsModal.tsx`
  * `src/components/settings/SettingsLayout.tsx`
  * `src/components/settings/pages/GeneralSettingsPage.tsx`
  * `src/components/stats/StatsPanel.tsx`
  * `src/components/sidebar/ProjectTree.tsx`
* Relevant Trellis specs read:
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/guides/code-reuse-thinking-guide.md`
* Relevant constraints:
  * Keep settings tab ids stable when changing labels/layout.
  * Prefer existing patterns and shared components before introducing new code.
  * Manual UI verification is required for visual/runtime desktop behavior.
