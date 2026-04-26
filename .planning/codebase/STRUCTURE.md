# Codebase Structure

**Analysis Date:** 2026-04-26

## Directory Layout

```
zmNinjaNg/
├── AGENTS.md                       # Project rules — read first (also linked from CLAUDE.md)
├── CLAUDE.md                       # Single line: "Use @AGENTS.md as your instructions"
├── README.md                       # User-facing project intro
├── CHANGELOG.md                    # Generated changelog
├── PRIVACY_POLICY.md               # Privacy policy
├── package.json                    # Workspace-root scripts that delegate to app/
├── package-lock.json               # Root lockfile (workspace-root devDeps)
├── docs/                           # Sphinx docs (developer guide, user guide)
│   ├── developer-guide/
│   ├── user-guide/
│   ├── building/
│   ├── superpowers/
│   ├── conf.py
│   └── index.md
├── scripts/                        # Cross-platform automation
│   ├── build-desktop.sh            # Builds macOS DMG
│   ├── make_release.sh             # Release helper
│   ├── sync-version.js             # Syncs version across package.json/Cargo.toml/iOS/Android
│   ├── check-tauri-versions.js     # Verifies JS/Rust Tauri versions match (rule #16)
│   ├── test-android.sh
│   ├── test-ios.sh
│   ├── test-tauri.sh
│   ├── test-all-platforms.sh
│   └── verify-platform-setup.ts
├── notes/                          # Working notes (not consumed by build)
├── images/                         # Repo-level marketing/screenshots
├── site/                           # Generated docs site output
├── run/                            # Runtime artifacts (gitignored)
├── .github/                        # CI workflows, issue templates, PR templates
├── .planning/codebase/             # Codebase map docs (this file lives here)
└── app/                            # Main application — run npm commands here
    ├── package.json                # All real dependencies + scripts
    ├── package-lock.json           # App lockfile
    ├── tsconfig.json               # Root TS config (project references)
    ├── tsconfig.app.json           # App-side TS config
    ├── tsconfig.node.json          # Node-side TS config (configs, scripts)
    ├── vite.config.ts              # Vite + manual vendor chunk splitting
    ├── vitest.config.ts            # Unit test config (jsdom)
    ├── playwright.config.ts        # E2E (web/Android via Playwright BDD)
    ├── wdio.config.device-screenshots.ts  # WebdriverIO config for native screenshots
    ├── eslint.config.js
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── capacitor.config.ts         # iOS/Android Capacitor config
    ├── index.html                  # SPA shell
    ├── proxy-server.js             # Dev-only CORS proxy (port 3001)
    ├── mock-notification-server.js # Dev-only mock zmeventnotification (port 9000)
    ├── .env / .env.example         # Server credentials for tests
    ├── public/                     # Static assets copied verbatim into dist/
    ├── assets/                     # Build-time assets (logo, etc.)
    ├── icons/                      # App icons
    ├── dist/                       # Vite build output (gitignored)
    ├── coverage/                   # Vitest coverage reports (gitignored)
    ├── playwright/                 # Playwright runtime data
    ├── playwright-report/          # Playwright HTML reports
    ├── test-results/               # Test result artifacts
    ├── ios/                        # Capacitor iOS native project (Xcode)
    │   └── App/
    ├── android/                    # Capacitor Android native project (Gradle)
    │   ├── app/
    │   ├── gradle/
    │   ├── build.gradle
    │   ├── settings.gradle
    │   └── variables.gradle
    ├── src-tauri/                  # Tauri desktop shell (Rust)
    │   ├── Cargo.toml
    │   ├── Cargo.lock
    │   ├── tauri.conf.json
    │   ├── Entitlements.plist
    │   ├── build.rs
    │   ├── icons/
    │   ├── capabilities/
    │   ├── gen/                    # Generated bundle metadata
    │   └── src/
    │       ├── main.rs             # Rust entry (calls lib::run)
    │       ├── lib.rs              # Tauri builder, plugin registration, command bindings
    │       └── biometric.rs        # Biometric auth command implementations
    ├── src/                        # All application TypeScript/React code (~318 files)
    │   ├── main.tsx                # React entry — applies is-native class, mounts <App />
    │   ├── App.tsx                 # Provider tree, routes, splash dismissal
    │   ├── App.css
    │   ├── index.css               # Global styles + Tailwind directives
    │   ├── i18n.ts                 # i18next init with bundled translations
    │   ├── api/                    # ZoneMinder REST modules + Zod types
    │   ├── components/             # Feature components + ui/ primitives
    │   ├── contexts/               # React contexts (PiP)
    │   ├── hooks/                  # Reusable hooks
    │   ├── lib/                    # Shared utilities + platform abstractions
    │   ├── locales/                # i18next translation JSON (en/de/es/fr/zh)
    │   ├── pages/                  # Route-level components (lazy-loaded)
    │   ├── plugins/                # Custom Capacitor plugins
    │   ├── services/               # Long-lived clients (sockets, pollers, push)
    │   ├── stores/                 # Zustand stores
    │   ├── styles/                 # Style assets (vendor)
    │   ├── tests/                  # Vitest setup
    │   └── types/                  # Standalone type declarations
    └── tests/                      # E2E test harness (Playwright BDD + WebDriverIO)
        ├── README.md
        ├── platforms.config.ts
        ├── platforms.config.defaults.ts
        ├── platforms.config.local.ts  # Per-machine overrides (gitignored)
        ├── actions/                # Driver-agnostic TestActions abstraction
        ├── features/               # *.feature files (Gherkin) — one per screen
        ├── helpers/                # Shared step helpers (config, ios-launcher, visual-regression)
        ├── steps/                  # *.steps.ts step definitions per screen
        ├── screenshots/            # Visual regression baselines per platform
        ├── device-screenshots/     # Per-device screenshot baselines
        └── native/specs/           # Appium spec files for native-only flows
```

## Directory Purposes

**`app/src/api/`:**
- Purpose: ZoneMinder REST API client modules.
- Contains: One module per resource plus the singleton client and Zod-validated types.
- Key files: `client.ts` (ApiClient with auth/retry), `types.ts` (~22KB of Zod schemas), `auth.ts`, `monitors.ts`, `events.ts`, `groups.ts`, `logs.ts`, `notifications.ts`, `server.ts`, `states.ts`, `tags.ts`, `time.ts`, `zones.ts`. Tests in `app/src/api/__tests__/`.

**`app/src/components/`:**
- Purpose: All React components — both feature-specific and reusable primitives.
- Contains: Top-level components (`AppLayout` lives in `layout/`, but `ErrorBoundary.tsx`, `NotificationHandler.tsx`, `BackgroundTaskDrawer.tsx`, `theme-provider.tsx`, `mode-toggle.tsx`, `profile-switcher.tsx`, `QRScanner.tsx`, `CertTrustDialog.tsx`, `RouteErrorBoundary.tsx`, `NotificationBadge.tsx` are direct children).
- Subdirectories:
  - `layout/` — App shell: `AppLayout.tsx`, `SidebarContent.tsx`, `LanguageSwitcher.tsx`.
  - `ui/` — Generic primitives (shadcn-style on Radix): `button.tsx`, `dialog.tsx`, `select.tsx`, `tabs.tsx`, `toast.tsx`, `sheet.tsx`, `popover.tsx`, `dropdown-menu.tsx`, `card.tsx`, `input.tsx`, `slider.tsx`, `switch.tsx`, `checkbox.tsx`, `tabs.tsx`, `progress.tsx`, `scroll-area.tsx`, `separator.tsx`, `skeleton.tsx`, `alert-dialog.tsx`, `collapsible.tsx`, `collapsible-card.tsx`, `empty-state.tsx`, `hover-preview.tsx`, `secure-image.tsx`, `password-input.tsx`, `label.tsx`, `quick-date-range-buttons.tsx`, `pull-to-refresh-indicator.tsx`, `video-player.tsx`, `badge.tsx`.
  - `dashboard/` — `DashboardConfig.tsx`, `DashboardLayout.tsx`, `DashboardWidget.tsx`, `WidgetEditDialog.tsx`, plus `widgets/` (`MonitorWidget`, `EventsWidget`, `TimelineWidget`, `HeatmapWidget`).
  - `events/` — `EventCard.tsx`, `EventListView.tsx`, `EventMontageView.tsx`, `EventThumbnail.tsx`, `EventHeatmap.tsx`, `EventProgressBar.tsx`, `EventsFilterPopover.tsx`, `EventMontageFilterPanel.tsx`, `EventMontageGridControls.tsx`, `EventThumbnailHoverPreview.tsx`, `TagChip.tsx`, `ZmsEventPlayer.tsx`.
  - `filters/` — `GroupFilterSelect.tsx`, `MonitorFilterPopover.tsx`.
  - `kiosk/` — `KioskOverlay.tsx`, `PinPad.tsx`.
  - `monitor-detail/` — `MonitorControlsCard.tsx`, `MonitorSettingsDialog.tsx`.
  - `monitors/` — `MonitorCard.tsx`, `MonitorHoverPreview.tsx`.
  - `montage/` — `MontageMonitor.tsx`, `PTZControls.tsx`, `FullscreenControls.tsx`, `GridLayoutControls.tsx`, `index.ts`, plus `hooks/`.
  - `notifications/` — `MonitorFilterSection.tsx`, `NotificationModeSection.tsx`, `ServerConfigSection.tsx`.
  - `settings/` — `AdvancedSection.tsx`, `AppearanceSection.tsx`, `LiveStreamingSection.tsx`, `PlaybackSection.tsx`, `SettingsLayout.tsx`.
  - `timeline/` — `TimelineCanvas.tsx`, `TimelineScrubber.tsx`, `DetectionFilterTabs.tsx`, `EventPreviewPopover.tsx`, plus pure modules `timeline-hit-test.ts`, `timeline-layout.ts`, `timeline-renderer.ts`, and hooks `useTimelineGestures.ts`, `useTimelineViewport.ts`.
  - `tv/` — `TvCursor.tsx`.
  - `video/` — `VideoPlayer.tsx`, `ZoneOverlay.tsx`, `ZoomControls.tsx`.
- Tests colocated in `__tests__/` subdirectories at each feature directory.

**`app/src/contexts/`:**
- Purpose: Cross-cutting React context providers.
- Contains: `PipContext.tsx` (persistent video.js player + native PiP bridge).

**`app/src/hooks/`:**
- Purpose: Reusable hooks composing stores, API, and React Query.
- Contains: ~30 hooks. Notable: `useCurrentProfile.ts`, `useBandwidthSettings.ts`, `useMonitors.ts`, `useGroups.ts`, `useGroupFilter.ts`, `useEventFilters.ts`, `useEventNavigation.ts`, `useEventPagination.ts`, `useEventTags.ts`, `useEventMontageGrid.ts`, `useTimelineFilters.ts`, `useMonitorStream.ts`, `useGo2RTCStream.ts`, `useStreamLifecycle.ts`, `useImageError.ts`, `useTokenRefresh.ts`, `useDateTimeFormat.ts`, `useNotificationAutoConnect.ts`, `useNotificationDelivered.ts`, `useNotificationPushSetup.ts`, `useBiometricAuth.ts`, `useInsomnia.ts`, `useKioskLock.ts`, `usePinchZoom.ts`, `usePullToRefresh.ts`, `useSwipeNavigation.ts`, `useZoomPan.ts`, `useTvMode.ts`, `useTvKeyHandler.ts`, `useServerUrls.ts`, `use-toast.ts`. Tests in `app/src/hooks/__tests__/`.

**`app/src/lib/`:**
- Purpose: Pure utilities, platform abstractions, and shared services that don't fit the api/store/hook layers.
- Contains: `http.ts` (platform-agnostic HTTP), `platform.ts` (runtime detection), `logger.ts` + `log-level.ts` + `log-sanitizer.ts`, `crypto.ts` (Web Crypto AES-GCM), `secureStorage.ts` (Keychain/Keystore wrapper), `ssl-trust.ts` + `cert-trust-event.ts` (TOFU cert handling), `url-builder.ts` + `urls.ts` + `proxy-utils.ts` (URL construction), `format-date-time.ts` (with profile-aware formatting), `time.ts`, `discovery.ts` (mDNS/SSDP server discovery), `download.ts` (cross-platform downloads), `api-validator.ts` (Zod helper), `filters.ts` (monitor filtering), `event-icons.ts` + `event-utils.ts`, `object-class-icons.ts`, `monitor-rotation.ts`, `monitor-status.ts`, `grid-utils.ts`, `kioskPin.ts`, `notification-profile.ts`, `navigation.ts`, `profile-validation.ts`, `qr-profile.ts`, `server-resolver.ts`, `thumbnail-chain.ts`, `tv-a11y.ts`, `tv-dpad-nav.ts`, `tv-spatial-nav.ts`, `utils.ts` (`cn`), `version.ts`, `video-markers.ts`, `zm-constants.ts`, `zm-version.ts`, `zmninja-ng-constants.ts` (BANDWIDTH_SETTINGS), `zone-utils.ts`. Tests in `app/src/lib/__tests__/`.

**`app/src/locales/`:**
- Purpose: i18next translation resources, bundled into the app at build time.
- Contains: `en/translation.json`, `de/translation.json`, `es/translation.json`, `fr/translation.json`, `zh/translation.json`.
- Pattern: Every user-facing string must exist in all five files (rule #5). Keys are dot-namespaced (`setup.title`, `montage.screen_too_small`, `app_init.toast_title`).

**`app/src/pages/`:**
- Purpose: Route-level screens, all lazy-imported in `App.tsx`.
- Contains: `Dashboard.tsx`, `Monitors.tsx`, `MonitorDetail.tsx`, `Montage.tsx`, `Events.tsx`, `EventDetail.tsx`, `EventMontage.tsx`, `Timeline.tsx`, `Profiles.tsx`, `ProfileForm.tsx`, `Server.tsx`, `Settings.tsx`, `States.tsx`, `NotificationSettings.tsx`, `NotificationHistory.tsx`, `Logs.tsx`.
- Naming: PascalCase, one component per file, file name matches export.

**`app/src/plugins/`:**
- Purpose: Custom Capacitor plugins with TypeScript definitions and web fallbacks.
- Contains:
  - `pip/` — Picture-in-Picture: `definitions.ts`, `index.ts`, `web.ts`.
  - `ssl-trust/` — Self-signed cert trust on native: `definitions.ts`, `index.ts`, `web.ts`.

**`app/src/services/`:**
- Purpose: Long-lived clients/processes that don't map to a hook lifecycle.
- Contains: `notifications.ts` (`ZMNotificationService` WebSocket client), `pushNotifications.ts` (FCM push setup/handlers), `eventPoller.ts` (polling fallback for direct-notification mode), `profile.ts` (password secure-storage helpers).

**`app/src/stores/`:**
- Purpose: Zustand stores (with `persist` middleware) + cross-store helpers.
- Contains: `profile.ts`, `auth.ts`, `settings.ts`, `dashboard.ts`, `notifications.ts`, `monitors.ts`, `logs.ts`, `backgroundTasks.ts`, `eventFavorites.ts`, `kioskStore.ts`, `query-cache.ts`, `profile-bootstrap.ts`, `profile-initialization.ts`. Tests in `app/src/stores/__tests__/`.

**`app/src/types/`:**
- Purpose: Standalone TypeScript declarations not tied to a single module.
- Contains: `notifications.ts`, `videojs-markers.d.ts`.

**`app/src/tests/`:**
- Purpose: Vitest-only setup (separate from end-to-end `app/tests/`).
- Contains: `setup.ts` — registers global mocks for Capacitor/Tauri plugins (rule #14 mock requirement).

**`app/tests/`:**
- Purpose: E2E test harness (web/Android via Playwright BDD, iOS/Tauri via WebdriverIO + Appium).
- Contains: `features/` (Gherkin), `steps/` (TypeScript step defs per screen), `actions/playwright-actions.ts` (driver-agnostic TestActions), `helpers/` (config, iOS launcher, visual-regression utility), `screenshots/` (visual baselines per platform), `device-screenshots/devices/`, `native/specs/` (Appium specs), `platforms.config.ts` + `.defaults.ts` + `.local.ts`. See `app/tests/README.md`.

**`app/public/`:**
- Purpose: Static assets copied verbatim to `dist/` (logos, icons, robots.txt, web app manifest).

**`app/dist/` (generated):**
- Purpose: Vite build output. Loaded by every shell (`webDir: dist` in `capacitor.config.ts`, `frontendDist: ../dist` in `tauri.conf.json`).
- Generated: Yes, by `npm run build`.
- Committed: No.

**`app/src-tauri/`:**
- Purpose: Tauri desktop shell — Rust crate plus configuration.
- Contains: `Cargo.toml`, `Cargo.lock`, `tauri.conf.json`, `Entitlements.plist`, `build.rs`, `icons/`, `capabilities/`, `gen/` (generated), `src/main.rs`, `src/lib.rs`, `src/biometric.rs`.
- Plugins registered in `lib.rs`: `tauri-plugin-http`, `tauri-plugin-fs`, `tauri-plugin-dialog`, `tauri-plugin-log`.
- Custom commands: `check_biometric_available`, `authenticate_biometric`.

**`app/ios/` and `app/android/`:**
- Purpose: Capacitor-generated native projects. Treat as build artifacts; native code edits are rare and usually go through `cap sync`.
- `app/ios/App/` is the Xcode project; `app/android/app/` is the Gradle module.

**`docs/`:**
- Purpose: Sphinx documentation source.
- Contains: `developer-guide/` (numbered chapters: 05-component-architecture, 07-api-and-data-fetching, 12-shared-services-and-components, etc. — see rule #4 for what to update), `user-guide/`, `building/`, `superpowers/`, `conf.py`, `index.md`, `requirements.txt`.

**`scripts/`:**
- Purpose: Cross-platform automation invoked by `npm run` scripts in `app/package.json` and `package.json`.

**`.planning/codebase/`:**
- Purpose: Codebase map docs (this file, plus any sibling `STACK.md`/`CONVENTIONS.md`/etc.).

## Key File Locations

**Entry Points:**
- `app/index.html` — SPA shell loaded by every platform.
- `app/src/main.tsx` — React entry, mounts `<App />` and tags native runtime.
- `app/src/App.tsx` — Provider tree (QueryClient, Theme, Pip, Router) and lazy route table.
- `app/src-tauri/src/main.rs` → `app/src-tauri/src/lib.rs` — Tauri Rust entry.

**Configuration:**
- `app/package.json` — Real dependencies and all `npm run` scripts (`dev`, `build`, `test`, `test:e2e`, `ios`, `android`, `tauri:build`).
- `app/tsconfig.json` / `app/tsconfig.app.json` / `app/tsconfig.node.json` — TypeScript project references.
- `app/vite.config.ts` — Vite build, manual vendor chunks, bundle visualizer.
- `app/vitest.config.ts` — Unit test setup.
- `app/playwright.config.ts` — Web/Android E2E.
- `app/wdio.config.device-screenshots.ts` — WebdriverIO device screenshots.
- `app/eslint.config.js` — ESLint flat config.
- `app/tailwind.config.js` — Tailwind theme + content globs.
- `app/postcss.config.js` — PostCSS pipeline (autoprefixer, tailwindcss).
- `app/capacitor.config.ts` — Capacitor app id, scheme overrides, plugin config.
- `app/src-tauri/tauri.conf.json` — Tauri window/build/bundle config.
- `app/src-tauri/Cargo.toml` — Rust dependencies (must mirror JS Tauri versions, rule #16).
- `app/.env` / `app/.env.example` — Test server credentials (`ZM_HOST_1`, `ZM_USER_1`, `ZM_PASSWORD_1`).
- `app/tests/platforms.config.ts` (+ `.defaults.ts`, `.local.ts`) — Simulator names, ports, timeouts.

**Core Logic:**
- `app/src/api/client.ts` — ApiClient singleton with auth pipeline.
- `app/src/lib/http.ts` — Platform-dispatched HTTP layer.
- `app/src/lib/platform.ts` — Runtime platform detection.
- `app/src/lib/logger.ts` — Structured logger.
- `app/src/lib/url-builder.ts` — ZoneMinder URL construction.
- `app/src/lib/zmninja-ng-constants.ts` — BANDWIDTH_SETTINGS + integration constants.
- `app/src/stores/profile.ts` — Multi-server profile management with switch rollback.
- `app/src/stores/auth.ts` — Token state with encrypted persistence.
- `app/src/stores/settings.ts` — Profile-scoped settings store.
- `app/src/services/notifications.ts` — `ZMNotificationService` WebSocket client.
- `app/src/components/layout/AppLayout.tsx` — Authenticated app shell.

**Testing:**
- `app/src/tests/setup.ts` — Vitest global setup + Capacitor/Tauri mocks.
- `app/src/**/__tests__/*.test.ts` — Unit/integration tests colocated next to source.
- `app/tests/features/*.feature` — Gherkin scenarios.
- `app/tests/steps/<screen>.steps.ts` — Step definitions per screen.
- `app/tests/actions/playwright-actions.ts` — Driver-agnostic TestActions.
- `app/tests/screenshots/<platform>/` — Visual regression baselines.

## Naming Conventions

**Files:**
- TypeScript modules and most components: kebab-case (`url-builder.ts`, `format-date-time.ts`, `theme-provider.tsx`, `profile-switcher.tsx`, `mode-toggle.tsx`, `secure-image.tsx`).
- React components in feature directories: PascalCase matching the exported component (`MonitorCard.tsx`, `EventThumbnail.tsx`, `DashboardWidget.tsx`, `KioskOverlay.tsx`, `TimelineCanvas.tsx`).
- Pages: PascalCase (`Dashboard.tsx`, `Events.tsx`, `MonitorDetail.tsx`).
- Hooks: camelCase starting with `use` (`useMonitors.ts`, `useCurrentProfile.ts`, `useTokenRefresh.ts`); the legacy `use-toast.ts` is kebab-case.
- Tests: `<source-name>.test.ts(x)` colocated under `__tests__/` (`crypto.ts` → `__tests__/crypto.test.ts`).
- E2E features: `<screen>.feature` (kebab-case if multi-word).
- E2E steps: `<screen>.steps.ts`.
- Translation files: `<lang>/translation.json`.
- Capacitor plugins: directory `<plugin-name>/` containing `definitions.ts`, `index.ts`, `web.ts`.

**Directories:**
- All lowercase, kebab-case if multi-word (`monitor-detail/`, `src-tauri/`, `__tests__/`).
- Feature subdirectories under `components/` are singular noun for primitives (`ui/`) and plural noun for feature collections (`monitors/`, `events/`, `notifications/`).

**Identifiers:**
- Components and React types: `PascalCase` (`AppLayout`, `ProfileSettings`, `BandwidthSettings`).
- Hooks, functions, variables: `camelCase` (`getMonitors`, `httpRequest`, `currentProfile`).
- Constants: `SCREAMING_SNAKE_CASE` for top-level groups (`BANDWIDTH_SETTINGS`, `DEFAULT_HOVER_PREVIEW`, `ZM_INTEGRATION`, `GRID_LAYOUT`).
- Zustand store hooks: prefixed with `use…Store` (`useProfileStore`, `useAuthStore`, `useSettingsStore`, `useDashboardStore`).
- Zod schemas: `<Type>Schema` (`MonitorsResponseSchema`, `LoginResponseSchema`).
- Translation keys: dot-namespaced lowercase (`setup.title`, `app_init.toast_title`).

**Test IDs:**
- `data-testid` is required on all interactive elements (rule #13), kebab-case (`mobile-menu-button`, `sidebar-toggle`, `cancel-bootstrap-button`, `montage-toolbar-toggle`, `app-init-blocker`).

## Where to Add New Code

**New page (route-level screen):**
- Implementation: `app/src/pages/<PageName>.tsx` — PascalCase.
- Wire up: add a `lazy(() => import('./pages/<PageName>'))` in `app/src/App.tsx` and a `<Route>` inside the `<AppLayout />` route, wrapped in `<RouteErrorBoundary routePath="…">`.
- Sidebar entry: add to `app/src/components/layout/SidebarContent.tsx`.
- Add `data-testid` to interactive elements.
- Add E2E feature file at `app/tests/features/<page>.feature` and step file at `app/tests/steps/<page>.steps.ts`.

**New feature component:**
- Group with siblings: `app/src/components/<feature-area>/<ComponentName>.tsx`. Reuse an existing folder if one matches; create a new one only for a distinct feature area.
- Tests next to it: `app/src/components/<feature-area>/__tests__/<ComponentName>.test.tsx`.

**New ui primitive:**
- Implementation: `app/src/components/ui/<name>.tsx` — kebab-case file, PascalCase export. Build on Radix where a primitive exists (`@radix-ui/react-*`).

**New hook:**
- Implementation: `app/src/hooks/use<Thing>.ts` — camelCase starting with `use`.
- Tests: `app/src/hooks/__tests__/use<Thing>.test.ts`.

**New API endpoint module:**
- Implementation: `app/src/api/<resource>.ts` — call `getApiClient()`, validate response with Zod via `validateApiResponse(...)`.
- Schemas/types: extend `app/src/api/types.ts`.
- Tests: `app/src/api/__tests__/<resource>.test.ts`.

**New store:**
- Implementation: `app/src/stores/<name>.ts` — `create(persist(...))` if state should survive reloads; profile-scope by keying on `profileId` (rule #7).
- Tests: `app/src/stores/__tests__/<name>.test.ts`.

**New service (long-lived client):**
- Implementation: `app/src/services/<name>.ts` — class or factory; expose lifecycle methods (`connect`, `disconnect`).

**New shared utility:**
- Implementation: `app/src/lib/<utility-name>.ts` — kebab-case. Tests at `app/src/lib/__tests__/<utility-name>.test.ts`.

**New polling/refresh feature:**
- Add property to `BandwidthSettings` interface and both `normal`/`low` blocks in `app/src/lib/zmninja-ng-constants.ts` (low ~2x slower) — rule #8.
- Read via `useBandwidthSettings()` (`app/src/hooks/useBandwidthSettings.ts`) inside React or `getBandwidthSettings(mode)` outside.

**New i18n string:**
- Add the same key/value to ALL of `en`, `de`, `es`, `fr`, `zh` under `app/src/locales/<lang>/translation.json` — rule #5. Keep labels short across languages — rule #23.

**New Capacitor plugin:**
- Implementation: `app/src/plugins/<plugin-name>/{definitions.ts,index.ts,web.ts}`.
- Always import dynamically with `Capacitor.isNativePlatform()` guards (rule #14).
- Add a mock to `app/src/tests/setup.ts`.
- Match `@capacitor/core` major version when adding third-party plugins.

**New Tauri command:**
- Implementation: a Rust function in `app/src-tauri/src/<name>.rs` (or a new module), then register in `tauri::generate_handler![...]` inside `app/src-tauri/src/lib.rs`.
- Update both JS (`@tauri-apps/...`) and Rust (`tauri-plugin-...`) versions together — rule #16.

**New translation language:**
- Add `app/src/locales/<lang>/translation.json`, then register in `app/src/i18n.ts`.

**Documentation:**
- Update `docs/developer-guide/` in the same session (rule #4): API → `07-api-and-data-fetching.rst`, components → `05-component-architecture.rst`, utilities → `12-shared-services-and-components.rst`, hooks → relevant chapter.

## Special Directories

**`app/dist/`:**
- Purpose: Vite build output consumed by every shell.
- Generated: Yes (`npm run build`).
- Committed: No.

**`app/src-tauri/gen/`:**
- Purpose: Tauri-generated bundle metadata (icons, plist).
- Generated: Yes.
- Committed: Partial (icons committed, build artifacts not).

**`app/src-tauri/target/` (if present), `app/android/build/`, `app/android/app/build/`, `app/ios/App/build/`, `app/ios/DerivedData/`:**
- Purpose: Native build outputs.
- Generated: Yes.
- Committed: No.

**`app/coverage/`, `app/playwright-report/`, `app/test-results/`:**
- Purpose: Test reports and coverage.
- Generated: Yes.
- Committed: No.

**`app/tests/screenshots/`, `app/tests/device-screenshots/`:**
- Purpose: Visual regression baselines.
- Generated: Yes (via `--update-snapshots`).
- Committed: Yes (baselines are checked in, but ad-hoc screenshot files are not — see memory note `feedback_no_screenshot_commits`).

**`app/tests/platforms.config.local.ts`:**
- Purpose: Per-developer overrides for simulator names, ports, timeouts.
- Committed: No (gitignored).

**`app/.env`:**
- Purpose: Test server credentials (`ZM_HOST_1`, `ZM_USER_1`, `ZM_PASSWORD_1`).
- Committed: No (gitignored). Only `.env.example` is committed.

**`run/`, `notes/`:**
- Purpose: Working directories for runtime artifacts and personal notes.
- Committed: Partial — exclude transient artifacts.

**`.planning/codebase/`:**
- Purpose: Codebase map docs consumed by tooling.
- Committed: Yes.

**`site/`, `docs/_build/`:**
- Purpose: Generated docs site output.
- Committed: No.

---

*Structure analysis: 2026-04-26*
