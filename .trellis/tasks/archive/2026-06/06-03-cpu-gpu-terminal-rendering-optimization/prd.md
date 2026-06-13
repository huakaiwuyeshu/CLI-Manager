# CPU/GPU Terminal Rendering Optimization

## Goal

Improve CLI-Manager terminal smoothness and responsiveness by optimizing both CPU hot paths and GPU renderer behavior, especially for high-throughput output, multiple tabs/splits, transparent backgrounds, and WebGL fallback scenarios.

## What I already know

- The app is a Tauri 2 + React 19 + xterm.js desktop app.
- `src/components/XTermTerminal.tsx` already constructs xterm terminals and loads `@xterm/addon-webgl`.
- `allowTransparency: true` is already enabled for xterm because terminal background images need transparency.
- PTY output is already decoded per session with `TextDecoder` stream mode and batched via `requestAnimationFrame` before `terminal.write(...)`.
- Hidden terminal output already uses a bounded latest-suffix buffer instead of unbounded accumulation.
- `WebglAddon.onContextLoss(...)` already disposes the addon so xterm can fall back instead of freezing.
- `src/App.css` intentionally avoids forced GPU layer promotion on the background wrapper because it can make xterm overlay text blurry.
- Tauri/WebView2 browser arguments are high-risk and should not be the first optimization lever.

## Assumptions

- The first valuable implementation should improve terminal rendering reliability and responsiveness without redesigning the app.
- Hardware acceleration should be automatic by default, not require users to understand WebGL internals.
- CPU work should be reduced on hot output paths before adding broad configuration knobs.

## Requirements

- Add a stable renderer strategy for terminal rendering that prefers GPU acceleration when safe.
- Improve fallback diagnostics so WebGL failure or context loss degrades clearly to the built-in DOM renderer without freezing.
- Preserve current background image and transparency behavior.
- Preserve current hidden-tab bounded buffering behavior.
- Add enough diagnostics to verify which renderer path is active and when fallback occurs.
- Avoid WebView2/Chromium command-line flag changes in the MVP unless a later measurement proves they are needed.

## Acceptance Criteria

- [x] Terminal opens normally with the default renderer path.
- [x] WebGL renderer remains the preferred path when available.
- [x] WebGL creation failure or context loss falls back gracefully without freezing the terminal.
- [x] High-throughput PTY output remains responsive and does not introduce unbounded memory growth.
- [x] Background image, opacity, blur, and darken behavior still work.
- [x] TypeScript check passes with `npx tsc --noEmit`.
- [x] If backend/Tauri code is touched, `cd src-tauri && cargo check` passes.
- [x] Manual UI verification covers multiple tabs, split terminal, large output, background image, and renderer fallback where feasible.

## Definition of Done

- Minimal code changes only.
- Existing behavior is preserved unless explicitly changed in this PRD.
- No unrelated refactor.
- Do not add the Canvas fallback dependency in this MVP because current published versions declare an incompatible xterm peer range for this project.
- Verification results are recorded in the final response.

## Research Notes

### What similar tools/patterns suggest

- xterm.js recommends disposing `WebglAddon` on WebGL context loss.
- Existing project research notes recommend renderer fallback chain: WebGL -> Canvas -> DOM.
- Tauri on Windows uses WebView2 based on Chromium; WebView browser arguments are powerful and risky, so they should remain Rust-side controlled and not be exposed casually.

### Constraints from this repo

- `allowTransparency` is construction-time only and is already always enabled.
- Background CSS deliberately avoids forced GPU compositing to protect text sharpness.
- Frontend quality rules require bounded buffers for hidden terminal output and avoiding wasteful allocation in hot UI scans.

### Feasible approaches

**Approach A: Renderer diagnostics + CPU hot-path tuning (Recommended)**

- How it works: keep WebGL as default, log/track renderer selection and context loss, and cap active terminal writes per animation frame.
- Pros: small, targeted, improves responsiveness and observability without incompatible dependency changes.
- Cons: WebGL failure still falls back to xterm's built-in DOM renderer.

**Approach B: CPU hot-path first**

- How it works: tune PTY output batching, base64 decode allocation, write throttling, and inactive buffer handling.
- Pros: no new dependency, improves worst-case output pressure.
- Cons: current code already has several protections; gains may be smaller without measurement.

**Approach C: WebView2 GPU flags experiment**

- How it works: add Rust-side controlled WebView2 browser arguments or environment-based launch flags.
- Pros: may help on some machines.
- Cons: high risk, platform-specific, hard to prove, can weaken stability/security if done casually.

## Technical Approach

Recommended MVP: combine Approach A with limited Approach B instrumentation. Do not change WebView2 flags in MVP.

## Decision (ADR-lite)

**Context**: The terminal already uses WebGL, so the problem is not missing hardware acceleration but robustness, fallback quality, and CPU pressure under real workloads.

**Decision**: Prefer WebGL automatically, add safer fallback and diagnostics, and keep WebView2 GPU flags out of the MVP.

**Consequences**: The first implementation stays low-risk and measurable. Deeper platform-level GPU tuning can be a separate task if measurements prove it is necessary.

## Out of Scope

- Replacing xterm.js.
- Native DirectWrite/Direct2D/Metal terminal rendering.
- Broad WebView2/Chromium command-line flag changes.
- Reworking the terminal layout system.
- Changing PTY protocol or backend event format unless measurement later proves it necessary.

## Open Questions

- Answered: skip `@xterm/addon-canvas` in this MVP because current published versions are not compatible with `@xterm/xterm@6` under npm peer resolution.

## Technical Notes

- Relevant files inspected: `src/components/XTermTerminal.tsx`, `src/stores/settingsStore.ts`, `src/stores/terminalStore.ts`, `src/App.css`, `package.json`, `src-tauri/tauri.conf.json`.
- Existing dependency versions: `@xterm/xterm@^6.0.0`, `@xterm/addon-webgl@^0.19.0`, `@xterm/addon-fit@^0.11.0`.
- `@xterm/addon-canvas` was checked but not added: npm rejects it with `@xterm/xterm@6.0.0` because the addon currently declares `@xterm/xterm@^5.0.0` as peer dependency.
