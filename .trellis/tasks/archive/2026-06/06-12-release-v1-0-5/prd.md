# Release V1.0.5

## Goal

Prepare and publish CLI-Manager V1.0.5: align app version metadata, update the changelog, commit the release changes, push to the remote, then create and push tag `V1.0.5`.

## What I Already Know

* User requested release version `V1.0.5`; Git tag must use uppercase `V`.
* Current branch is `master`.
* Remotes are `origin` (`dark-hxx/CLI-Manager`) and `fork` (`yz0812/CLI-Manager`).
* Version checklist requires six app-version sources to match:
  * `package.json`
  * `package-lock.json` top-level version
  * `package-lock.json` `packages[""].version`
  * `src-tauri/Cargo.toml`
  * `src-tauri/Cargo.lock` package `cli-manager`
  * `src-tauri/tauri.conf.json`
* Current versions are inconsistent: `package.json`, `src-tauri/Cargo.toml`, and `tauri.conf.json` show `1.0.4`; lockfiles still include older app metadata.
* `CHANGELOG.md` already has a `V1.0.5` section, but it may need completion against current pending changes.
* Working tree already contains many dirty files not created by this release task, so commit scope must be confirmed before Git operations.

## Requirements

* Update CLI-Manager app version metadata to `1.0.5`.
* Ensure `CHANGELOG.md` has an accurate `## [V1.0.5] - 2026-06-12` release section.
* Do not silently include unrelated or unrecognized WIP in the release commit.
* After confirmation, commit and push the selected release changes.
* Create and push Git tag `V1.0.5` exactly with uppercase `V`.

## Acceptance Criteria

* [ ] All app-version sources listed in the version checklist are `1.0.5`.
* [ ] `CHANGELOG.md` contains the V1.0.5 release notes.
* [ ] Verification commands pass or any failure is reported clearly.
* [ ] Git commit contains only confirmed files.
* [ ] Remote branch receives the commit.
* [ ] Remote receives tag `V1.0.5`.

## Definition of Done

* Version metadata aligned.
* Changelog updated.
* Release commit pushed.
* Tag `V1.0.5` pushed.
* Dirty/unrecognized files handled explicitly.

## Out of Scope

* Feature refactors.
* Dependency upgrades.
* Release artifact signing or GitHub Release upload unless separately requested.

## Technical Notes

* Read `.trellis/spec/guides/version-update-checklist.md`.
* Relevant files discovered: `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`.
* Git operations require explicit confirmation before execution.
