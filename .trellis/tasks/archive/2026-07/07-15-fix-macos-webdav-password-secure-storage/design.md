# Design

## Root Cause

The bug lives at the Rust platform-adapter boundary: all credential commands originally compiled their functional path only for Windows, so the fix must provide native macOS and Linux stores at keyring initialization rather than suppressing frontend errors or adding plaintext fallback state.

## Data Flow

`SyncSettingsPage` -> `syncStore` -> existing Tauri password command -> `keyring-core::Entry` -> platform-native credential store.

- Windows provider: `windows-native-keyring-store`.
- macOS provider: `apple-native-keyring-store::keychain` using the user/login Keychain.
- Linux provider: `zbus-secret-service-keyring-store` using a dedicated `CLI-Manager` collection over freedesktop Secret Service.
- Unsupported targets retain the existing non-persistent behavior and do not receive a plaintext fallback.

## Implementation Shape

- Keep one shared `webdav_password_entry` and shared save/load/delete code for Windows, macOS, and Linux.
- Select the provider inside one-time initialization with target-specific `cfg` blocks.
- Build Linux entries with a fixed `target` modifier on every access so WSL does not require a default collection.
- Scope native provider dependencies under target-specific Cargo dependency tables.
- Preserve the service/user pair so frontend state and command contracts remain unchanged.

## Compatibility and Risk

- The Apple crate requires Rust 1.85; the project toolchain is newer.
- The `keychain` backend is chosen instead of `protected` because it works without provisioning-profile entitlements and matches ordinary desktop application distribution.
- The Linux provider uses `rt-tokio-crypto-rust` to match the application runtime and avoid a new OpenSSL dependency.
- Linux Secret Service requires a working D-Bus session and provider (for example GNOME Keyring or KWallet). Native WSL must supply one; missing infrastructure is an explicit error, not a persistence fallback trigger.
- `keyring-core` has a process-global default store; initialization remains one-time and platform-exclusive, matching the existing Windows implementation.
- No secret value is logged, serialized, or migrated.

## Rollback

Remove the macOS/Linux target dependencies and restore the password helper/commands to their Windows-only cfg gates. No stored app data migration is involved.
