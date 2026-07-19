# optimize-network-resource-card

## Goal

Update the System Resources network card so it shows current upload/download speed and today's cumulative upload/download traffic in a compact layout matching the provided reference image, without adding unnecessary CPU or memory overhead.

## Changelog Target

[TEMP]

## What I Already Know

- User wants the network card to show current download/upload speed and today's cumulative traffic.
- Reference image shows a compact card with a trend chart on the left and two stacked rate/total rows on the right.
- Existing implementation already has `SystemResourcesPanel`, `useSystemResources`, and Rust `system_resources_get_snapshot`.
- Existing backend uses the open-source `sysinfo` crate (`0.39.5`) for network counters.
- Current backend exposes `uploadBytesPerSec`, `downloadBytesPerSec`, `totalUploadedBytes`, and `totalDownloadedBytes`, but the total values are system/runtime cumulative counters, not today's cumulative traffic.
- Current network sampling is affected by the shared expensive-refresh throttle, so displayed speed can be averaged over a long interval instead of reflecting the current sample cadence.
- Repo state before implementation: branch is 1 commit ahead and 14 commits behind `origin/master`, with a dirty working tree. User explicitly confirmed to proceed in the current worktree.

## Requirements

- Network card must display current upload speed and current download speed.
- Network card must display today's cumulative upload and download traffic.
- UI should follow the provided reference: trend chart plus right-side stacked upload/download details.
- Sampling must run only when the System Resources panel/card is active.
- Do not add a new dependency unless the existing stack cannot provide the data.
- Keep the backend response backward-compatible by adding fields instead of removing existing network fields.
- Keep user-visible text in `src/lib/i18n.ts` for both `zh-CN` and `en-US`.

## Acceptance Criteria

- [x] Network card shows current upload/download speed when network data is available.
- [x] Network card shows today's upload/download cumulative traffic separately from all-time totals.
- [x] Network card layout matches the reference direction: compact chart left, metrics right.
- [x] Network sampling does not refresh CPU/process/disk/GPU data when only the network card needs updates.
- [x] TypeScript type check passes.
- [x] Rust `cargo check` passes if backend code is changed.
- [x] `CHANGELOG.md` and `docs/功能清单.md` are updated for the user-visible behavior change.

## Technical Approach

Use the existing `sysinfo` network counters instead of adding another library:

- Use `NetworkData::received()` / `NetworkData::transmitted()` for bytes since the last network refresh, divided by elapsed seconds for current download/upload speed.
- Use `NetworkData::total_received()` / `NetworkData::total_transmitted()` as raw cumulative counters.
- Store a tiny in-memory daily baseline in `ResourceCollector`; today's cumulative traffic is `current_total - day_baseline`.
- Reset the baseline when local date changes.
- Keep network refresh separate from expensive CPU/process/disk refresh throttling so the network card can update at the panel interval without waking heavy collectors.

## Research References

- [`research/network-sampling.md`](research/network-sampling.md) - Existing `sysinfo` counters are sufficient and cheaper than adding a new dependency; direct Windows API is a fallback only if cross-platform behavior is dropped.

## Decision (ADR-lite)

**Context**: The user explicitly asked for an open-source solution that does not consume unnecessary CPU or memory.

**Decision**: Reuse the existing open-source `sysinfo` crate and keep the collector gated by visible card options. Do not introduce a new crate or direct Windows API path for this task.

**Consequences**: Minimal added memory: one daily baseline and day key. Minimal added CPU: network refresh only while the panel is active. Today's cumulative traffic is app-observed for the current day; if the app starts after midnight, it cannot reconstruct traffic before the first sample without adding OS-specific persistence/history APIs.

## Out of Scope

- Persisting daily traffic across app restarts.
- Reconstructing OS-level traffic since midnight before the app was opened.
- Per-adapter traffic breakdown.
- Adding a third-party charting or telemetry dependency.

## Technical Notes

- Impact analysis via GitNexus could not find `NetworkCard` or `system_resources_get_snapshot`, likely because these resource-monitor files are currently untracked and not in the GitNexus index.
- Implementation proceeded after user confirmation despite the stale/dirty baseline. No pull/merge was performed.
- Verification: `npx tsc --noEmit`, `cargo check`, and `cargo test system_resources --lib` passed.
