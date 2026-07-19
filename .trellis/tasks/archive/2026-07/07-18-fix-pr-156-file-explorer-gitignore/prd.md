# Fix PR #156 File Explorer Gitignore

## Goal

Repair PR #156 so file-tree ignore behavior follows established Gitignore semantics for root rules, nested directories, wildcards, and negation, while retaining the intended collapsed-directory/hidden-file presentation and reacting to `.gitignore` changes.

## Requirements

- Replace the custom glob/parser implementation with the maintained `ignore` package.
- Continue reading only the project-root `.gitignore`, matching the original PR scope.
- Treat directory entries with directory semantics and files with file semantics.
- Preserve the fallback default ignore patterns when `.gitignore` is missing or unreadable.
- Preserve existing default collapsed-directory names and user-managed ignored paths.
- Reload rules when the project watcher reports `.gitignore` creation, modification, or deletion.
- Add regression tests for nested `node_modules/`, root-anchored `/build`, wildcard files, negation, and default patterns.
- Update `CHANGELOG.md` version `V1.2.9`, `docs/功能清单.md`, and project file-browser contracts.
- Associate the commit with issue #147 / PR #156 and push to the contributor branch.

## Confirmed Facts

- The custom parser incorrectly matches bare directory rules only at the repository root.
- Removing a leading `/` loses root-anchor semantics.
- `.gitignore` is currently loaded only when `project.path` changes.
- Existing `project-files-changed` watcher events expose project-relative changed paths.
- The `ignore` package is browser-compatible and currently available as version `7.0.6`.
- The contributor branch is `Kyou12138/feat/147-file-explorer-gitignore` and permits maintainer edits.
- Changelog Target: `V1.2.9`.

## Acceptance Criteria

- [x] `node_modules/` matches nested directories such as `packages/app/node_modules/`.
- [x] `/build` matches only the project-root entry and not `packages/build`.
- [x] `*.log` plus `!important.log` restores the negated file.
- [x] Missing `.gitignore` uses the built-in default matcher.
- [x] Editing, creating, or deleting `.gitignore` reloads the active matcher without switching projects.
- [x] Ignored directories remain accessible through the collapsed group; ignored files stay hidden from the main tree.
- [x] Type checking and focused tests pass.
- [x] The repaired commit is pushed to the original PR branch.

## Out Of Scope

- Parsing nested `.gitignore` files below the project root.
- Applying `.git/info/exclude` or global Git excludes.
- Changing backend file search ignore behavior.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
