# File Preview Context Create Actions

## Goal

Remove visible create-file/create-folder buttons from the project file preview sidebar and keep create actions available only from right-click context menus.

## What I Already Know

* User wants file preview create actions to be right-click only.
* Existing frontend file browser lives in `src/components/files/FileExplorerSidebar.tsx`.
* Existing store action `createEntry` already supports creating files and directories.
* Existing Rust commands `file_create_file` and `file_create_dir` already exist and validate paths under the project root.
* Directory rows already expose right-click menu items for `新建文件` and `新建文件夹`.

## Requirements

* Remove the visible `文件` and `文件夹` create buttons from the file preview/sidebar header.
* Keep directory right-click create actions.
* Add root/empty-area right-click create actions so users can still create files/folders at project root after the buttons are removed.
* Do not change backend file creation behavior.
* Do not add dependencies.

## Acceptance Criteria

* [ ] File preview/sidebar header no longer shows visible create-file/create-folder buttons.
* [ ] Right-clicking a directory still offers `新建文件` and `新建文件夹`.
* [ ] Right-clicking the file tree empty/background area offers root-level `新建文件` and `新建文件夹`.
* [ ] Existing rename/copy/move/delete behavior is unchanged.
* [ ] Type check passes for the frontend.

## Definition of Done

* Minimal scoped frontend change.
* TypeScript check passes or any failure is reported with cause.
* No unrelated files are modified.

## Technical Approach

Update `FileExplorerSidebar.tsx` only:

* Remove the header button row that calls `openInput({ kind: "create-file" | "create-dir", parentPath: "" })`.
* Wrap the tree content area in a `ContextMenu` whose menu creates entries at `parentPath: ""`.
* Prevent the background context menu from interfering with existing row-level context menus where needed.

## Out of Scope

* Backend command changes.
* New keyboard shortcuts.
* Changing rename/copy/move/delete UX.
* Changing file search behavior.

## Technical Notes

* Inspected `src/components/files/FileExplorerSidebar.tsx`.
* Inspected `src/stores/fileExplorerStore.ts`.
* Inspected `src-tauri/src/commands/fs.rs`.
