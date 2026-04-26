# External Integrations

**Analysis Date:** 2026-04-26

## APIs & External Services

**ZoneMinder Server (primary backend):**
- Service: ZoneMinder NVR — REST API + media streams. The app is a client; users supply their own server URL.
- Base URL configured per profile (`portalUrl` / `apiUrl` stored in profile settings)
- API client: `app/src/api/client.ts` (factory `createApiClient`) with token injection and 401 retry/refresh logic
- Per-domain modules under `app/src/api/`:
  - `auth.ts` — `POST /host/login.json`, token refresh, version/api version
  - `events.ts` — `/events*.json` (filtered, paginated)
  - `monitors.ts` — `/monitors*.json`, status, alarm control
  - `states.ts` — `/states/change/*.json` run state changes
  - `server.ts` — `/host/*` (load, disk usage, servers)
  - `groups.ts` — `/groups*.json`
  - `tags.ts` — `/tags*.json`
  - `zones.ts` — `/zones*.json`
  - `logs.ts` — `/logs*.json`
  - `time.ts` — Server timezone (`HostTimeZoneResponseSchema` in `app/src/api/types.ts`)
  - `notifications.ts` — `/notifications.json` POST/PUT/DELETE for ZM Direct push token registration
- All responses validated with Zod schemas in `app/src/api/types.ts`

**Token Authentication (ZoneMinder):**
- Login response decoded by `LoginResponseSchema`: `access_token`, `access_token_expires`, `refresh_token`, `refresh_token_expires`, `version`, `apiversion`
- Token attached as `?token=...` query param by `app/src/api/client.ts` (lines 114–124)
- Auto-refresh window controlled by `ZM_INTEGRATION.accessTokenLeewayMs` and `tokenCheckInterval` in `app/src/lib/zmninja-ng-constants.ts`; orchestrated by `app/src/hooks/useTokenRefresh.ts`

**ZoneMinder Streams Server (`zms`):**
- Path discovered via `ZmsPathResponseSchema` (`app/src/api/auth.ts`)
- MJPEG live + event streams; URLs constructed by `app/src/lib/url-builder.ts`

**Go2RTC (optional, server-side):**
- Used for low-latency streaming (WebRTC / MSE / HLS) when ZM server has Go2RTC configured
- Path discovered via `Go2RTCPathResponseSchema` (`app/src/api/auth.ts`)
- WebSocket URL built by `getGo2RTCWebSocketUrl` in `app/src/lib/url-builder.ts`
- Client implementation: `app/src/lib/vendor/go2rtc/video-rtc.js` (vendored), wrapped by `app/src/hooks/useGo2RTCStream.ts` as a `<video-rtc>` custom element
- Falls back to MJPEG when disabled or unavailable

**ZoneMinder Event Notification Server (zmeventnotificationNg):**
- Real-time WebSocket protocol for event push
- Implementation: `app/src/services/notifications.ts` — `ZMNotificationService` class with reconnect (2 s base, capped 120 s), keepalive ping (`bandwidth.wsKeepaliveInterval`), and authentication
- Configured per profile via `ZMEventServerConfig` (`app/src/types/notifications.ts`)
- Connects via global `WebSocket` API (browser/native)

**Firebase Cloud Messaging (push):**
- Used only on iOS/Android for background push delivery
- Plugin: `@capacitor-firebase/messaging` 7.5.0
- Service: `app/src/services/pushNotifications.ts` — `MobilePushService` class
- Permissions requested via `FirebaseMessaging.requestPermissions()`; token retrieved via `FirebaseMessaging.getToken()`
- Token registered with ZM server via `registerToken` in `app/src/api/notifications.ts` (sends `Notification[Token]`, `Notification[Platform]`, `Notification[Profile]` form data to `/notifications.json`)
- Capacitor presentation options: `['alert', 'badge', 'sound']` (`app/capacitor.config.ts`)
- iOS configuration: `GoogleService-Info.plist` (in iOS bundle); Android: `google-services.json` (in Android project)

## Data Storage

**Databases:**
- None directly. The app is a client to user-supplied ZoneMinder MySQL/MariaDB servers (accessed only via ZM REST API).

**Client-side Storage:**
- Profile data and settings: Zustand stores persisted to `localStorage` (`app/src/stores/`)
- Sensitive credentials (passwords, refresh tokens):
  - iOS — Keychain via `@aparajita/capacitor-secure-storage`
  - Android — Keystore via `@aparajita/capacitor-secure-storage`
  - Web/Tauri — AES-GCM-encrypted blob in `localStorage` with PBKDF2 (100k iterations); see `app/src/lib/secureStorage.ts` and `app/src/lib/crypto.ts`
- Storage prefix: `zmng_secure_`
- Capacitor `Preferences` plugin available (`@capacitor/preferences`) for non-sensitive native key/value

**File Storage:**
- Local filesystem only (per-platform)
- Tauri downloads write to `$DOWNLOADS`, `$DOCUMENTS`, `$DESKTOP`, `$PICTURES`, `$MOVIES` (allow-list in `app/src-tauri/capabilities/default.json`); via `@tauri-apps/plugin-dialog` (`save`) and `@tauri-apps/plugin-fs` (`writeFile`) — see `app/src/lib/download.ts:128-129,358-359`
- Mobile downloads use `@capacitor-community/media` to save to OS gallery (`app/src/lib/download.ts:177,384`); base64 path used to avoid Blob OOM
- Generic native file I/O: `@capacitor/filesystem`

**Caching:**
- TanStack React Query in-memory cache (`QueryClient` in `app/src/App.tsx:56-63`, `retry: 1`, `refetchOnWindowFocus: false`)
- Global query client exposed via `app/src/stores/query-cache.ts` (`setQueryClient`)

## Authentication & Identity

**ZoneMinder Auth (primary):**
- Username + password POSTed as `application/x-www-form-urlencoded` to `/host/login.json` (`app/src/api/auth.ts:33-90`)
- Returns access + refresh JWTs; stored in `useAuthStore` (`app/src/stores/auth.ts`)
- Auto-retry on HTTP 401 via `refreshAccessToken`; falls back to full re-login (`app/src/api/client.ts:147-171`)

**Biometric Local Lock (kiosk PIN / app unlock):**
- Mobile: `@aparajita/capacitor-biometric-auth` 7.2.0
- macOS Tauri: Custom Rust command via LocalAuthentication framework — `check_biometric_available` and `authenticate_biometric` invoked from `app/src/hooks/useBiometricAuth.ts:37-71` through `@tauri-apps/api/core` `invoke`. Implementation at `app/src-tauri/src/biometric.rs` (uses `objc2` FFI for availability check, spawns `swift` CLI for authentication)
- Web/Windows/Linux Tauri: Biometric not available (returns `false`)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Bugsnag, etc. detected)

**Logs:**
- Custom logger at `app/src/lib/logger.ts` — Component-scoped helpers (`log.api`, `log.auth`, `log.push`, `log.notifications`, `log.http`, `log.secureStorage`, `log.profileForm`, `log.download`, `log.app`, etc.) with explicit `LogLevel`
- Per-component log levels stored in profile settings (`componentLogLevels` in `app/src/App.tsx:90`)
- Sensitive data scrubbed by `app/src/lib/log-sanitizer.ts` (`sanitizeObject`) before structured logging
- Tauri side: `tauri-plugin-log` 2.8.0 with file rotation (`KeepOne`, 10 MB max) — `app/src-tauri/src/lib.rs:10-15`
- In-app `Logs` page at `app/src/pages/Logs.tsx`

## CI/CD & Deployment

**Hosting:**
- Web: Static `dist/` hostable anywhere; iOS App Store; Google Play; Tauri bundles distributed via GitHub Releases
- Documentation site: ReadTheDocs (`.readthedocs.yaml`)

**CI Pipeline (GitHub Actions, `.github/workflows/`):**
- `test.yml` — Runs unit tests + coverage on release; conditional E2E run when `ZM_HOST_1`/`ZM_USER_1`/`ZM_PASSWORD_1` secrets present; uploads coverage to Codecov via `codecov/codecov-action@v4`
- `build-android.yml` — Android APK/AAB
- `build-macos.yml`, `build-linux-amd64.yml`, `build-linux-arm64.yml`, `build-windows.yml` — Tauri desktop bundles
- `build-all.yml` — Aggregate build orchestration
- `create-release.yml` — Release creation
- `deploy-pages.yml` — Docs to GitHub Pages
- `claude-code-review.yml`, `claude.yml` — Claude integration (review fork PRs only)
- `auto-close-low-quality-issues.yml` — Issue triage

**Code Coverage:**
- Codecov via `CODECOV_TOKEN` repository secret

## Environment Configuration

**Required env vars (`app/.env`, used by E2E only):**
- `ZM_HOST_1` — Test server #1 URL
- `ZM_USER_1` — Test server #1 username
- `ZM_PASSWORD_1` — Test server #1 password
- `ZM_HOST_2`, `ZM_USER_2`, `ZM_PASSWORD_2` — Optional secondary test server
- Template at `app/.env.example`; loaded by `app/playwright.config.ts:7`

**Optional dev env vars:**
- `ZM_PROXY_INSECURE=1` — Skip TLS verification in `app/proxy-server.js`
- `ANDROID_HOME` — For `npm run android:logs` / `npm run android:devices`
- `TEST_DEVICE` — Selects WDIO platform for `npm run test:screenshots:*`
- `CI` — Read by Playwright config to enable retries

**Production runtime config:**
- All ZM connection details supplied at runtime by the user via Profile UI; nothing is baked into the build.

**Secrets location:**
- Local development: `app/.env` (gitignored, see `.gitignore`)
- CI: GitHub Actions repository secrets (`ZM_HOST_1`, `ZM_USER_1`, `ZM_PASSWORD_1`, `CODECOV_TOKEN`)
- Mobile/desktop end users: Stored in OS-native secure storage (Keychain / Keystore) or AES-GCM encrypted localStorage

## Webhooks & Callbacks

**Incoming:**
- FCM push notifications — Delivered to mobile via `@capacitor-firebase/messaging` listeners; navigation handled by `app/src/components/NotificationHandler.tsx` and `app/src/lib/navigation.ts`
- Deep links — Capacitor URL scheme `http`/`https` (`app/capacitor.config.ts`)
- WebSocket events from ZM Event Server — Routed to `useNotificationStore` (`app/src/stores/notifications.ts`)

**Outgoing:**
- All ZM REST calls (see API module list above)
- FCM token registration to ZM server (`POST /notifications.json`)
- WebSocket auth + keepalive frames to ZM Event Server

## HTTP Client Architecture

**Unified abstraction:** `app/src/lib/http.ts`
- Picks an implementation per platform via `app/src/lib/platform.ts`:
  - Capacitor native (iOS/Android) → `@capacitor/core` HTTP plugin pathway (avoids CORS, supports base64 responses)
  - Tauri desktop → `@tauri-apps/plugin-http` `fetch` (`app/src/lib/http.ts:441`)
  - Web dev → routed through Express proxy (`app/proxy-server.js`, port 3001) using `X-Target-Host` header pattern, plus `/image-proxy?url=...` for image streaming
  - Web prod → direct `fetch`
- Public helpers: `httpGet`, `httpPost`, `httpPut`, `httpDelete`, `httpRequest<T>`
- Request/response types: `HttpOptions`, `HttpResponse<T>`, `HttpError`, `HttpProgress`
- Correlation IDs: monotonically increasing counters in both `app/src/lib/http.ts` and `app/src/api/client.ts`
- Never use raw `fetch` or `axios` directly (per project rules) — `axios` is listed in `package.json` but not imported under `app/src/`

## Native Plugins Summary

**Capacitor (iOS/Android, Capacitor 7.4.4):**
| Plugin | Version | Purpose | Primary file |
|---|---|---|---|
| `@capacitor/core` | 7.4.4 | Platform detection / bridge | `app/src/lib/platform.ts` |
| `@capacitor/filesystem` | 7.1.5 | File I/O | `app/src/lib/download.ts` |
| `@capacitor/haptics` | 7.0.3 | Haptic feedback | Dynamic import |
| `@capacitor/network` | 7.0.4 | Network status | `app/src/hooks/` |
| `@capacitor/preferences` | 7.0.2 | Native key/value | Settings storage |
| `@capacitor/share` | 7.0.2 | Share sheet | Event/image sharing |
| `@capacitor/splash-screen` | 7.0.4 | Launch splash | `app/src/App.tsx:107` |
| `@capacitor-community/media` | 8.0.1 | Save to gallery | `app/src/lib/download.ts:177,384` |
| `@capacitor-firebase/messaging` | 7.5.0 | FCM | `app/src/services/pushNotifications.ts:59,79` |
| `@aparajita/capacitor-biometric-auth` | 7.2.0 | Biometrics | `app/src/hooks/useBiometricAuth.ts` |
| `@aparajita/capacitor-secure-storage` | 7.1.6 | Keychain/Keystore | `app/src/lib/secureStorage.ts` |
| `@capawesome/capacitor-badge` | 7.0.1 | App icon badge | `app/src/stores/notifications.ts:594` |
| `capacitor-barcode-scanner` | 2.5.0 | Native QR | `app/src/components/QRScanner.tsx:123` |

**Custom Capacitor plugins (in-repo):**
- `app/src/plugins/ssl-trust/` — Self-signed certificate trust handling
- `app/src/plugins/pip/` — Picture-in-Picture support

**Tauri (desktop, Tauri 2.10.2) — JS/Rust pairs must stay version-locked:**
| JS package | Rust crate | Version | Purpose |
|---|---|---|---|
| `@tauri-apps/api` | `tauri` | 2.10.x | Core invoke / events |
| `@tauri-apps/plugin-dialog` | `tauri-plugin-dialog` | 2.7.0 | Save dialog |
| `@tauri-apps/plugin-fs` | `tauri-plugin-fs` | 2.5.0 | File write |
| `@tauri-apps/plugin-http` | `tauri-plugin-http` | 2.5.7 | HTTP (with `dangerous-settings`) |
| — | `tauri-plugin-log` | 2.8.0 | Rust logging |

**Tauri custom commands:** `check_biometric_available`, `authenticate_biometric` (`app/src-tauri/src/biometric.rs`).

## Polling Intervals (network bandwidth)

All polling/refresh intervals must be sourced from `useBandwidthSettings()` (React) or `getBandwidthSettings(mode)` (services); defaults in `app/src/lib/zmninja-ng-constants.ts:257-288`. Modes: `normal` and `low` (low ≈ 2× slower). Properties include `monitorStatusInterval`, `alarmStatusInterval`, `eventsWidgetInterval`, `consoleEventsInterval`, `daemonCheckInterval`, `zmsStatusInterval`, `eventPollerInterval`, `wsKeepaliveInterval`, plus `imageScale`, `imageQuality`, `streamMaxFps`.

---

*Integration audit: 2026-04-26*
