# Technology Stack

**Analysis Date:** 2026-04-26

## Languages

**Primary:**
- TypeScript ~5.9.3 — All application source under `app/src/` (`.ts`/`.tsx`); `tsconfig.app.json` enforces `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`
- Rust 2021 edition (rust-version 1.77.2) — Tauri desktop shell at `app/src-tauri/src/`

**Secondary:**
- JavaScript (ESM) — Dev tooling (`app/proxy-server.js`, `app/mock-notification-server.js`, `app/eslint.config.js`, `app/postcss.config.js`, `app/tailwind.config.js`)
- Swift (inline via `swift -e` CLI) — Embedded in `app/src-tauri/src/biometric.rs` for macOS LocalAuthentication framework calls
- Bash — Platform test runners under `scripts/test-*.sh`

## Runtime

**Environment:**
- Node.js 20 (CI pinned via `.github/workflows/test.yml`)
- Browser: ES2022, DOM, DOM.Iterable (`app/tsconfig.app.json`)
- Native runtimes: WKWebView (iOS via Capacitor 7), Android System WebView (Capacitor 7), WKWebView/WebKitGTK/WebView2 (Tauri 2)

**Package Manager:**
- npm
- Lockfiles: `app/package-lock.json` (757KB) and root `package-lock.json` present
- Workspace pattern: root `package.json` proxies most scripts to `app/` via `npm --prefix app`

## Frameworks

**Core (Frontend):**
- React 19.2.0 — UI library (`react`, `react-dom`)
- React Router DOM 7.9.6 — Hash-based routing (`HashRouter` in `app/src/App.tsx`)
- Vite 7.2.4 — Dev server and build (`app/vite.config.ts`); base `'./'`, source maps on, manual vendor chunk splitting
- Tailwind CSS 3.4.18 — Styling with `tailwindcss-animate`; config at `app/tailwind.config.js`; PostCSS via `app/postcss.config.js`
- TypeScript ESLint 8.46.4 — Linting (`app/eslint.config.js`)

**Native Shells:**
- Capacitor 7.4.4 — iOS/Android wrapper (`@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/cli`); config at `app/capacitor.config.ts`
- Tauri 2.10.2 — Desktop wrapper (`@tauri-apps/api` 2.10.1, `@tauri-apps/cli` 2.10.0); config at `app/src-tauri/tauri.conf.json` and `app/src-tauri/Cargo.toml`

**State / Data:**
- Zustand 5.0.8 — Client state stores (`app/src/stores/`)
- TanStack React Query 5.90.11 — Server state and caching (`QueryClient` in `app/src/App.tsx`)
- React Hook Form 7.66.1 + `@hookform/resolvers` 5.2.2 + Zod 4.1.13 — Form handling and runtime schema validation (used throughout `app/src/api/types.ts`)

**UI Primitives:**
- Radix UI — Accessible component primitives (`@radix-ui/react-dialog`, `react-dropdown-menu`, `react-select`, `react-tabs`, `react-toast`, `react-popover`, `react-alert-dialog`, `react-checkbox`, `react-collapsible`, `react-progress`, `react-scroll-area`, `react-separator`, `react-slider`, `react-switch`, `react-slot`)
- `lucide-react` 0.555.0 — Icon set
- `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 3.4.0 — Class composition
- `sonner` 2.0.7 — Toast notifications

**Visualization & Media:**
- Video.js 8.23.4 + `videojs-markers` 1.0.1 — Video playback with markers (`app/src/components/ui/video-player.tsx`)
- Recharts 3.5.1 — Charts (timeline/heatmap)
- `react-grid-layout` 1.5.2 — Dashboard/Montage grids
- `@tanstack/react-virtual` 3.13.12 — Virtualized lists
- `@use-gesture/react` 10.3.1 — Touch gestures

**Internationalization:**
- i18next 25.6.3, `react-i18next` 16.3.5, `i18next-browser-languagedetector` 8.2.0
- Locale bundles at `app/src/locales/{en,de,es,fr,zh}/translation.json`
- Setup in `app/src/i18n.ts`

**Testing:**
- Vitest 3.2.4 + jsdom 27.0.1 — Unit tests; config at `app/vitest.config.ts`; setup at `app/src/tests/setup.ts`; coverage thresholds 60% (lines/functions/branches/statements) via `@vitest/coverage-v8`
- `@testing-library/react` 16.3.0, `@testing-library/jest-dom` 6.9.1, `@testing-library/user-event` 14.6.1
- Playwright 1.57.0 + `playwright-bdd` 8.4.2 — E2E (web/Android via CDP); config at `app/playwright.config.ts`; features at `app/tests/features/`, steps at `app/tests/steps/`
- WebdriverIO 9.26.1 + Appium service — E2E for iOS Simulator and Tauri (`@wdio/cli`, `@wdio/local-runner`, `@wdio/mocha-framework`, `@wdio/spec-reporter`, `@wdio/appium-service`); WDIO config at `app/wdio.config.device-screenshots.ts`

**Build/Dev:**
- Vite 7.2.4 — Bundler (`app/vite.config.ts`)
- `@vitejs/plugin-react` 5.1.1 — React Fast Refresh
- `vite-plugin-static-copy` 3.1.4 — Static asset copying
- `rollup-plugin-visualizer` 6.0.5 — Bundle analyzer (outputs `dist/stats.html` via `npm run analyze`)
- `tsc -b` — Project references build (called as part of `npm run build`)
- `dotenv` 17.2.3 — Loads `app/.env` for Playwright (`app/playwright.config.ts`)

## Key Dependencies

**HTTP & Networking:**
- `axios` 1.13.2 — Listed as dependency; primary HTTP path is the unified abstraction at `app/src/lib/http.ts` (Capacitor HTTP / Tauri HTTP / fetch / proxy)
- `ws` 8.18.3 — WebSocket client (also relies on global browser `WebSocket` for ZM event server)
- `socket.io-client` 4.8.1 — Listed dependency (no direct imports detected in `app/src/`; reserved for future or transitive use)
- `express` 5.1.0 + `http-proxy-middleware` 3.0.5 — Powers `app/proxy-server.js` and `app/mock-notification-server.js` (dev only)

**Auth / Security:**
- `@aparajita/capacitor-secure-storage` 7.1.6 — iOS Keychain / Android Keystore (`app/src/lib/secureStorage.ts`)
- `@aparajita/capacitor-biometric-auth` 7.2.0 — iOS/Android biometrics
- Web Crypto API (no library) — AES-GCM + PBKDF2 (100k iterations) for web/desktop credential encryption (`app/src/lib/crypto.ts`)

**Date/Time:**
- `date-fns` 4.1.0 + `date-fns-tz` 3.2.0 — All user-facing formatting routed through `app/src/lib/format-date-time.ts` and `app/src/hooks/useDateTimeFormat.ts`

**QR Scanning:**
- `html5-qrcode` 2.3.8 — Web QR scanner
- `capacitor-barcode-scanner` 2.5.0 — Native iOS/Android scanner
- Both wired through `app/src/components/QRScanner.tsx`

**Push & Messaging:**
- `firebase` 11.10.0 — Listed dependency (no direct imports under `app/src/` detected; FCM is consumed via Capacitor plugin)
- `@capacitor-firebase/messaging` 7.5.0 — FCM token retrieval and message reception on iOS/Android (`app/src/services/pushNotifications.ts`)

**Critical:**
- React 19.2.0 / React DOM 19.2.0 — Whole UI
- Zustand 5.0.8 — App-wide state
- TanStack Query 5.90.11 — Polling and caching for ZM API
- Capacitor 7.4.4 (core + ios + android) — Mobile shell
- Tauri 2.10.2 — Desktop shell

**Capacitor Plugins (mobile features):**
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

**Tauri Plugins (JS + Rust pairs):**
- `@tauri-apps/plugin-dialog` 2.7.0 ↔ `tauri-plugin-dialog` 2.7.0 (Cargo)
- `@tauri-apps/plugin-fs` 2.5.0 ↔ `tauri-plugin-fs` 2.5.0 (Cargo)
- `@tauri-apps/plugin-http` 2.5.7 ↔ `tauri-plugin-http` 2.5.7 (Cargo, `dangerous-settings` feature)
- `tauri-plugin-log` 2.8.0 (Cargo only) — Rust-side logging with rotation (10 MB cap, KeepOne strategy)
- Custom Rust commands: `check_biometric_available`, `authenticate_biometric` (`app/src-tauri/src/biometric.rs`, registered in `app/src-tauri/src/lib.rs`)

**Rust Crates (`app/src-tauri/Cargo.toml`):**
- `tauri` 2.10.2 (`devtools` feature)
- `tauri-build` 2.5.5 (build dep)
- `serde` 1.0 (with `derive`), `serde_json` 1.0
- `log` 0.4
- `objc2` 0.6.4 + `objc2-foundation` 0.3.1 — macOS-only LAContext FFI

## Configuration

**Environment:**
- `app/.env` — Test ZM server credentials (`ZM_HOST_1`, `ZM_USER_1`, `ZM_PASSWORD_1`, plus `_2` set); template at `app/.env.example`
- `ZM_PROXY_INSECURE=1` — Optional flag for `app/proxy-server.js` to bypass TLS verification
- `process.env.NODE_ENV` — Used by `app/src/lib/logger.ts:41` to gate dev logging
- No `VITE_*` env vars detected in source

**Build:**
- `app/tsconfig.json` (project references), `app/tsconfig.app.json`, `app/tsconfig.node.json`
- `app/vite.config.ts` — Manual vendor chunks: `vendor-react`, `vendor-ui`, `vendor-forms`, `vendor-query`, `vendor-i18n`, `vendor-charts`, `vendor-video`
- `app/src-tauri/tauri.conf.json` — Frontend dist `../dist`, dev URL `http://localhost:5173`, identifier `com.zoneminder.zmNinjaNG`
- `app/src-tauri/Entitlements.plist` — macOS bundle entitlements
- `app/capacitor.config.ts` — `appId: com.zoneminder.zmNinjaNG`, cleartext HTTP enabled, `allowNavigation: ['*']`

**Capabilities (Tauri):**
- `app/src-tauri/capabilities/default.json` — Permissions for `core:default`, `http:default` (HTTP/HTTPS to any host/port), `log:default`, `fs:default`, `dialog:default`; FS write allowed under `$DOWNLOADS`, `$DOCUMENTS`, `$DESKTOP`, `$PICTURES`, `$MOVIES`

## Platform Requirements

**Development:**
- Node.js 20 (CI), npm
- Xcode + iOS Simulator for `npm run ios` and `npm run test:e2e:ios-*`
- Android Studio + `$ANDROID_HOME` for `npm run android` and `npm run test:e2e:android`
- Rust toolchain (rustup, cargo) ≥ 1.77.2 for `npm run tauri:*`
- Appium + simulators for native E2E; setup verified by `npm run test:platform:setup` (`scripts/verify-platform-setup.ts`)

**Production:**
- iOS app via App Store (Capacitor build at `app/ios/`)
- Android app via Play Store / sideload (Gradle project at `app/android/`)
- Tauri desktop bundles (macOS dmg/app, Windows, Linux amd64/arm64) — built by `.github/workflows/build-*.yml`
- Web bundle deployable as static files (`dist/`) via `vite build`

## Dev Tooling Scripts

Defined in `app/package.json`:
- `npm run dev` — Vite dev server (port 5173)
- `npm run dev:all` — Express proxy (`app/proxy-server.js`, port 3001) + Vite
- `npm run dev:notifications` — Adds `app/mock-notification-server.js` for FCM-style mock testing
- `npm run build` — `tsc -b && vite build`
- `npm run analyze` — Build then open `dist/stats.html`
- `npm run android | ios | tauri` — Native run/sync chains; all funnel through `scripts/sync-version.js`

---

*Stack analysis: 2026-04-26*
