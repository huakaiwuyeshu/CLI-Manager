# update changelog v1.1.8

## Goal

Add the current unreleased work to the `V1.1.8` section of `CHANGELOG.md`.

## Requirements

* Only update the `V1.1.8` changelog content.
* Keep the existing changelog style and concise grouped bullets.
* Exclude temporary task folders, crash dumps, and non-release artifacts.

## Acceptance Criteria

* [ ] `CHANGELOG.md` includes the main current changes under `V1.1.8`.
* [ ] The wording matches the high-level current git diff.
* [ ] No business code is modified by this task.

## Definition of Done

* Review `git diff -- CHANGELOG.md`.
* No build or test run is required for this docs-only change.

## Technical Approach

Review the current diff summary and add a small set of grouped release notes under `V1.1.8`.

## Out of Scope

* No version bump.
* No source implementation changes.
* No cleanup of unrelated uncommitted files.

## Technical Notes

* User approved the proposed changelog-only plan.
* Shared guide `.trellis/spec/guides/index.md` was read; no frontend/backend code spec applies to this docs-only task.
