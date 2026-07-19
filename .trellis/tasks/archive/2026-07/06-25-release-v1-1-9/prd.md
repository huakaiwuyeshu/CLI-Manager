# release V1.1.9

## Goal

Publish CLI-Manager version `1.1.9` by aligning project version metadata, committing the release bump, and recreating/pushing tag `V1.1.9` so the remote release workflow rebuilds.

## Requirements

* Update all project-level app/package version sources from `1.1.8` to `1.1.9`.
* Create a release commit for the version bump.
* Delete the existing local `V1.1.9` tag and recreate it on the new release commit.
* Delete/recreate or force-update the remote `V1.1.9` tag on `origin` so remote automation rebuilds.
* Push the release commit and updated tag to `origin`.

## Acceptance Criteria

* [ ] `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json` all report version `1.1.9` for the app/root package.
* [ ] Git working tree is clean except Trellis bookkeeping if intentionally left uncommitted.
* [ ] A release commit exists on `master`.
* [ ] Local and remote `V1.1.9` tag point to the new release commit.
* [ ] `master` and tag `V1.1.9` are pushed to `origin`.

## Definition of Done

* Version metadata is verified by direct file inspection/search.
* Type/build checks are run where practical.
* Remote push succeeds.

## Technical Approach

Use the existing version update checklist. Keep changes limited to release metadata and Trellis task notes. Do not change application logic.

## Out of Scope

* No dependency upgrades.
* No changelog content changes unless needed to correct version metadata.
* No remote branch restructuring.

## Technical Notes

* Existing local and remote `V1.1.9` tag currently point to commit `23333ae`.
* Current branch is `master`.
* Existing app metadata is still `1.1.8` in project version sources.
