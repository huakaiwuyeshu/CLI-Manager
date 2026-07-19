# Add Microsoft YaHei terminal font option

## Goal

Add Microsoft YaHei as a selectable terminal font family option with the smallest possible frontend change.

## What I already know

* User wants the terminal font family list to include 微软雅黑 / Microsoft YaHei.
* The terminal font selector is in `src/components/settings/pages/ThemeSettingsPage.tsx` as `FONT_FAMILY_OPTIONS`.
* The persisted setting key is `fontFamily` in `src/stores/settingsStore.ts`.
* Existing custom values are preserved by `isCustomFontFamily`, so adding an option does not require a migration.

## Requirements

* Add one terminal font family option for Microsoft YaHei.
* Do not change the current default font family.
* Do not change terminal rendering logic, settings schema, or persisted key names.

## Acceptance Criteria

* [ ] Settings > 终端设置 > 终端字体族 includes a Microsoft YaHei / 微软雅黑 option.
* [ ] Selecting it stores a valid CSS font-family string and updates the existing terminal font hot-update path.
* [ ] Existing custom font values remain preserved.
* [ ] `npx tsc --noEmit` passes.

## Definition of Done

* Frontend typecheck passes.
* Manual UI verification item is listed for the user because runtime Tauri UI is manually verified in this project.

## Technical Approach

Update only `FONT_FAMILY_OPTIONS` in `src/components/settings/pages/ThemeSettingsPage.tsx` and add a single option:

```ts
{ value: "\"Microsoft YaHei\", \"Cascadia Code\", Consolas, monospace", label: "微软雅黑" }
```

This keeps fallback monospace fonts after Microsoft YaHei and reuses the existing `update("fontFamily", value)` path.

## Decision (ADR-lite)

**Context**: The app already stores terminal font family as a raw CSS font-family string and renders options from a local constant.

**Decision**: Add one option to the existing constant instead of adding schema, migration, or new settings logic.

**Consequences**: Minimal risk. Microsoft YaHei is not a monospace font, so terminal alignment may be less strict if selected; fallback monospace fonts remain available.

## Out of Scope

* Changing the default terminal font.
* Detecting installed fonts.
* Adding a custom font picker.
* Changing xterm construction/hot-update behavior.

## Technical Notes

* Read `.trellis/spec/frontend/index.md`, `component-guidelines.md`, `state-management.md`, `quality-guidelines.md`, and `guides/code-reuse-thinking-guide.md`.
* GitNexus impact for `FONT_FAMILY_OPTIONS`: LOW, 0 direct callers / 0 affected processes reported.
* Relevant files inspected:
  * `src/components/settings/pages/ThemeSettingsPage.tsx`
  * `src/stores/settingsStore.ts`
