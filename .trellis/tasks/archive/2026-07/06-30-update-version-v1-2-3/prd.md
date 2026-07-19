# Update Version to V1.2.3

## Goal

Bump CLI-Manager project/app version metadata to 1.2.3 consistently.

## Requirements

* Update only official app/package version metadata sources.
* Keep npm, Tauri, and Rust package versions aligned.
* Do not change dependency versions or unrelated release notes.

## Acceptance Criteria

* [ ] `package.json` top-level version is `1.2.3`.
* [ ] `package-lock.json` root version entries are `1.2.3`.
* [ ] `src-tauri/Cargo.toml` package version is `1.2.3`.
* [ ] `src-tauri/Cargo.lock` `cli-manager` package version is `1.2.3`.
* [ ] `src-tauri/tauri.conf.json` top-level version is `1.2.3`.

## Definition of Done

* Version sources listed in `.trellis/spec/guides/version-update-checklist.md` match.
* Verification command confirms all expected `1.2.3` entries.
* Existing unrelated worktree changes are left untouched.

## Out of Scope

* Release tagging, committing, pushing, or building installers.
* Updating changelog or release notes unless explicitly requested.
* Dependency upgrades.

## Technical Notes

* Relevant guide: `.trellis/spec/guides/version-update-checklist.md`.
* Expected files: `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`.
