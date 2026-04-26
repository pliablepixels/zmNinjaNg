# Stack Research — 10-Second Triage Delivery Mechanisms

**Domain:** Cross-platform notification routing, rich push, and home-screen quick-look surfaces for an existing brownfield Capacitor 7 + Tauri 2 + React 19 app
**Researched:** 2026-04-26
**Confidence:** HIGH for FCM payload + plugin choices, MEDIUM for widget plugin selection (multiple viable forks), MEDIUM for iOS Critical Alerts path

## Scope of This Document

This is the **delta stack** for the milestone — only what is *not yet wired* in `.planning/codebase/STACK.md`. The existing stack (TypeScript 5.9, React 19, Vite 7, Capacitor 7.4.4, Tauri 2.10.2, Zustand 5, React Query 5.90, react-i18next, sonner, `@capacitor-firebase/messaging` 7.5.0) is locked and reused. Recommendations here either add new packages or document the native-side configuration the existing plugins already permit.

## Recommended Stack

### Core Delivery Mechanisms

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@capacitor-firebase/messaging` | **7.5.0** (already installed) | FCM payload reception on iOS + Android, action callbacks via `notificationActionPerformed` | Already in lockfile; the 7.x line is the last to support `@capacitor/core` 7. The plugin exposes `createChannel`, `deleteChannel`, action-buttons via Android category + iOS UNNotificationCategory, and foreground presentation options. The 8.x line is gated on Capacitor 8 — do not upgrade. |
| `@capacitor/local-notifications` | **7.0.6** (NEW) | Schedule per-monitor quiet-hours suppression, deliver action-buttoned local notifications when the WebSocket path receives an event in foreground/recent-background, register `actionTypes` for category-based action sets | Last 7.x release; peers `@capacitor/core >=7.0.0`. Required because FCM-only delivery does not let us schedule deferred or quiet-hours-rewritten notifications, and the `registerActionTypes` API is the iOS UNNotificationCategory bridge that `@capacitor-firebase/messaging` lacks for *local* notifications. |
| iOS Notification Service Extension (App-side, no plugin) | iOS 15+ target | Download the ZM event thumbnail referenced in the FCM payload's `fcm_options.image` or a `data.thumbnail_url` field, attach via `UNNotificationAttachment`, decorate title with monitor name + score | Required by Apple for any rich push that fetches media at delivery time. `@capacitor-firebase/messaging` does not generate this extension — it must be added to the Xcode project as a new target (`NotificationService.swift`) and configured to share an App Group with the main app for thumbnail caching. The plugin will swizzle `didReceiveRemoteNotification` and forward extension-mutated payloads to JS. |
| Android `NotificationCompat` styles via FCM payload | AndroidX (already pulled by Capacitor) | `BigPictureStyle` for thumbnail, `addAction(...)` for action buttons, per-monitor `NotificationChannel` for priority + sound | Fully driven by the FCM `notification.android.notification` block + `notification.android.channel_id` field — no extra plugin needed. The system handles big-picture rendering when the FCM payload includes `image` and the app is targeting API 33+. |
| `tauri-plugin-notification` (Rust) + `@tauri-apps/plugin-notification` (JS) | **2.3.3** (NEW) | Native macOS Notification Center / Windows Toast / Linux libnotify delivery for events received via the existing WebSocket path | Official Tauri plugin (mirrors the existing `@tauri-apps/plugin-*` pattern at 2.5–2.7). Compatible with Tauri 2.10.2 (`@tauri-apps/api ^2.8.0` peer). Image attachments work on macOS + Linux; Windows shows the icon only. Action buttons are mobile-only per the official docs — desktop falls back to click-to-open. |
| Tauri 2 built-in **tray icon** API (no plugin) | Tauri 2.10.2 (already installed) | System-tray / menu-bar quick-look surface on macOS / Windows / Linux | The `tray-icon` API is built into `tauri` core in v2 — the v1 `system-tray` feature flag was renamed and merged. No new dependency. Configured in `app/src-tauri/src/lib.rs` via `TrayIconBuilder` with a menu showing the latest event(s) and a click handler that opens the EventDetail route. |
| Web Push (VAPID) + Service Worker `showNotification` | Browser-native, no library | Web/PWA equivalent of mobile rich push when ZM server has a Web Push relay configured (out of milestone scope to add server-side, in scope to wire the client) | `Notification.actions` (up to 2 buttons supported widely) + `image` + `badge` + `tag` (replaces stale notifications by camera) cover the same UX. Use `web-push` only on the server side; the client only registers a `PushSubscription` and a service worker that calls `registration.showNotification(...)`. Document this as a stub for the milestone — the actual server delivery is a future ZM-side feature. |
| Web `Badging API` (`navigator.setAppBadge` / `clearAppBadge`) | Browser-native | Unreviewed-event count on the PWA app icon (Chromium + iOS 16.4+ Safari/standalone PWAs) | Already partly used via `@capawesome/capacitor-badge` on native — extend to web via the platform-native API. No new dependency. |

### Home-Screen / Quick-Look Surface

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **iOS WidgetKit extension** (Swift, in `app/ios/App/`) | iOS 16.1+ target | Latest-event home-screen widget (small + medium families) reading from a shared App Group `UserDefaults` suite | WidgetKit is Apple's only sanctioned home-screen widget API. The extension is a separate Xcode target; the main app writes the latest event JSON to `UserDefaults(suiteName: "group.com.zoneminder.zmNinjaNG")` and calls `WidgetCenter.shared.reloadAllTimelines()`. |
| **Android Glance App Widget** (Kotlin, in `app/android/`) | `androidx.glance:glance-appwidget:1.1.1` | Latest-event home-screen widget rendered with a Compose-style API, reading from `SharedPreferences` shared with the main app | Glance 1.1.x is GA on Android 12+ (with limited support back to API 23). It avoids the legacy XML `RemoteViews` quagmire and renders cleanly under Material You. |
| `capacitor-widget-bridge` (kisimedia fork) | **7.0.0** (NEW) | The thin JS↔native bridge: `setItem`/`getItem`/`reloadAllTimelines` on iOS, equivalent SharedPreferences write + `AppWidgetManager.notifyAppWidgetViewDataChanged` on Android | Peer is `@capacitor/core >=7.0.0` — the only Capacitor-7-line release of this plugin. The 8.x branch (8.1.0, March 2026) requires Capacitor 8. The plugin is intentionally bridge-only: it does **not** ship the Swift widget code or the Kotlin Glance code, which we own anyway because the UI is camera/event-specific. Picked over `capacitor-widgetsbridge-plugin@0.2.1` (iOS-only, by `0xn33t`) because we need both platforms and a single bridge surface. |
| iOS Live Activities / Dynamic Island | iOS 16.1+, ActivityKit | DEFER to a follow-up milestone | Live Activities require an active "event in progress" model (start → update → end) that does not match ZoneMinder's discrete event firing. Revisit if/when continuous-detection metadata becomes available. |

### Per-Monitor Routing & Quiet Hours

| Mechanism | Platform | Why |
|-----------|----------|-----|
| Android `NotificationChannel` per monitor (or per priority bucket) | Android 8+ | Once created, channel importance can only be changed by the user — so we create channels by *priority bucket* (`zmng_priority_high`, `_normal`, `_low`, `_silent`) not per camera, and route via the FCM payload's `android.notification.channel_id`. Per-camera sound/vibration is set on the channel; users tweak it from system settings. |
| iOS `UNNotificationCategory` + `interruptionLevel` | iOS 15+ | `interruptionLevel` (`active` / `timeSensitive` / `critical`) drives Focus mode behavior. `timeSensitive` is the right default for a security alert; `critical` requires a separate Apple entitlement (`com.apple.developer.usernotifications.critical-alerts`) and bypasses Do Not Disturb. Treat Critical Alerts as opt-in per monitor and request the entitlement only if the user enables it (TestFlight-only until Apple approves the entitlement request). |
| Quiet hours = client-side scheduled rewrite | All platforms | Within a quiet window, the FCM/WebSocket arrival fires `LocalNotifications.schedule({ ..., schedule: { at: windowEnd } })` instead of an immediate notification, with deduplication by `eventId`. Avoids depending on the ZM server for time-windowed routing. |

### Development & Testing Additions

| Tool | Purpose | Notes |
|------|---------|-------|
| `web-push` (NEW dev-only) | Local mock server for VAPID-signed test pushes during web-push development | Add to `app/mock-notification-server.js`. Not shipped to production. |
| Appium native specs for action callbacks | Verify action buttons fire the right deep link on iOS + Android | Already required by AGENTS.md rule #14 + the existing Appium harness; just new specs in `app/tests/native/specs/rich-push.spec.ts`. |
| iOS Simulator `xcrun simctl push` | Inject test FCM-shaped payloads to a simulator without a real APNs round-trip | Standard Xcode tooling, no install needed. Wire into `npm run test:e2e:ios-phone` as a pre-step that pushes a fixture before assertions. |
| Android `adb shell cmd notification post` | Same idea on Android | Standard Android SDK tool. |

## Installation

```bash
# Inside app/
# Local notifications (NEW) — last Capacitor-7-compatible release
npm install @capacitor/local-notifications@7.0.6

# Widget bridge (NEW) — kisimedia fork, only Capacitor-7 line on npm
npm install capacitor-widget-bridge@7.0.0

# Tauri notification (NEW) — JS + Rust pair, both at 2.3.3
npm install @tauri-apps/plugin-notification@2.3.3
# In app/src-tauri/Cargo.toml, add under [dependencies]:
#   tauri-plugin-notification = "2.3.3"

# Dev-only mock for web-push payloads (NEW)
npm install -D web-push

# After install:
npx cap sync                                  # propagate plugin pods + Gradle modules
# Manually add Notification Service Extension target in Xcode (one-time)
# Manually add WidgetKit extension target in Xcode (one-time)
# Manually add a Glance AppWidgetProvider module under app/android/app/src/main/java/com/zoneminder/zmNinjaNG/widget/
```

After install, register the new Tauri plugin in `app/src-tauri/src/lib.rs` next to the existing `tauri_plugin_log::Builder` / `tauri_plugin_http` / `tauri_plugin_fs` / `tauri_plugin_dialog` registrations, and add `notification:default` to `app/src-tauri/capabilities/default.json`.

For Capacitor plugin mocks, add stubs to `app/src/tests/setup.ts` for `LocalNotifications`, `WidgetBridge` (kisimedia plugin name), and the existing `FirebaseMessaging` per AGENTS.md rule #14.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@capacitor-firebase/messaging` 7.5.0 (already in tree) | OneSignal SDK | Only if the project ever wants third-party hosted segmentation, in-app messaging, or analytics. OneSignal handles iOS NSE auto-config, action buttons, and rich push out of the box, but adds a vendor dependency, a third-party data plane (incompatible with the self-hosted ZoneMinder model), and a separate token-registration flow that conflicts with the existing `/notifications.json` ZM endpoint. Rejected. |
| `capacitor-widget-bridge` 7.0.0 (kisimedia fork) | `capacitor-widgetsbridge-plugin` 0.2.1 (`0xn33t`) | Use only if iOS is the sole target. Drops Android support, which violates rule #6 (cross-platform). |
| `capacitor-widget-bridge` 7.0.0 | Hand-roll a custom Capacitor plugin under `app/src/plugins/widget-bridge/` mirroring the existing `app/src/plugins/pip/` and `app/src/plugins/ssl-trust/` pattern | Use if the npm plugin's API surface (e.g. its hardcoded `UserDefaults` suite name resolution) ever blocks a feature. Plugin code is ~150 LOC per platform; not exotic. The existing in-repo plugin pattern is precedent. |
| iOS Notification Service Extension (in `app/ios/App/`) | `mutable-content: 1` alone with no extension | Without an NSE you cannot fetch the ZM thumbnail (which lives behind ZM auth on the user's LAN) at delivery time. The image must arrive in the payload pre-signed *or* be fetched by code running in the NSE that has access to the App-Group keychain copy of the credentials. There is no shortcut. |
| Tauri 2 built-in tray | `tauri-plugin-tray` (community, third-party) | Built-in tray API is more capable in 2.10. Third-party plugin is mostly a v1-era artifact. |
| Glance 1.1.1 | Legacy `RemoteViews` XML | Use legacy only if the team blocks Compose / Kotlin tooling. RemoteViews is functional but verbose, lacks Material You theming, and has no preview tooling. |
| `@capacitor/local-notifications` 7.0.6 | `@capacitor-firebase/messaging` foreground display alone | The Firebase plugin can render foreground notifications but cannot schedule deferred ones (needed for quiet-hours rewrite) or expose `registerActionTypes` for local notifications. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@capacitor-firebase/messaging` 8.x (8.2.0 is current as of March 2026) | Peer-requires `@capacitor/core >=8.0.0`; existing app is on Capacitor 7.4.4. Upgrading is a separate, milestone-sized lift (Android Gradle 8.x, iOS minimum 14, plugin re-validation across the existing 13 plugins). | Stay on 7.5.0 (already pinned). |
| `@capacitor/local-notifications` 8.x (8.0.2) | Same Capacitor-8 peer issue. | Pin `@capacitor/local-notifications@7.0.6`. |
| `@capacitor/push-notifications` (the official plugin, any version) | Duplicates `@capacitor-firebase/messaging`'s job and cannot share a token with FCM cleanly. The codebase already standardized on the Capawesome FCM plugin. | Keep using `@capacitor-firebase/messaging` 7.5.0 only. |
| `capacitor-community/fcm` | Marked maintenance-mode; the Capawesome `@capacitor-firebase/messaging` is the actively maintained successor. Many issues open against `capacitor-community/fcm` for iOS 14+. | `@capacitor-firebase/messaging` 7.5.0. |
| FCM **legacy** HTTP API (server.googleapis.com/fcm/send) | Sunset; Google migrated everyone to HTTP v1. The richer cross-platform overrides (`apns`, `android`, `webpush` blocks) only exist on v1. | If/when ZM-side push payloads are ever shaped by us, use HTTP v1 with explicit per-platform overrides. The client doesn't choose this — flag for the ZM-server companion work. |
| FCM **notification-only** payloads (no `data` block) for ZM events | iOS will not call our NSE if `mutable-content: 1` is missing, and the app cannot route to the right monitor without the event id in `data`. | Always send `notification` + `data` together with `apns.payload.aps.mutable-content: 1` and `android.notification.image` + `data: { eventId, monitorId, score, cause }`. |
| `tauri-plugin-tray` (community) | The v2 core API supersedes it; pulling a third-party plugin for a built-in feature increases version-sync surface area. | Use `tauri::tray::TrayIconBuilder` directly in `lib.rs`. |
| iOS Live Activities for events | The lifecycle (start → update → end) does not match a discrete ZM motion event. Misuse leads to Live Activities that "stick" on the lock screen with no clean end. Apple is also tightening Live Activity moderation in iOS 18+. | Defer; revisit if the milestone after this one introduces server-supplied "ongoing event" semantics. |
| Hardcoded polling for the widget refresh on Android | Glance widgets refresh on a system-throttled schedule + explicit `update()` calls. Polling burns battery. | Update the widget only when (a) a new event arrives via FCM/WebSocket, or (b) the user pulls down the home-screen widget. |
| Raw `Notification` constructor on web (without service worker) | Foreground-only and ignored when the tab is closed. | Always go through `ServiceWorkerRegistration.showNotification(...)` so the PWA path works in the background. |

## Stack Patterns by Variant

**If a user is on iOS with the Critical Alerts entitlement granted:**
- Per-monitor priority can include a "critical" tier
- Send `apns.payload.aps.sound: { critical: 1, name: "default", volume: 1.0 }` and `interruption-level: "critical"`
- Bypasses Focus mode and silent switch

**If a user is on iOS without the Critical Alerts entitlement:**
- Top tier is `interruption-level: "time-sensitive"`
- Surfaces in Focus mode but respects the silent switch
- This is the default; the entitlement is post-launch + opt-in

**If a user is on a web/PWA-only setup:**
- Web Push covers rich notifications (image + 2 actions)
- Service worker `showNotification(..., { tag: monitorId })` collapses repeat alerts per camera
- `setAppBadge(unreviewedCount)` for the badge equivalent
- No widget — the "quick-look" surface degrades to a top-bar dock inside the app shell

**If a user is on Tauri desktop:**
- Notification + tray-icon menu = quick-look
- macOS shows the badge on the dock icon via Tauri's tray API
- Windows + Linux show only the tray menu (no dock-equivalent badge)
- No action buttons on desktop notifications (mobile-only API per Tauri docs) — fall back to click-to-open

**If push must be re-enabled after a profile switch:**
- Existing `services/pushNotifications.ts` re-registers the FCM token; extend the same flow to (a) re-register `LocalNotifications` action types, (b) re-write per-priority Android channels via `createChannel`, (c) clear the widget App-Group cache so the widget doesn't show another profile's events.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@capacitor-firebase/messaging` 7.5.0 | `@capacitor/core >=7.0.0`, `firebase ^11.2.0` | Already installed and verified. The 8.x line is gated on `firebase ^12` + `@capacitor/core 8`. |
| `@capacitor/local-notifications` 7.0.6 | `@capacitor/core >=7.0.0` | Final 7.x release; 7.0.7-dev exists but is not stable. |
| `capacitor-widget-bridge` 7.0.0 | `@capacitor/core >=7.0.0` | Only Cap-7 release. Forks the `0xn33t` plugin and adds Android. |
| `@tauri-apps/plugin-notification` 2.3.3 | `@tauri-apps/api ^2.8.0` | Project ships `@tauri-apps/api` 2.10.1 — satisfied. JS + Rust crate **must** stay in sync per AGENTS.md rule #16. |
| `tauri-plugin-notification` (Rust) 2.3.3 | `tauri 2.x`, Rust ≥ 1.77.2 | Project ships `tauri 2.10.2` and Rust 1.77.2 — satisfied. |
| `androidx.glance:glance-appwidget` 1.1.1 | `compileSdk` 34+, Kotlin 1.9.x+ | Confirm via `app/android/app/build.gradle` after `npx cap sync`. |
| iOS NSE target | iOS deployment target ≥ 15.0 | Confirm `app/ios/App/App.xcodeproj`'s deployment target. |
| iOS WidgetKit extension | iOS deployment target ≥ 16.1 | If app is currently iOS 15-floored, raising to 16.1 is required for widgets. |
| Web Push API + `Notification.actions` | Chrome 50+, Firefox 44+, Safari 16.4+ on iOS PWAs in standalone | Action buttons unsupported in some Firefox builds — gracefully degrade to click-to-open. |
| Web `Badging API` | Chromium-based browsers, Safari 16.4+ in standalone PWA | Feature-detect; no fallback needed (just skip the call). |

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| FCM payload shape (HTTP v1 with `apns` + `android` + `webpush` overrides) | HIGH | Verified against official Firebase docs + multiple corroborating sources |
| `@capacitor-firebase/messaging` version + peer compat | HIGH | npm registry direct query, peer dep verified |
| `@capacitor/local-notifications` 7.0.6 final 7.x | HIGH | npm registry version listing verified |
| `capacitor-widget-bridge` 7.0.0 vs 8.x | HIGH | npm registry shows 7.0.0 as the only Cap-7 line release |
| iOS NSE need for thumbnails | HIGH | Apple platform requirement; no alternative |
| iOS Critical Alerts entitlement requirement | HIGH | Apple-published process |
| Tauri 2 tray-icon API replacing `tauri-plugin-tray` | HIGH | Verified at v2.tauri.app/learn/system-tray |
| `tauri-plugin-notification` 2.3.3 compat with Tauri 2.10 | HIGH | crates.io + npm pair both at 2.3.3, peer satisfied |
| Glance 1.1.1 as the Android-widget choice | MEDIUM | Glance is GA but the team has no current Glance code in tree; first integration carries learning-curve risk. Fallback to legacy `RemoteViews` is always available. |
| Web Push action support in iOS Safari standalone PWA | MEDIUM | Safari's iOS web-push surface evolves frequently; verify on current iOS at integration time |
| `kisimedia` fork stability long-term | MEDIUM | One-author plugin; may need to in-repo-fork to `app/src/plugins/widget-bridge/` if it goes unmaintained |

## Sources

- [@capacitor-firebase/messaging on npm](https://www.npmjs.com/package/@capacitor-firebase/messaging) — version + peers verified
- [@capacitor/local-notifications on npm](https://www.npmjs.com/package/@capacitor/local-notifications) — 7.0.6 confirmed as latest 7.x via `npm view`
- [Capawesome `capacitor-firebase` repo](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/messaging/README.md) — documented action handler API
- [Capacitor Local Notifications API docs](https://capacitorjs.com/docs/apis/local-notifications) — `registerActionTypes` documented as iOS + Android only
- [Capacitor Push Notifications + Firebase guide](https://capacitorjs.com/docs/guides/push-notifications-firebase) — iOS NSE setup pattern
- [Firebase FCM HTTP v1 send guide](https://firebase.google.com/docs/cloud-messaging/send/v1-api) — per-platform override blocks
- [FCM message types](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type) — notification vs data vs combined payloads
- [FCM Android message priority](https://firebase.google.com/docs/cloud-messaging/android-message-priority) — high-priority delivery semantics
- [Android NotificationChannel docs](https://developer.android.com/develop/ui/views/notifications/channels) — channel importance immutability
- [Apple WidgetKit documentation](https://developer.apple.com/documentation/widgetkit) — extension model
- [Apple ActivityKit / Live Activities](https://developer.apple.com/documentation/widgetkit/liveactivities-collection) — lifecycle reference (informs the "defer" call)
- [Jetpack Glance releases](https://developer.android.com/jetpack/androidx/releases/glance) — version 1.1.1 verified
- [Tauri v2 System Tray](https://v2.tauri.app/learn/system-tray/) — built-in `tray-icon` API
- [Tauri v2 Notification plugin](https://v2.tauri.app/plugin/notification/) — actions are mobile-only
- [`tauri-plugin-notification` on crates.io](https://crates.io/crates/tauri-plugin-notification) — Rust crate version 2.3.3
- [`capacitor-widget-bridge` (kisimedia)](https://github.com/kisimediaDE/capacitor-widget-bridge) — 7.0.0 the Cap-7 line
- [`capacitor-widgetsbridge-plugin` (0xn33t)](https://github.com/0xn33t/capacitor-widgetsbridge-plugin) — iOS-only origin
- [MDN ServiceWorkerRegistration.showNotification()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification) — actions, image, badge, tag fields
- [MDN Re-engageable Notifications + Push (PWA)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Re-engageable_Notifications_Push) — VAPID + push subscription pattern
- [iOS Critical Alerts in Capacitor (Wolenitz, Medium)](https://medium.com/@alonwo/ios-critical-alerts-in-capacitor-apps-fcm-push-notifications-ce591179feec) — confirms entitlement-gated path; MEDIUM confidence (single non-Apple source for the Capacitor-side specifics)

---
*Stack research for: 10-Second Triage delivery mechanisms*
*Researched: 2026-04-26*
