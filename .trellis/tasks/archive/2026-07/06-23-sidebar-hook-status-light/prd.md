# Sidebar Hook Status Light

## Goal

Add a compact Hook status breathing light to the sidebar footer so users can see Claude Code / Codex Hook installation health and jump to the correct action quickly.

## Requirements

* Sidebar footer shows a Hook breathing-light action near existing stats/settings actions.
* Overall color rules:
  * Gray: no applicable Hook is installed.
  * Yellow: at least one applicable Hook is partially installed or mixed installed/not installed.
  * Green: all applicable Hooks are installed.
* Applicability rule: only tools with detected/selected config directories count. If the user only has Claude Code or only Codex installed/detected, that one installed Hook is enough for green.
* Click behavior:
  * Green opens Settings > Hook settings.
  * Gray or yellow runs uninstall then install for applicable tools, then refreshes status.
* Reinstall behavior reuses existing Hook IPC commands and must not add new dependencies or backend installation logic.
* Errors should surface via existing toast style.

## Acceptance Criteria

* [ ] Sidebar collapsed and expanded footer both show the Hook status action.
* [ ] Claude-only installed returns green when Codex config is missing.
* [ ] Codex-only installed returns green when Claude config is missing.
* [ ] Partial Hook state returns yellow.
* [ ] No installed applicable Hook returns gray.
* [ ] Gray/yellow click performs uninstall then install for applicable tools and refreshes UI state.
* [ ] Green click opens the Hook settings tab.
* [ ] `npx tsc --noEmit` passes.

## Definition of Done

* Frontend implementation follows existing sidebar/settings patterns.
* Static/type checks pass or failures are explicitly reported.
* No unrelated files are changed.

## Technical Approach

Implement a small frontend-only sidebar component that calls `hook_settings_get_status`, derives an aggregate status from Claude/Codex tool status, and reuses `hook_settings_uninstall` / `hook_settings_install` plus Codex variants for reinstall.

## Decision (ADR-lite)

**Context**: Existing Hook install/status logic already lives behind Tauri IPC and Hook settings page consumes it.
**Decision**: Reuse IPC from a sidebar component instead of changing backend contracts.
**Consequences**: Minimal risk; duplicated frontend status typing may be a later extraction candidate if Hook status UI grows.

## Out of Scope

* Changing backend Hook install/uninstall semantics.
* Adding new settings persistence fields.
* Starting the Tauri app for runtime visual verification.

## Technical Notes

* Inspected `src/components/sidebar/SidebarFooter.tsx` for footer placement.
* Inspected `src/components/settings/pages/HookSettingsPage.tsx` for existing Hook IPC contract and status labels.
* Inspected `src-tauri/src/commands/hook_settings.rs` for status and default directory detection.
* GitNexus impact:
  * `SidebarFooter`: LOW, no upstream processes detected.
  * `HookSettingsPage`: LOW, no upstream processes detected.
