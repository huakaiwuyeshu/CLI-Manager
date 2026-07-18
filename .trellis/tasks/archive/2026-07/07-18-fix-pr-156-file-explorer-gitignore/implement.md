# Implementation Plan

1. Refresh GitNexus and run upstream impact analysis for `FileExplorerSidebar`, `splitAutoCollapsedEntries`, and ignore helper symbols.
2. Add `ignore@7.0.6` and replace the custom parser/glob implementation with a matcher adapter.
3. Update `FileExplorerSidebar` state and auto-collapse plumbing to use the matcher.
4. Reload the matcher from `project-files-changed` events that include `.gitignore`.
5. Add focused Node tests for Gitignore semantics and default fallback rules.
6. Update contracts, V1.2.9 changelog, and feature inventory.
7. Run focused tests, `npx tsc --noEmit`, GitNexus detect-changes, commit with `Refs #147`, and push to the original branch.
