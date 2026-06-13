# Add Terminal Scrollback Setting

## Goal

Allow users to configure the built-in terminal scrollback length from Terminal Settings, so Codex and Claude sessions can retain more visible terminal history without changing CLI behavior.

## Requirements

* Add a terminal setting for scrollback rows.
* Minimum value: 1000 rows.
* Maximum value: 50000 rows.
* Default value: 5000 rows.
* Place the setting in the existing Terminal Settings / terminal behavior area.
* Add a small question-mark style help icon beside the setting.
* The help tooltip must communicate:
  * Higher row counts increase memory usage per terminal.
  * Running many Codex/Claude terminals at once makes the impact more obvious.
  * Codex TUI clear/redraw behavior may not fully enter scrollback, but normal scrollback should improve.

## Acceptance Criteria

* [x] New installs/default settings keep 5000 scrollback rows.
* [x] User can set values from 1000 to 50000 rows.
* [x] Built-in xterm terminal uses the configured value instead of a hardcoded 5000.
* [x] Tooltip is available from a compact help icon near the setting label.
* [x] Type checking passes.

## Definition of Done

* Implementation follows existing settings store and Mantine settings-page patterns.
* Existing unrelated terminal behavior is not refactored.
* Verification is done with static checks or focused inspection.

## Out of Scope

* Unlimited scrollback.
* Full transcript persistence/export.
* Changing Codex or Claude CLI context behavior.
* Rewriting terminal rendering or PTY output handling.

## Technical Notes

* Existing xterm creation uses `scrollback: 5000` in `src/components/XTermTerminal.tsx`.
* Existing settings live in `src/stores/settingsStore.ts`.
* Existing terminal settings UI lives in `src/components/settings/pages/ThemeSettingsPage.tsx`.
