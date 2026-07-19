# Optimize Project List and Terminal Paste Formatting

## Changelog Target

V1.2.4

## Goal

Improve the left project list so it can be used as a project-scoped terminal switcher, and make terminal paste safer for multi-line prompts by formatting `Ctrl+Shift+V` input before it reaches the PTY.

## Requirements

- The left project list keeps its existing search/filter behavior.
- Project rows show the number of currently opened terminals for that project.
- Clicking a project scopes the terminal workspace to only that project's open terminals.
- The terminal workspace still provides an "All Terminals" entry to return to the full terminal list.
- `Ctrl+Shift+V` in an embedded terminal trims leading/trailing line breaks from clipboard text.
- When the formatted clipboard text contains line breaks, `Ctrl+Shift+V` pastes it wrapped in single quotes so multi-line content is not submitted line-by-line immediately.
- Regular paste behavior remains unchanged except where existing code already handles it.

## Acceptance Criteria

- [ ] Project list search still filters by project name, path, or CLI keyword.
- [ ] Each visible project row can show the number of currently opened terminals for that project.
- [ ] Clicking a project filters the right terminal area to that project's terminals.
- [ ] Clicking "All Terminals" restores the full terminal list.
- [ ] `Ctrl+Shift+V` with `"\ntext\n"` pastes `'text'`.
- [ ] `Ctrl+Shift+V` with multi-line text pastes a single-quoted block after trimming outer line breaks.
- [ ] `Ctrl+V` and context-menu paste keep existing behavior.
- [ ] Frontend type check passes.

## Definition of Done

- Implement the smallest change that reuses existing project-scoped terminal plumbing.
- Update `CHANGELOG.md` under V1.2.4.
- Update `docs/功能清单.md` for product-visible behavior.
- Run `npx tsc --noEmit`.

## Technical Approach

- Reuse the existing `projectScopedTerminalViewEnabled`, `terminalScopeProjectId`, and `filterPaneTreeBySessionIds` flow instead of introducing a new terminal routing layer.
- Count project terminals in the sidebar from `useTerminalStore().sessions`, excluding non-terminal pseudo sessions where needed.
- Keep paste formatting local to `XTermTerminal.tsx`, since the requirement is an input formatting concern before xterm/PTY write.

## Decision (ADR-lite)

**Context**: The repository already has project-scoped terminal filtering behind a setting and an existing `Ctrl+Shift+V` paste hook.

**Decision**: Make the requested behavior by tightening the existing code paths instead of adding new state or backend commands.

**Consequences**: The behavior affects project click semantics, so verification must cover switching back to all terminals and empty project state.

## Out of Scope

- Adding a full paste preview/editor UI.
- Adding new dependencies.
- Changing PTY backend behavior.
- Redesigning terminal panes or project tree drag/drop.

## Technical Notes

- Relevant files inspected:
  - `src/components/sidebar/index.tsx`
  - `src/components/sidebar/ProjectTree.tsx`
  - `src/components/sidebar/TreeNodeItem.tsx`
  - `src/components/TerminalTabs.tsx`
  - `src/components/XTermTerminal.tsx`
  - `src/stores/settingsStore.ts`
  - `src/lib/i18n.ts`
- Existing docs already mention the previous optional project-scoped terminal setting in `docs/功能清单.md`.
