# Command Suggestion Completion Engine

## Goal

Expand terminal input suggestions from command-history/template/built-in text matching into a lightweight completion engine. It should suggest filesystem paths for examples like `cd D:/work/`, keep existing ghost-suffix UX, and add the highest-value autosuggestion behavior seen in fish/zsh without introducing a large UI or dependency change.

Changelog Target: `[TEMP]`

## Requirements

- Keep the current inline ghost suggestion UX and acceptance keys: `Tab`, right arrow, and `Ctrl+Space` insert only the suffix and never execute.
- Preserve current local sources: command history, command templates, built-in AI CLI commands, and optional AI second-phase suggestions.
- Add a filesystem path completion source that can suggest directories and files from the current command token.
- For `cd`, `chdir`, `Set-Location`, `sl`, `pushd`, and `popd`, suggest directories only.
- For common path-accepting commands such as `ls`, `dir`, `cat`, `type`, `code`, `notepad`, `python`, `node`, `npm`, `git`, `cargo`, `cp`, `mv`, and `rm`, suggest files and directories.
- Support absolute Windows paths, forward-slash paths, relative paths, `./`, and `../` based on the terminal session cwd.
- Update session cwd when a submitted `cd`-style command resolves to an existing directory, so later relative predictions follow the user's terminal location.
- Add a zsh `match_prev_cmd`-style history boost: when the last submitted command matches the command preceding a historical candidate, rank that candidate higher.
- Do not add dependencies and do not implement a multi-candidate picker in this task.
- Update product docs and changelog because this changes user-visible terminal behavior.

## Acceptance Criteria

- [x] Typing `cd D:/work/` shows an existing child directory as a ghost suffix.
- [x] Typing a relative path after changing cwd with `cd` suggests entries from the new cwd.
- [x] `cd`-style commands do not suggest files.
- [x] Common file/path commands can suggest both files and directories.
- [x] No candidate means `Tab` and right arrow still pass through to the shell/CLI.
- [x] Existing history/template/built-in suggestions still work.
- [x] AI suggestions remain optional and do not block local/path suggestions.
- [x] Path enumeration is single-level, bounded, read-only, and does not recurse through the filesystem.
- [x] TypeScript check and targeted Rust tests pass.

## Definition of Done

- Tests added or updated for path parsing, path candidate ordering, and backend path listing.
- `npx tsc --noEmit` passes.
- `cd src-tauri && cargo test command_suggestion` passes.
- `cd src-tauri && cargo check` passes unless blocked by unrelated existing issues.
- `CHANGELOG.md` and `docs/功能清单.md` are updated.

## Technical Approach

- Add a `path` suggestion source to `src/lib/terminalInputSuggestions.ts`.
- Keep synchronous local history/template/builtin scoring, then add an async path completion pass from `XTermTerminal` after loading history/template context.
- Add a small Tauri command in `src-tauri/src/commands/command_suggestion.rs` for read-only, single-directory path entries. Reuse safe filesystem patterns already present in `fs.rs`; avoid recursion and cap returned entries.
- In `XTermTerminal`, resolve path-completion shell/cwd context from the current `TerminalSession`, call the path suggestion helper, merge it with existing local suggestions, and preserve stale-request rejection.
- Add lightweight cwd tracking for submitted `cd`-style commands by resolving the target and only updating session state when the backend confirms the target directory exists.
- Update `command-suggestion-contracts.md` only if a new cross-layer path-completion contract is needed during implementation.

## Decision (ADR-lite)

Context: Current suggestions only match full command strings. fish/zsh autosuggestion behavior shows that useful terminal completion combines history with completion/path awareness.

Decision: Implement a lightweight in-app completion strategy instead of invoking the user's shell completion engine. This keeps the implementation portable, predictable, and safe inside the existing Tauri boundary.

Consequences: This will not match every shell-specific completion rule, but it solves path navigation and gives the codebase a small extension point for later command/argument/env-var completions.

## Out of Scope

- Multi-candidate dropdown or pager UI.
- Executable lookup from `PATH`.
- Shell-specific option completion.
- Environment variable, user home `~`, glob, command substitution, and brace expansion.
- Partial word acceptance beyond the existing whole-suffix acceptance.

## Technical Notes

- Existing key files: `src/lib/terminalInputSuggestions.ts`, `src/components/XTermTerminal.tsx`, `src-tauri/src/commands/command_suggestion.rs`, `src/stores/terminalStore.ts`.
- Relevant contracts: `.trellis/spec/backend/command-suggestion-contracts.md`, `.trellis/spec/backend/project-file-command-contracts.md`, `.trellis/spec/backend/terminal-runtime-monitoring-contracts.md`.
- Open-source references:
  - zsh-autosuggestions uses ordered strategies such as history, completion, and previous-command matching.
  - fish autosuggestions use history, completions, and valid file paths, with right-arrow acceptance.
- GitNexus refresh failed before implementation with `.gitnexus/lbug` access denied; use source reads and `rg` as the implementation source of truth if GitNexus remains unavailable.
