# LLM Command Input Suggestions

## Changelog Target

[TEMP]

## Goal

Add the second phase of terminal command suggestions: keep the existing local history/template/built-in command suggestions as the first layer, and add an optional LLM-powered command prediction layer as the second layer. When enabled, LLM suggestions are tried first and local suggestions are used only when the LLM request fails, times out, is unavailable, or returns an unsafe candidate.

## What I Already Know

- Current local command suggestions live in `src/lib/terminalInputSuggestions.ts`.
- `src/components/XTermTerminal.tsx` already renders ghost suffix text and accepts it with `Tab` / `Ctrl+Space`.
- Settings persistence lives in `src/stores/settingsStore.ts`.
- Current input suggestion settings are in `src/components/settings/pages/ThemeSettingsPage.tsx`; the requested target UI is a separate settings tab named `命令提示`, placed directly under Hook in the settings sidebar.
- User provided a test endpoint `https://cpa1.wuc0714.top/`, a model slug `gpt-5.3-codex-spark`, and an API key. The key must not be committed, logged, or stored in this task file.
- Live endpoint test results:
  - `/v1/models` is reachable in about 300ms.
  - The model list contains `GPT-5.3 Codex Spark`.
  - Generation calls tested against chat completions / responses returned 502 or exceeded 10s, so the current endpoint/model should be reported as unavailable or too slow by the app.
- Open source patterns reviewed:
  - `zsh-users/zsh-autosuggestions`: ghost suffix, explicit user acceptance.
  - `atuinsh/atuin` and `cantino/mcfly`: history/context-aware shell suggestion ranking.
  - `TheR1D/shell_gpt`, `sigoden/aichat`, `charmbracelet/mods`: shell assistant prompt constraints and OpenAI-compatible request patterns.

## Requirements

- Add configurable LLM command suggestions:
  - `baseUrl`
  - API key
  - model
  - enable/disable switch
  - built-in prompt switch
  - editable custom prompt when built-in prompt is disabled
- Move command suggestion settings into a standalone settings option named `命令提示`, directly below Hook in the settings sidebar.
- Detect the API endpoint from `baseUrl`: full `/v1/responses` uses Responses, full `/v1/chat/completions` uses Chat Completions, and root or `/v1` defaults to Chat Completions.
- Keep current local suggestions as the first layer.
- When LLM suggestions are enabled, use LLM as the second phase and prefer its result; fall back to local suggestions only on error, timeout, unavailable model, or unsafe output.
- Include a built-in prompt optimized for shell command suffix completion:
  - returns one command only
  - no markdown
  - no explanations
  - no newline command
  - command must continue the user's current input
  - safe-by-default and never auto-executed
- Add fast model availability detection:
  - send a minimal request
  - classify fast usable / slow not recommended / unavailable
  - show clear UI feedback
- Track usage:
  - request count
  - success count
  - failure count
  - fallback count
  - accepted count
  - success rate
  - average response time
  - token usage when provider returns usage
- UI must be concise, match existing settings style, and use high-contrast status colors and simple charts.
- Do not add a new dependency unless existing Mantine/lucide/CSS is insufficient.
- New user-visible text must support both `zh-CN` and `en-US`.

## Acceptance Criteria

- [ ] Settings sidebar contains a standalone `命令提示` option below Hook, with enable toggle, base URL, API key, model, prompt controls, test button, and usage summary.
- [ ] API key is not printed to console, not stored in docs, and not sent anywhere except the configured model endpoint.
- [ ] Model detection reports fast/slow/unavailable using measured response time and HTTP result.
- [ ] Given the provided endpoint/model, the app reports generation as unavailable or too slow based on real request evidence.
- [ ] Enabling LLM suggestions makes terminal input suggestions call the LLM layer first.
- [ ] If LLM fails or times out, existing local history/template/built-in suggestions still work.
- [ ] Suggested suffix is only shown when the returned command safely starts with the current input and is a single line.
- [ ] `Tab` / `Ctrl+Space` still insert only the suffix and never execute the command.
- [ ] Usage statistics update after request, fallback, failure, success, and accepted suggestion.
- [ ] `npx tsc --noEmit` passes.
- [ ] `cd src-tauri && cargo check` passes after backend changes.

## Definition of Done

- Code follows existing frontend Zustand/settings and Rust Tauri command patterns.
- Relevant docs are updated: `CHANGELOG.md` and `docs/功能清单.md`.
- GitNexus impact analysis is run before modifying indexed symbols and detect changes is run before final delivery.
- Manual verification notes cover settings UI, model test states, LLM fallback, local suggestion fallback, and accepted suggestion stats.

## Technical Approach

- Add a narrow Rust Tauri command module for OpenAI-compatible command suggestion requests and fast model checks. Keep secrets at the Rust boundary and never echo them back.
- Add settings fields plus migration validation in `settingsStore.ts`.
- Extend `terminalInputSuggestions.ts` to call the backend only when LLM is enabled and configuration is valid; keep local suggestion logic as fallback.
- Keep `XTermTerminal.tsx` changes minimal: pass enough context, record accepted suggestions, and preserve existing ghost rendering.
- Add a standalone command-suggestion settings page below Hook; remove the old reserved AI provider selector from `ThemeSettingsPage.tsx`.

## Out of Scope

- No automatic command execution.
- No remote prompt downloading at runtime.
- No dependency additions unless implementation proves existing UI/tools are insufficient.
- No cloud sync of API key or prompt settings.
- No broad terminal/autocomplete refactor.

## Technical Notes

- Changelog target is `[TEMP]` because no release version was provided.
- Current branch was merged with `origin/master` before implementation; conflicts in `CHANGELOG.md` and `docs/功能清单.md` were resolved by preserving both sides.
- Provided secret key is intentionally omitted from this file.
