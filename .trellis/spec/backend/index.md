# Backend Development Guidelines

> Concrete backend contracts for Rust/Tauri code in this project.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [WebDAV Sync Contracts](./webdav-sync-contracts.md) | WebDAV sync request/response boundaries, size checks, and validation cases | Active |
| [Terminal Runtime Monitoring Contracts](./terminal-runtime-monitoring-contracts.md) | PTY env keys, shell OSC marker format, and tab runtime status mapping | Active |
| [Tauri Updater Contracts](./tauri-updater-contracts.md) | Signed updater config, capabilities, release artifacts, and install/relaunch UX contracts | Active |
| [cc-switch Integration Contracts](./ccswitch-integration-contracts.md) | External SQLite read-only access (sqlx, no rusqlite), secret masking, and per-project settings.json env replacement | Active |
| [History Stats Contracts](./history-stats-contracts.md) | History usage stats payloads, token/cost fields, cache behavior, and frontend normalization | Active |

---

## Pre-Development Checklist

Before modifying Rust/Tauri backend code:

- [ ] Read the relevant contract file for the affected module.
- [ ] Keep existing Tauri command signatures stable unless the task explicitly changes the contract.
- [ ] Validate external input at the Rust boundary, not only in the WebView.
- [ ] Run `cd src-tauri && cargo check` after backend changes.
