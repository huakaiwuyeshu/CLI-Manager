# optimize system resource monitor

## Goal

Optimize the newly added system resource monitor so it remains cheap when enabled across Windows, Linux, and macOS, while preserving the current UI and default-off behavior.

Changelog Target: [TEMP]

## Requirements

- Keep the resource monitor default disabled.
- Avoid collecting expensive resource categories when their cards are hidden.
- Avoid duplicate heavy polling between the CPU toolbar indicator and the full resource panel.
- Reduce full-process sampling cost by avoiding task/thread scanning and by formatting command strings only for the top processes shown.
- Refresh expensive categories less frequently than CPU/memory and reuse the last sampled values between heavy refreshes.
- Fix disk read/write rate semantics so `/s` values are based on elapsed sampling time.

## Acceptance Criteria

- [ ] Disabled monitor triggers no resource polling.
- [ ] CPU toolbar indicator uses lightweight CPU-only polling.
- [ ] Full panel requests only visible resource categories.
- [ ] Hidden process/disk/network/GPU cards do not trigger their expensive backend sampling.
- [ ] Process sampling excludes task/thread collection and only formats commands for displayed rows.
- [ ] Disk read/write rates are divided by elapsed seconds.
- [ ] `cd src-tauri && cargo check` passes.
- [ ] `cd src-tauri && cargo test system_resources` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `git diff --check` passes.

## Notes

- No new dependencies.
- Keep existing panel layout and i18n copy unless a small wording update is necessary.
- Existing system resource command may accept additional option fields; keep old `fullDetail` callers compatible.
