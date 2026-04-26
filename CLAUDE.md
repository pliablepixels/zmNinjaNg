Use @AGENTS.md as your instructions

<!-- GSD:project-start source:PROJECT.md -->
## Project

**zmNinjaNg**

zmNinjaNg is a cross-platform (web, iOS, Android, macOS/Windows/Linux desktop) client for ZoneMinder NVR servers. It connects to a user's ZoneMinder portal to show live monitors, browse events, scrub timelines, manage zones, and receive real-time + push notifications. Users are home/hobbyist installs, prosumer multi-camera setups, and mobile-first owners checking alerts on the go.

**Core Value:** A user can go from a push notification to "is this real, do I care?" in under 10 seconds without ever opening the full app.

### Constraints

- **Tech stack**: TypeScript 5.9, React 19, Vite 7, Capacitor 7, Tauri 2, shadcn-on-Radix UI, Zustand, React Query, react-i18next — locked by the existing codebase. New deps must match Capacitor major version and verify peer deps.
- **Cross-platform**: every feature must work on web + iOS + Android + Tauri desktop — but via *functional equivalents*, not pixel parity. Widget on mobile = menu-bar/tray on Tauri = top-bar dock on web. Same job, different surface.
- **i18n**: every user-facing string ships simultaneously in en, de, es, fr, zh. Labels stay short enough to render on a 320px-wide phone.
- **Profile-scoped settings**: anything user-tweakable goes through `getProfileSettings`/`updateProfileSettings`. No global singletons.
- **Bandwidth-aware**: any polling/refresh runs via `useBandwidthSettings()` — never hardcode intervals.
- **Logging / HTTP / dates**: use `lib/logger`, `lib/http`, and `useDateTimeFormat()` exclusively. No `console.*`, raw `fetch`, or hardcoded date-fns patterns in user-visible output.
- **Capacitor plugins**: dynamic-import + platform check only. Add tests/setup.ts mocks for any new plugin.
- **Tauri packages**: JS `@tauri-apps/*` and Rust `tauri-plugin-*` versions must move together.
- **Testing**: `npm test` + `npx tsc --noEmit` + `npm run build` + relevant `npm run test:e2e` must pass before every commit. UI changes need `data-testid` and a `.feature` scenario with platform tags. Device e2e (`ios-phone`, `android-phone`, `ios-tablet`, `tauri`) is manual-invoke only.
- **Issues-first**: every feature gets a GitHub issue before implementation; commits use conventional format and reference the issue.
- **No superlatives in any artifact** (per project rule 1).
- **Timeline**: ~2-4 weeks for the milestone.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ~5.9.3 — All application source under `app/src/` (`.ts`/`.tsx`); `tsconfig.app.json` enforces `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`
- Rust 2021 edition (rust-version 1.77.2) — Tauri desktop shell at `app/src-tauri/src/`
- JavaScript (ESM) — Dev tooling (`app/proxy-server.js`, `app/mock-notification-server.js`, `app/eslint.config.js`, `app/postcss.config.js`, `app/tailwind.config.js`)
- Swift (inline via `swift -e` CLI) — Embedded in `app/src-tauri/src/biometric.rs` for macOS LocalAuthentication framework calls
- Bash — Platform test runners under `scripts/test-*.sh`
## Runtime
- Node.js 20 (CI pinned via `.github/workflows/test.yml`)
- Browser: ES2022, DOM, DOM.Iterable (`app/tsconfig.app.json`)
- Native runtimes: WKWebView (iOS via Capacitor 7), Android System WebView (Capacitor 7), WKWebView/WebKitGTK/WebView2 (Tauri 2)
- npm
- Lockfiles: `app/package-lock.json` (757KB) and root `package-lock.json` present
- Workspace pattern: root `package.json` proxies most scripts to `app/` via `npm --prefix app`
## Frameworks
- React 19.2.0 — UI library (`react`, `react-dom`)
- React Router DOM 7.9.6 — Hash-based routing (`HashRouter` in `app/src/App.tsx`)
- Vite 7.2.4 — Dev server and build (`app/vite.config.ts`); base `'./'`, source maps on, manual vendor chunk splitting
- Tailwind CSS 3.4.18 — Styling with `tailwindcss-animate`; config at `app/tailwind.config.js`; PostCSS via `app/postcss.config.js`
- TypeScript ESLint 8.46.4 — Linting (`app/eslint.config.js`)
- Capacitor 7.4.4 — iOS/Android wrapper (`@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/cli`); config at `app/capacitor.config.ts`
- Tauri 2.10.2 — Desktop wrapper (`@tauri-apps/api` 2.10.1, `@tauri-apps/cli` 2.10.0); config at `app/src-tauri/tauri.conf.json` and `app/src-tauri/Cargo.toml`
- Zustand 5.0.8 — Client state stores (`app/src/stores/`)
- TanStack React Query 5.90.11 — Server state and caching (`QueryClient` in `app/src/App.tsx`)
- React Hook Form 7.66.1 + `@hookform/resolvers` 5.2.2 + Zod 4.1.13 — Form handling and runtime schema validation (used throughout `app/src/api/types.ts`)
- Radix UI — Accessible component primitives (`@radix-ui/react-dialog`, `react-dropdown-menu`, `react-select`, `react-tabs`, `react-toast`, `react-popover`, `react-alert-dialog`, `react-checkbox`, `react-collapsible`, `react-progress`, `react-scroll-area`, `react-separator`, `react-slider`, `react-switch`, `react-slot`)
- `lucide-react` 0.555.0 — Icon set
- `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 3.4.0 — Class composition
- `sonner` 2.0.7 — Toast notifications
- Video.js 8.23.4 + `videojs-markers` 1.0.1 — Video playback with markers (`app/src/components/ui/video-player.tsx`)
- Recharts 3.5.1 — Charts (timeline/heatmap)
- `react-grid-layout` 1.5.2 — Dashboard/Montage grids
- `@tanstack/react-virtual` 3.13.12 — Virtualized lists
- `@use-gesture/react` 10.3.1 — Touch gestures
- i18next 25.6.3, `react-i18next` 16.3.5, `i18next-browser-languagedetector` 8.2.0
- Locale bundles at `app/src/locales/{en,de,es,fr,zh}/translation.json`
- Setup in `app/src/i18n.ts`
- Vitest 3.2.4 + jsdom 27.0.1 — Unit tests; config at `app/vitest.config.ts`; setup at `app/src/tests/setup.ts`; coverage thresholds 60% (lines/functions/branches/statements) via `@vitest/coverage-v8`
- `@testing-library/react` 16.3.0, `@testing-library/jest-dom` 6.9.1, `@testing-library/user-event` 14.6.1
- Playwright 1.57.0 + `playwright-bdd` 8.4.2 — E2E (web/Android via CDP); config at `app/playwright.config.ts`; features at `app/tests/features/`, steps at `app/tests/steps/`
- WebdriverIO 9.26.1 + Appium service — E2E for iOS Simulator and Tauri (`@wdio/cli`, `@wdio/local-runner`, `@wdio/mocha-framework`, `@wdio/spec-reporter`, `@wdio/appium-service`); WDIO config at `app/wdio.config.device-screenshots.ts`
- Vite 7.2.4 — Bundler (`app/vite.config.ts`)
- `@vitejs/plugin-react` 5.1.1 — React Fast Refresh
- `vite-plugin-static-copy` 3.1.4 — Static asset copying
- `rollup-plugin-visualizer` 6.0.5 — Bundle analyzer (outputs `dist/stats.html` via `npm run analyze`)
- `tsc -b` — Project references build (called as part of `npm run build`)
- `dotenv` 17.2.3 — Loads `app/.env` for Playwright (`app/playwright.config.ts`)
## Key Dependencies
- `axios` 1.13.2 — Listed as dependency; primary HTTP path is the unified abstraction at `app/src/lib/http.ts` (Capacitor HTTP / Tauri HTTP / fetch / proxy)
- `ws` 8.18.3 — WebSocket client (also relies on global browser `WebSocket` for ZM event server)
- `socket.io-client` 4.8.1 — Listed dependency (no direct imports detected in `app/src/`; reserved for future or transitive use)
- `express` 5.1.0 + `http-proxy-middleware` 3.0.5 — Powers `app/proxy-server.js` and `app/mock-notification-server.js` (dev only)
- `@aparajita/capacitor-secure-storage` 7.1.6 — iOS Keychain / Android Keystore (`app/src/lib/secureStorage.ts`)
- `@aparajita/capacitor-biometric-auth` 7.2.0 — iOS/Android biometrics
- Web Crypto API (no library) — AES-GCM + PBKDF2 (100k iterations) for web/desktop credential encryption (`app/src/lib/crypto.ts`)
- `date-fns` 4.1.0 + `date-fns-tz` 3.2.0 — All user-facing formatting routed through `app/src/lib/format-date-time.ts` and `app/src/hooks/useDateTimeFormat.ts`
- `html5-qrcode` 2.3.8 — Web QR scanner
- `capacitor-barcode-scanner` 2.5.0 — Native iOS/Android scanner
- Both wired through `app/src/components/QRScanner.tsx`
- `firebase` 11.10.0 — Listed dependency (no direct imports under `app/src/` detected; FCM is consumed via Capacitor plugin)
- `@capacitor-firebase/messaging` 7.5.0 — FCM token retrieval and message reception on iOS/Android (`app/src/services/pushNotifications.ts`)
- React 19.2.0 / React DOM 19.2.0 — Whole UI
- Zustand 5.0.8 — App-wide state
- TanStack Query 5.90.11 — Polling and caching for ZM API
- Capacitor 7.4.4 (core + ios + android) — Mobile shell
- Tauri 2.10.2 — Desktop shell
- `@capacitor-community/media` 8.0.1 — Save media to device
- `@capacitor-firebase/messaging` 7.5.0 — Push notifications
- `@capacitor/filesystem` 7.1.5 — File I/O
- `@capacitor/haptics` 7.0.3 — Haptic feedback
- `@capacitor/network` 7.0.4 — Connectivity status
- `@capacitor/preferences` 7.0.2 — Key/value storage
- `@capacitor/share` 7.0.2 — Share sheet
- `@capacitor/splash-screen` 7.0.4 — Launch splash (used in `app/src/App.tsx`)
- `@capawesome/capacitor-badge` 7.0.1 — App icon badge
- `capacitor-barcode-scanner` 2.5.0 — Native QR
- `@tauri-apps/plugin-dialog` 2.7.0 ↔ `tauri-plugin-dialog` 2.7.0 (Cargo)
- `@tauri-apps/plugin-fs` 2.5.0 ↔ `tauri-plugin-fs` 2.5.0 (Cargo)
- `@tauri-apps/plugin-http` 2.5.7 ↔ `tauri-plugin-http` 2.5.7 (Cargo, `dangerous-settings` feature)
- `tauri-plugin-log` 2.8.0 (Cargo only) — Rust-side logging with rotation (10 MB cap, KeepOne strategy)
- Custom Rust commands: `check_biometric_available`, `authenticate_biometric` (`app/src-tauri/src/biometric.rs`, registered in `app/src-tauri/src/lib.rs`)
- `tauri` 2.10.2 (`devtools` feature)
- `tauri-build` 2.5.5 (build dep)
- `serde` 1.0 (with `derive`), `serde_json` 1.0
- `log` 0.4
- `objc2` 0.6.4 + `objc2-foundation` 0.3.1 — macOS-only LAContext FFI
## Configuration
- `app/.env` — Test ZM server credentials (`ZM_HOST_1`, `ZM_USER_1`, `ZM_PASSWORD_1`, plus `_2` set); template at `app/.env.example`
- `ZM_PROXY_INSECURE=1` — Optional flag for `app/proxy-server.js` to bypass TLS verification
- `process.env.NODE_ENV` — Used by `app/src/lib/logger.ts:41` to gate dev logging
- No `VITE_*` env vars detected in source
- `app/tsconfig.json` (project references), `app/tsconfig.app.json`, `app/tsconfig.node.json`
- `app/vite.config.ts` — Manual vendor chunks: `vendor-react`, `vendor-ui`, `vendor-forms`, `vendor-query`, `vendor-i18n`, `vendor-charts`, `vendor-video`
- `app/src-tauri/tauri.conf.json` — Frontend dist `../dist`, dev URL `http://localhost:5173`, identifier `com.zoneminder.zmNinjaNG`
- `app/src-tauri/Entitlements.plist` — macOS bundle entitlements
- `app/capacitor.config.ts` — `appId: com.zoneminder.zmNinjaNG`, cleartext HTTP enabled, `allowNavigation: ['*']`
- `app/src-tauri/capabilities/default.json` — Permissions for `core:default`, `http:default` (HTTP/HTTPS to any host/port), `log:default`, `fs:default`, `dialog:default`; FS write allowed under `$DOWNLOADS`, `$DOCUMENTS`, `$DESKTOP`, `$PICTURES`, `$MOVIES`
## Platform Requirements
- Node.js 20 (CI), npm
- Xcode + iOS Simulator for `npm run ios` and `npm run test:e2e:ios-*`
- Android Studio + `$ANDROID_HOME` for `npm run android` and `npm run test:e2e:android`
- Rust toolchain (rustup, cargo) ≥ 1.77.2 for `npm run tauri:*`
- Appium + simulators for native E2E; setup verified by `npm run test:platform:setup` (`scripts/verify-platform-setup.ts`)
- iOS app via App Store (Capacitor build at `app/ios/`)
- Android app via Play Store / sideload (Gradle project at `app/android/`)
- Tauri desktop bundles (macOS dmg/app, Windows, Linux amd64/arm64) — built by `.github/workflows/build-*.yml`
- Web bundle deployable as static files (`dist/`) via `vite build`
## Dev Tooling Scripts
- `npm run dev` — Vite dev server (port 5173)
- `npm run dev:all` — Express proxy (`app/proxy-server.js`, port 3001) + Vite
- `npm run dev:notifications` — Adds `app/mock-notification-server.js` for FCM-style mock testing
- `npm run build` — `tsc -b && vite build`
- `npm run analyze` — Build then open `dist/stats.html`
- `npm run android | ios | tauri` — Native run/sync chains; all funnel through `scripts/sync-version.js`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Language & Compiler
- Version: `~5.9.3` (`app/package.json`)
- Config: `app/tsconfig.app.json` (extends from `app/tsconfig.json`)
- Strict mode: `"strict": true`
- Additional checks: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `erasableSyntaxOnly`
- `verbatimModuleSyntax: true` — `import type` is required for type-only imports
- Target: `ES2022`, module: `ESNext`, moduleResolution: `bundler`
- JSX: `react-jsx` (no React import needed)
- Build command: `npm run build` (runs `tsc -b && vite build`) — `tsc -b` is stricter than `tsc --noEmit` and catches unused variables/narrowing issues; always run `npm run build` before commits.
- Version: `^19.2.0`
- Hooks-only (no class components)
- Function components with named function exports for pages, named arrow function exports for components
## Linting
- `@eslint/js` recommended
- `typescript-eslint` recommended
- `eslint-plugin-react-hooks` (flat recommended)
- `eslint-plugin-react-refresh` (vite preset)
## Naming Patterns
- React pages and components: `PascalCase.tsx` (e.g., `app/src/pages/Dashboard.tsx`, `app/src/components/monitors/MonitorCard.tsx`)
- Hooks: `useXxx.ts` (e.g., `app/src/hooks/useBandwidthSettings.ts`)
- Lib utilities: `kebab-case.ts` or `camelCase.ts` mixed (e.g., `app/src/lib/url-builder.ts`, `app/src/lib/secureStorage.ts`)
- Stores: `camelCase.ts` (e.g., `app/src/stores/dashboard.ts`)
- Tests: `*.test.ts` next to source in `__tests__/` (e.g., `app/src/lib/__tests__/http.test.ts`)
- E2E features: `kebab-case.feature` in `app/tests/features/`
- Step definitions: `<screen>.steps.ts` in `app/tests/steps/`
## Import Organization
## Mandatory Patterns (from AGENTS.md)
### Logging — never use `console.*`
### HTTP — never use raw `fetch()` / `axios`
### i18n — never hardcode user-facing strings
### Profile-scoped settings — never global singletons
### Bandwidth settings — never hardcode polling intervals
### Date/time formatting — never hardcode `format(date, 'HH:mm')`
### Capacitor plugins — dynamic imports only
- `app/src/components/events/EventMontageView.tsx:77`
- `app/src/hooks/useNotificationDelivered.ts:73,103-104`
- `app/src/components/kiosk/KioskOverlay.tsx:73-75`
### Mobile downloads — never convert to Blob
### Tauri packages — match JS and Rust versions
### Platform detection
### Text overflow
## Error Handling
- Async functions: `try`/`catch` with logger error reporting via `log.<component>('msg', LogLevel.ERROR, { context, error })`. See `app/src/lib/format-date-time.ts:39–44` for fallback-on-error pattern.
- HTTP errors: throw `HttpError` (extends `Error` with `status`, `statusText`, `data`, `headers` fields). Defined in `app/src/lib/http.ts:48–67`.
- Component-level: `app/src/components/ErrorBoundary.tsx` wraps app; `app/src/components/RouteErrorBoundary.tsx` wraps routes.
- Capacitor optional plugins: wrap dynamic import in `try`/`catch` and silently no-op if plugin is unavailable.
- Toast for user-facing errors: `import { toast } from 'sonner'; toast.error(t('...'));`
## React/Component Patterns
- **State management:** Zustand stores in `app/src/stores/`. Use `useShallow` from `zustand/react/shallow` for derived selectors to prevent unnecessary re-renders.
- **Server state:** TanStack Query (`@tanstack/react-query`) with `useQuery` / `useMutation`. Query keys are tuples (e.g., `['monitors']`).
- **Forms:** React Hook Form + Zod resolvers (`@hookform/resolvers`).
- **UI primitives:** Radix UI (`@radix-ui/react-*`) + Tailwind via `class-variance-authority`. Components live in `app/src/components/ui/`.
- **Toasts:** `sonner`.
- **Routing:** `react-router-dom` v7.
## File Size & Modularity
- Target ~400 LOC max per file (rule #12). Extract cohesive blocks to separate modules.
- Prefer DRY but tolerate three similar lines over premature abstraction.
- Delete replaced code completely — no commented-out code or unused files (rule #18).
## Comments
- File-level docblock at top of each module describing purpose and features (e.g., `app/src/lib/http.ts:1–13`, `app/src/lib/logger.ts:1–14`).
- Function-level JSDoc on exported APIs with `@param`, `@returns`, and `@example` where useful (e.g., `app/src/hooks/useBandwidthSettings.ts:13–27`).
- Inline comments explain non-obvious decisions, not what the code does.
## Configuration
- Vite: `app/vite.config.ts`
- Vitest: `app/vitest.config.ts`
- Playwright: `app/playwright.config.ts`
- Capacitor: `app/capacitor.config.ts`
- Tailwind: `app/tailwind.config.js`
- Tauri: `app/src-tauri/`
## Documentation
- API modules → `07-api-and-data-fetching.rst`
- Components → `05-component-architecture.rst`
- Utilities → `12-shared-services-and-components.rst`
- Hooks → `05-component-architecture.rst` or relevant chapter
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- Single bundled SPA (`dist/`) loaded by every shell — no per-platform UI code paths.
- Platform differences isolated to `app/src/lib/platform.ts` and dispatched inside `app/src/lib/http.ts`, `app/src/lib/secureStorage.ts`, `app/src/lib/ssl-trust.ts`, `app/src/lib/download.ts`.
- Multi-server: every persisted setting and React Query key is profile-scoped (`['monitors', currentProfile?.id]`).
- Lazy-loaded route components and manual vendor chunk splitting (`app/vite.config.ts`).
- Capacitor plugins always imported dynamically with platform guards; never statically (rule #14).
- Hash routing (`HashRouter`) so file-based loads work inside `file://` web views.
## Layers
- Purpose: Route-level views; orchestrate hooks and components, no direct API calls.
- Location: `app/src/pages/`
- Contains: `Dashboard.tsx`, `Monitors.tsx`, `MonitorDetail.tsx`, `Montage.tsx`, `Events.tsx`, `EventDetail.tsx`, `EventMontage.tsx`, `Timeline.tsx`, `NotificationHistory.tsx`, `NotificationSettings.tsx`, `Profiles.tsx`, `ProfileForm.tsx`, `Server.tsx`, `Settings.tsx`, `States.tsx`, `Logs.tsx`.
- Depends on: components, hooks, stores.
- Used by: `app/src/App.tsx` route table (all lazy via `React.lazy`).
- Purpose: Reusable UI — feature-grouped subdirectories plus generic `ui/` primitives.
- Location: `app/src/components/`
- Subdirectories: `layout/`, `ui/`, `dashboard/` (+ `widgets/`), `events/`, `filters/`, `kiosk/`, `monitor-detail/`, `monitors/`, `montage/` (+ `hooks/`), `notifications/`, `settings/`, `timeline/`, `tv/`, `video/`.
- `ui/` mirrors a shadcn-style primitive set built on Radix (`button.tsx`, `dialog.tsx`, `select.tsx`, `tabs.tsx`, `toast.tsx`, `sheet.tsx`, etc.).
- Purpose: Reusable state/behavior bridging stores and React Query.
- Location: `app/src/hooks/`
- Contains: data hooks (`useMonitors`, `useGroups`, `useEventFilters`, `useEventTags`, `useCurrentProfile`, `useServerUrls`), streaming (`useMonitorStream`, `useGo2RTCStream`, `useStreamLifecycle`), gestures (`usePinchZoom`, `usePullToRefresh`, `useSwipeNavigation`, `useZoomPan`), TV/kiosk (`useTvMode`, `useTvKeyHandler`, `useKioskLock`), notifications (`useNotificationAutoConnect`, `useNotificationDelivered`, `useNotificationPushSetup`), platform (`useInsomnia`, `useBiometricAuth`, `useImageError`).
- Depends on: stores, api, lib utilities.
- Purpose: Client state that survives page transitions; some persisted to localStorage.
- Location: `app/src/stores/`
- Stores: `profile.ts`, `auth.ts`, `settings.ts`, `dashboard.ts`, `notifications.ts`, `monitors.ts`, `logs.ts`, `backgroundTasks.ts`, `eventFavorites.ts`, `kioskStore.ts`, `query-cache.ts`.
- Helpers: `profile-bootstrap.ts` (post-switch auth/timezone/zms/multi-port resolution), `profile-initialization.ts` (rehydration logic).
- Persistence: `zustand/middleware/persist`. Auth refresh tokens are encrypted via Web Crypto (`app/src/lib/crypto.ts`); profile passwords are stored in native Keychain/Keystore via `app/src/lib/secureStorage.ts`.
- Purpose: Long-lived clients/processes (sockets, pollers) that don't fit a hook lifecycle.
- Location: `app/src/services/`
- Contains: `notifications.ts` (WebSocket service to `zmeventnotification.pl`), `pushNotifications.ts` (FCM push setup/handlers), `eventPoller.ts` (fallback polling for direct-notification mode), `profile.ts` (password secure-storage helpers).
- Purpose: Typed ZoneMinder REST endpoints; one module per resource. All responses validated with Zod.
- Location: `app/src/api/`
- Contains: `client.ts` (singleton + request pipeline), `types.ts` (Zod schemas, ~22KB), `auth.ts`, `monitors.ts`, `events.ts`, `groups.ts`, `logs.ts`, `notifications.ts`, `server.ts`, `states.ts`, `tags.ts`, `time.ts`, `zones.ts`.
- Pattern: every function calls `getApiClient()`, then `validateApiResponse(Schema, response.data, …)`.
- Purpose: Platform-agnostic transport. Switches implementation based on runtime.
- Location: `app/src/lib/http.ts`
- Public surface: `httpRequest`, `httpGet`, `httpPost`, `httpPut`, `httpDelete`.
- Implementations: `nativeHttpRequest` (CapacitorHttp), `tauriHttpRequest` (`@tauri-apps/plugin-http` with optional `acceptInvalidCerts`), `webHttpRequest` (browser `fetch`, dev-mode rewrites to `http://localhost:3001/proxy`).
- iOS Capacitor: `app/ios/App/` — Xcode project. Build via `npm run ios`.
- Android Capacitor: `app/android/` — Gradle project. Build via `npm run android`.
- Tauri desktop: `app/src-tauri/` — Rust crate (`Cargo.toml`, `src/lib.rs`, `src/main.rs`, `src/biometric.rs`). Build via `npm run tauri:build`.
## Data Flow
### Primary Request Path (e.g., load monitors list)
### Authentication Flow
### Real-Time Notifications
### State Management
- **Zustand** for client state (profiles, auth, settings, dashboard layouts, kiosk, logs, background tasks). Each store is a single `create(persist(...))` module under `app/src/stores/`. Stores call each other via `import('./other').useStore.getState()` to avoid circular imports.
- **React Query** for server data (monitors, events, groups, logs, etc.). The shared client is created in `app/src/App.tsx:56` and exposed globally via `setQueryClient` so `clearQueryCache` (`app/src/stores/query-cache.ts`) can invalidate everything during profile switches.
- **React Context** only where strictly required: `PipProvider` (`app/src/contexts/PipContext.tsx`) holds a persistent video.js player + `<video>` element across route changes.
## Key Abstractions
- Purpose: Auth-aware HTTP wrapper for ZoneMinder API.
- File: `app/src/api/client.ts`
- Pattern: Built per profile via `createApiClient(baseURL, reLogin)`; replaced on profile switch via `setApiClient(...)`. Every request gets a correlation id; 401s trigger refresh-token flow.
- Purpose: Single source of truth for platform branching.
- File: `app/src/lib/platform.ts`
- Pattern: All getters; `isDev`, `isNative`, `isTauri`, `isWeb`, `isDesktopOrWeb`, `shouldUseProxy`, `isTVDevice`. Use these instead of checking `Capacitor`/`window` directly.
- Purpose: Structured logging with sanitization and persistence.
- File: `app/src/lib/logger.ts`
- Pattern: `log.api`, `log.auth`, `log.profileService`, `log.http`, `log.notifications`, `log.app`, `log.download`, `log.profileForm`, `log.secureStorage`, etc. Each helper accepts `(message, level, context?, error?)` and routes through `Logger.log` with sanitization (`app/src/lib/log-sanitizer.ts`) and persistence to `useLogStore`.
- Purpose: Per-server preferences (theme, polling, layouts, kiosk pin, etc.).
- File: `app/src/stores/settings.ts`
- Pattern: `useSettingsStore.getState().getProfileSettings(profileId)` for reads, `updateProfileSettings(profileId, partial)` for writes. Defaults merged via `DEFAULT_SETTINGS`. Hook consumers should use `useCurrentProfile()` (`app/src/hooks/useCurrentProfile.ts`) which `useShallow`s the raw object before merging defaults to avoid infinite re-renders.
- Purpose: Centralized polling intervals + image quality knobs by mode.
- File: `app/src/lib/zmninja-ng-constants.ts` (`BANDWIDTH_SETTINGS`, `getBandwidthSettings`)
- Hook: `app/src/hooks/useBandwidthSettings.ts`
- Pattern: `low` mode is roughly 2x slower / lower-quality than `normal`. New polling features must read from this rather than hardcoding intervals.
- Purpose: Build ZoneMinder URLs (portal, api, zms, cgi-bin, monitor stream, event stream) consistently with token injection.
- File: `app/src/lib/url-builder.ts`
- Purpose: Cross-platform secret storage (passwords, kiosk pin).
- File: `app/src/lib/secureStorage.ts`
- Pattern: Uses `@aparajita/capacitor-secure-storage` on native (Keychain/Keystore), `@capacitor/preferences` or encrypted localStorage elsewhere.
## Entry Points
- Location: `app/index.html` → `app/src/main.tsx` → `app/src/App.tsx`
- `main.tsx` tags `<html>` with `is-native` class on Capacitor and renders `<App />` inside `<StrictMode>`.
- Location: `app/ios/App/`
- Config: `app/capacitor.config.ts` (`appId: com.zoneminder.zmNinjaNG`, `webDir: dist`, `iosScheme: http` for CORS bypass).
- Build: `npm run ios:sync` (sync version + build + `cap sync ios`) then `npm run ios:run`.
- Location: `app/android/`
- Config: same `capacitor.config.ts` (`androidScheme: http`).
- Build: `npm run android:sync` then `npm run android:run`. Release: `npm run android:release`/`npm run android:bundle`.
- Location: `app/src-tauri/`
- Config: `app/src-tauri/tauri.conf.json` (window 800×600, frontend served from `../dist`, dev URL `http://localhost:5173`).
- Rust entry: `app/src-tauri/src/main.rs` → `app/src-tauri/src/lib.rs` (`run()`).
- Plugins registered: `tauri-plugin-http`, `tauri-plugin-fs`, `tauri-plugin-dialog`, `tauri-plugin-log`. Custom commands: `check_biometric_available`, `authenticate_biometric` (`app/src-tauri/src/biometric.rs`).
- Build: `npm run tauri:build`. macOS DMG: `scripts/build-desktop.sh`.
- Location: `app/proxy-server.js`
- Purpose: Express server on port 3001 that forwards `/proxy/*` requests to `X-Target-Host` to bypass browser CORS during development.
- Started by: `npm run dev:all` (proxy + Vite together).
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
### Calling `getProfileSettings(profileId)` inside a Zustand selector
### Raw `fetch` / `axios` calls
### Hardcoded polling intervals
### `console.log` calls
### Hardcoded date/time format strings
## Error Handling
- App-level `ErrorBoundary` wraps the entire tree in `app/src/components/ErrorBoundary.tsx`; route-level `RouteErrorBoundary` wraps each `<Route>` element in `app/src/App.tsx`.
- API errors throw `HttpError` with `status`, `statusText`, `data`, `headers` (`app/src/lib/http.ts:48`); `ApiClient` logs them with correlation ids before re-throwing.
- 401 → automatic refresh-token retry, fallback to `reLogin`, then `logout` if all fail (`app/src/api/client.ts:147`).
- Profile switch failures roll back to previous profile (`app/src/stores/profile.ts:292`).
- Bootstrap has a 5-second hard timeout to prevent infinite hangs (`app/src/App.tsx:122`).
- Zod validation failures log and throw via `validateApiResponse` (`app/src/lib/api-validator.ts`).
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
