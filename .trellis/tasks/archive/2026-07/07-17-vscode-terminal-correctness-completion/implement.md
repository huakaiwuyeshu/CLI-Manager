# Implementation Plan

1. Add protocol versions/features, process traits, resize pixels, binary input/checkpoint/reset kinds and compatibility tests.
2. Add legacy Tauri transport and restore alive/exited daemon sessions correctly.
3. Replace replay storage with per-session checkpoint + streamed raw delta; isolate slow-client flow control.
4. Add frontend checkpoint barrier/upload and streaming reset/delta attach.
5. Apply platform-specific xterm traits, DA1/reflow, resize bounds, Windows environment merge and ConPTY throttle.
6. Introduce terminal instance/addon ownership, remove dead capability store, and stop unconditional tab refresh.
7. Add bilingual warnings, CHANGELOG/feature docs, cross-platform tests and CI jobs.
8. Run TypeScript/Rust/test/diff/GitNexus quality gates.
