# OSS Command Suggestion Patterns

## Scope

Research reference for adding LLM-backed terminal command suggestions to CLI-Manager.

## Comparable Projects

| Project | Stars observed 2026-07-06 | License | Useful pattern |
| --- | ---: | --- | --- |
| `zsh-users/zsh-autosuggestions` | 35,806 | MIT | Fish-style inline ghost suffix; suggestions are accepted explicitly by user action. |
| `atuinsh/atuin` | 30,458 | MIT | Shell history is ranked with context and recency rather than plain prefix matching. |
| `cantino/mcfly` | 7,752 | MIT | Predictive shell history should remain local and fast, with clear fallback behavior. |
| `TheR1D/shell_gpt` | 12,164 | MIT | LLM shell assistant should constrain output to command text instead of explanations. |
| `sigoden/aichat` | 10,215 | Apache-2.0 | Multi-model CLI integrations need explicit model/base URL configuration and reusable prompt roles. |
| `charmbracelet/mods` | 4,529 | MIT | CLI AI assistance works best when streaming/explanation behavior is optional and command mode is concise. |

## Conventions To Borrow

- Show suggestions as ghost text and require explicit acceptance.
- Treat history/template/built-in commands as the always-available fast path.
- Keep model requests optional and configurable.
- Constrain prompt output to a single command string or strict JSON.
- Reject multi-line output and commands that do not continue the user's current prefix.
- Report slow models separately from failed models; slow models should not be silently treated as healthy.
- Track operational metrics so users can see whether the feature is worth keeping enabled.

## Mapping To CLI-Manager

- Existing ghost text rendering in `XTermTerminal.tsx` already matches the zsh/fish autosuggestion interaction model.
- Existing local source ranking should remain the fallback and should not be replaced by LLM calls.
- Rust/Tauri should own network calls so API keys are not handled by arbitrary UI code paths or browser CORS behavior.
- Settings UI should be dense and operational, not marketing-style: status pill, model test button, small metrics/charts, and prompt controls.

## Decision

Implement LLM command suggestions as an opt-in second phase with local fallback and strict safety validation. Do not add new dependencies; use current Rust `reqwest`, Zustand settings, Mantine controls, lucide icons, and existing CSS variables.
