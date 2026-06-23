# Research: Font selector UI patterns for React + Mantine settings

- **Query**: Research UI patterns for selecting installed fonts in a React + Mantine settings page. Focus on searchable Combobox/Select with async loading, current custom value preservation, fallback manual entry, preview text, performance for large font lists. Map to CLI-Manager's existing ThemeSettingsPage and settingsStore.
- **Scope**: mixed
- **Date**: 2026-06-23

## Findings

### Files Found

| File Path | Description |
|---|---|
| `src/components/settings/pages/ThemeSettingsPage.tsx` | Current terminal appearance/settings page; owns terminal font size, font family Select, shell Select, terminal preview, and theme search UI. |
| `src/stores/settingsStore.ts` | Persisted settings store; `fontFamily` is a persisted string and `update()` writes to `settings.json` via `tauri-plugin-store`. |
| `src/components/XTermTerminal.tsx` | Terminal consumer of `fontFamily`; xterm receives it at construction and hot-updates it without recreating the terminal. |
| `src/components/TerminalTabs.tsx` | Reads `fontFamily`/`fontSize` from `settingsStore` and passes them through to terminal render paths. |
| `src/App.tsx` | Applies `uiFontFamily`, not terminal `fontFamily`; useful boundary showing UI font and terminal font are separate. |
| `src-tauri/src/**/*.rs` | No existing installed-font enumeration command found by filename/content search for `font`, `font_family`, or installed fonts. |
| `.trellis/spec/frontend/component-guidelines.md` | Settings-page UI conventions: prefer Mantine controls and preserve settings/tab/storage contracts. |
| `.trellis/spec/frontend/state-management.md` | Store persistence conventions for Zustand + `tauri-plugin-store`; settings fields are persisted in `settings.json`. |
| `node_modules/@mantine/core/lib/components/Select/Select.d.ts` | Installed Mantine 9.3.1 Select API surface for searchable Select, controlled search, option rendering, empty message, and dropdown behavior. |
| `node_modules/@mantine/core/lib/components/Combobox/Combobox.types.d.ts` | Installed Mantine 9.3.1 shared Combobox-like props for filtering, option limit, scroll area, max dropdown height, and option submission. |
| `package-lock.json` | Confirms resolved Mantine core/hooks version is `9.3.1`. |

### Code Patterns

#### Current terminal font settings shape

- `ThemeSettingsPage.tsx` defines a static `FONT_FAMILY_OPTIONS` array with CSS font-family strings as `value` and user labels as `label` (`src/components/settings/pages/ThemeSettingsPage.tsx:43-49`).
- The page reads `fontFamily` from `settingsStore` (`src/components/settings/pages/ThemeSettingsPage.tsx:72-75`) and writes through the generic `update` action (`src/components/settings/pages/ThemeSettingsPage.tsx:79-80`).
- The current font Select is a Mantine `Select<string>` with `value={fontFamily}`, `data={fontFamilyOptions}`, `allowDeselect={false}`, and `onChange` that persists only non-null values via `update("fontFamily", value)` (`src/components/settings/pages/ThemeSettingsPage.tsx:334-344`).

#### Current custom value preservation

- Existing code already preserves a persisted `fontFamily` that is not in the static preset list: `isCustomFontFamily` checks for absence from `FONT_FAMILY_OPTIONS` (`src/components/settings/pages/ThemeSettingsPage.tsx:133-136`).
- When custom, the current raw value is prepended to the Select data as `{ value: fontFamily, label: "当前自定义（保留）" }` before static options (`src/components/settings/pages/ThemeSettingsPage.tsx:137-143`).
- A parallel pattern exists for custom default shell values: `isCustomShellValue` and `shellOptions` prepend `{ value: defaultShell, label: "当前自定义（保留）" }` (`src/components/settings/pages/ThemeSettingsPage.tsx:144-153`). This is the closest in-project pattern for preserving values not present in an async/default option source.

#### Preview text and live terminal behavior

- The sticky terminal preview includes two sections: a theme preview and a “实时字体预览” area (`src/components/settings/pages/ThemeSettingsPage.tsx:172-228`).
- The font preview applies the current persisted `fontFamily` and `fontSize` directly in inline style: `<Box style={{ fontFamily, fontSize: `${fontSize}px` }}>` (`src/components/settings/pages/ThemeSettingsPage.tsx:216-224`).
- Runtime xterm consumption supports live mutation: `XTermTerminal` checks whether `terminal.options.fontSize` or `terminal.options.fontFamily` changed, updates both options, and schedules a fit (`src/components/XTermTerminal.tsx:416-430`).
- Initial terminal creation also passes `fontSize` and `fontFamily` into `new Terminal({ ... })` (`src/components/XTermTerminal.tsx:466-477`).
- `.trellis/spec/frontend/component-guidelines.md` explicitly records that font-family changes should be hot-updated rather than recreate a terminal: xterm supports hot-mutating `fontSize`, `fontFamily`, `theme`, `cursorBlink`, `cursorStyle`, and `scrollback` (`.trellis/spec/frontend/component-guidelines.md:317-323`).

#### Store persistence mapping

- `settingsStore.ts` declares `fontFamily` as a persisted `string` in `Settings` (`src/stores/settingsStore.ts:137-145`).
- The default terminal font is `"Cascadia Code, Consolas, monospace"` (`src/stores/settingsStore.ts:196-204`).
- `load()` iterates all keys in `DEFAULTS` and reads them from `settings.json` (`src/stores/settingsStore.ts:453-461`). There is no current font-family-specific migration or validation; the persisted value is loaded as part of the generic entries object.
- `update()` persists any `Settings` key by `await s.set(key, value)` and then updates Zustand state with `{ [key]: value }` (`src/stores/settingsStore.ts:615-622`). A font selector can keep the existing storage contract by continuing to write `update("fontFamily", stringValue)`.

#### Existing settings UI conventions

- The frontend spec says settings pages in the current shell should prefer Mantine `Card`, `Stack`, `Group`, `TextInput`, `Select`, `Switch`, `SegmentedControl`, `Button`, `Modal`, and `Badge` for standard controls (`.trellis/spec/frontend/component-guidelines.md:208-235`).
- The same spec says not to rename persisted settings store fields or alter storage schema for settings visual work (`.trellis/spec/frontend/component-guidelines.md:237-244`). For this task, the relevant persisted key is `fontFamily`.
- State-management spec identifies `settingsStore.ts` as the persisted user-preferences store including theme/font/terminal settings (`.trellis/spec/frontend/state-management.md:7-14`).

### Mantine Select / Combobox API patterns

The installed version is Mantine `@mantine/core`/`@mantine/hooks` `9.3.1` (`package-lock.json:1563-1578`, `package-lock.json:1581-1587`). Relevant APIs are present locally:

#### Searchable Select

- `SelectProps` includes `searchable?: boolean` (`node_modules/@mantine/core/lib/components/Select/Select.d.ts:15-16`).
- Search input can be controlled with `searchValue?: string` and `onSearchChange?: (value: string) => void` (`node_modules/@mantine/core/lib/components/Select/Select.d.ts:25-30`). This maps to async loading/debounced filtering state in React.
- `nothingFoundMessage?: React.ReactNode` is available for empty/loading/error states (`node_modules/@mantine/core/lib/components/Select/Select.d.ts:23-24`).
- `openOnFocus?: boolean` is available for searchable Select (`node_modules/@mantine/core/lib/components/Select/Select.d.ts:47-50`).
- `onChange?: (value: Value | null, option: ComboboxItem<Value>) => void` gives both selected value and option object (`node_modules/@mantine/core/lib/components/Select/Select.d.ts:11-12`).

#### Custom option rendering and font preview rows

- `SelectProps` includes `renderOption?: (item: ComboboxLikeRenderOptionInput<ComboboxItem<Value>>) => React.ReactNode` (`node_modules/@mantine/core/lib/components/Select/Select.d.ts:41-42`).
- The shared render input exposes `option` and `checked` (`node_modules/@mantine/core/lib/components/Combobox/Combobox.types.d.ts:54-57`).
- This supports dropdown rows that render the font label and a sample string in that font family, while keeping `value` as the CSS font-family string.

#### Large list performance controls

- Shared `ComboboxLikeProps` has `filter?: OptionsFilter<Value>` for custom filtering/sorting (`node_modules/@mantine/core/lib/components/Combobox/Combobox.types.d.ts:43-44`).
- It has `limit?: number`, described as “Maximum number of options displayed at a time, `Infinity` by default” (`node_modules/@mantine/core/lib/components/Combobox/Combobox.types.d.ts:45-46`). This is the primary built-in control to avoid rendering all installed fonts at once.
- It has dropdown scroll controls: `withScrollArea?: boolean` default true and `maxDropdownHeight?: number | string` default `250` when scroll area is enabled (`node_modules/@mantine/core/lib/components/Combobox/Combobox.types.d.ts:47-50`).
- `SelectProps` also exposes `scrollAreaProps?: ScrollAreaProps` for dropdown scroll tuning (`node_modules/@mantine/core/lib/components/Select/Select.d.ts:41-44`).
- `@mantine/hooks` provides `useDebouncedValue` and `useDebouncedState` exports (`node_modules/@mantine/hooks/lib/index.d.ts:7-8`), which fit controlled `searchValue` if async font loading or filtering should wait until typing pauses.

#### Manual entry / free-form fallback

- Mantine `Select` is selection-only: its `onChange` value is `Value | null` from submitted options (`node_modules/@mantine/core/lib/components/Select/Select.d.ts:7-12`), and its data options must have unique values or rendering errors occur (`node_modules/@mantine/core/lib/components/Combobox/Combobox.types.d.ts:24-26`).
- Free-form manual entry therefore maps to either:
  - a separate `TextInput` that writes the same `fontFamily` setting, or
  - a custom `Combobox` composition that provides an input target and creates/submits an option from the typed query.
- CLI-Manager already uses a simple preservation fallback for unknown values in Select data (`ThemeSettingsPage.tsx:133-143`), but it does not currently provide a UI for typing a new arbitrary font-family string.

### Async installed font list mapping to current code

No backend or frontend source currently enumerates installed fonts:

- `Glob src-tauri/src/**/*font*` found no files.
- `Grep src-tauri/src` for `font`, `font_family`, and `installed` found no font-listing command; matches were unrelated hook installation status fields.

If an async font source is introduced, the current `ThemeSettingsPage` shape can consume it without changing the persisted store field:

1. Load installed fonts into component-local state because the spec prefers local state for ephemeral UI and `settingsStore` is for persisted preferences (`.trellis/spec/frontend/state-management.md:7-14`).
2. Keep `fontFamily` as the controlled selected value and continue persisting through `update("fontFamily", value)` (`src/components/settings/pages/ThemeSettingsPage.tsx:334-344`, `src/stores/settingsStore.ts:615-622`).
3. Build Select/Combobox data from: current custom value if missing, recommended fallbacks, and async installed fonts. The current custom-preservation pattern is already implemented for both font family and shell selection (`src/components/settings/pages/ThemeSettingsPage.tsx:133-153`).
4. Use Mantine `searchable`, controlled `searchValue`, `onSearchChange`, `limit`, `maxDropdownHeight`, `nothingFoundMessage`, and `renderOption` APIs from Mantine 9.3.1 for search, loading/empty states, bounded rendering, and sample rows.
5. Keep the existing preview area as the selected-font preview target because it already applies `fontFamily` and `fontSize` live (`src/components/settings/pages/ThemeSettingsPage.tsx:216-224`).

### External References

- [Mantine Select documentation](https://mantine.dev/core/select/) — Public docs for the installed component family; local Mantine 9.3.1 type definitions confirm relevant props: `searchable`, `searchValue`, `onSearchChange`, `nothingFoundMessage`, `renderOption`, `openOnFocus`.
- [Mantine Combobox documentation](https://mantine.dev/core/combobox/) — Public docs for custom Combobox composition when Select is not enough for free-form/manual entry behavior; local shared types confirm `filter`, `limit`, `withScrollArea`, and dropdown height props.
- [MDN: Window.queryLocalFonts()](https://developer.mozilla.org/en-US/docs/Web/API/Window/queryLocalFonts) — Browser Local Font Access API reference; relevant as a web-side installed-font source but has browser/permission availability caveats.
- [Chrome Developers: Local Font Access API](https://developer.chrome.com/docs/capabilities/web-apis/local-fonts) — Chromium capability reference for enumerating local fonts from web contexts; relevant to Tauri/WebView2 feasibility checks if frontend-side enumeration is considered.

### Related Specs

- `.trellis/spec/frontend/component-guidelines.md` — Mantine controls are preferred in settings pages; do not rename persisted store fields or tab IDs for visual/settings UI changes; terminal font changes should hot-update xterm rather than recreate it.
- `.trellis/spec/frontend/state-management.md` — Zustand + `tauri-plugin-store` persistence pattern; `settingsStore.ts` is where font/user preferences live, while local component state is appropriate for ephemeral UI such as async loading/search state.

## Caveats / Not Found

- No existing installed-font enumeration command exists in `src-tauri/src` based on filename/content searches. A font selector UI would need an async font source before it can list actual installed fonts.
- Browser-side installed-font enumeration through `queryLocalFonts()` is not guaranteed across all environments; MDN/Chrome docs should be treated as feasibility references, not proof that the current Tauri WebView2 runtime exposes the API with the needed permissions.
- Mantine `Select` supports searchable option selection and custom option rendering, but not arbitrary free-form value creation by itself. Manual fallback entry maps to a separate `TextInput` or a custom `Combobox` implementation.
- Mantine option `value` fields must be unique; installed font data should deduplicate CSS family strings before passing to Select/Combobox.
