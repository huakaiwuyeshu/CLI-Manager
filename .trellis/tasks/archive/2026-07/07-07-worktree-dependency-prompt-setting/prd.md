# PRD: Worktree Prompt Defaults And Cleanup Reliability

## Changelog Target

V1.2.6

## Goal

Make Git Worktree behavior less intrusive by default and reduce failed discard operations on Windows when a worktree directory is temporarily locked.

## Confirmed Facts

- Project worktree isolation currently defaults to `prompt` in the UI, project creation store, backend migration, and worktree isolation spec.
- Dependency install detection currently runs automatically after creating/opening a new worktree unless the per-worktree prompt has already been dismissed.
- Manual "Install dependencies" actions are separate from the automatic prompt and should remain available.
- The discard failure reported by the user matches `remove_stale_worktree_dir_failed`, which is emitted by stale registered worktree directory filesystem cleanup.
- Existing retry logic only wraps `git worktree remove --force`; stale filesystem deletion does not retry on Windows file-lock errors.

## Requirements

- New projects must default the worktree isolation strategy to "Do nothing" / `disabled`, not "Prompt" / `prompt`.
- Add a per-project checkbox in Worktree settings to enable automatic dependency install detection/prompt when a worktree is opened.
- The checkbox defaults to off for new projects and existing projects.
- Automatic dependency detection must run only when the checkbox is enabled.
- Manual Worktree menu action "Install dependencies" must continue to check dependencies and open an install tab when needed.
- Existing zh-CN and en-US UI text must be updated through i18n keys.
- Worktree discard should retry stale directory removal on transient Windows file-lock errors such as OS error 32 / "being used by another process".
- Worktree discard must preserve the existing safety boundary: do not delete non-empty unregistered paths, and only delete registered stale paths or empty unregistered stale directories as allowed by the existing contract.

## Acceptance Criteria

- Creating a new project without changing Worktree settings stores `worktree_strategy = "disabled"`.
- Config modal shows the Worktree strategy select on "Do nothing" by default for new projects.
- Config modal shows a dependency prompt checkbox that is unchecked by default.
- Creating/opening a worktree does not call dependency detection or show the dependency dialog unless the checkbox is checked.
- Checking the box for a project enables the existing automatic dependency prompt flow for newly opened worktrees.
- Manually choosing "Install dependencies" from a Worktree menu still performs dependency detection regardless of the checkbox.
- Discarding a registered stale worktree path retries directory deletion before returning `remove_stale_worktree_dir_failed`.
- Relevant Rust unit tests cover retry classification and stale cleanup behavior where practical.

## Out Of Scope

- Changing the existing worktree creation, finish, merge, or branch naming contracts.
- Automatically killing external programs that hold files under a worktree directory.
- Removing the manual "Install dependencies" menu action.
