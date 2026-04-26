# Codebase Concerns

**Analysis Date:** 2026-04-26

## Tech Debt

**Deprecated APIs still referenced:**
- Issue: Several modules carry `@deprecated` markers but old call sites or fallback paths remain.
- Files:
  - `app/src/stores/settings.ts:79-80` — `monitorDetailInsomnia` and `montageInsomnia` flags marked deprecated in favor of a global `insomnia` flag, but still defined in the settings type and persisted in storage.
  - `app/src/lib/urls.ts:27` — old URL helper deprecated in favor of `discovery.ts`.
  - `app/src/lib/zmninja-ng-constants.ts:210` — `ZM_MONITOR_FUNCTIONS` shadowed by a copy in `zm-constants.ts`.
  - `app/src/services/profile.ts:47` — service-level `isProfileNameAvailable` deprecated in favor of `lib/profile-validation`.
- Impact: Confusion about which symbol to use; persisted user state still references deprecated flags.
- Fix approach: Remove deprecated exports after migrating all call sites, then add a settings migration that drops the old keys from `localStorage`.

**Legacy crypto fallbacks for web secure storage:**
- Issue: Web/desktop secure storage retains a multi-tier decryption fallback chain (current key → `decryptLegacy` → raw plaintext) and a UA-derived legacy key.
- Files: `app/src/lib/secureStorage.ts:107-138`, `app/src/lib/crypto.ts:78-81`, `app/src/lib/crypto.ts:152-160`.
- Impact: `decryptLegacy` derives a key from `navigator.userAgent`, which UA-Reduction (Chrome 101+) will eventually break. The `Returning raw value - may be unencrypted legacy data` branch returns plaintext from `localStorage` if every decryption step fails.
- Fix approach: Add a final cutoff date — log out users whose payload only decrypts via `decryptLegacy`, drop the plaintext-fallback path, and remove `decryptLegacy` once telemetry confirms no live users still rely on it.

**Date formatting bypasses `useDateTimeFormat` (rule 24):**
- Issue: 17 call sites use raw date-fns `format()` with literal patterns for user-visible output, violating AGENTS.md rule 24.
- Files (highest-impact):
  - `app/src/components/dashboard/widgets/TimelineWidget.tsx:117,126,163,218,220,254,256,300` — chart axis labels and tooltips.
  - `app/src/components/events/EventHeatmap.tsx:114,121` — heatmap axis labels.
  - `app/src/components/timeline/EventPreviewPopover.tsx:127` — popover time label `HH:mm:ss`.
  - `app/src/pages/Timeline.tsx:52,53,463,555,556` — date input defaults and reset values use `yyyy-MM-dd'T'HH:mm`.
- Impact: Users with custom date/time format preferences (12h vs 24h, locale formats) see inconsistent output across the app.
- Fix approach: Replace each `format(d, '...')` call site with `fmtDate`/`fmtTime`/`fmtDateTime` from `useDateTimeFormat()` in components, or `formatAppDate`/`formatAppTime` from `lib/format-date-time.ts` outside React. The `<input type="datetime-local">` cases in `Timeline.tsx` need a separate ISO-shaped helper.

**`console.log` / `console.error` violations of rule 9:**
- Issue: Two direct `console.*` calls remain inside the logger itself.
- Files: `app/src/lib/logger.ts:120` (the canonical `console.log` call inside `formatMessage`), `app/src/lib/logger.ts:155` (`console.error(error.stack)`).
- Impact: Acceptable inside the logger implementation, but the rule's grep-based enforcement (and any future tightening) will trip on these.
- Fix approach: Add an `eslint-disable-next-line` comment with a clear justification on each line so future audits can distinguish logger internals from accidental usage.

**Wide use of `any` in extensible records:**
- Issue: 14 source-tree occurrences of `any`, mostly clustered around dashboard widgets and persisted-store migrations.
- Files:
  - `app/src/stores/dashboard.ts:32,188,194,227` — widget settings record and store-migration shapes.
  - `app/src/components/dashboard/widgets/TimelineWidget.tsx:296` — recharts `onClick` payload.
  - `app/src/types/videojs-markers.d.ts:34,63` — third-party type augmentation.
  - `app/src/lib/vendor/go2rtc/video-rtc.d.ts:97,120` — vendored go2rtc types.
- Impact: Type errors slip past `tsc -b`; widget settings are not exhaustive when new widget types are added.
- Fix approach: Replace with discriminated unions for widget settings, `unknown` + zod parsing for migrations, and minimal typed shapes for recharts payloads. Vendored `.d.ts` files can stay as-is.

**Inline `eslint-disable` markers obscure intent:**
- Issue: 24 disable directives across the source tree, mostly `react-hooks/exhaustive-deps` and `@typescript-eslint/no-explicit-any`.
- Files (concentrations):
  - `app/src/components/ui/video-player.tsx:96,100,117,163` — repeated disables for `videojs-markers` interface augmentation.
  - `app/src/hooks/useStreamLifecycle.ts:124`, `app/src/hooks/useGo2RTCStream.ts:258` — exhaustive-deps disables in lifecycle hooks.
  - `app/src/components/timeline/EventPreviewPopover.tsx:117`, `app/src/components/ui/hover-preview.tsx:309` — popover effect deps.
- Impact: Hooks with disabled dependency checking are more prone to stale-closure bugs when refactored.
- Fix approach: Audit each `react-hooks/exhaustive-deps` disable, factor stable dependencies via `useEvent`-style ref helpers, and move repeated `videojs-markers` augmentation into a single typed wrapper.

## Known Bugs

**Monitor detail crashes on placeholder ZM Servers row (open issue #120):**
- Symptoms: Monitor detail view fails when the ZM Servers table contains a placeholder row with `Hostname/Port=0`.
- Files: likely `app/src/api/monitors.ts`, `app/src/pages/MonitorDetail.tsx:1-536`.
- Trigger: ZM installations that retain a default `ZM_SERVERS` entry with stub host/port values.
- Workaround: None documented in the issue.

**Mock notification server accepts any credentials:**
- Symptoms: `mock-notification-server.js:122-127` accepts any non-empty `user`/`password` pair as authenticated.
- Files: `app/mock-notification-server.js:122-127,276`.
- Trigger: Developer convenience harness, not user-facing.
- Workaround: Local-only binding; safe as long as the file is never deployed.

## Security Considerations

**Tauri CSP disabled:**
- Risk: `app/src-tauri/tauri.conf.json:24` sets `"csp": null`, which means the Tauri webview imposes no Content-Security-Policy beyond the default.
- Files: `app/src-tauri/tauri.conf.json:24`.
- Current mitigation: No remote code is loaded by default (frontend is bundled). HTTP plugin scope in `app/src-tauri/capabilities/default.json` allows `http://**` and `https://**`, so XSS via injected ZM data could exfiltrate.
- Recommendations: Define a strict CSP (`default-src 'self'; img-src 'self' data: blob: https: http:; connect-src 'self' https: http: ws: wss:; script-src 'self'; style-src 'self' 'unsafe-inline'`) once the live-streaming flows have been verified to work under it.

**Tauri HTTP scope is wildcard-open:**
- Risk: `http:default` capability allows `http://**` and `https://**`, so any compromised renderer can issue arbitrary outbound requests to any host.
- Files: `app/src-tauri/capabilities/default.json:10-17`.
- Current mitigation: Frontend code goes through `lib/http.ts` and only contacts the configured ZM server.
- Recommendations: Narrow the scope at runtime by reading the active profile URL into the capability set, or accept the trade-off but document it in the developer guide.

**Web-only PBKDF2 key derived from a single device-local random salt:**
- Risk: `app/src/lib/crypto.ts:73-76` derives the encryption key from a 16-byte random salt stored in `localStorage` under `zmng_crypto_salt_v1`. There is no user-supplied secret. Any attacker with read access to `localStorage` (XSS, malicious extension) can call `getEncryptionKey()` and decrypt every secure value.
- Files: `app/src/lib/crypto.ts:18-76`, `app/src/lib/secureStorage.ts:55-73`.
- Current mitigation: The app discourages web/desktop credential storage in favor of native Keychain/Keystore on mobile. The hardened CSP, when enabled, would mitigate XSS.
- Recommendations: Document that web `secureStorage` is convenience-grade only. Consider adding an opt-in passphrase mode for the desktop/web build.

**Plain `fetch` call in `EventThumbnailHoverPreview` bypasses `lib/http.ts` (rule 10):**
- Risk: `app/src/components/events/EventThumbnailHoverPreview.tsx:123` issues `fetch(controlUrl, { method: 'GET', mode: 'no-cors' })` directly, bypassing the unified HTTP path that adds auth, logging, and SSL-trust handling.
- Files: `app/src/components/events/EventThumbnailHoverPreview.tsx:123`.
- Current mitigation: The request is fire-and-forget for an image preload; failure is silently swallowed.
- Recommendations: Use `httpGet` from `lib/http.ts` so the call participates in auth-token rotation, native HTTP on mobile, and self-signed-cert trust on desktop.

**`axios` is a runtime dependency but no source code imports it:**
- Risk: `axios ^1.13.2` ships in `app/package.json:91` despite zero imports under `app/src`. It is included in the bundle, increasing supply-chain surface.
- Files: `app/package.json:91`.
- Current mitigation: None.
- Recommendations: Drop the dependency unless a planned migration requires it; verify with `npm ls axios` to confirm no transitive consumer relies on the workspace copy.

## Performance Bottlenecks

**Mobile downloads via base64 of full payload:**
- Problem: `downloadFileNative` requests the entire response as a single base64 string before writing to disk.
- Files: `app/src/lib/download.ts:173-232` (specifically `httpRequest<string>(... responseType: 'base64')` at line 185 and `Filesystem.writeFile` at line 207).
- Cause: `lib/http.ts` does not expose chunked-streaming for native HTTP, so `download.ts` keeps the full file in memory as base64 plus the decoded write. Despite the AGENTS.md rule 15 explicitly forbidding Blob conversion to avoid OOM, the current path still holds 1× base64 + 1× decoded buffer simultaneously.
- Improvement path: Stream `Filesystem.appendFile` in chunks, or move large downloads to a native-side foreground service that streams from URL to disk without crossing the JS bridge as a single payload.

**Per-second timeline canvas redraws:**
- Problem: `TimelineCanvas.tsx:187` schedules `setNowTick((t) => t + 1)` every `NOW_REFRESH_INTERVAL` ms, forcing a re-render and canvas repaint regardless of bandwidth mode.
- Files: `app/src/components/timeline/TimelineCanvas.tsx:187`.
- Cause: The "now" line is treated as a wall-clock animation; the interval is hardcoded rather than scaled by bandwidth settings.
- Improvement path: Source the cadence from `useBandwidthSettings()`; suspend the interval when the timeline scrubber is being dragged or when the tab is hidden.

**`KioskOverlay` 1-second timer:**
- Problem: `app/src/components/kiosk/KioskOverlay.tsx:44` re-renders the kiosk overlay every second.
- Files: `app/src/components/kiosk/KioskOverlay.tsx:44`.
- Cause: Used for the live clock display.
- Improvement path: Move clock formatting into a memoized child so the parent does not re-render every second; consider `requestAnimationFrame` slot to align with display refresh.

**Token-check polling unconditional after auth:**
- Problem: `useTokenRefresh` runs `setInterval(checkAndRefresh, ZM_INTEGRATION.tokenCheckInterval)` indefinitely while authenticated.
- Files: `app/src/hooks/useTokenRefresh.ts:64`.
- Cause: A safety net for already-expired tokens after long backgrounding.
- Improvement path: Schedule a single `setTimeout` aligned with `accessTokenExpires - leeway` and reset on visibility change rather than polling minute-by-minute.

## Fragile Areas

**Cross-platform download path branching:**
- Files: `app/src/lib/download.ts:120-296`.
- Why fragile: Three implementation branches (Tauri, native mobile, web) duplicate progress reporting, error handling, and abort wiring. Each platform has independent failure modes (CORS fallback at line 277-296, base64 OOM risk on mobile, dialog cancellation on Tauri).
- Safe modification: Add a unit test per branch for the happy path, then refactor shared logic (filename, progress callback wiring) into a single `runDownload()` core. Always touch all three branches when adjusting behavior.
- Test coverage: There is a test file at `app/src/lib/__tests__/` but no `download.test.ts`; native paths are exercised only manually.

**Profile-bootstrap SSL trust migration:**
- Files: `app/src/stores/profile-bootstrap.ts:248-281`.
- Why fragile: Bootstrap runs before the first API call, must apply trust settings synchronously across iOS/Android/web, and includes a one-shot migration for users who enabled self-signed certs before fingerprint pinning landed.
- Safe modification: Always run `npm test` against `profile-bootstrap.test.ts` and add a new fixture per migration scenario. Document any new bootstrap step in `app/src/stores/profile-bootstrap.ts` header comment.
- Test coverage: Covered by `app/src/stores/__tests__/`.

**Notifications stack (push, websocket, badge, history):**
- Files: `app/src/services/notifications.ts` (658 LOC), `app/src/services/pushNotifications.ts` (592 LOC), `app/src/stores/notifications.ts` (667 LOC), `app/src/components/NotificationHandler.tsx` (318 LOC).
- Why fragile: Three concurrent connection paths (Firebase push, ZM websocket, polling fallback) reconcile into one badge counter and one history list. State transitions span four files.
- Safe modification: Use `notifications.feature` e2e and the unit tests in `app/src/services/__tests__/notifications.test.ts` and `pushNotifications.test.ts`. Verify `mock-notification-server.js` still receives the right registration payload after changes.
- Test coverage: Service layer is covered; UI component (`NotificationHandler.tsx`) lacks a dedicated unit test.

**Capacitor / Tauri version coupling (rules 14 and 16):**
- Files: `app/package.json:54-89`, `app/src-tauri/Cargo.toml:24-28`.
- Why fragile: Capacitor JS plugins (`@capacitor/core ^7.4.4`) must match the iOS/Android native runtimes; Tauri JS (`@tauri-apps/api ^2.10.1`) must match Rust crates (`tauri = "2.10.2"`, `tauri-plugin-http = "2.5.7"`). Skews surface only at runtime on device.
- Safe modification: When updating any Capacitor or Tauri package, update all siblings in the same commit and run `npm run android:sync` / `npm run ios:sync` / `npm run tauri:build` before merging.
- Test coverage: Build scripts catch crate-level mismatches; runtime mismatches require device e2e (manual-only per project memory).

**Logger writes to both `console.log` and zustand store on every call:**
- Files: `app/src/lib/logger.ts:120-130`.
- Why fragile: Every `log.*` call appends to `useLogStore`, which is unbounded by default. Long-running sessions can accumulate megabytes of log entries in memory and persist them to localStorage if the store is configured for persistence.
- Safe modification: Verify the log store enforces a ring-buffer cap before adding new high-frequency log call sites.
- Test coverage: Logger has no `__tests__/logger.test.ts` despite being imported by every module.

## Scaling Limits

**In-memory log store:**
- Current capacity: Unbounded — every `log.*` call appends to `useLogStore`.
- Limit: Long sessions on mobile (where memory is tight) accumulate entries until OOM or jank.
- Scaling path: Cap `useLogStore` at e.g. 5,000 entries with FIFO eviction; persist only ERROR/WARN levels.

**Background tasks / downloads concurrency:**
- Current capacity: `app/src/stores/backgroundTasks.ts` (4.5K) holds active tasks; no observed cap.
- Limit: Mobile devices throttle simultaneous native HTTP downloads; many parallel downloads can starve the WebView of memory.
- Scaling path: Add a configurable max-parallel-downloads policy and queue overflow tasks.

## Dependencies at Risk

**Unused `axios` runtime dependency:**
- Risk: Listed in `dependencies` but not imported anywhere under `app/src`.
- Impact: Adds bundle weight and supply-chain surface.
- Migration plan: Remove from `app/package.json:91` and re-run `npm install` + `npm run build`.

**`videojs-markers` lacks official types:**
- Risk: `app/src/types/videojs-markers.d.ts` is a hand-rolled ambient declaration with `any` fields. The plugin is unmaintained upstream.
- Impact: Type-checking gaps in `app/src/components/ui/video-player.tsx:96-117`.
- Migration plan: Replace with `videojs-marker-plugin` (maintained fork) or implement marker rendering directly via `video.js` overlays.

**`html5-qrcode` for QR scanning:**
- Risk: Used in `app/src/components/QRScanner.tsx` (459 LOC). Library is in maintenance mode and has known camera-permission edge cases on iOS Safari.
- Impact: QR scanning may break on future iOS versions.
- Migration plan: Native QR plugin (`capacitor-barcode-scanner`, already a dependency) is preferred on mobile; web/Tauri can keep `html5-qrcode` until a maintained alternative is selected.

## Files Exceeding the ~400 LOC Guideline (Rule 12)

Source files (excluding `__tests__`) above the ~400 LOC target:

| Lines | File |
|-------|------|
| 746 | `app/src/pages/Timeline.tsx` |
| 679 | `app/src/api/types.ts` |
| 673 | `app/src/components/timeline/timeline-renderer.ts` |
| 667 | `app/src/stores/notifications.ts` |
| 658 | `app/src/services/notifications.ts` |
| 614 | `app/src/pages/Server.tsx` |
| 596 | `app/src/components/monitor-detail/MonitorSettingsDialog.tsx` |
| 592 | `app/src/services/pushNotifications.ts` |
| 592 | `app/src/pages/Profiles.tsx` |
| 592 | `app/src/pages/ProfileForm.tsx` |
| 557 | `app/src/pages/Events.tsx` |
| 541 | `app/src/pages/EventDetail.tsx` |
| 536 | `app/src/pages/MonitorDetail.tsx` |
| 531 | `app/src/lib/http.ts` |
| 527 | `app/src/components/settings/AdvancedSection.tsx` |
| 522 | `app/src/pages/Logs.tsx` |
| 509 | `app/src/lib/download.ts` |
| 502 | `app/src/lib/url-builder.ts` |
| 482 | `app/src/components/events/ZmsEventPlayer.tsx` |
| 459 | `app/src/components/QRScanner.tsx` |
| 458 | `app/src/pages/Montage.tsx` |
| 449 | `app/src/stores/profile.ts` |
| 441 | `app/src/components/settings/AppearanceSection.tsx` |
| 425 | `app/src/components/layout/SidebarContent.tsx` |
| 424 | `app/src/pages/NotificationSettings.tsx` |
| 417 | `app/src/components/montage/hooks/useMontageGrid.ts` |
| 403 | `app/src/components/timeline/TimelineCanvas.tsx` |
| 401 | `app/src/components/montage/GridLayoutControls.tsx` |

Suggested extractions:
- `pages/Timeline.tsx` — split filter state, scrubber wiring, and event-list rendering into focused subcomponents under `components/timeline/`.
- `api/types.ts` — split per ZM domain (events, monitors, server, zones) into `api/types/*.ts`.
- `services/notifications.ts` and `stores/notifications.ts` — extract the websocket reconnect strategy into a dedicated `services/notification-transport.ts`.
- `pages/Server.tsx`, `Profiles.tsx`, `ProfileForm.tsx` — move form sections into `components/profile/` chunks.

## Platform-Specific Gotchas

**iOS WebView:**
- WebView context switch required in WDIO + Appium; tests must wait for `webviewSwitch` timeout from `app/tests/platforms.config.defaults.ts`.
- iOS Keychain entries persist across app reinstalls when the entitlement is set; uninstall during dev must use `xcrun simctl uninstall` to fully clear.

**Android emulator:**
- Tests rely on ADB port-forward to CDP (`cdpPort: 9222` in `app/tests/platforms.config.defaults.ts:54`). A second emulator on the same host will collide unless the port is overridden in `platforms.config.local.ts`.
- Open issues: 16 KB memory page support (#117) and R8/proguard minification (#115) are unresolved. The release AAB does not yet ship minified.

**Tauri WebDriver:**
- `tauri-driver` is the only supported driver; it requires the bundled debug binary.
- macOS biometric integration (`app/src-tauri/src/biometric.rs:30-65`) shells out to the `swift` CLI to call `LAContext.evaluatePolicy`. This depends on Xcode command-line tools being installed; without them, biometric auth silently fails. The header comment notes this is a workaround for `block2` FFI complexity.

**Static `@capacitor` import on iOS-only push path:**
- `app/src/services/pushNotifications.ts:10` statically imports `import type { Notification } from '@capacitor-firebase/messaging'`.
- This is a `type`-only import and does not violate rule 14 (which forbids static value imports), but new contributors may copy the line and add a value import. Add a comment marking the import as type-only.

## Test Coverage Gaps

**Pages with no unit tests:**
- `app/src/pages/Server.tsx` (614 LOC), `EventMontage.tsx`, `NotificationSettings.tsx`, `Dashboard.tsx`, `ProfileForm.tsx` (592 LOC), `Timeline.tsx` (746 LOC), `NotificationHistory.tsx`, `MonitorDetail.tsx` (536 LOC), `EventDetail.tsx` (541 LOC).
- Risk: Many of these pages contain non-trivial state machines (filter wiring in `Timeline`, profile bootstrap in `ProfileForm`). Regressions surface only via e2e.
- Priority: High for `Timeline`, `MonitorDetail`, `ProfileForm`.

**Hooks without tests (19 of 31):**
- `usePullToRefresh`, `useServerUrls`, `useEventNavigation`, `useDateTimeFormat`, `useEventPagination`, `useBiometricAuth`, `useImageError`, `useEventMontageGrid`, `useBandwidthSettings`, `useNotificationDelivered`, `use-toast`, `useSwipeNavigation`, `useZoomPan`, `useMonitors`, `useTimelineFilters`, `usePinchZoom`, `useNotificationPushSetup`, `useEventTags`, `useInsomnia`.
- Risk: `useDateTimeFormat` and `useBandwidthSettings` are referenced by every page; bugs propagate widely.
- Priority: High for `useBandwidthSettings`, `useDateTimeFormat`, `useTimelineFilters`, `useBiometricAuth`. Medium for the rest.

**API modules without tests:**
- `app/src/api/zones.ts`, `app/src/api/logs.ts`, `app/src/api/client.ts`, `app/src/api/tags.ts`.
- Risk: `client.ts` is the auth-aware HTTP client; regressions affect every API call.
- Priority: High for `client.ts`. Medium for the rest.

**Lib modules without tests:**
- `log-level.ts`, `tv-dpad-nav.ts`, `format-date-time.ts`, `navigation.ts`, `proxy-utils.ts`, `tv-spatial-nav.ts`, `zmninja-ng-constants.ts`, `event-utils.ts`, `platform.ts`, `tv-a11y.ts`, `logger.ts`, `zm-constants.ts`, `cert-trust-event.ts`, `version.ts`.
- Risk: `logger.ts` is imported by every module; `format-date-time.ts` is rule-24 critical; `proxy-utils.ts` controls dev-mode CORS; `cert-trust-event.ts` mediates SSL trust UX.
- Priority: High for `logger.ts`, `format-date-time.ts`, `cert-trust-event.ts`, `proxy-utils.ts`. Low for TV navigation helpers.

**`download.ts` has no unit test:**
- The 509-LOC cross-platform download module has no `download.test.ts`. Each branch (web, Tauri, native mobile) carries OOM and CORS risk.
- Priority: High.

**Component test concentration:**
- Of 109 `.tsx` files outside `__tests__`, only 16 component test files exist. `BackgroundTaskDrawer.test.tsx` is 432 LOC, much larger than the production component, suggesting test patterns are not yet uniform.

## Open GitHub Issues (as of 2026-04-26)

| # | Type | Title |
|---|------|-------|
| 120 | bug | `fix: monitor detail view fails when ZM Servers row has placeholder Hostname/Port=0` |
| 117 | build | `build(android): support 16 KB memory page sizes` |
| 115 | build | `build(android): enable R8/proguard minification for release AAB` |

---

*Concerns audit: 2026-04-26*
