# resource-monitor-redesign

## Changelog Target

V1.2.7

## Goal

Redesign the terminal-side system resource monitor so it is compact, follows the current side-panel/terminal theme instead of a fixed green look, and exposes the information the user needs: CPU, memory, network, disks, GPU, and top processes.

## What I Already Know

- User wants GPU and time-zone/sample rows removed from the system information card, but still wants a separately redesigned GPU statistics card.
- IP should get a copy icon.
- CPU cores should render 2 columns by default, 4 columns when there are more than 8 threads.
- Memory donut should use a thinner outer ring than the current implementation.
- Network upload/download trend should visually split directions like the provided reference: upload above center, download below center.
- Multiple disks should be merged into one disk card, while still showing current read/write speed.
- Process ranking should show top 5 only, with columns: CPU %, memory %, program/command, PID.
- Settings > Sidebar should support system-resource card visibility and ordering similar to realtime stats cards.
- Existing frontend files involved: `src/components/terminal/SystemResourcesPanel.tsx`, `src/hooks/useSystemResources.ts`, `src/stores/settingsStore.ts`, `src/components/settings/pages/SidebarSettingsPage.tsx`, `src/lib/i18n.ts`.
- Existing backend file involved: `src-tauri/src/commands/system_resources.rs`.

## Requirements

- Keep system resource sampling gated by `systemResourceMonitoringEnabled`.
- Remove GPU/time-zone/sample rows from the system information card.
- Add IP copy action in the system information card.
- Redesign panel colors around existing side-panel CSS variables, with primary/accent colors derived from the current side-panel/terminal theme, not hard-coded green dominance.
- CPU core grid uses 2 columns for up to 8 cores and 4 columns for more than 8 cores.
- Memory donut ring is thinner and closer to the reference proportions.
- Network chart renders upload and download in opposite directions around a center baseline.
- Disk card aggregates all disks for total used/available/total and shows read/write speeds.
- Add a dedicated GPU card with usage visualization and unavailable state.
- Process card shows exactly the top 5 rows in the requested column order and uses memory percentage.
- Add resource monitor card visibility/order settings.
- Maintain `zh-CN` and `en-US` i18n coverage for new or changed UI text.

## Acceptance Criteria

- [ ] System info card no longer shows GPU, time zone, or sample rows.
- [ ] IP copy button is present, accessible, and does nothing unsafe when IP is missing.
- [ ] CPU core layout switches to 4 columns when core count is greater than 8.
- [ ] Memory donut ring is visibly thinner than before.
- [ ] Network upload/download lines are separated above/below the center baseline.
- [ ] Disk card totals all disks and displays current read/write rates.
- [ ] GPU card exists and has a clear unavailable state.
- [ ] Top processes render no more than 5 rows with CPU %, memory %, command/name, PID.
- [ ] Settings > Sidebar can hide/show and reorder resource monitor cards.
- [ ] `npx tsc --noEmit` passes.
- [ ] `cd src-tauri && cargo check` passes.

## Out of Scope

- No new third-party dependencies.
- No new OS-level permissions beyond current system resource collection.
- No runtime Tauri desktop launch by the agent; manual UI verification remains required.

## Technical Notes

- `sysinfo = 0.39.5` is already present.
- `sysinfo::Disk::usage()` provides per-disk `read_bytes` and `written_bytes` since last refresh.
- `sysinfo::Process::cmd()` can provide command details.
- `sysinfo::Process::memory()` returns bytes; process memory percent can be derived from total memory.
- Existing card-order pattern can be mirrored from `terminalStatsCardVisibility` and `terminalStatsCardOrder`.
