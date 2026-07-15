# fix-cross-platform-webdav-password-secure-storage

## Changelog Target

V1.2.8

## Goal

Allow Windows, macOS, and Linux users (including a native CLI-Manager process under WSL/WSLg) to save, restore, and clear the WebDAV password through the platform secure store while keeping passwords out of plaintext app storage.

## Confirmed Facts

- `sync_save_password` currently returns `WebDAV 密码安全存储仅支持 Windows` on every non-Windows target.
- `sync_load_password` and `sync_delete_password` are also Windows-only; macOS therefore cannot persist a password across app restarts.
- The frontend already invokes the same three Tauri commands and needs no command-signature change.
- The existing credential identity is fixed as `service=CLI-Manager`, `user=webdav`.
- `apple-native-keyring-store` 1.0.1 is compatible with `keyring-core` 1.x. Its `keychain` feature uses the macOS login Keychain and does not require a provisioning-profile entitlement.
- `zbus-secret-service-keyring-store` 1.0.0 is compatible with `keyring-core` 1.x and supports freedesktop Secret Service without a native OpenSSL dependency when `rt-tokio-crypto-rust` is enabled.
- Native WSL does not normally expose a Secret Service default collection; the Linux provider supports a named `target` collection that can be created and reused instead.
- GitNexus tools are unavailable in this environment; impact discovery uses the WebDAV sync contract plus repository symbol/keyword search.

## Requirements

- Add the Apple keyring provider only for `target_os = "macos"`, with the `keychain` feature enabled.
- Add the zbus Secret Service provider only for `target_os = "linux"`, with `rt-tokio-crypto-rust` enabled.
- Initialize `keyring-core` with Windows Credential Manager on Windows, the macOS login Keychain on macOS, and freedesktop Secret Service on Linux.
- Reuse the existing `CLI-Manager` / `webdav` service/user identity on all supported platforms.
- On Linux, create every credential entry with a fixed named target collection so native WSL does not depend on a missing default collection.
- Run save, load, and delete operations through the existing blocking-task boundary on Windows, macOS, and Linux.
- Treat a missing credential as `None` when loading and as success when deleting.
- Propagate Keychain initialization/access failures; do not fall back to plaintext storage.
- Keep non-Windows/non-macOS/non-Linux targets unsupported; do not add plaintext or file-based fallback storage.
- Do not change Tauri command names, arguments, or return types.

## Scenario Coverage

- Windows: existing save/load/delete behavior remains unchanged.
- macOS with an unlocked login Keychain: save, restart/load, replace, and delete all use the native Keychain.
- macOS with no existing entry: load returns `None`; delete succeeds.
- macOS with unavailable/denied Keychain access: the command returns an error and no plaintext fallback is written.
- Linux desktop with Secret Service: save, restart/load, replace, and delete use a dedicated CLI-Manager collection.
- Linux without a D-Bus Secret Service provider, or with denied/locked access: return an error and do not persist plaintext fallback data.
- Empty password: uses the existing delete behavior.
- WSL terminal sessions hosted by the Windows desktop app: use the Windows credential backend because the Tauri command runs in the Windows host process.
- Native CLI-Manager inside WSL/WSLg: use Linux Secret Service with the dedicated collection; a Secret Service daemon/session bus must be available.

## Acceptance Criteria

- [ ] Saving a non-empty WebDAV password on macOS no longer returns the Windows-only error and writes the fixed credential entry to the login Keychain.
- [ ] Restarting on macOS restores the password through `sync_load_password`, so `hasPassword` becomes true without re-entry.
- [ ] Clearing or saving an empty password removes the macOS Keychain entry and leaves subsequent loads as `None`.
- [ ] Windows continues to use `windows-native-keyring-store` with the same service/user identity.
- [ ] Linux and native WSL use `zbus-secret-service-keyring-store` with a fixed target collection, and do not require a default collection.
- [ ] Passwords remain absent from Tauri store, SQLite, logs, and WebDAV snapshots.
- [ ] Native Windows `cargo check` passes.
- [ ] A macOS-target compile check is attempted when the target/toolchain is available; otherwise the limitation is reported with Cargo metadata/source-level validation.
- [ ] `CHANGELOG.md` and `docs/功能清单.md` describe Windows Credential Manager, macOS Keychain, and Linux Secret Service support under V1.2.8.

## Out of Scope

- Credential migration between operating systems or devices.
- iCloud Keychain synchronization, biometric access policies, or Apple protected-data storage.
- Linux kernel keyutils fallback when Secret Service is unavailable.
- Frontend layout or WebDAV protocol changes.

## Verification

- Passed: Rust formatting check.
- Passed: native Windows `cargo check --locked`.
- Passed: Rust library test target compilation for the sync filter.
- Passed: Cargo target dependency selection for Windows Credential Manager, macOS Keychain, and Linux Secret Service; Linux feature resolution includes `rt-tokio-crypto-rust`.
- Passed: GitNexus `detect-changes` reports five expected password symbols, zero affected execution flows, and low risk.
- Pending human runtime verification: macOS Keychain lifecycle and Linux/WSL Secret Service lifecycle. The current Windows host has no macOS target and no installed WSL distribution.
