# Command Suggestion Storage Controls

## Goal

Improve terminal command suggestions by keeping command history useful, hiding unfinished LLM prediction controls, and making local command-history storage visible and clearable from the command suggestion settings page.

## Changelog Target

[TEMP]

## What I already know

* User wants non-command input such as Chinese and other natural-language text excluded from command history because these are invalid commands.
* User wants LLM prediction hidden from settings for now because it is immature.
* User wants the command suggestion settings page to show how many commands are stored, how much storage they occupy, and provide a button to clear storage.
* Existing command history is stored in SQLite table `command_history`.
* Existing command history store already has `addCommand`, `getRecent`, `fetchAll`, and `cleanup`.
* Existing command suggestion settings page already shows LLM controls and AI usage stats.
* Frontend user-visible copy must use i18n keys for both `zh-CN` and `en-US`.

## Requirements

* Do not store terminal submissions that are clearly natural-language text rather than shell commands.
* Keep valid shell-like commands stored as before.
* Hide LLM prediction settings and model/prompt controls from the command suggestion settings page.
* Do not remove the underlying LLM code path in this task; only keep it disabled/hidden.
* Show command-history storage count and estimated storage size in command suggestion settings.
* Add a clear button in command suggestion settings that deletes stored command history.
* Update `CHANGELOG.md` under `[TEMP]`.
* Update `docs/功能清单.md` because product functionality changes.

## Acceptance Criteria

* [x] Typing and submitting Chinese or other natural-language text does not insert it into `command_history`.
* [x] Normal command submissions such as `npm run dev`, `git status`, `cd src`, and `/status` still enter command history.
* [x] Command suggestion settings no longer expose the LLM prediction toggle, model endpoint inputs, model test, or prompt editor.
* [x] Command suggestion settings displays stored command count and approximate storage usage.
* [x] Clicking clear storage removes all command-history rows and refreshes the displayed count/size.
* [x] `zh-CN` and `en-US` i18n entries are present for new visible text.
* [x] Type check passes or any inability to run it is explicitly reported.

## Definition of Done

* Minimal code changes, no new dependency.
* Existing local history/template/builtin suggestion behavior remains intact.
* Docs/notes updated for behavior changes.
* Risk and rollback considered before implementation.

## Out of Scope

* Redesigning the command suggestion UX.
* Removing backend LLM command suggestion IPC code.
* Adding database migrations.
* Implementing advanced shell parsing.

## Technical Notes

* `src/stores/commandHistoryStore.ts` owns command-history persistence.
* `src/components/XTermTerminal.tsx` records submitted input through `addCommand(getProjectId(), cmd)`.
* `src/components/settings/pages/CommandSuggestionSettingsPage.tsx` renders command suggestion settings.
* `src/stores/settingsStore.ts` owns LLM-related settings and currently defaults LLM disabled.
* `src/lib/i18n.ts` contains both Chinese and English dictionaries.
* `src-tauri/src/lib.rs` migration version 4 defines `command_history`.

## Technical Approach

Use the existing command-history store as the single persistence boundary:

* Add a small validity guard before `addCommand` inserts.
* Add a small stats method that queries command count and estimates storage from stored command text length.
* Reuse existing `cleanup` for clearing storage, refreshing stats afterward.
* Hide LLM settings UI while keeping defaults disabled and existing data untouched.

## Decision (ADR-lite)

Context: The current feature is useful locally but LLM prediction and polluted natural-language history reduce quality.

Decision: Keep local history/template/builtin suggestions, hide LLM controls, and add simple command-history stats/clear controls in settings.

Consequences: This avoids schema changes and large refactors. The natural-language filter will be intentionally conservative and may not catch every invalid input, but it should avoid blocking normal command usage.
