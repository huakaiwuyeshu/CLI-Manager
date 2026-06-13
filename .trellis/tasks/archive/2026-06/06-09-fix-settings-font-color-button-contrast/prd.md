# Fix settings font color button contrast

## Goal

Fix the General Settings “应用字体颜色” reset button so its label remains readable when the app primary color is applied.

## Requirements

- Keep the existing reset behavior: clear `uiTextColor` and return to theme-following text color.
- Make the “跟随主题” button text visibly contrast with its background.
- Limit the change to the settings UI style; do not change settings data flow, theme persistence, or terminal colors.

## Acceptance Criteria

- [ ] The “跟随主题” button label is visible in the screenshot scenario where custom UI text color is `#1c1f23`.
- [ ] Clicking the button still clears the custom application font color.
- [ ] No unrelated settings layout or behavior changes are introduced.

## Definition of Done

- Run TypeScript/static checks where practical.
- Do not start the Tauri desktop app; list manual UI verification items for the user.
- Keep the implementation minimal and localized.

## Technical Approach

Apply the same explicit light-primary visual treatment already used in `GeneralSettingsPage` for the active palette badge: light primary background/border with primary-colored text. This avoids Mantine `variant="light"` using identical generated custom color shades for both background and foreground.

## Decision (ADR-lite)

**Context**: `cliPrimary` is generated from a single app primary color, so Mantine light variants can lose shade contrast.
**Decision**: Override this specific reset button’s background, border, and text color locally.
**Consequences**: Minimal blast radius; other components are unaffected. If many `cliPrimary` light buttons are added later, theme-level shade generation can be revisited.

## Out of Scope

- Regenerating the global Mantine color scale.
- Changing application font color persistence or validation.
- Changing terminal font/theme behavior.

## Technical Notes

- Relevant code: `src/components/settings/pages/GeneralSettingsPage.tsx`.
- Frontend specs read: `.trellis/spec/frontend/index.md`, `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/quality-guidelines.md`.
- Shared guide index read: `.trellis/spec/guides/index.md`.
- GitNexus impact on `GeneralSettingsPage`: LOW, 0 upstream impacts.
