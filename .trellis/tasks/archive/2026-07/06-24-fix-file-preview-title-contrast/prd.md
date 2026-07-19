# Fix File Preview Title Contrast

## Goal

Improve the readability of file preview/editor tab titles in dark theme.

## Requirements

* File editor tabs should have clearer title text in dark theme.
* Keep the change scoped to file editor tabs; do not retheme all terminal tabs.
* Preserve existing tab layout, close behavior, drag behavior, and active state behavior.

## Acceptance Criteria

* [x] File editor tab title text is visibly brighter than the previous muted gray in dark theme.
* [x] Normal terminal tabs keep their existing visual style.
* [x] Frontend type-check passes.

## Definition of Done

* Minimal code/style change only.
* Verify with static/type check or equivalent inspection.
* Do not touch unrelated dirty files.

## Out of Scope

* Theme token redesign.
* Full tab bar visual refactor.
* Light theme changes beyond compatibility with the same selector.

## Technical Notes

* Candidate files inspected:
  * `src/components/TerminalTabs.tsx`
  * `src/components/files/FileEditorPane.tsx`
  * `src/styles/components.css`
  * `src/styles/themes.css`
* GitNexus impact for `SortableTab`: LOW, direct callers 0, affected processes 0.
* The screenshot maps best to the top session tab title, not the editor content header.
