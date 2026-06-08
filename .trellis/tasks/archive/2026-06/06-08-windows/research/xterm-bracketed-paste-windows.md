# Research: xterm.js bracketed paste on Windows PTY

- **Query**: Research xterm.js paste handling for terminal apps such as Claude Code CLI on Windows/PowerShell/ConPTY. Focus on: bracketed paste mode, whether custom DOM paste handlers bypass xterm's bracketed paste wrapping, newline normalization for Windows PTY input (LF vs CRLF/CR), and common fixes for multiline paste corruption in interactive TUIs.
- **Scope**: mixed
- **Date**: 2026-06-08

## Findings

### Files Found

| File Path | Description |
|---|---|
| `package.json` | Project uses `@xterm/xterm` `^6.0.0`, `@xterm/addon-fit`, `@xterm/addon-search`, and `@xterm/addon-webgl` (`package.json:30-33`). |
| `src/components/XTermTerminal.tsx` | Main xterm frontend. It creates `Terminal`, adds a custom DOM `paste` listener, intercepts Ctrl+V in `attachCustomKeyEventHandler`, and forwards input through `invoke("pty_write", ...)`. |
| `src-tauri/src/commands/terminal.rs` | Tauri command boundary for `pty_write`; forwards `data: String` unchanged to `PtyManager.write` (`src-tauri/src/commands/terminal.rs:45-50`). |
| `src-tauri/src/pty/manager.rs` | Rust PTY implementation using `portable_pty::native_pty_system`; writes input bytes as-is via `writer.write_all(data.as_bytes())` and `flush()` (`src-tauri/src/pty/manager.rs:336-354`). |
| `node_modules/@xterm/xterm/src/browser/Clipboard.ts` | xterm's built-in paste path: normalizes line endings to CR and conditionally wraps text in bracketed paste delimiters before firing `onData`. |
| `node_modules/@xterm/xterm/src/common/InputHandler.ts` | xterm tracks DEC private mode 2004 (`CSI ? 2004 h/l`) in `coreService.decPrivateModes.bracketedPasteMode`. |
| `node_modules/@xterm/xterm/typings/xterm.d.ts` | Public API docs for `onData`, `input`, `paste`, `ignoreBracketedPasteMode`, `windowsPty`, and `convertEol`. |
| `.trellis/spec/backend/terminal-runtime-monitoring-contracts.md` | Related terminal cross-layer contract for PowerShell/pwsh PTY creation, output parsing, and xterm boundary behavior; no paste-specific contract found. |

### Code Patterns

#### Current project paste path bypasses xterm's built-in paste helper

`XTermTerminal.tsx` registers a capturing DOM paste listener on the terminal container:

```ts
const normalizePastedInput = (text: string) => text.replace(/\r\n?/g, "\n");

const writePastedInput = (text: string) => {
  const data = normalizePastedInput(text);
  if (!data) return;
  markAttentionInputHandled();
  inputBuffer.current += data;
  invoke("pty_write", { sessionId, data }).catch((err) => reportPtyWriteError("paste", err));
};

const onPaste = (e: ClipboardEvent) => {
  const text = e.clipboardData?.getData("text/plain");
  if (text === undefined) return;
  e.preventDefault();
  e.stopPropagation();
  writePastedInput(text);
};

pasteTarget.addEventListener("paste", onPaste, pasteListenerOptions);
```

Citations: `src/components/XTermTerminal.tsx:383-405`.

Because the handler calls `preventDefault()` and `stopPropagation()` and then directly calls `invoke("pty_write", ...)`, it does not call xterm's `paste(...)`, `input(...)`, or built-in clipboard handler. That means xterm's bracketed paste wrapping and CR newline preparation are bypassed for DOM paste events handled here.

Ctrl+V is also intercepted before xterm processes it:

```ts
if (key === "v") {
  e.preventDefault();
  navigator.clipboard.readText().then((text) => {
    writePastedInput(text);
  }).catch((err) => {
    logError("Failed to read clipboard text", { sessionId, err });
  });
  return false;
}
```

Citations: `src/components/XTermTerminal.tsx:456-464`. Returning `false` from `attachCustomKeyEventHandler` stops xterm's normal keyboard processing per xterm's public API docs (`node_modules/@xterm/xterm/typings/xterm.d.ts:1045-1072`).

#### xterm's built-in paste behavior

xterm 6.0.0's clipboard module does two relevant transformations before firing `onData`:

```ts
export function prepareTextForTerminal(text: string): string {
  return text.replace(/\r?\n/g, '\r');
}

export function bracketTextForPaste(text: string, bracketedPasteMode: boolean): string {
  if (bracketedPasteMode) {
    return '\x1b[200~' + text + '\x1b[201~';
  }
  return text;
}

export function paste(text: string, textarea: HTMLTextAreaElement, coreService: ICoreService, optionsService: IOptionsService): void {
  text = prepareTextForTerminal(text);
  text = bracketTextForPaste(text, coreService.decPrivateModes.bracketedPasteMode && optionsService.rawOptions.ignoreBracketedPasteMode !== true);
  coreService.triggerDataEvent(text, true);
  textarea.value = '';
}
```

Citations: `node_modules/@xterm/xterm/src/browser/Clipboard.ts:12-55`.

Implications:

- xterm converts pasted `\n` and `\r\n` to carriage return `\r` for terminal input.
- xterm wraps paste with `ESC [ 200 ~` and `ESC [ 201 ~` only when the application enabled bracketed paste mode and `ignoreBracketedPasteMode` is not `true`.
- xterm fires `onData` with the transformed paste, so the app should normally forward that `onData` payload to the PTY.

The public API exposes `Terminal.paste(data)` as: "Writes text to the terminal, performing the necessary transformations for pasted text" (`node_modules/@xterm/xterm/typings/xterm.d.ts:1270-1275`). It also exposes `Terminal.input(data, wasUserInput?)`, which treats data like user input and fires `onData` (`node_modules/@xterm/xterm/typings/xterm.d.ts:1015-1025`), but `input` is not documented there as performing paste transformations.

#### xterm tracks bracketed paste mode from terminal output

xterm handles DECSET/DECRST 2004:

- `CSI ? 2004 h` sets `decPrivateModes.bracketedPasteMode = true` (`node_modules/@xterm/xterm/src/common/InputHandler.ts:1840-1872`, `1969-1971`).
- `CSI ? 2004 l` sets `decPrivateModes.bracketedPasteMode = false` (`node_modules/@xterm/xterm/src/common/InputHandler.ts:2090-2092`, `2200-2202`).
- `DECRQM ? 2004` reports the current bracketed paste mode (`node_modules/@xterm/xterm/src/common/InputHandler.ts:2299-2301`).

The option `ignoreBracketedPasteMode` is documented as forcing paste without `\x1b[200~` / `\x1b[201~` even when the shell enables bracketed mode (`node_modules/@xterm/xterm/typings/xterm.d.ts:134-139`). The project does not set this option in `new Terminal(...)` (`src/components/XTermTerminal.tsx:314-329`).

#### Current newline normalization differs from xterm's paste normalization

Project paste normalization:

```ts
const normalizePastedInput = (text: string) => text.replace(/\r\n?/g, "\n");
```

Citation: `src/components/XTermTerminal.tsx:383`.

xterm paste normalization:

```ts
return text.replace(/\r?\n/g, '\r');
```

Citation: `node_modules/@xterm/xterm/src/browser/Clipboard.ts:12-14`.

So pasted CRLF/CR is converted to LF in the project, while xterm's built-in paste converts LF/CRLF to CR. Normal Enter key input from xterm is tracked as `"\r"` in this app (`src/components/XTermTerminal.tsx:476-483`), and startup commands append `"\r"` (`src/stores/terminalStore.ts:334-337`). This is consistent with terminal applications expecting Enter as carriage return at the PTY input boundary.

#### PTY write boundary does no normalization

The frontend sends `data` unchanged to Tauri:

```ts
invoke("pty_write", { sessionId, data })
```

Citations: `src/components/XTermTerminal.tsx:392`, `472-475`.

Tauri command forwards unchanged:

```rust
pub async fn pty_write(..., data: String) -> Result<(), String> {
    pty_manager.write(&session_id, &data)
}
```

Citations: `src-tauri/src/commands/terminal.rs:45-50`.

Rust writes bytes unchanged:

```rust
session.writer.write_all(data.as_bytes())?;
session.writer.flush()?;
```

Citations: `src-tauri/src/pty/manager.rs:336-354`.

Therefore newline and bracketed paste decisions are entirely frontend-side for pasted input in the current implementation.

#### Windows/ConPTY-related xterm option exists but is output/viewport-oriented

xterm's `windowsPty` option is documented as compatibility information for Windows PTY hosting. It enables heuristics/workarounds for ConPTY scrollback/reflow behavior (`node_modules/@xterm/xterm/typings/xterm.d.ts:286-303`). It is not described as changing paste newline normalization or bracketed paste handling.

The project uses `portable_pty::native_pty_system()` (`src-tauri/src/pty/manager.rs:3`, `138`), which on Windows corresponds to the native Windows PTY backend through the crate, but the project does not pass `windowsPty` into `new Terminal(...)` (`src/components/XTermTerminal.tsx:314-329`).

### External References

- xterm.js 6.0.0 local package source (`node_modules/@xterm/xterm/src/browser/Clipboard.ts`) — authoritative installed implementation for this project version. It shows built-in paste normalization to `\r` and bracket wrapping via `\x1b[200~...\x1b[201~`.
- xterm.js 6.0.0 local typings (`node_modules/@xterm/xterm/typings/xterm.d.ts`) — authoritative installed public API docs for `paste`, `input`, `onData`, `ignoreBracketedPasteMode`, `windowsPty`, and `convertEol`.
- Microsoft Learn, "Creating a Pseudoconsole session" — ConPTY API reference for pseudoconsole sessions; confirms Windows pseudoconsole communication uses input/output pipes, with the application writing input bytes to the pipe. Network fetch succeeded for metadata, but detailed excerpts were not persisted from the web page due intermittent timeout during snippet extraction.
- Microsoft DevBlogs, "Windows Command-Line: Introducing the Windows Pseudo Console (ConPTY)" — background on ConPTY as a pseudoconsole bridge. Network fetch succeeded for metadata, but detailed excerpts were not persisted from the web page due intermittent timeout during snippet extraction.

### Related Specs

- `.trellis/spec/backend/terminal-runtime-monitoring-contracts.md` — terminal runtime status contract across Rust PTY and React/xterm boundaries. Relevant because it documents PowerShell/pwsh PTY creation and xterm output parsing. No bracketed paste or paste newline contract was found in `.trellis/spec/**/*.md`.

## Common Fixes Observed / Pattern Notes

These are common implementation patterns inferred from the installed xterm implementation and current code boundaries:

1. Let xterm own paste transformation when possible: use xterm's built-in paste path or `Terminal.paste(data)` so bracketed paste and `\r` normalization are applied before `onData` is forwarded to the PTY.
2. If a custom DOM paste handler is required, duplicate xterm's two core transformations: normalize pasted line endings to `\r`, then wrap with `\x1b[200~` / `\x1b[201~` when bracketed paste mode is active and `ignoreBracketedPasteMode` is not enabled. Caveat: `decPrivateModes.bracketedPasteMode` is internal, not exposed in the stable public API.
3. For interactive TUIs such as Claude Code/Codex-like CLIs, bracketed paste is important because it lets the application distinguish pasted multiline input from a sequence of typed Enter keystrokes. Without delimiters, each newline can be interpreted as command submission or prompt confirmation.
4. Avoid converting pasted newlines to LF for terminal input when the rest of the terminal path treats Enter as CR. In this project, normal Enter and startup commands use `\r`, while custom paste currently emits `\n`.
5. Backend normalization is not present here; changes at the frontend paste path directly determine what PowerShell/ConPTY receives.

## Caveats / Not Found

- No paste-specific Trellis spec was found.
- No project test file covering bracketed paste, paste newline normalization, Claude Code multiline paste, or ConPTY paste behavior was found in the searched files.
- External web pages were reachable, but detailed web snippet extraction was intermittent due timeouts. The most important xterm facts are backed by the installed package source in this repo, which is version-aligned with `package.json`.
- xterm's stable public API documents `Terminal.paste(data)` but does not expose a public getter for `bracketedPasteMode` in the read typings. Directly reading internal mode state would depend on non-public internals.
