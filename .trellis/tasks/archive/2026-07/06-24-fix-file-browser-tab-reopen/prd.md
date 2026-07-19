# Fix File Browser Tab Reopen

## Goal

Fix the file browser behavior where a file tab cannot be shown again after it has been closed and the same file is clicked again.

## What I Already Know

* User reports: after closing a file browsing tab, clicking the file again no longer displays it.
* This is a front-end file browser/editor interaction bug.
* `FileExplorerSidebar` stays visible when the file editor pane session is closed because the file explorer project state is not closed.
* Clicking a file currently calls `openFile(entry)` only; it does not ensure the outer file editor pane exists.

## Assumptions

* Closing a file tab should remove or deactivate the tab state enough that a later file click can open/show the file again.
* The fix should be local to file browser/editor tab state, with no broad UI redesign.

## Requirements

* Re-clicking a file after its tab is closed must show that file again.
* Existing open-tab switching behavior should keep working.
* No unrelated refactor or visual redesign.

## Acceptance Criteria

* [ ] Open a file from the file browser.
* [ ] Close that file's tab.
* [ ] Click the same file again.
* [ ] The file content/tab is displayed again.

## Definition of Done

* Type-check or targeted validation completed where feasible.
* Modified code follows existing file browser patterns.
* Only relevant files are changed.

## Out of Scope

* New file editor features.
* File persistence behavior changes.
* Layout or styling redesign.

## Technical Notes

* Relevant files to inspect likely include `src/components/files/FileEditorPane.tsx` and `src/components/files/FileExplorerSidebar.tsx`.
* `src/components/sidebar/index.tsx` opens both file explorer project state and file editor pane through `openFileProject(project)` + `openFileEditorPane(project)`.
* `src/components/files/FileExplorerSidebar.tsx:711` has the narrowest fix point: file click handler can call `openFileEditorPane(project)` after opening the file.
* GitNexus impact lookup returned `Target/Symbol not found` for `requestOpenFile`, `FileExplorerSidebar`, `openFileEditorPane`, and file-path targets; direct `rg` shows `requestOpenFile` is local to `FileExplorerSidebar` and used by tree/search file click paths.
