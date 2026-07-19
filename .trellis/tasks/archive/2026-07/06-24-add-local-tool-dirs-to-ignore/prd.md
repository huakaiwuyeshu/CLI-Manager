# File Explorer Ignore Toggle

## Goal

Restore the cancel-ignore action for ignored directories in the project file explorer.

## Requirements

- Directory context menu shows `忽略` when the directory is not manually ignored.
- Directory context menu shows `取消忽略` when the directory is already manually ignored.
- Selecting `取消忽略` removes the directory from the current project's `fileExplorerIgnoredPaths` setting so it returns to the normal file tree.

## Acceptance Criteria

- [ ] A manually ignored directory can be restored from the collapsed group context menu.
- [ ] Non-ignored directories still support the existing ignore action.
- [ ] TypeScript check passes.

## Out of Scope

- No changes to automatic default collapsed directory names.
- No data schema changes.
- No runtime desktop app launch.

## Technical Notes

- Main file: `src/components/files/FileExplorerSidebar.tsx`
- Settings field: `fileExplorerIgnoredPaths`
