# Task Delivery Checklist

> Repo-specific start/finish checklist for AI-driven changes.

---

## When to Use

Use this checklist for any task that writes files, whether it goes through the full Trellis task flow or qualifies for no-task inline handling.

---

## Before You Edit

- Run `git status --short` to see current dirty files.
- Run `git fetch --prune` to refresh the current branch's remote tracking state.
- If the branch has an upstream, run `git rev-list --left-right --count HEAD...@{upstream}` to compare local vs remote.
- If the remote side is ahead, pull before editing when the working tree is clean.
- If the remote side is ahead but the working tree is already dirty, stop and resolve that state before continuing; do not keep coding on stale base assumptions.
- If unrelated dirty files exist, keep them out of your task and surface them in the commit plan instead of silently bundling them.
- If there is no upstream configured for the current branch, surface that fact instead of pretending the remote-ahead check succeeded.

---

## Before You Finalize

- Before or at the start of any file-writing task, confirm which `CHANGELOG.md` version should receive the work. If the user does not provide a version number, use temporary version `[TEMP]` instead of guessing.
- If the task changed user-visible behavior or developer-facing workflow behavior, update [`CHANGELOG.md`](../../../CHANGELOG.md).
- If the task changed product/app functionality, update [`docs/功能清单.md`](../../../docs/%E5%8A%9F%E8%83%BD%E6%B8%85%E5%8D%95.md).
- If the user explicitly provided an issue number or issue URL, associate the commit message with that issue.
- Prefer non-closing issue references such as `Refs #123` unless the user explicitly asked to close the issue.

---

## Simple Task Rule

- A small, bounded change may skip full Trellis task creation when the goal is clear, no research is needed, and the main implementation stays within 1–2 existing files.
- Required follow-up docs such as `CHANGELOG.md` or `docs/功能清单.md` do not count against that 1–2 file bound.
- If the work expands beyond that boundary, stop treating it as a simple inline task and switch back to the normal Trellis task flow.

---

## Why This Exists

- Prevent stale-context edits when the repo changed since the last read.
- Keep release notes and feature inventory aligned with actual shipped behavior.
- Make commit history traceable when users point to a specific issue.
