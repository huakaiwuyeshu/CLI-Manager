# Monaco React + Vite research

## Sources

- Context7 `/suren-atoyan/monaco-react`: React wrapper supports `Editor`, `onMount`, `onChange`, dynamic `language`, controlled/uncontrolled usage, and Vite worker setup.
- Context7 `/microsoft/monaco-editor`: Monaco supports separate editor models via `monaco.editor.createModel(value, language)` and dynamic language/model assignment.

## Relevant findings

- `@monaco-editor/react` is the smallest React-facing integration path for this project. It still requires `monaco-editor` and explicit Vite worker wiring for editor/json/css/html/ts workers.
- Monaco language should be inferred from extension and passed as the editor language. Unsupported extensions should fall back to `plaintext`.
- Theme can be mapped from the app theme: dark theme uses `vs-dark`; light theme uses `vs`. A later polish can define a custom Monaco theme from CSS variables, but that is not necessary for MVP.
- For file switching, Monaco models avoid losing undo/history per file, but MVP can keep one open file at a time to reduce state complexity.
- `onChange` should mark the buffer dirty. Saving should be explicit to avoid surprising file writes.

## Recommendation

Use `@monaco-editor/react` plus `monaco-editor`, configure workers once in a small setup module, and start with one active editable text file. Use the existing shared `MarkdownContent` for Markdown preview instead of adding a second Markdown renderer.
