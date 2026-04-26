<!-- refreshed: 2026-04-26 -->
# Architecture

**Analysis Date:** 2026-04-26

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                       Native / Desktop Shells                        │
├──────────────────┬───────────────────┬──────────────────────────────┤
│  Capacitor iOS   │ Capacitor Android │  Tauri Desktop (macOS/Win/   │
│  `app/ios/`      │ `app/android/`    │  Linux) `app/src-tauri/`      │
│  WKWebView host  │ WebView host      │  Rust + WebView host          │
└────────┬─────────┴─────────┬─────────┴──────────────┬───────────────┘
         │                   │                         │
         └───────────────────┴─────────────────────────┘
                             │
                             ▼  (loads `dist/index.html`)
┌─────────────────────────────────────────────────────────────────────┐
│           React 19 SPA — Vite-bundled, served from `dist/`           │
│           Entry: `app/index.html` → `app/src/main.tsx` → App         │
├─────────────────────────────────────────────────────────────────────┤
│  Pages (route-level, lazy)            `app/src/pages/`               │
│  Components (feature + ui primitives) `app/src/components/`          │
│  Contexts (PiP)                       `app/src/contexts/`            │
└────────┬────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Hooks Layer  `app/src/hooks/`                                       │
│  Bridges UI to data: useMonitors, useCurrentProfile,                 │
│  useBandwidthSettings, useTokenRefresh, useNotificationAutoConnect…  │
└────────┬────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┬───────────────────────┐
│  State Stores `app/src/stores/`             │  Services             │
│  Zustand (with `persist` middleware):       │  `app/src/services/`  │
│  profile, auth, settings, dashboard,        │  Long-running clients:│
│  notifications, monitors, logs,             │  ZMNotificationService│
│  backgroundTasks, eventFavorites, kiosk     │  pushNotifications,   │
│                                             │  eventPoller          │
│  Cross-cutting: query-cache, profile-       │                       │
│  bootstrap, profile-initialization          │                       │
└────────┬────────────────────────────────────┴────────┬──────────────┘
         │                                              │
         ▼                                              │
┌─────────────────────────────────────────────────┐    │
│  API Layer  `app/src/api/`                      │    │
│  Domain modules (auth, monitors, events, etc.)  │    │
│  Singleton ApiClient: `app/src/api/client.ts`   │    │
│  Zod-validated responses (`api/types.ts`)       │    │
└────────┬────────────────────────────────────────┘    │
         │                                              │
         ▼                                              │
┌─────────────────────────────────────────────────────────────────────┐
│  HTTP Layer  `app/src/lib/http.ts`                                   │
│  Single `httpRequest` switching on `Platform`:                       │
│  • Native → `CapacitorHttp` (bypasses CORS)                          │
│  • Tauri  → `@tauri-apps/plugin-http` (with optional cert override)  │
│  • Web    → `fetch` (proxies through localhost:3001 in dev)          │
└────────┬────────────────────────────────────────────┬───────────────┘
         │                                            │
         ▼                                            ▼
┌─────────────────────────────────┐    ┌─────────────────────────────┐
│  ZoneMinder Server (REST API)   │    │  zmeventnotification        │
│  /api/host/login.json,          │    │  WebSocket server           │
│  /api/monitors.json, /events…   │    │  (real-time push events)    │
└─────────────────────────────────┘    └─────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App root | Provider tree (QueryClient, Theme, Router, Pip, ErrorBoundary), top-level routes, splash dismissal, log-level wiring | `app/src/App.tsx` |
| AppLayout | Authenticated shell: sidebar, mobile drawer, kiosk overlay, TOFU cert dialog, route persistence | `app/src/components/layout/AppLayout.tsx` |
| Pages | Route-level screens (lazy-loaded) — Dashboard, Monitors, Events, Timeline, Profiles, Settings, Logs | `app/src/pages/` |
| Hooks | Reusable data and behavior hooks composing stores + React Query | `app/src/hooks/` |
| Profile store | Multi-server profile management, secure password storage, profile-switch orchestration with rollback | `app/src/stores/profile.ts` |
| Auth store | Access/refresh tokens, encrypted refresh-token persistence, login/refresh actions | `app/src/stores/auth.ts` |
| Settings store | Profile-scoped settings (`profileSettings[profileId]`), persisted via `getProfileSettings`/`updateProfileSettings` | `app/src/stores/settings.ts` |
| API client | Singleton with token injection, 401 refresh, proactive re-login, correlation IDs | `app/src/api/client.ts` |
| HTTP layer | Platform-agnostic request abstraction with progress/streaming and dev-proxy routing | `app/src/lib/http.ts` |
| Platform helper | Centralized runtime detection (`isNative`, `isTauri`, `isWeb`, `shouldUseProxy`, `isTVDevice`) | `app/src/lib/platform.ts` |
| Logger | Component-scoped log helpers with level filtering and sanitization, persisted to `useLogStore` | `app/src/lib/logger.ts` |
| URL builder | ZoneMinder URL construction (portal/api/zms/cgi-bin paths, query/token injection) | `app/src/lib/url-builder.ts` |
| Bandwidth helper | Maps `normal`/`low` mode to polling intervals, image quality, FPS | `app/src/lib/zmninja-ng-constants.ts` + `app/src/hooks/useBandwidthSettings.ts` |
| Notification service | WebSocket client to `zmeventnotification.pl` with reconnect backoff and pending auth | `app/src/services/notifications.ts` |
| Push notifications | FCM-based push handling for iOS/Android | `app/src/services/pushNotifications.ts` |
| Tauri biometric plugin | Rust-side biometric auth bridge | `app/src-tauri/src/biometric.rs` |
| Capacitor PiP plugin | Custom Picture-in-Picture plugin with web fallback | `app/src/plugins/pip/` |
| Capacitor SSL-trust plugin | Custom self-signed cert trust plugin | `app/src/plugins/ssl-trust/` |

## Pattern Overview

**Overall:** React 19 single-page application embedded in three native shells (Capacitor iOS, Capacitor Android, Tauri desktop). Layered architecture: Pages → Hooks → Stores/Services → API → HTTP → ZoneMinder. State is split between Zustand (persistent client state) and React Query (server state cache).

**Key Characteristics:**
- Single bundled SPA (`dist/`) loaded by every shell — no per-platform UI code paths.
- Platform differences isolated to `app/src/lib/platform.ts` and dispatched inside `app/src/lib/http.ts`, `app/src/lib/secureStorage.ts`, `app/src/lib/ssl-trust.ts`, `app/src/lib/download.ts`.
- Multi-server: every persisted setting and React Query key is profile-scoped (`['monitors', currentProfile?.id]`).
- Lazy-loaded route components and manual vendor chunk splitting (`app/vite.config.ts`).
- Capacitor plugins always imported dynamically with platform guards; never statically (rule #14).
- Hash routing (`HashRouter`) so file-based loads work inside `file://` web views.

## Layers

**Pages layer:**
- Purpose: Route-level views; orchestrate hooks and components, no direct API calls.
- Location: `app/src/pages/`
- Contains: `Dashboard.tsx`, `Monitors.tsx`, `MonitorDetail.tsx`, `Montage.tsx`, `Events.tsx`, `EventDetail.tsx`, `EventMontage.tsx`, `Timeline.tsx`, `NotificationHistory.tsx`, `NotificationSettings.tsx`, `Profiles.tsx`, `ProfileForm.tsx`, `Server.tsx`, `Settings.tsx`, `States.tsx`, `Logs.tsx`.
- Depends on: components, hooks, stores.
- Used by: `app/src/App.tsx` route table (all lazy via `React.lazy`).

**Components layer:**
- Purpose: Reusable UI — feature-grouped subdirectories plus generic `ui/` primitives.
- Location: `app/src/components/`
- Subdirectories: `layout/`, `ui/`, `dashboard/` (+ `widgets/`), `events/`, `filters/`, `kiosk/`, `monitor-detail/`, `monitors/`, `montage/` (+ `hooks/`), `notifications/`, `settings/`, `timeline/`, `tv/`, `video/`.
- `ui/` mirrors a shadcn-style primitive set built on Radix (`button.tsx`, `dialog.tsx`, `select.tsx`, `tabs.tsx`, `toast.tsx`, `sheet.tsx`, etc.).

**Hooks layer:**
- Purpose: Reusable state/behavior bridging stores and React Query.
- Location: `app/src/hooks/`
- Contains: data hooks (`useMonitors`, `useGroups`, `useEventFilters`, `useEventTags`, `useCurrentProfile`, `useServerUrls`), streaming (`useMonitorStream`, `useGo2RTCStream`, `useStreamLifecycle`), gestures (`usePinchZoom`, `usePullToRefresh`, `useSwipeNavigation`, `useZoomPan`), TV/kiosk (`useTvMode`, `useTvKeyHandler`, `useKioskLock`), notifications (`useNotificationAutoConnect`, `useNotificationDelivered`, `useNotificationPushSetup`), platform (`useInsomnia`, `useBiometricAuth`, `useImageError`).
- Depends on: stores, api, lib utilities.

**State layer (Zustand):**
- Purpose: Client state that survives page transitions; some persisted to localStorage.
- Location: `app/src/stores/`
- Stores: `profile.ts`, `auth.ts`, `settings.ts`, `dashboard.ts`, `notifications.ts`, `monitors.ts`, `logs.ts`, `backgroundTasks.ts`, `eventFavorites.ts`, `kioskStore.ts`, `query-cache.ts`.
- Helpers: `profile-bootstrap.ts` (post-switch auth/timezone/zms/multi-port resolution), `profile-initialization.ts` (rehydration logic).
- Persistence: `zustand/middleware/persist`. Auth refresh tokens are encrypted via Web Crypto (`app/src/lib/crypto.ts`); profile passwords are stored in native Keychain/Keystore via `app/src/lib/secureStorage.ts`.

**Services layer:**
- Purpose: Long-lived clients/processes (sockets, pollers) that don't fit a hook lifecycle.
- Location: `app/src/services/`
- Contains: `notifications.ts` (WebSocket service to `zmeventnotification.pl`), `pushNotifications.ts` (FCM push setup/handlers), `eventPoller.ts` (fallback polling for direct-notification mode), `profile.ts` (password secure-storage helpers).

**API layer:**
- Purpose: Typed ZoneMinder REST endpoints; one module per resource. All responses validated with Zod.
- Location: `app/src/api/`
- Contains: `client.ts` (singleton + request pipeline), `types.ts` (Zod schemas, ~22KB), `auth.ts`, `monitors.ts`, `events.ts`, `groups.ts`, `logs.ts`, `notifications.ts`, `server.ts`, `states.ts`, `tags.ts`, `time.ts`, `zones.ts`.
- Pattern: every function calls `getApiClient()`, then `validateApiResponse(Schema, response.data, …)`.

**HTTP layer:**
- Purpose: Platform-agnostic transport. Switches implementation based on runtime.
- Location: `app/src/lib/http.ts`
- Public surface: `httpRequest`, `httpGet`, `httpPost`, `httpPut`, `httpDelete`.
- Implementations: `nativeHttpRequest` (CapacitorHttp), `tauriHttpRequest` (`@tauri-apps/plugin-http` with optional `acceptInvalidCerts`), `webHttpRequest` (browser `fetch`, dev-mode rewrites to `http://localhost:3001/proxy`).

**Native shells:**
- iOS Capacitor: `app/ios/App/` — Xcode project. Build via `npm run ios`.
- Android Capacitor: `app/android/` — Gradle project. Build via `npm run android`.
- Tauri desktop: `app/src-tauri/` — Rust crate (`Cargo.toml`, `src/lib.rs`, `src/main.rs`, `src/biometric.rs`). Build via `npm run tauri:build`.

## Data Flow

### Primary Request Path (e.g., load monitors list)

1. Component renders, calls `useMonitors()` (`app/src/hooks/useMonitors.ts:57`).
2. Hook calls `useCurrentProfile()` to scope query and `useBandwidthSettings()` for `refetchInterval`.
3. React Query invokes `getMonitors` (`app/src/api/monitors.ts:26`).
4. `getMonitors` calls `getApiClient().get('/monitors.json')` (`app/src/api/client.ts:209`).
5. ApiClient's internal `request` injects `token` query param, applies 401-retry logic, and calls `httpRequest` (`app/src/lib/http.ts:229`).
6. `httpRequest` dispatches based on `Platform`: `nativeHttpRequest`, `tauriHttpRequest`, or `webHttpRequest`.
7. Response returns up the chain; `validateApiResponse` runs Zod schema; deleted monitors are filtered out (`app/src/api/monitors.ts:39`).
8. React Query caches result keyed by `['monitors', profileId]`; component re-renders.

### Authentication Flow

1. User submits credentials in `ProfileForm` (`app/src/pages/ProfileForm.tsx`) or app boots with stored profile.
2. `useProfileStore.switchProfile` (`app/src/stores/profile.ts:236`) clears auth, query cache, and api client; sets new profile id; calls `performBootstrap` (`app/src/stores/profile-bootstrap.ts`).
3. Bootstrap calls `useAuthStore.login` (`app/src/stores/auth.ts`), which calls `apiLogin` (`app/src/api/auth.ts:33`) and stores tokens.
4. Refresh token is encrypted (Web Crypto AES-GCM) before persistence via the custom `encryptedAuthStorage` adapter.
5. Periodic `useTokenRefresh` (`app/src/hooks/useTokenRefresh.ts`) refreshes access token before expiry.
6. On 401 in any request, `app/src/api/client.ts` triggers `refreshAccessToken`, falling back to `reLogin` if refresh fails, with rollback semantics.

### Real-Time Notifications

1. `NotificationHandler` mounts in `App.tsx` and uses `useNotificationAutoConnect` (`app/src/hooks/useNotificationAutoConnect.ts`).
2. Hook constructs a `ZMNotificationService` (`app/src/services/notifications.ts:32`) and connects via WebSocket to the user's `zmeventnotification.pl` host.
3. Incoming events update `useNotificationStore` (`app/src/stores/notifications.ts`) and trigger toasts via `sonner`.
4. On native, FCM push is also wired through `app/src/services/pushNotifications.ts` and the `@capacitor-firebase/messaging` plugin.

### State Management

- **Zustand** for client state (profiles, auth, settings, dashboard layouts, kiosk, logs, background tasks). Each store is a single `create(persist(...))` module under `app/src/stores/`. Stores call each other via `import('./other').useStore.getState()` to avoid circular imports.
- **React Query** for server data (monitors, events, groups, logs, etc.). The shared client is created in `app/src/App.tsx:56` and exposed globally via `setQueryClient` so `clearQueryCache` (`app/src/stores/query-cache.ts`) can invalidate everything during profile switches.
- **React Context** only where strictly required: `PipProvider` (`app/src/contexts/PipContext.tsx`) holds a persistent video.js player + `<video>` element across route changes.

## Key Abstractions

**`ApiClient` (singleton, profile-scoped):**
- Purpose: Auth-aware HTTP wrapper for ZoneMinder API.
- File: `app/src/api/client.ts`
- Pattern: Built per profile via `createApiClient(baseURL, reLogin)`; replaced on profile switch via `setApiClient(...)`. Every request gets a correlation id; 401s trigger refresh-token flow.

**`Platform` (runtime detection):**
- Purpose: Single source of truth for platform branching.
- File: `app/src/lib/platform.ts`
- Pattern: All getters; `isDev`, `isNative`, `isTauri`, `isWeb`, `isDesktopOrWeb`, `shouldUseProxy`, `isTVDevice`. Use these instead of checking `Capacitor`/`window` directly.

**`log` namespace (component-scoped logger):**
- Purpose: Structured logging with sanitization and persistence.
- File: `app/src/lib/logger.ts`
- Pattern: `log.api`, `log.auth`, `log.profileService`, `log.http`, `log.notifications`, `log.app`, `log.download`, `log.profileForm`, `log.secureStorage`, etc. Each helper accepts `(message, level, context?, error?)` and routes through `Logger.log` with sanitization (`app/src/lib/log-sanitizer.ts`) and persistence to `useLogStore`.

**Profile-scoped settings:**
- Purpose: Per-server preferences (theme, polling, layouts, kiosk pin, etc.).
- File: `app/src/stores/settings.ts`
- Pattern: `useSettingsStore.getState().getProfileSettings(profileId)` for reads, `updateProfileSettings(profileId, partial)` for writes. Defaults merged via `DEFAULT_SETTINGS`. Hook consumers should use `useCurrentProfile()` (`app/src/hooks/useCurrentProfile.ts`) which `useShallow`s the raw object before merging defaults to avoid infinite re-renders.

**Bandwidth settings:**
- Purpose: Centralized polling intervals + image quality knobs by mode.
- File: `app/src/lib/zmninja-ng-constants.ts` (`BANDWIDTH_SETTINGS`, `getBandwidthSettings`)
- Hook: `app/src/hooks/useBandwidthSettings.ts`
- Pattern: `low` mode is roughly 2x slower / lower-quality than `normal`. New polling features must read from this rather than hardcoding intervals.

**URL builder:**
- Purpose: Build ZoneMinder URLs (portal, api, zms, cgi-bin, monitor stream, event stream) consistently with token injection.
- File: `app/src/lib/url-builder.ts`

**Secure storage:**
- Purpose: Cross-platform secret storage (passwords, kiosk pin).
- File: `app/src/lib/secureStorage.ts`
- Pattern: Uses `@aparajita/capacitor-secure-storage` on native (Keychain/Keystore), `@capacitor/preferences` or encrypted localStorage elsewhere.

## Entry Points

**Web entry (development and embedded shells):**
- Location: `app/index.html` → `app/src/main.tsx` → `app/src/App.tsx`
- `main.tsx` tags `<html>` with `is-native` class on Capacitor and renders `<App />` inside `<StrictMode>`.

**Capacitor iOS shell:**
- Location: `app/ios/App/`
- Config: `app/capacitor.config.ts` (`appId: com.zoneminder.zmNinjaNG`, `webDir: dist`, `iosScheme: http` for CORS bypass).
- Build: `npm run ios:sync` (sync version + build + `cap sync ios`) then `npm run ios:run`.

**Capacitor Android shell:**
- Location: `app/android/`
- Config: same `capacitor.config.ts` (`androidScheme: http`).
- Build: `npm run android:sync` then `npm run android:run`. Release: `npm run android:release`/`npm run android:bundle`.

**Tauri desktop shell:**
- Location: `app/src-tauri/`
- Config: `app/src-tauri/tauri.conf.json` (window 800×600, frontend served from `../dist`, dev URL `http://localhost:5173`).
- Rust entry: `app/src-tauri/src/main.rs` → `app/src-tauri/src/lib.rs` (`run()`).
- Plugins registered: `tauri-plugin-http`, `tauri-plugin-fs`, `tauri-plugin-dialog`, `tauri-plugin-log`. Custom commands: `check_biometric_available`, `authenticate_biometric` (`app/src-tauri/src/biometric.rs`).
- Build: `npm run tauri:build`. macOS DMG: `scripts/build-desktop.sh`.

**Dev proxy (web only):**
- Location: `app/proxy-server.js`
- Purpose: Express server on port 3001 that forwards `/proxy/*` requests to `X-Target-Host` to bypass browser CORS during development.
- Started by: `npm run dev:all` (proxy + Vite together).

**Mock notification server (testing):**
- Location: `app/mock-notification-server.js`

## Architectural Constraints

- **Threading:** Single-threaded JS event loop in the WebView. Tauri's Rust side runs on its own threads but only exposes a small bridge (biometrics, http, fs, dialog, log).
- **Singletons:** Module-level singletons in `app/src/api/client.ts` (`apiClient`, `correlationIdCounter`, `loginInProgress`, `loginPromise`) and `app/src/lib/http.ts` (`requestIdCounter`). The api client singleton is intentionally swapped on profile switch — never store references to it across switches.
- **Profile switching is destructive:** `switchProfile` clears auth, React Query cache, and api client before installing new ones (`app/src/stores/profile.ts:236`). Anything that caches per-profile data outside Zustand/React Query must subscribe to profile changes.
- **No static Capacitor imports:** All Capacitor plugins must be imported via dynamic `import('@capacitor/...')` inside `Platform.isNative` guards (rule #14). Static imports break the web build.
- **Token in query string, not header:** ZoneMinder accepts `?token=...`. The api client injects this rather than `Authorization` headers (`app/src/api/client.ts:114`).
- **Lazy route components:** Pages must remain `React.lazy` imports in `app/src/App.tsx` so the app shell stays small.
- **HashRouter:** Required because Capacitor and Tauri load `index.html` from `file://` / custom schemes; `BrowserRouter` would 404 on deep links.

## Anti-Patterns

### Static Capacitor imports

**What happens:** A file imports `@capacitor/haptics` (or any plugin) at the top level.
**Why it's wrong:** Web builds break because the plugin's web shim throws at evaluation, or the plugin pulls in native-only code.
**Do this instead:** Wrap in `if (Capacitor.isNativePlatform()) { const { Haptics } = await import('@capacitor/haptics'); … }` (see `AGENTS.md` rule #14 and the dynamic import pattern in `app/src/App.tsx:107`).

### Calling `getProfileSettings(profileId)` inside a Zustand selector

**What happens:** A selector returns `state.getProfileSettings(currentProfileId)`, which builds a new object each call.
**Why it's wrong:** New reference every render → infinite re-render loop. Documented at the top of `app/src/hooks/useCurrentProfile.ts`.
**Do this instead:** Select the raw object with `useShallow` and merge defaults inside `useMemo`, exactly as `useCurrentProfile` does (`app/src/hooks/useCurrentProfile.ts:64`).

### Raw `fetch` / `axios` calls

**What happens:** A new module calls `fetch(url)` directly.
**Why it's wrong:** Skips CORS handling on web (no proxy rewrite), skips Capacitor native HTTP, skips Tauri SSL trust, skips logging, skips token injection.
**Do this instead:** Always go through `httpGet`/`httpPost`/`httpPut`/`httpDelete` from `app/src/lib/http.ts`, or for ZoneMinder endpoints through `getApiClient()` (rule #10).

### Hardcoded polling intervals

**What happens:** A new feature uses `refetchInterval: 5000` literal.
**Why it's wrong:** Breaks the bandwidth-mode contract; users on `low` mode still poll fast (rule #8).
**Do this instead:** Add the property to `BandwidthSettings` in `app/src/lib/zmninja-ng-constants.ts` (with both `normal` and `low` values where `low` is ~2x slower) and read via `useBandwidthSettings()`.

### `console.log` calls

**What happens:** Code uses `console.log`/`console.error` directly.
**Why it's wrong:** Bypasses sanitization, level filtering, and persistence to `useLogStore` (rule #9).
**Do this instead:** Use `log.<component>(message, LogLevel.X, context?, error?)` from `app/src/lib/logger.ts`.

### Hardcoded date/time format strings

**What happens:** A view uses `format(date, 'HH:mm')` from date-fns directly.
**Why it's wrong:** Ignores user's profile date/time preferences (rule #24).
**Do this instead:** Use `useDateTimeFormat()` (`app/src/hooks/useDateTimeFormat.ts`) inside React, or `formatAppDate`/`formatAppTime`/`formatAppDateTime` from `app/src/lib/format-date-time.ts` outside React.

## Error Handling

**Strategy:** Boundary-and-bubble. Errors are caught at sensible boundaries (`ErrorBoundary` at the app root, `RouteErrorBoundary` per route, try/catch in stores and services) and surfaced via `sonner` toasts using i18n strings.

**Patterns:**
- App-level `ErrorBoundary` wraps the entire tree in `app/src/components/ErrorBoundary.tsx`; route-level `RouteErrorBoundary` wraps each `<Route>` element in `app/src/App.tsx`.
- API errors throw `HttpError` with `status`, `statusText`, `data`, `headers` (`app/src/lib/http.ts:48`); `ApiClient` logs them with correlation ids before re-throwing.
- 401 → automatic refresh-token retry, fallback to `reLogin`, then `logout` if all fail (`app/src/api/client.ts:147`).
- Profile switch failures roll back to previous profile (`app/src/stores/profile.ts:292`).
- Bootstrap has a 5-second hard timeout to prevent infinite hangs (`app/src/App.tsx:122`).
- Zod validation failures log and throw via `validateApiResponse` (`app/src/lib/api-validator.ts`).

## Cross-Cutting Concerns

**Logging:** `log.*` helpers in `app/src/lib/logger.ts` with per-component log levels stored in profile settings; persisted to `useLogStore` and viewable in `Logs.tsx`. Sanitization in `app/src/lib/log-sanitizer.ts` redacts passwords/tokens.

**Validation:** Zod schemas colocated with API types in `app/src/api/types.ts`; all API responses run through `validateApiResponse` (`app/src/lib/api-validator.ts`).

**Authentication:** Tokens carried as `?token=` query param; access token in memory only, refresh token persisted (encrypted) in localStorage; profile passwords in native secure storage. `useTokenRefresh` polls expiry.

**Internationalization:** `i18next` + `react-i18next` (`app/src/i18n.ts`). Translations bundled inline (5 languages: `en`, `de`, `es`, `fr`, `zh`) — no runtime HTTP for translations. All user-facing strings must use `t('key')` (rule #5).

**Theming:** `app/src/components/theme-provider.tsx` (light/dark/slate/cream/amber/system) with CSS custom properties.

**TV / spatial nav:** `app/src/lib/tv-spatial-nav.ts` and `tv-dpad-nav.ts` enable d-pad navigation when `Platform.isTVDevice`; `tv-mode` class toggled on `<html>` from `AppLayout`.

**Kiosk mode:** Profile-scoped lock with PIN (`app/src/stores/kioskStore.ts`, `app/src/lib/kioskPin.ts`, `app/src/components/kiosk/`).

**Background tasks:** Centralized download/long-running task tracking in `app/src/stores/backgroundTasks.ts`; rendered by `app/src/components/BackgroundTaskDrawer.tsx`. Mobile downloads must use CapacitorHttp base64 directly to avoid Blob OOM (rule #15).

---

*Architecture analysis: 2026-04-26*
