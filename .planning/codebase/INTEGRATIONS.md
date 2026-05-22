# External Integrations

**Analysis Date:** 2026-05-22

## APIs & External Services

**Database:**
- Microsoft SQL Server - Schema metadata source; all connection targets are user-supplied SQL Server instances
  - SDK/Client: `tiberius` 0.12 (Rust crate, TDS protocol, no ODBC driver)
  - Auth: SQL Server auth (username/password) or Windows Integrated auth (Windows only)
  - Connection params: server, port, database, trust_server_certificate flag
  - Implementation: `src-tauri/src/db/connection.rs`, `src-tauri/src/db/queries.rs`

**Auto-Updater:**
- GitHub Releases - Update manifest endpoint
  - Endpoint: `https://github.com/elliotlayen/Monocle/releases/latest/download/latest.json`
  - Plugin: `tauri-plugin-updater` 2 / `@tauri-apps/plugin-updater` 2.9.0
  - Verification: minisign public key embedded in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`)
  - User is prompted to update when a newer version is detected

## Data Storage

**Databases:**
- SQL Server - External user-managed database (read-only metadata queries)
  - Connection: user-supplied at runtime (server address, credentials)
  - Client: `tiberius` via TCP/TLS in `src-tauri/src/db/connection.rs`
  - Default port: 1433; supports named instances via SSRP (UDP 1434)

**App Settings Storage:**
- JSON file on local disk
  - Location: `{app_data_dir}/settings.json` (resolved by Tauri at runtime)
  - Schema: `AppSettings` struct in `src-tauri/src/state.rs`
  - Access: `Mutex<AppSettings>` in `AppState`; written via `AppState::save_settings()`
  - Commands: `get_settings`, `save_settings` in `src-tauri/src/commands/settings.rs`

**Browser localStorage:**
- Connection settings persistence (non-sensitive fields only)
  - Key: `monocle-connection-settings`
  - Stores: `server`, `authType`, `username` (username only for SQL Server auth)
  - Passwords are never stored
  - Implementation: `src/features/connection/services/connection-settings.ts`
- Theme preference
  - Key: used by `src/providers/theme-provider.tsx`

**File Storage:**
- Local filesystem only (no cloud storage)
  - Plugin: `tauri-plugin-fs` 2 / `@tauri-apps/plugin-fs` 2.4.5
  - Used for export: PNG, PDF, JSON files saved via native save dialog
  - Implementation: `src/features/export/services/export-service.ts`

**Caching:**
- In-memory session cache only
  - Import dialog caches database list within a session: `src/features/canvas/components/import-from-database-dialog-state.ts`
  - No persistent cache layer

## Authentication & Identity

**Auth Provider:**
- None (no user accounts, no cloud identity)

**SQL Server Authentication:**
- SQL Server auth: username + password supplied at connection time; password never persisted
- Windows Integrated auth: uses OS credentials via `tiberius::AuthMethod::Integrated` (Windows builds only)
- TLS: `EncryptionLevel::Required` with optional `trust_cert()` for self-signed certificates
- Implementation: `src-tauri/src/db/connection.rs`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, or similar service integrated)

**Logs:**
- `console.error` in frontend IPC wrapper (`src/services/tauri.ts`)
- Rust `eprintln!`/standard error for Tauri runtime errors
- No structured logging framework

## CI/CD & Deployment

**Hosting:**
- GitHub Releases - Distribution of `.dmg`, `.tar.gz`, `.exe`, `.msi` artifacts
- No server hosting (desktop app)

**CI Pipeline:**
- GitHub Actions (`/.github/workflows/release.yml`)
  - Trigger: manual `workflow_dispatch`
  - macOS builds: `macos-latest` runner, matrix over `aarch64-apple-darwin` and `x86_64-apple-darwin`
  - Windows build: `windows-latest` runner, `x86_64`
  - Release job: ubuntu-latest; generates `latest.json` for auto-updater, creates GitHub release, opens version-bump PR
  - Signing secrets: `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (GitHub repo secrets)
  - Version source of truth: `src-tauri/tauri.conf.json`

## Environment Configuration

**Required env vars at runtime:**
- None. The app requires no API keys or environment variables to run.

**Required secrets (CI/CD only):**
- `TAURI_SIGNING_PRIVATE_KEY` - Private key for signing update artifacts
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - Password for the signing key
- `GITHUB_TOKEN` - Provided by GitHub Actions; used to create releases and PRs

**Secrets location:**
- GitHub repository secrets (Actions); no `.env` files present or required

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None (the auto-updater polls `latest.json` via HTTP GET; no webhooks)

## Native OS Integrations

**Tauri Plugins Used:**
- `tauri-plugin-opener` - Open URLs in default browser; open files with default OS app
- `tauri-plugin-dialog` - Native save/open file picker dialogs
- `tauri-plugin-fs` - Write exported files to local filesystem
- `tauri-plugin-process` - App restart on update apply
- `tauri-plugin-updater` - In-app update check and installation

**Menu Events (macOS/Windows native menu bar):**
- Native menu emits Tauri events consumed via event hubs in `src/services/events.ts`
- Events: `menu:toggle-sidebar`, `menu:fit-view`, `menu:actual-size`, `menu:zoom-in`, `menu:zoom-out`, `menu:export-png`, `menu:export-pdf`, `menu:export-json`, `menu:check-updates`, `menu:delete-selection`
- Menu setup: `src-tauri/src/commands/menu.rs`

**Network:**
- SQL Server Browser (SSRP) - UDP port 1434 for named instance resolution
  - Implementation: `src-tauri/src/db/ssrp.rs`

---

*Integration audit: 2026-05-22*
