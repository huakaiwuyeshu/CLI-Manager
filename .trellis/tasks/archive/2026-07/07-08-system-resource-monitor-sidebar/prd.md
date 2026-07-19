# system resource monitor sidebar

## Changelog Target

[TEMP]

## Goal

Add an optional terminal sidebar system resource monitor with theme-following visuals and a fixed CPU cat indicator at the bottom of the terminal action rail.

## Requirements

* Add a settings-controlled system resource monitor. When disabled, the app must not probe system resource data.
* Add a terminal side-panel entry for system resources that shows IP address, CPU total usage, per-core CPU usage, GPU usage when available, memory, network upload/download, disk usage, and top processes.
* Keep visuals compact and graphical, using existing terminal side-panel semantic colors instead of hard-coded panel colors.
* Add a CPU cat indicator fixed at the bottom of the terminal action rail. It is visible only when resource monitoring is enabled and updates from lightweight CPU sampling.
* Add the system resource button to existing terminal toolbar visibility/order settings. The panel modules remain fixed order for MVP.
* Use safe, low-overhead resource queries and avoid shelling out to parse command output.

## Acceptance Criteria

* [ ] Disabled setting hides the system resource entry and CPU cat, and no resource polling is scheduled.
* [ ] Enabled setting shows the CPU cat and allows opening the system resource panel from the terminal action rail.
* [ ] Full panel polls a complete snapshot at a slow interval and renders all requested categories with graceful unavailable states.
* [ ] GPU failures or unsupported OS behavior do not break the panel.
* [ ] Toolbar order and visibility migration preserve existing user settings and append the new entry.
* [ ] New user-visible strings are available in `zh-CN` and `en-US`.

## Technical Approach

* Backend: add a `system_resources` command module. Use `sysinfo` for CPU, memory, disk, network, and process data. Use a reusable in-process collector guarded by a mutex so CPU/process deltas are meaningful and repeated construction is avoided.
* Windows GPU: use PDH counters best-effort behind `cfg(target_os = "windows")`; return `null` if initialization or collection fails.
* IP address: use `local-ip-address` rather than parsing `ipconfig`.
* Frontend: add a typed resource-monitor hook and a `SystemResourcesPanel` using existing `StatCard`, `Donut`, `Sparkline`-style SVG/CSS patterns and `TERM_PANEL`.
* Terminal shell: extend `TerminalSidePanelTab`, toolbar button map, panel active state, resize widths, and settings migration.

## Out of Scope

* Per-module reorder inside the resource panel.
* Historical persistence of resource samples.
* Vendor-specific GPU APIs beyond Windows PDH best-effort.

## Technical Notes

* Existing terminal panel frame and skin variables live in `src/components/terminal/TerminalSidePanel.tsx` and `src/components/stats/termStatsUi.tsx`.
* Existing toolbar ordering is stored in `terminalToolbarOrder`; visibility is stored in `terminalToolbarVisibility`.
* Cargo should resolve exact dependency versions during implementation; do not hand-edit `Cargo.lock`.
