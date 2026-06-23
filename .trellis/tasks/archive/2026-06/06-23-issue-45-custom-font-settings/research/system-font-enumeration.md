# Research: Cross-platform system font enumeration for Tauri 2 Rust desktop app

- **Query**: Research cross-platform system font enumeration approaches for a Tauri 2 Rust desktop app. Focus on Windows, macOS, Linux, and whether/how WSL fonts should be included. Compare 2-4 practical approaches (font-kit/fontdb/fontconfig/native directory scan/PowerShell fc-list etc.), note dependency and reliability trade-offs, map to CLI-Manager constraints.
- **Scope**: mixed
- **Date**: 2026-06-23

## Findings

### Files Found

| File Path | Description |
|---|---|
| `.trellis/tasks/06-23-issue-45-custom-font-settings/prd.md` | Task PRD for issue #45; records requirement to customize app/terminal fonts, system font library support for windows/wsl/mac/linux, graceful fallback, and WSL open question. |
| `src/stores/settingsStore.ts` | Persisted settings include `fontFamily` for terminal font and `uiFontFamily` for app UI font; defaults are currently CSS font-family strings. |
| `src/App.tsx` | Applies `uiFontFamily` to document CSS variables and global font-family override, while explicitly reverting `.xterm` so app UI font does not override terminal font. |
| `src/components/settings/pages/GeneralSettingsPage.tsx` | Current app font selector is a fixed Mantine `Select` option list with custom-current preservation. |
| `src/components/settings/pages/ThemeSettingsPage.tsx` | Current terminal font selector is a fixed option list (`Cascadia Code`, `JetBrains Mono`, `Fira Code`, `Consolas`, `Courier New`) with custom-current preservation and live preview. |
| `src-tauri/Cargo.toml` | Current Rust dependencies do not include font enumeration crates; adding one would be a new Rust dependency. |
| `src-tauri/src/lib.rs` | Tauri commands are registered centrally in `invoke_handler![]`; PRD notes no font enumeration command exists yet. |
| `.trellis/spec/frontend/state-management.md` | Spec states user preferences are managed by Zustand plus `tauri-plugin-store`, and `settingsStore.ts` is the persisted settings store for theme/font/terminal background/shortcuts. |

### Code Patterns

- Existing app font persistence fields are simple strings, not structured font records: `fontFamily: string; uiFontFamily: string;` in `src/stores/settingsStore.ts:143-144`, with defaults at `src/stores/settingsStore.ts:202-204`.
- App UI font application is already centralized in `App.tsx`: it writes `--font-ui-sans`, `--font-ui-mono`, `documentElement.style.fontFamily`, and a `<style id="ui-font-family-override">`; `.xterm, .xterm *, .xterm-helper-textarea` are set to `font-family: revert !important` at `src/App.tsx:503-535`.
- Current terminal font settings UI builds options from a hard-coded list and prepends `当前自定义（保留）` when the stored value is not one of them at `src/components/settings/pages/ThemeSettingsPage.tsx:43-49` and `src/components/settings/pages/ThemeSettingsPage.tsx:133-142`.
- Current app font settings UI follows the same fixed-options plus custom-current pattern in `src/components/settings/pages/GeneralSettingsPage.tsx:477-482`, with the actual `Select` at `src/components/settings/pages/GeneralSettingsPage.tsx:550-560`.
- New backend font enumeration would need command exposure through `src-tauri/src/lib.rs:308-379` because all Tauri commands are registered in `invoke_handler![]`.

### Related Specs

- `.trellis/tasks/06-23-issue-45-custom-font-settings/prd.md` — requirement and acceptance criteria for custom app/terminal font settings and system font enumeration.
- `.trellis/spec/frontend/state-management.md` — documents settings persistence pattern via `settingsStore.ts` and `tauri-plugin-store`.

## Practical Approaches Compared

### Approach 1: `fontdb` (`Database::load_system_fonts`) in a Tauri command

**What it does**

`fontdb` is a Rust in-memory font database with CSS-like queries. Its upstream docs state it can load fonts from files, directories, and raw data; it can try to load system fonts; and system loading is implemented by scanning predefined directories rather than interacting with OS font APIs.

Concrete behavior from `fontdb 0.23.0` source:

- Supports Windows, Linux, and macOS at the API level (`load_system_fonts` docs in local crate source lines 389-399).
- Windows scans `%SYSTEMROOT%\Fonts`, then per-user `AppData\Local\Microsoft\Windows\Fonts` and `AppData\Roaming\Microsoft\Windows\Fonts` (`fontdb-0.23.0/src/lib.rs:401-421`).
- macOS scans `/Library/Fonts`, `/System/Library/Fonts`, `/System/Library/AssetsV2/com_apple_MobileAsset_Font*`, `/Network/Library/Fonts`, and `~/Library/Fonts` (`fontdb-0.23.0/src/lib.rs:424-450`).
- Linux with default `fontconfig` feature first parses fontconfig configuration and scans configured dirs; if that fails, falls back to `/usr/share/fonts`, `/usr/local/share/fonts`, `~/.fonts`, and `~/.local/share/fonts` (`fontdb-0.23.0/src/lib.rs:460-475`, `485-494`, `503-576`).
- It loads `ttf`, `otf`, `ttc`, and `otc` from directories recursively (`fontdb-0.23.0/src/lib.rs:299-304`).

**Dependency / build shape**

- Latest observed crate: `fontdb = "0.23.0"`; description: “A simple, in-memory font database with CSS-like queries.”
- Cargo features from `cargo info`: default = `std`, `fs`, `memmap`, `fontconfig`; `fontconfig` depends on `fontconfig-parser` and `fs`, not on the native C fontconfig library.
- Rust MSRV from `cargo info`: 1.60.
- Avoids native OS API bindings and avoids external commands.

**Reliability trade-offs**

- Strong portability and small integration surface.
- Does not ask Windows DirectWrite or macOS Core Text for installed font families, so it can miss fonts that are visible through platform APIs but not in scanned directories.
- On Linux, default feature parses fontconfig config files and configured directories, so it is closer to Linux desktop behavior than a hard-coded scan, but it still does not call the native fontconfig C library.
- Returns font faces; UI likely needs de-duplicated family names and possibly filtering/metadata for monospace choices.

**Fit for CLI-Manager constraints**

- Matches the PRD’s graceful-fallback model because failure/missing fonts can fall back to built-in options and current custom value.
- New Rust dependency is pure-Rust enough for Tauri distribution compared with native fontconfig bindings.
- Supports current string-based settings: backend can return family names, and frontend can convert selected family to CSS font-family string with existing fallbacks.
- Good candidate for MVP if “current host OS fonts” is sufficient and native-perfect enumeration is not required.

### Approach 2: `font-kit` (`SystemSource`) using platform font databases

**What it does**

`font-kit` provides a common interface over system font libraries. Its README states it delegates to system libraries and exposes platform font database “sources”:

- Core Text source on macOS.
- DirectWrite source on Windows.
- Fontconfig source on Unix-like systems.
- Filesystem, memory, and multi sources for other composition cases.

It supports finding fonts by name/attributes and loading/rasterizing glyphs, which is broader than simple enumeration. Example files include `examples/list-fonts.rs`; local source contains `src/source.rs`, `src/sources/directwrite.rs`, `src/sources/core_text.rs`, and `src/sources/fontconfig.rs`.

**Dependency / build shape**

- Latest observed crate: `font-kit = "0.14.3"`; description: “A cross-platform font loading library.”
- Rust MSRV from `cargo info`: 1.77.
- Features from `cargo info`: default includes `source`; optional `loader-freetype`, `source-fontconfig`, `source-fontconfig-dlopen`, `source-fontconfig-default`.
- README notes FreeType loader and Fontconfig source are not built by default on Windows/macOS; `source-fontconfig-default` is “rarely what you want” on those two platforms.

**Reliability trade-offs**

- Best semantic match for “system fonts” because it can use Windows DirectWrite and macOS Core Text rather than directory assumptions.
- Bigger dependency and conceptual surface than font listing needs; includes font loading/rendering machinery not obviously required for CLI-Manager’s settings dropdown.
- Unix/Linux behavior may depend on fontconfig source and native library availability/features. Need care for Tauri build and distribution, especially cross-compiling and Linux packages.
- If only family enumeration is needed, this may be higher capability than necessary.

**Fit for CLI-Manager constraints**

- Strong if the requirement is “match what the OS font picker/app APIs see” on Windows/macOS.
- Less minimal than `fontdb` for a settings feature; adds more platform-specific behavior and dependencies to the Rust backend.
- Still maps cleanly to a Tauri command returning family names and maybe postscript/family metadata.

### Approach 3: `fontconfig` crate or `fc-list` on Linux/WSL

**What it does**

Fontconfig is the Linux/Unix desktop font discovery and matching system. The `fc-list` manual says `fc-list` “lists fonts and styles available on the system for applications using fontconfig,” and examples include listing all font faces and printing `family`, `style`, `file`, and `spacing` properties. The fontconfig user guide describes it as a library for system-wide font configuration, customization, application access, and nearest matching.

Rust `fontconfig = "0.11.0"` is a safe higher-level wrapper around the native Fontconfig library for locating fonts on UNIX-like systems. Its docs/source state:

- Requires Fontconfig installed.
- Optional `dlopen` feature or `RUST_FONTCONFIG_DLOPEN=on` loads the library at runtime rather than link time.
- Provides `Fontconfig::new()`, `find`, `Pattern`, and `list_fonts` (`fontconfig-0.11.0/src/lib.rs:3-6`, `30-42`, `48-57`, `715-718`).

**Dependency / build shape**

- `fontconfig` crate depends on native Fontconfig availability (or runtime dlopen). This is normal on Linux desktops but not a Windows/macOS solution.
- `fc-list` via subprocess depends on the command being installed and available on PATH. It introduces command execution/parsing and, on Windows host, possible console/window concerns unless using existing silent process helpers.

**Reliability trade-offs**

- Most reliable for Linux and WSL distributions where fontconfig is present, because it reflects fontconfig-visible fonts and user config.
- Not cross-platform by itself.
- `fc-list` output parsing can vary by locale/format unless using explicit format strings such as `fc-list --format '%{family}\n'` and de-duplicating comma-separated family lists.
- Native crate linking/runtime library failures need graceful handling. Subprocess failures also need graceful handling.

**Fit for CLI-Manager constraints**

- Useful as a Linux-specific implementation or fallback if `fontdb` is considered too approximate on Linux.
- Less attractive as the single cross-platform mechanism because CLI-Manager is a Windows-focused Tauri desktop app and currently avoids unnecessary native dependencies where possible.
- Could be relevant for WSL-specific enumeration only if the product explicitly wants fonts installed inside WSL distros, not just host Windows fonts.

### Approach 4: Manual native directory scan / external command orchestration

**What it does**

Implement scanning directly in CLI-Manager without a font crate: read known font directories per OS, filter font file extensions, parse names using a small parser such as `ttf-parser` or use file names as weak labels. Directory sets would mirror common locations:

- Windows: `%SYSTEMROOT%\Fonts`, `%USERPROFILE%\AppData\Local\Microsoft\Windows\Fonts`, `%USERPROFILE%\AppData\Roaming\Microsoft\Windows\Fonts`.
- macOS: `/Library/Fonts`, `/System/Library/Fonts`, `/System/Library/AssetsV2/...`, `/Network/Library/Fonts`, `~/Library/Fonts`.
- Linux: `/usr/share/fonts`, `/usr/local/share/fonts`, `~/.fonts`, `~/.local/share/fonts`, plus XDG/fontconfig-configured dirs if implemented.

External command variants:

- Linux/WSL/macOS if installed: `fc-list` with explicit `--format`.
- Windows PowerShell can enumerate files in Windows Fonts directories, but Windows installed font display names are better represented through registry/DirectWrite than raw file names; pure PowerShell directory listing is not equivalent to OS font enumeration.

**Dependency / build shape**

- Few or no crate dependencies if only scanning; `ttf-parser` would be needed for reliable family names.
- External commands add no Rust crate dependency but add runtime availability and parsing dependencies.

**Reliability trade-offs**

- Highest control, lowest dependency, but most implementation detail and platform edge cases.
- Raw file names are not user-facing family names; parsing `name` tables is needed for usable UI.
- Duplicates and collections (`.ttc`) need handling.
- Equivalent to reimplementing a subset of `fontdb` unless special behavior is required.

**Fit for CLI-Manager constraints**

- Only compelling if avoiding new crates is more important than correctness and implementation time.
- For CLI-Manager’s MVP, it overlaps strongly with `fontdb` but with more project-owned code.
- External command execution should be treated cautiously because the app already centralizes hidden process spawning on Windows via helper patterns; command availability is not guaranteed.

## WSL Font Inclusion

### What “WSL fonts” can mean

1. **Linux build of CLI-Manager running inside WSL**: enumerate the Linux environment’s fonts. In this case, normal Linux approaches (`fontdb` Linux path/fontconfig parsing, `fontconfig` crate, or `fc-list`) apply.
2. **Windows Tauri desktop app enumerating host Windows fonts for its own WebView/xterm UI**: host Windows fonts are what the WebView and xterm can normally use by CSS family name. WSL distro fonts are not automatically installed into Windows font APIs.
3. **Windows Tauri desktop app additionally inspecting WSL distros**: possible via `wsl.exe`/interop or UNC paths, but these fonts may not be usable by the Windows WebView unless also installed or referenced via accessible font files/CSS `@font-face`, which is outside the PRD’s stated scope (“no font download/install/manager”).

### WSL access notes

Microsoft WSL docs describe cross-filesystem access between Windows and Linux and WSL interop. In practice, enumerating WSL fonts from Windows would require one of:

- Running `wsl.exe -d <distro> fc-list --format ...` and parsing output for each distro.
- Reading distro files through `\\wsl$\<distro>\...` or `\\wsl.localhost\<distro>\...` and scanning Linux font dirs.

### Trade-off for this task

- Including WSL distro fonts in a Windows app’s regular font dropdown can be misleading unless those fonts are actually usable by the Windows WebView/xterm CSS stack.
- The PRD already contains the temporary assumption: “WSL” is preferably interpreted as Linux-runtime font dirs first; Windows-host extra WSL scanning can be future enhancement (`.trellis/tasks/06-23-issue-45-custom-font-settings/prd.md:17-24`).
- For CLI-Manager constraints, the cleanest mapping is:
  - **MVP**: enumerate current host OS fonts only.
  - **Linux/WSL runtime**: Linux enumeration naturally covers WSL distro fonts because the process is running in that environment.
  - **Windows host extra WSL distros**: keep out of MVP or expose separately with clear labeling, because availability does not imply CSS usability in the Windows app.

## CLI-Manager Mapping

### Data shape implications

The current persisted values are CSS `font-family` strings. Enumeration can return a lightweight list such as:

- `family`: user-facing family name, e.g. `Cascadia Code`.
- `source`: `system` / `builtin` / maybe `wsl:<distro>` if ever supported.
- Optional `monospace` or `spacing` metadata if available; fontconfig exposes `spacing`, but cross-platform crates may not uniformly classify monospace.

Frontend can preserve current behavior by merging:

1. Built-in recommended fonts.
2. Current saved custom value if absent.
3. System-enumerated family names.

### Approach summary for this project

| Approach | Windows | macOS | Linux | WSL handling | Dependency profile | Reliability profile | CLI-Manager fit |
|---|---|---|---|---|---|---|---|
| `fontdb` | Directory scan of system + user font dirs | Directory scan of standard font dirs and Apple font assets | Fontconfig config parsing plus fallback dirs | Natural only when running in Linux/WSL; no Windows-host WSL distro scan | Rust crate; default pure-Rust fontconfig parser; no native fontconfig C lib | Good enough for dropdowns; may miss API-only/platform-managed fonts | Strong MVP fit |
| `font-kit` | DirectWrite source | Core Text source | Fontconfig source/filesystem source depending features | Natural only when process is in Linux/WSL unless custom source added | Larger crate; platform backends; possible native/fontconfig feature care | Closest to OS-visible fonts on Windows/macOS | Best fidelity, more integration weight |
| `fontconfig` crate / `fc-list` | Not primary | Not primary, unless fontconfig installed | Native Linux fontconfig | Good for WSL via Linux runtime or `wsl.exe fc-list` | Native lib or external command | Best Linux/fontconfig fidelity, weaker portability | Linux-specific supplement, not single solution |
| Manual scan / commands | Known dirs or PowerShell file/registry scan | Known dirs | Known dirs or `fc-list` | Possible through `wsl.exe` or `\\wsl$` | Low crate deps, more custom code/runtime command deps | Depends on implementation; easy to miss metadata | Only if avoiding crates or adding explicit WSL enhancement |

## External References

- [`fontdb` crate docs / README](https://docs.rs/fontdb/) — documents in-memory font database, system font loading by predefined directory scan, CSS-like queries, and non-goals.
- [`fontdb` source](https://github.com/RazrFalcon/fontdb) — local downloaded source inspected for exact Windows/macOS/Linux directory behavior and Linux fontconfig parser fallback.
- [`font-kit` README](https://github.com/servo/font-kit) — documents DirectWrite/Core Text/Fontconfig/filesystem sources and loaders, plus feature guidance.
- [`font-kit` crate](https://crates.io/crates/font-kit) — package metadata and feature set (`source`, `loader-freetype`, `source-fontconfig`, `source-fontconfig-dlopen`).
- [`fontconfig` crate docs/source](https://docs.rs/crate/fontconfig) — safe wrapper around native Fontconfig for Unix-like systems, requires Fontconfig installed or `dlopen` runtime loading.
- [`fc-list(1)` manual](https://man.archlinux.org/man/fc-list.1.en) — states `fc-list` lists fonts/styles available for applications using fontconfig and supports formatted output.
- [Fontconfig user guide](https://fontconfig.pages.freedesktop.org/fontconfig/fontconfig-user.html) — describes fontconfig as system-wide font configuration/customization/application access and matching library.
- [Microsoft WSL file systems docs](https://learn.microsoft.com/en-us/windows/wsl/filesystems) — relevant to Windows/Linux filesystem access boundaries for any future Windows-host WSL scanning.
- [Microsoft WSL interop docs](https://learn.microsoft.com/en-us/windows/wsl/interop) — relevant to invoking Linux commands from Windows through WSL for future `wsl.exe fc-list` style enumeration.

## Caveats / Not Found

- No existing backend font enumeration command was found in `src-tauri/src/lib.rs` or `src-tauri/src/commands`; PRD also notes this.
- No existing Rust font dependency was found in `src-tauri/Cargo.toml`.
- Browser/WebView CSS usability of WSL-only fonts from a Windows host is not established by enumeration alone; extra WSL listing should not be treated as equivalent to installed Windows fonts.
- External docs fetching for some pages was partially limited by network/browser rendering, so crate behavior was cross-checked through `cargo info`, local downloaded crate source, and upstream README/source text where available.
- This report does not edit implementation files and does not decide final product scope; it maps options and constraints only.
