# Update Version to V1.2.1

## Goal

Change CLI-Manager application/package version metadata from `1.2.0` to `1.2.1`.

## Requirements

* Update only app/package version sources listed in `.trellis/spec/guides/version-update-checklist.md`.
* Keep dependency versions unchanged.
* Do not rewrite existing `CHANGELOG.md`; it already contains a `V1.2.1` section.

## Acceptance Criteria

* [ ] `package.json` top-level `version` is `1.2.1`.
* [ ] `package-lock.json` top-level `version` is `1.2.1`.
* [ ] `package-lock.json` `packages[""].version` is `1.2.1`.
* [ ] `src-tauri/Cargo.toml` `[package].version` is `1.2.1`.
* [ ] `src-tauri/Cargo.lock` root package `cli-manager` version is `1.2.1`.
* [ ] `src-tauri/tauri.conf.json` top-level `version` is `1.2.1`.
* [ ] Search confirms no expected app-version source remains at `1.2.0`.

## Definition of Done

* Version metadata is aligned across npm, Tauri, and Rust package files.
* Verification commands are run or any skipped checks are explicitly reported.

## Technical Approach

Use targeted edits for the six app-version fields. Avoid broad replacement because lockfiles contain dependency versions such as `1.2.0` and `1.2.1`.

## Out of Scope

* Dependency upgrades.
* Release tagging, commit, push, or build artifact generation.
* Changelog content changes beyond what already exists.

## Technical Notes

* Version checklist read: `.trellis/spec/guides/version-update-checklist.md`.
* Existing `CHANGELOG.md` has `## [V1.2.1] - 2026-06-26`.
* `src-tauri/tauri.macos.conf.json` has no version field.
