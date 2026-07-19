# Optimize File Tree Search and Add Global Code Snippet Search

## Goal

Improve the project file explorer search so users can quickly find files by path/name and search code snippets across the currently opened project without leaving CLI-Manager.

## What I Already Know

- The file explorer UI is implemented in `src/components/files/FileExplorerSidebar.tsx`.
- File explorer state and IPC calls live in `src/stores/fileExplorerStore.ts`.
- Current file search stores a single `searchQuery` and `searchResults`, calls the Tauri command `file_search`, and renders matching `ProjectFileEntry` rows in place of the tree.
- `file_search` is implemented in `src-tauri/src/commands/fs.rs` and currently matches file or directory names only.
- Project file commands are scoped by `rootPath` plus project-relative paths; Rust is the validation authority.
- `src-tauri/src/commands/fs.rs` already has path validation helpers, project-root canonicalization, a 2 MiB text read limit, and default collapsed/ignored directory names on the frontend.
- User-visible frontend text must use `src/lib/i18n.ts` with both `zh-CN` and `en-US` entries.
- No new dependency is required for an MVP; Rust recursive traversal and bounded UTF-8 reads are enough.

## Requirements

- Keep the existing file tree search behavior available for finding files and folders by name/path.
- Add global code snippet search under the currently opened project.
- Optimize current file tree search so typing in the search box does not noticeably freeze the UI.
- Search results must stay inside the configured project root.
- Search must skip common heavy or generated directories already ignored/collapsed by the file explorer, such as `.git`, `.trellis`, `node_modules`, `dist`, `build`, `target`, and cache directories.
- Code snippet search must return bounded results with file path, line number, matched line, and a small surrounding context.
- Search requests must be debounced or otherwise protected from firing a full filesystem scan for every keystroke.
- Stale search responses must not overwrite newer results.
- Clicking a snippet result should open the file in the existing editor pane.
- Clicking a snippet result should jump the editor to the matched line and highlight the matched snippet.
- Do not add dependencies or broaden Tauri asset/fs scopes.
- Add or update tests for Rust search behavior and safety boundaries where practical.

## Acceptance Criteria

- [ ] Typing a file name/path still finds matching files and directories.
- [ ] Typing quickly in file search does not cause visible UI jank from request storms.
- [ ] Users can switch to content/snippet search from the file explorer search area.
- [ ] Content search finds UTF-8 text matches inside project files and shows path plus line/context.
- [ ] Content search does not scan outside the project root.
- [ ] Content search skips heavy/generated directories and large or non-UTF-8 files.
- [ ] Both file search and content search return bounded result sets.
- [ ] Older slow search responses cannot replace newer query results.
- [ ] Clicking a content result opens the target file without changing existing editor behavior.
- [ ] Clicking a content result scrolls the editor to the matched line and highlights the matched code snippet.
- [ ] New visible labels, empty states, and errors are available in both Simplified Chinese and English.
- [ ] `npx tsc --noEmit` passes.
- [ ] `cd src-tauri && cargo check` passes.

## Definition of Done

- Existing file explorer workflows still work: open file, expand/collapse folders, context menu, drag/drop, create/rename/delete, copy AI path/tree.
- Backend project file command contracts remain project-scoped and path-safe.
- No unrelated refactor or dependency change.
- Manual verification items are listed for the desktop UI.

## Technical Approach

Use the current file explorer search area and add a compact mode switch:

- `Files` mode keeps the existing `file_search` command and result rows.
- `Code` mode calls a new Rust command, tentatively `file_search_content`, returning bounded snippet matches.
- The frontend store keeps separate result arrays for path results and content results so editing file tree behavior remains stable.
- The frontend debounces search input and guards against stale async responses before updating results.
- The backend `file_search` traversal skips known heavy directories and returns a bounded result set.
- The Rust content search command reuses project-root canonicalization and traversal patterns from `fs.rs`, skips known heavy directories, reads only bounded UTF-8 text files, and limits total returned matches.

## Decision (ADR-lite)

**Context**: The feature spans frontend search UI, Zustand store state, Tauri IPC types, and Rust file traversal. A dependency-based search engine would be overkill for an MVP and would increase install/build risk.

**Decision**: Implement bounded project-scoped Rust search commands plus a minimal frontend UI mode switch inside the existing file explorer search area and debounced request flow, without new dependencies.

**Consequences**: The MVP will be simple and predictable, but it will not provide indexed search, regex search, ranking, cancellation of already-running Rust scans, or instant results for very large repositories.

## Out of Scope

- Regex search.
- Replace-in-files.
- Search index/database.
- Search across all configured projects at once.
- Binary file preview or binary content search.
- Jumping to exact editor line/column unless existing editor APIs already make this cheap.

## Technical Notes

- Relevant frontend files:
  - `src/components/files/FileExplorerSidebar.tsx`
  - `src/stores/fileExplorerStore.ts`
  - `src/lib/types.ts`
  - `src/lib/i18n.ts`
- Relevant backend files:
  - `src-tauri/src/commands/fs.rs`
  - `src-tauri/src/lib.rs`
- Relevant specs:
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/state-management.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/backend/project-file-command-contracts.md`
  - `.trellis/spec/guides/tauri-user-file-security-checklist.md`
