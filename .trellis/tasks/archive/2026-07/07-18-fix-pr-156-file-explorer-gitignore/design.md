# Design

## Root Cause

PR #156 reimplements a subset of Gitignore matching. The parser discards anchor information and the matcher treats bare directory patterns as root-relative, so valid Gitignore files produce incorrect file-tree visibility.

## Implementation

- `fileExplorerIgnore.ts` owns a small adapter around the `ignore` package and the built-in fallback pattern list.
- The adapter normalizes project-relative paths and appends `/` when checking directory entries.
- `FileExplorerSidebar` stores an immutable matcher instead of parsed rule arrays.
- The existing project watcher increments a reload sequence whenever `.gitignore` appears in `changedPaths`; the loader effect depends on that sequence.
- The tree presentation stays unchanged: matcher-hit directories enter the auto-collapsed group, matcher-hit files are omitted from the normal list.

## Compatibility

- No Tauri command or payload changes.
- Existing user ignored paths and default collapsed directory names remain additive.
- A present but empty `.gitignore` intentionally disables fallback file-pattern rules, matching the original PR's priority behavior.
