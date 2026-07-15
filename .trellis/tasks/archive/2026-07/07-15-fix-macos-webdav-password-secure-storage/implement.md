# Implementation Plan

1. Record symbol impact and repository touchpoints for the three password commands and their helper functions.
2. Add `apple-native-keyring-store` under macOS and `zbus-secret-service-keyring-store` under Linux; keep `keyring-core` available on all three supported desktop targets.
3. Generalize the Rust password helper and command cfg gates to Windows + macOS + Linux, using a fixed Linux target collection for native WSL compatibility while preserving other unsupported-target behavior.
4. Refresh `Cargo.lock` through Cargo dependency resolution.
5. Update the V1.2.8 changelog entry and WebDAV feature inventory wording.
6. Run formatting, native `cargo check`, focused/static tests as applicable, a macOS-target check when available, and Trellis change-scope verification.

## Risky Files

- `src-tauri/src/commands/sync.rs`: process-global keyring provider initialization and password lifecycle.
- `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock`: target-specific native dependency resolution.

## Validation

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- macOS/Linux target `cargo check` if those targets are installed/usable.
- Confirm Cargo metadata/tree selects only the matching native provider on Windows, macOS, and Linux.
- Confirm no plaintext password persistence path was added.
