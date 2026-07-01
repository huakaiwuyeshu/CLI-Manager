# External Prompt Engine And Shell Integration Research

## Goal

Evaluate whether CLI-Manager should support terminal prompt customization by integrating with existing shell prompt engines and shell integration conventions, instead of rendering a fake prompt in the frontend.

## Findings

### 1. Xterm.js is not the right layer for prompt semantics

- xterm.js is a terminal emulator/view layer, not a prompt engine.
- It can render ANSI/OSC output and handle input, but it should not invent shell prompt semantics on behalf of the shell.
- A frontend-generated fake prompt would conflict with real PTY input, shell history, completion, IME behavior, and TUI programs.

Reference:
- https://xtermjs.org/

### 2. VS Code uses shell integration, not a fake prompt

- VS Code injects shell integration scripts/arguments into supported shells.
- That integration lets the terminal know when a prompt is shown, when a command starts, and when it finishes.
- This is conceptually aligned with CLI-Manager's current OSC 133/777 parsing path.

Reference:
- https://code.visualstudio.com/docs/terminal/shell-integration

### 3. PowerShell prompt is natively customizable

- PowerShell exposes a `prompt` function for customizing prompt appearance.
- This confirms prompt styling belongs to the shell/profile layer, not to the terminal emulator.

Reference:
- https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_prompts?view=powershell-7.6

### 4. Oh My Posh is the strongest cross-shell candidate

- Oh My Posh supports multiple shells including `powershell`, `pwsh`, `bash`, `zsh`, `fish`.
- For `cmd`, it works via Clink.
- Oh My Posh documentation also includes shell integration concepts, making it a good fit for existing OSC-driven runtime/status plumbing.

References:
- https://ohmyposh.dev/docs/installation/prompt
- https://ohmyposh.dev/docs/configuration/general
- https://chrisant996.github.io/clink/

### 5. Starship is also viable, but weaker for status integration certainty

- Starship is a strong cross-platform, multi-shell prompt engine.
- It also needs Clink for `cmd`.
- It is a good prompt appearance option, but current research gives less direct evidence than Oh My Posh for shell-integration/status-marker alignment.

Reference:
- https://starship.rs/

## Implications For CLI-Manager

### Recommended product direction

- Treat CLI-Manager as a PTY host + shell integration coordinator.
- Let the actual shell or an external prompt engine generate the visible prompt.
- Reuse existing OSC parsing for runtime/status instead of drawing prompt text in React.

### MVP candidate

- Detect whether Oh My Posh / Starship / Clink are installed.
- Show shell-by-shell capability/status in settings.
- Provide per-shell setup guidance and generated init snippets.
- Optionally support assisted install/config for a small supported subset.

### Avoid

- Do not build a frontend fake prompt layer.
- Do not silently overwrite global shell profiles without explicit user action and visible diff/backup.

## Repo Constraints Observed

- Existing shell list is already normalized in `src/lib/shell.ts`.
- Existing shell runtime monitoring already injects shell-specific runtime markers in `src-tauri/src/pty/manager.rs`.
- Existing UI/backend install-status pattern already exists for Hook management and can be reused for prompt engine integration.

## Candidate Approaches

### Approach A: External prompt engine integration (recommended)

- Prefer Oh My Posh first-class, optionally Starship second.
- CLI-Manager detects tools, shows capability matrix, offers setup assistance, and keeps prompt ownership in the shell.

Pros:
- Lowest semantic risk
- Best cross-shell reach
- Reuses existing shell/profile ecosystem

Cons:
- Depends on external tools
- Cross-shell setup UX is still shell-specific

### Approach B: Built-in shell session adapters

- CLI-Manager injects prompt functions/rc fragments for every supported shell.

Pros:
- No external dependency for visible prompt
- Stronger control over default appearance

Cons:
- High maintenance across 9 shell targets
- More startup/per-shell edge cases
- Harder to coexist with user profiles

### Approach C: Frontend-rendered synthetic prompt

- Render prompt UI in React/xterm overlay.

Pros:
- Superficially uniform UI

Cons:
- Architecturally wrong for a real PTY terminal
- High risk of input/history/IME/TUI breakage

Recommendation: reject
