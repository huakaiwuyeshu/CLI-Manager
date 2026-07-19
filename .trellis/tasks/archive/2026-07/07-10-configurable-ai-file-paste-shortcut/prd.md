# configurable-ai-file-paste-shortcut

## Goal

Allow the Claude Code / Codex in-terminal file paste shortcut to be configured from Settings.

## Requirements

- Default behavior remains `Alt+V`.
- Settings > Shortcuts exposes the action and allows changing it, including to `Ctrl+V`.
- The shortcut only changes Claude Code / Codex terminal behavior.
- When configured to `Ctrl+V`, Claude Code / Codex sessions send the file-paste trigger instead of normal text paste.
- Non-Claude/Codex terminals keep existing paste behavior.
- Add Chinese and English UI labels.
- Changelog Target: [TEMP]

## Acceptance Criteria

- [ ] The shortcut action appears in shortcut settings.
- [ ] Existing installs get the new shortcut default through settings migration.
- [ ] Claude Code / Codex terminals send the AI file paste trigger for the configured shortcut.
- [ ] `npx tsc --noEmit` passes.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
