# Pitfalls Research

**Domain:** Cross-platform self-hosted NVR client — rich push, home-screen widgets, quiet-hours, triage UX
**Researched:** 2026-04-26
**Confidence:** HIGH for platform-API constraints (Apple/Google docs), MEDIUM for ZM-specific integration patterns (community + this codebase)

Scope: pitfalls specific to delivering the "10-Second Triage" milestone on top of the existing zmNinjaNg stack (Capacitor 7, Tauri 2, FCM via `@capacitor-firebase/messaging`, ZM Direct push tokens registered via `/notifications.json`).

Phase letters used below match the milestone roadmap dimension cards: P1 push enrichment, P2 reviewed state, P3 noise filter, P4 quick search, P5 priority + quiet hours, P6 home-screen quick-look surfaces.

---

## Critical Pitfalls

### Pitfall 1: FCM `notification` payload bypasses the Notification Service Extension and zmNinja can't enrich the alert

**What goes wrong:**
The iOS notification arrives, but the user sees a plain text alert with no thumbnail and no action buttons. On Android the foreground vs background payload split causes the `data` handler to never fire when the app is killed, so the "mark reviewed" / "snooze monitor" action buttons are absent.

**Why it happens:**
- iOS: A push only invokes `UNNotificationServiceExtension` when the payload sets `mutable-content: 1` AND uses an `aps.alert` block. FCM's "notification message" path only sets `mutable-content` if the sender explicitly adds it; ZM's `zmeventnotification.pl` historically sends a `notification` message without that flag. Without it, no extension runs, no thumbnail can be downloaded, no actions can be attached.
- Android: `notification`-type FCM messages are auto-displayed by the system and `onMessageReceived` only fires if the app is in the foreground. `data`-only messages call `onMessageReceived` in both states but require the app to construct the notification itself — which is where action buttons and channel routing live. Mixed payloads (both keys) are handled differently in fore vs background, which silently drops `data` fields.

**How to avoid:**
- Coordinate with `zmeventnotification.pl` operators (or document required server config) to send `data`-only FCM payloads with `priority: high` and `mutable_content: true` set on the iOS APNs override block.
- On iOS, ship a Notification Service Extension target inside `app/ios/` that reads `fcm_options.image` (or a custom `zmThumbUrl` field), fetches the image with the auth token retrieved from a shared App Group keychain, and calls `contentHandler` within the 30-second extension budget.
- On Android, in `MyFirebaseMessagingService`, build the notification from `data` fields ourselves and route to the right `NotificationChannel` (per-monitor or per-priority). Don't rely on the FCM SDK auto-display.
- Keep `notification`-type fallback for unconfigured servers but render only a degraded plain alert.

**Warning signs:**
- iOS device logs show the alert arriving but no `didReceive(_:withContentHandler:)` log line.
- Android `onMessageReceived` is never called when the app is in background or stopped.
- Thumbnails appear in foreground only.
- Action buttons appear in foreground only.

**Phase to address:** P1 (push enrichment). Audit the zmeventnotificationNg payload shape before designing the rich-push UI; otherwise the entire P1 surface is dead on real devices.

Sources: [Apple developer forum on UNNotificationServiceExtension + FCM](https://developer.apple.com/forums/thread/664048), [firebase-ios-sdk #3368 — FCM v1 payload not invoking service extension](https://github.com/firebase/firebase-ios-sdk/issues/3368), [Firebase blog — FCM on Android](https://firebase.blog/posts/2025/04/fcm-on-android/).

---

### Pitfall 2: Notification Service Extension OOMs at 24 MB and silently drops the rich notification

**What goes wrong:**
The thumbnail download succeeds, but decoding a multi-megapixel JPEG plus the WebKit overhead in the extension exceeds the 24 MB memory ceiling. iOS terminates the extension, and the user sees the original (un-mutated) plain notification text — no thumbnail, no "is this real" preview. There is no error UI; failures look identical to network failures.

**Why it happens:**
The Notification Service Extension is capped at 24 MB resident memory since iOS 14. ZM event thumbnails are full-resolution camera frames (often 2-4 MP, 1-3 MB JPEG, 8-16 MB decoded). Loading via `UIImage(data:)` decompresses immediately. Any retained `Data` plus the decoded image easily blows the budget on 4K camera setups.

**How to avoid:**
- Server-side: prefer a pre-resized thumbnail URL endpoint (ZM `thumbCapture.php` or a ZM API resize param). Don't send the full event frame URL.
- Extension-side: download with `URLSession` straight to a temp file, then pass the file URL to `UNNotificationAttachment.init(identifier:url:options:)` without decoding into memory. Set `UNNotificationAttachmentOptionsThumbnailHiddenKey: false` and let the system render the thumbnail off-process.
- Hard cap the download: `URLSession` task with a 6 MB byte counter; abort and fall back to text-only if exceeded.
- Profile the extension on iPhone SE (smaller memory headroom than Pro models).

**Warning signs:**
- "Notification thumbnails work on iPhone 15 Pro but not on iPhone SE."
- Console.app shows `Attempting to set the contents of an XPC encoder to an invalid value` or extension is killed via jetsam without a crash report.
- A user with a 4K camera reports missing thumbnails while a user with 1080p sees them.

**Phase to address:** P1. Required before shipping rich push.

Sources: [UNNotificationServiceExtension memory limits (Apple forums)](https://developer.apple.com/forums/thread/64634), [alastaircoote.github.io — UNNotificationServiceExtension and memory](https://alastaircoote.github.io/notification-service/).

---

### Pitfall 3: Authenticated thumbnail URLs in the FCM payload leak credentials or break self-signed installs

**What goes wrong:**
Either (a) credentials are embedded in the image URL (`https://user:pass@zm.example.com/...`) and end up logged by FCM/APNs intermediaries and the OS notification database, or (b) the URL is unauthenticated, fails when the user's ZM server requires auth, and the rich push silently degrades. Bonus failure: the user's ZM portal uses a self-signed cert, the system `URLSession` rejects it, and the extension can't fetch at all.

**Why it happens:**
- FCM payload is plaintext to multiple intermediaries before delivery; an embedded password is harvestable by anyone with access to APNs/FCM logs and is also persisted by iOS into `UserNotifications` history.
- Notification Service Extensions run in a separate process — the main-app SSL trust override (the codebase's `ssl-trust` Capacitor plugin and Tauri `dangerous-settings`) does not apply. The extension uses the default `URLSession` trust evaluator.
- ZM's `?token=` query auth has a short expiry and may be invalid by the time the extension runs.

**How to avoid:**
- Pull credentials from a shared App Group keychain (entitlement: `com.apple.security.application-groups: group.com.zoneminder.zmNinjaNG`) inside the extension. The main app writes the active profile's auth token plus the SSL trust fingerprint into the shared keychain on every refresh.
- In the extension, build a custom `URLSessionDelegate` that pins against the stored fingerprint (mirroring `app/src/plugins/ssl-trust/`). Treat unknown-fingerprint as "fail to plain-text alert", not "trust by default".
- Server-side option: have `zmeventnotification.pl` mint a short-lived signed thumbnail URL (HMAC over event id + expiry) and embed only that. This sidesteps both pitfalls but requires server cooperation (and the milestone is client-only — so this is fallback documentation, not a hard dep).
- Never embed `Authorization: Basic ...` or `?password=` in a URL.

**Warning signs:**
- Thumbnails work on dev / public-internet ZM but break on the user's home server.
- Reports from users with self-signed certs that "rich push doesn't show pictures".
- A security audit finds passwords in iOS notification database (`/var/mobile/Library/UserNotifications/`).

**Phase to address:** P1. Same phase as the extension itself — the App Group + shared-keychain plumbing is part of the extension setup.

Sources: [Apple keychain access groups](https://developer.apple.com/documentation/security/sharing-access-to-keychain-items-among-a-collection-of-apps), [Sharing authentication state across app + extensions (Smedmann)](https://medium.com/@thomsmed/share-authentication-state-across-your-apps-app-clips-and-widgets-ios-e7e7f24e5525), [Best practice for private images in FCM (Google Group)](https://groups.google.com/g/firebase-talk/c/Sm4Iv3ael-k).

---

### Pitfall 4: Android notification channels created at first run lock in wrong defaults forever

**What goes wrong:**
We ship v1.0 with a single channel `zmninja_events` at `IMPORTANCE_DEFAULT` (no sound, no heads-up). v1.1 adds per-monitor priority and tries to set `IMPORTANCE_HIGH` on existing channels — the change is silently ignored. Users who installed v1.0 never see heads-up alerts even after upgrading. Uninstall/reinstall is the only fix and we cannot trigger that remotely.

**Why it happens:**
Once a `NotificationChannel` is submitted to `NotificationManager`, every property except `name` and `description` is immutable. `setImportance()` after creation is a no-op. The user can change the importance via Settings; the app cannot.

**How to avoid:**
- Design the channel set up-front for the milestone (per priority tier × per quiet-hours mode), not iteratively. Recommended channels for P5:
  - `zmng.event.critical` — IMPORTANCE_HIGH, sound, vibrate, bypass-DND off (DND bypass needs Critical Alerts entitlement, see Pitfall 6)
  - `zmng.event.normal` — IMPORTANCE_DEFAULT
  - `zmng.event.quiet` — IMPORTANCE_LOW, no sound — used during quiet hours
  - `zmng.event.silent_summary` — IMPORTANCE_MIN — used for batched off-hours summaries
- Use `NotificationChannelGroup` per profile so multi-server users see groups in OS settings (`zmng.profile.<profileId>`).
- Per-monitor "priority" routes to one of the four channels at notification-build time. Do not create a channel per monitor — channel proliferation is a known UX foot-gun and a `monitor renamed` doesn't update the channel name correctly.
- Version the channel set: if we must change defaults later, mint a new channel id (`zmng.event.critical.v2`) and delete the old one with `deleteNotificationChannel`. Document the migration in code.

**Warning signs:**
- QA reports "the toggle in Notification Settings does nothing".
- Looking at OS settings shows the old channel defaults despite app code intending new ones.
- Users on long-lived installs report different behavior than fresh installs.

**Phase to address:** P5 (priority + quiet hours), but the channel set must be defined and shipped in P1 because the very first push notification commits the channels. There is no "we'll figure it out later" option.

Sources: [Android NotificationChannel docs — channel settings are immutable](https://developer.android.com/reference/android/app/NotificationChannel), [Create and manage notification channels](https://developer.android.com/develop/ui/views/notifications/channels).

---

### Pitfall 5: Android 14+ FCM high-priority quota downgrade kills the "10 second" promise

**What goes wrong:**
Initial test installs deliver pushes within 1-2 seconds. After a week of normal use, alerts start arriving 30-90 seconds late. The user opens the app, sees five queued events, and the milestone's core value evaporates.

**Why it happens:**
Android 14 changed the high-priority FCM model: there is no fixed quota any more, but the system downgrades an app's high-priority budget if it detects that a high-priority message did NOT result in a user-visible notification (for example because the app handled it as a silent data-only update or because POST_NOTIFICATIONS is denied). Repeat offenders get pushed to NORMAL priority, which means delivery is batched into Doze maintenance windows (15+ minutes possible).

**How to avoid:**
- Every high-priority FCM must result in a `notify()` call. If we want a silent update path (e.g., "monitor went offline" backgrounded refresh), send those as NORMAL priority data-only.
- Hold POST_NOTIFICATIONS permission before requesting the FCM token. If the user denies, fall back to the WebSocket transport and stop registering for FCM at all.
- Treat "silent dedupe" carefully: if the same event id arrives twice (FCM + WebSocket race), still post one notification on the FCM path and update — don't skip notify entirely.
- Telemetry: track receipt timestamp (FCM `sent_time` vs `onMessageReceived` time). Flag deltas > 10s.

**Warning signs:**
- Latency histogram in test logs shows a bimodal distribution with a tail beyond 15 seconds.
- Users in "data saver" or "battery saver" report systematically worse latency.
- Devices with the app uninstalled-and-reinstalled have better latency than long-running installs.

**Phase to address:** P1. The "always notify on high priority" rule is foundational and constrains how P5 (quiet hours) suppresses alerts — quiet-hours suppression must happen by routing to a low-importance channel, NOT by skipping notify().

Sources: [Firebase blog — FCM on Android (2025)](https://firebase.blog/posts/2025/04/fcm-on-android/), [Android Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby), [Android message priority](https://firebase.google.com/docs/cloud-messaging/android-message-priority).

---

### Pitfall 6: Critical Alerts entitlement applied for the wrong reason → App Store rejection

**What goes wrong:**
We submit the milestone to App Store with a Critical Alerts entitlement request justified as "home security alerts". Apple rejects with the standard "this API is not designed for the use you've identified" form letter. The submission goes back into the queue, the milestone slips by 2-3 weeks.

**Why it happens:**
Apple has tightened Critical Alerts policy. General-purpose home-security and surveillance apps have been rejected; the entitlement is reserved for apps whose alerts have direct safety implications (medical alarms, severe weather warnings, regulated industries). "Someone moved in front of my camera" does not clear that bar even though users want it to.

**How to avoid:**
- Do NOT request Critical Alerts in the initial milestone. Ship per-monitor priority with regular `IMPORTANCE_HIGH` / heads-up + Apple's regular high-priority push tier. That covers 95% of the "wake me up when this matters" UX without the entitlement.
- If a future milestone needs Critical Alerts, scope it to a specific safety-relevant feature (e.g., a "panic alarm" tied to a hardware contact sensor or ZM's `Alarm` state with a documented runbook), apply with that narrower justification, and gate the toggle behind explicit user opt-in plus a system-prompt acknowledgement.
- In settings, frame the existing high-priority option as "Heads-up alerts" not "Critical alerts" — avoid setting expectations the entitlement would have to back up.

**Warning signs:**
- A draft Apple submission email contains the phrase "home security" or "surveillance" in the entitlement justification — that's the rejection trigger.
- UI copy promises "alerts even when your phone is on silent / Do Not Disturb" before entitlement approval is in hand.

**Phase to address:** P5. Stay out of Critical Alerts entirely for this milestone. Document in PROJECT.md as a deferred decision.

Sources: [Apple — Critical Alerts entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.usernotifications.critical-alerts), [HN/Apple developer discussion of rejection patterns](https://news.ycombinator.com/item?id=43922698), [How Apple's Critical Alert policy reads in practice (Han)](https://jhan.bearblog.dev/i-cant-understand-apples-critical-alert-policy/).

---

### Pitfall 7: Quiet-hours window evaluated in the wrong timezone when the user travels

**What goes wrong:**
User configures quiet hours 22:00–07:00 at home in PST. Travels to Europe. Phone clock auto-adjusts to CET. Quiet hours start firing at 22:00 CET (= 13:00 PST) — completely wrong. Or the inverse: user sets quiet hours in their server's timezone and they fire based on the phone's timezone. Either way they get woken up or fail to be silenced when they care.

**Why it happens:**
Three timezones are in play: the device's current timezone, the device's "home" timezone when the rule was authored, and the ZM server's `HostTimeZoneResponseSchema`. Naive implementations evaluate `new Date().getHours()` against the literal stored hour, which silently follows the device clock.

**How to avoid:**
- Store quiet-hours rules as `{ start: "22:00", end: "07:00", tz: "America/Los_Angeles" }` per profile. Default `tz` to the device timezone at creation time, surfaced in UI: "Quiet hours apply on America/Los_Angeles time" with a "use device timezone instead" toggle.
- Evaluate on the device using `date-fns-tz` (already a dep) by converting now-time into the rule's tz, then comparing. Use the existing `useDateTimeFormat()` infra so DST handling is centralized.
- For DST: cross-midnight ranges (22:00–07:00) need explicit handling — the "spring forward" night has 23 hours, "fall back" has 25. Test with mocked clocks for both.
- Add a settings-level "currently quiet" indicator so the user can verify behavior at a glance. This is the cheapest possible debugging tool.

**Warning signs:**
- Notifications arrive during the user's stated quiet window or fail to arrive when they should be loud.
- Bug reports clustered around DST-transition weekends.
- Reports from users who travel internationally.

**Phase to address:** P5. Date/time handling rule (AGENTS.md rule 24) already mandates the central formatting helper — extend it with a `isWithinQuietWindow(rule, now)` helper to avoid scattering logic.

Sources: [flutter_local_notifications #118 — DST notification time bug](https://github.com/MaikuB/flutter_local_notifications/issues/118), [dayjs #1260 — timezone conversion incorrect during DST](https://github.com/iamkun/dayjs/issues/1260).

---

### Pitfall 8: Quiet-hours implemented as "skip notify()" — see Pitfall 5

**What goes wrong:**
Devs see "during quiet hours, don't show notifications" and implement it as `if (inQuietHours) return;` inside `onMessageReceived`. Three things break: (1) Android downgrades high-priority FCM quota (Pitfall 5), (2) the event still needs to land in NotificationHistory, (3) bulk "see what I missed last night" UX is broken because the events were silently dropped.

**Why it happens:**
The settings UI says "silence notifications", which sounds like "don't notify". The platform model is "show, but quietly".

**How to avoid:**
- Always call `notify()` and always write to `useNotificationStore`. Quiet-hours is a *channel routing* decision, not a *send/skip* decision.
- Route to `zmng.event.quiet` (IMPORTANCE_LOW, no sound, no heads-up). The notification still lands in the shade, the badge still increments, and history is intact.
- Add a "quiet-hours summary" affordance: at the end of the quiet window, post a single roll-up notification ("12 events between 22:00 and 07:00, tap to review").
- For per-monitor "priority": camera in `priority: high` ignores quiet hours and routes to `zmng.event.critical`; `normal` respects quiet hours; `low` always routes to `zmng.event.silent_summary`.

**Warning signs:**
- Code review finds a `return` statement inside `onMessageReceived` keyed on settings.
- NotificationHistory page shows gaps during the user's quiet window.
- The Android FCM latency tail grows over weeks.

**Phase to address:** P5. Wire this into the channel design from Pitfall 4 in the same PR.

---

### Pitfall 9: WidgetKit timeline budget exhausted by greedy refresh schedule

**What goes wrong:**
The iOS home-screen widget shows the latest event. Built naively with `TimelineProvider` returning entries every minute, it works for the first hour after install — then never refreshes again until the user taps it. By the time the user looks, the widget shows "Front door — 4 hours ago" and the entire P6 surface looks broken.

**Why it happens:**
WidgetKit budgets a "frequently viewed" widget at 40-70 timeline reloads per 24 hours, dynamically allocated based on user view patterns. Returning a dense timeline does not increase the budget — it just empties faster. After the budget is spent, the widget freezes on its last entry until the next 24-hour budget window.

**How to avoid:**
- Return a sparse timeline: one entry per 30-60 minutes, plus a `policy: .after(date)` that re-asks at sensible intervals.
- For "latest event" freshness, treat the widget as a stale-by-design surface. The freshness signal is a relative timestamp ("3 min ago") computed at render time from the entry's date, not a fresh fetch.
- Use Background App Refresh (`BGAppRefreshTask`) in the host app to update a shared App Group plist with the latest event id; the widget reads from there. The widget itself does not pull from ZM — it reads cached data.
- Best-effort: when the host app receives a high-priority push (Pitfall 1's path), it writes the latest event to the App Group store and calls `WidgetCenter.shared.reloadAllTimelines()`. This nudges the widget to refresh outside its self-managed schedule and is the lowest-cost path to "real-time-ish" widgets.
- For Live Activities: only start one for genuinely time-bounded events (e.g., an active "alarm" run state). Don't spam Live Activities for every motion event — there's a per-app concurrent activity cap and a 4 KB push payload limit.

**Warning signs:**
- Widget timestamps drift older than 1 hour despite recent events.
- Console logs show no `getTimeline` calls for hours.
- Users on iPhone 12 (smaller widget budget) report worse staleness than iPhone 15.

**Phase to address:** P6. Build the "host app writes shared store, widget reads, reloadAllTimelines on push" loop from the start.

Sources: [Apple — Keeping a widget up to date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date), [Apple TimelineProvider](https://developer.apple.com/documentation/widgetkit/timelineprovider), [Live Activities push update size — 4KB cap](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications).

---

### Pitfall 10: Tauri tray click semantics differ per OS — "click to open" works on macOS, hangs on Windows

**What goes wrong:**
Tauri menu-bar quick-look implemented and tested on macOS. Ships to Windows users; left-click on the tray icon does nothing. Linux users on KDE see the icon but neither click works because of how AppIndicator integration handles `LeftClick`.

**Why it happens:**
- macOS: left-click natively opens the menu (no extra wiring needed).
- Windows: convention is right-click for menu, left-click for "primary action". Tauri 2 emits `LeftClick` events but does not auto-open the menu — the app must hook the event and call `menu.popup()` or `window.show()`.
- Linux: `DoubleClick` is unsupported across most DEs; AppIndicator only reliably fires the right-click → menu path. Some compositors don't fire `LeftClick` at all.

**How to avoid:**
- Treat each OS click handler as separate code:
  - macOS: rely on default menu. No code.
  - Windows: hook `TrayIconEvent::Click { button: MouseButton::Left }` → toggle the popup window (hide if visible, show otherwise).
  - Linux: rely solely on the right-click menu. Document this in the user guide. Don't promise left-click behavior.
- Ship a "menu always wins" affordance: every click path also opens the menu, so worst case the user gets a usable menu.
- Use `tray-icon` v0.x events directly from `tauri::tray::TrayIconBuilder` — keep wiring inside `app/src-tauri/src/lib.rs` so tests can stub it.

**Warning signs:**
- "Tray works on Mac, broken on Windows" QA report.
- Linux user reports "icon shows but does nothing".
- Right-click works but is the only path discovered by users.

**Phase to address:** P6. Tauri equivalent surface.

Sources: [Tauri v2 system tray docs](https://v2.tauri.app/learn/system-tray/), [tauri-apps/tauri #7719 — Windows tray menu on left click](https://github.com/tauri-apps/tauri/issues/7719), [tauri-apps/tauri #4002 — macOS tray menu shouldn't pop on left click](https://github.com/tauri-apps/tauri/issues/4002).

---

### Pitfall 11: PWA push promise ignored — most web users get no push, period

**What goes wrong:**
The roadmap says "web gets PWA push where supported". In practice: Safari on macOS desktop refuses without home-screen install (which doesn't exist on macOS for PWAs at all in the way iOS has it), Chromium on Android works only if the user installed the PWA, Safari on iOS only after explicit "Add to Home Screen". Estimated <10% of web users will ever receive a push. The "web equivalent" surface for the milestone's home-screen quick-look becomes a nearly-empty feature.

**Why it happens:**
Web push reliability across browsers is uneven:
- iOS/iPadOS Safari: only since 16.4, only after manual "Add to Home Screen", and service-worker push event delivery is not guaranteed after device restart or when launched fresh from home screen.
- macOS Safari: supports web push without install, but with stricter user permission patterns.
- Chrome/Firefox desktop: works without install but subscription invalidation is silent — `pushsubscriptionchange` event is poorly delivered.
- Service worker scope mistakes break subscription registration without an obvious error.

**How to avoid:**
- Do not promise web push in P1 user docs. Position the web equivalent for P6 as a "top-bar dock / live-updating banner inside the open tab" — i.e., something that works while the tab is open, served by the existing WebSocket connection, not a true push.
- For users who do install the PWA (Tauri-like usage from a browser), wire web push as a best-effort enhancement with prominent "your browser may not deliver these" copy.
- Implement `pushsubscriptionchange` resubscribe logic and proactively re-register on visibility-change to mitigate silent invalidation.
- Set service worker scope explicitly (`/`) and document the deployment requirement that the SW must be served at the root.

**Warning signs:**
- "PWA push works in dev / on Chrome desktop" but field reports show ~zero delivery on iOS PWA and Firefox.
- Subscriptions accumulate server-side without corresponding deliveries.

**Phase to address:** P6. Frame the web surface as in-tab dock first, push as bonus.

Sources: [PWA on iOS — current status (Brainhub)](https://brainhub.eu/library/pwa-on-ios), [PWA push notifications on iOS (Apple Forums)](https://developer.apple.com/forums/thread/732594), [iOS PWA limitations 2026 (MagicBell)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide).

---

### Pitfall 12: Multi-profile push: which profile does this notification belong to?

**What goes wrong:**
User has Profile A (home ZM server) and Profile B (work ZM server). Both register an FCM token with their respective servers. A push arrives, NotificationHandler routes to "the active profile", which happens to be B — but the event is from A. Tapping the notification opens the wrong server's event detail and shows "event 12345 not found".

**Why it happens:**
The current `pushNotifications.ts` registers a single FCM token tagged with the active profile at registration time (`Notification[Profile]`). When a push arrives, the receiving code doesn't know which profile sent it unless that field is also in the payload — and even then, switching profiles to handle the tap is async and racy.

**How to avoid:**
- Server-side: ensure `zmeventnotification.pl` includes a stable profile identifier in the FCM `data` payload (`zmProfileId: "<uuid>"`). The token registration should pass the same identifier so the server emits it.
- Client-side: every notification handler must (a) read the profile id from `data`, (b) look it up in the profile store, (c) silently switch to that profile (re-bootstrap auth, swap settings) before navigating, (d) show a "Switched to <profile name>" toast on completion.
- Tap target: deep link includes the profile id in the URL (`/events/<eventId>?profile=<uuid>`). The router resolves the profile before rendering.
- Per-profile FCM token: register one token per profile, not one per app. Token registration on profile switch is already in the codebase but the multi-token model has not been validated.
- Tests: e2e covering "Profile A push received while Profile B is active".

**Warning signs:**
- Bug reports of "Event not found" after tapping a notification.
- Notification history shows events from server A while logs show requests to server B.
- Multi-profile users report intermittent missing events.

**Phase to address:** P1 (push enrichment) — this is the same surface as the rich-push work and must be solved before quiet-hours / per-monitor priority (P5) which is per-profile.

Sources: existing codebase `app/src/services/pushNotifications.ts` (multi-profile registration), `app/src/components/NotificationHandler.tsx` (deep-link routing), [Capacitor push notifications](https://capacitorjs.com/docs/v2/apis/push-notifications).

---

### Pitfall 13: Snooze persistence lost across app kill or OS sync

**What goes wrong:**
User taps "Snooze monitor for 1 hour" from the notification action button. Phone reboots / app is killed by OS / user switches devices. Snooze state evaporates. They get the same nagging alerts five minutes later.

**Why it happens:**
- iOS notification actions hand off to the extension or to a foreground app launch; the snooze state is often written only to in-memory React state.
- On Android, the action handler runs in a `BroadcastReceiver` that may not have the Zustand store hydrated yet.
- Multi-device users have no sync — snooze on phone doesn't apply on tablet.

**How to avoid:**
- Snooze writes go into `getProfileSettings`/`updateProfileSettings` via the existing persisted Zustand profile store. Persistence is the source of truth, not in-memory state.
- Snooze record shape: `{ monitorId, snoozedUntil: epochMs, reason: "user_action" }` per profile.
- Notification suppression check: at notification-build time on the device, check `snoozedUntil > now`. This is a client-side filter — server still sends the event (it goes to history) but no user-visible alert.
- Multi-device: nice-to-have but out of scope for this milestone (no cloud sync). Document that snooze is per-device and put it in the user guide.
- Action-button handler runs in a contained native handler that boots only the bare profile-store hydration path, not the full app.

**Warning signs:**
- Snooze "works" until the app is force-quit, then breaks.
- Tests pass in dev (app warm) but field reports show snooze ignored.

**Phase to address:** P1 (snooze action) and P5 (per-monitor settings) overlap — store the snooze state in the same per-profile settings shape used by per-monitor priority so it's one schema.

---

### Pitfall 14: `data-message`-only path drops payload when app is force-stopped on Xiaomi/OEM-aggressive Android

**What goes wrong:**
On stock Android, `data`-only FCM with `priority: high` wakes the app and `onMessageReceived` runs. On Xiaomi / Huawei / Oppo / Realme / Samsung One UI's "deep sleep" / "aggressive battery", the same payload is dropped if the user has ever swiped the app away. Users report "I don't get notifications until I open the app". This bites a non-trivial slice of the user base.

**Why it happens:**
OEM Android skins implement custom app-killing on top of stock Doze. Force-stopped apps don't receive `data`-only FCM. The official Android answer is "use `notification` payload so the system displays the notification without invoking the app" — which conflicts with our rich-action-button requirement (Pitfall 1).

**How to avoid:**
- Send a *hybrid* FCM payload: a `notification` block (so the OS auto-displays a basic alert even on force-stopped apps) PLUS a `data` block (for rich rendering when the app can run). Document this requirement for `zmeventnotification.pl` operators.
- On Android, when the app handles the event with a custom rich notification, cancel the auto-displayed system notification by tag/id — the FCM SDK uses a deterministic tag.
- Add a settings page entry: "If you don't get notifications when the app is closed, your phone is force-stopping the app. Open Settings → Apps → zmNinjaNg → Battery → Don't optimize." with deep-link intents per OEM.
- Don't rely on WorkManager periodic fallback as a substitute — it's hit by the same OEM kills.

**Warning signs:**
- Bug reports from Xiaomi / Realme / Oppo users specifically.
- Reports of "missed events" that resolve when the user reopens the app.
- App-event analytics show a long tail of users with zero `onMessageReceived` invocations despite registered tokens.

**Phase to address:** P1.

Sources: [Firebase blog — FCM on Android (2025)](https://firebase.blog/posts/2025/04/fcm-on-android/), [dontkillmyapp.com] (referenced widely in community discussions).

---

### Pitfall 15: Rich-push "mark reviewed" action races with WebSocket and creates phantom unread events

**What goes wrong:**
Push arrives, user taps "Mark reviewed" from the notification. The notification action handler hits the ZM server to mark the event reviewed. Meanwhile, the WebSocket (still connected in another foreground app) emits the same event before the server has processed the mark. The local store inserts the event as "unread" and the user sees an unread count of 1 even though they just dismissed it.

**Why it happens:**
Three sources of truth (push, WebSocket, polled REST list) reconcile into one badge counter and one history list (per `CONCERNS.md` notes — `services/notifications.ts` 658 LOC + `stores/notifications.ts` 667 LOC already does this for a simpler case). Adding a "reviewed" state introduces a fourth source of state mutation (action button) with its own latency.

**How to avoid:**
- Treat the "reviewed" state as client-authoritative until the server confirms. Mark locally first, sync to server in the background, reconcile on conflict. (Same pattern as `eventFavorites` in the existing codebase.)
- Idempotent reviewed-marking: server endpoint must accept a `reviewedAt: <timestamp>` so duplicate marks are no-ops.
- WebSocket and push share a deduplication keyed on `eventId`. A push that arrives with a `reviewed: true` flag in payload is dropped (don't re-insert).
- Badge counter is derived from `unreviewed events` not `total events`. The reviewed state is the same field used by P2.

**Warning signs:**
- Badge counter doesn't decrement after dismissing a notification.
- Notification history shows the same event as "new" twice.
- Server logs show duplicate review-PUT calls.

**Phase to address:** P2 (reviewed state) is the foundational schema; P1 action buttons hook into it. P2 must land first — or at least the reviewed-state model must be defined before P1 ships actions.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single Android channel for all events | Simpler P1 ship | Channel is immutable; P5 per-priority is forced into a brand-new channel set, and v1 users will need to re-grant permissions on the new channels | Never — define the full channel set up-front in P1 |
| Embed credentials in thumbnail URL | Bypasses the App Group keychain plumbing | Credentials leak to FCM/APNs intermediaries and OS notification DB | Never |
| Hardcode quiet-hours timezone to device | Skip the UI for tz selection | Travelers get woken up; DST bugs every spring/fall | Only if the scope explicitly excludes traveling users (it does not for this milestone) |
| Skip notify() during quiet hours | Conceptually matches "be quiet" | Android downgrades FCM priority over time; history is inconsistent | Never — always notify, just on a quiet channel |
| Single FCM token per device, switch profile field on register | Less server-side work | Multi-profile users get notifications routed to the wrong server context | Acceptable for the v0 single-profile path; must be replaced before multi-profile is officially supported |
| Widget refreshes via TimelineProvider only | Native-feeling, no extra plumbing | Stale widget after budget exhausted; users see "1 hour ago" all afternoon | Acceptable as fallback; primary path is push-driven `reloadAllTimelines` |
| Fetch thumbnails in NotificationServiceExtension via plain URLSession with no SSL pinning | Works for public-internet servers | Self-signed cert users see no thumbnails; main app's ssl-trust plugin doesn't apply to extension | Never — share trust state via App Group |
| Snooze stored only in memory | Quick demo | Lost on app kill; user re-nagged | Never — write through to per-profile settings |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| FCM via `@capacitor-firebase/messaging` | Using `notification` message and expecting `onMessageReceived` to fire when app is killed | Use `data`-only with hybrid `notification` block; expect the SDK to auto-display the `notification` block on force-stopped apps and your handler to render rich UI when the app runs |
| iOS Notification Service Extension | Importing app code (Zustand stores, lib/http) into the extension | Keep the extension Swift-only with a thin native shim that reads the App Group keychain. The extension never calls into JS |
| ZM `zmeventnotification.pl` | Assuming the existing payload includes a thumbnail URL and a profile id | Audit and document the payload at the start of P1; coordinate any required upstream changes with operators (or reproduce on the server-side via a thin proxy if blocked) |
| ZM auth tokens in extensions | Extension hits ZM with a stale token | Refresh-on-401 isn't available — instead, store token + expiry in the App Group; if expired, fall back to plain text alert and let the app fetch the thumbnail on tap |
| Android FCM token | Not re-registering after profile switch or token refresh | The codebase handles registration; ensure on `INSTANCE_ID_TOKEN_REFRESH` the new token is pushed to ZM for the active profile and any other profiles using the device |
| iOS App Group | Wrong group identifier in extension Info.plist | Use the same `group.com.zoneminder.zmNinjaNG` in capabilities for both targets and document in `app/ios/App/App.entitlements` |
| Tauri tray on Linux | Assuming `LeftClick` fires | Code defensively — only the menu (right-click) is universal |
| Self-signed cert + Notification Service Extension | The main app's `ssl-trust` plugin doesn't apply | Extension must implement its own pinning against a fingerprint stored in the shared keychain |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Decoding camera-resolution thumbnails in 24 MB extension | Notifications missing images on phones with smaller memory; jetsam kills | Server-side thumbnail resize endpoint or `URLSession` download to file + lazy decode by system | Above ~3 MP source images on iPhone SE-class devices |
| WidgetKit budget drained by minute-granularity timelines | Widget freezes on stale entry; no refresh for hours | Sparse timelines, push-driven `reloadAllTimelines`, derive freshness label at render time | After ~40-70 reloads in a 24h window |
| WorkManager polling for widget refresh on Android | Battery drain, OEM kill | Use WorkManager only with `setRequiresBatteryNotLow(true)`, 15-min minimum, push-driven invalidation as primary path | At ~60+ background invocations/day or under battery-saver |
| Notification-store unbounded growth | App memory creeps; localStorage persistence balloons | Per `CONCERNS.md` already a known issue with `useLogStore`; apply same FIFO cap (e.g., 500 entries) to notification history | Long-running sessions, multi-camera setups generating 100+/day |
| Re-render storms on the events list when reviewed-state mass-flips | UI hitch during bulk "mark all reviewed" | Optimistic batch update writes to a single store action, single re-render | At ~500+ events selected |
| Snooze evaluation in the hot push path | Per-event lookup walks every monitor | Maintain an in-memory `Map<monitorId, snoozedUntil>` projected from the per-profile settings; rebuild only on settings change | At ~50+ monitors |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Embedding ZM auth in thumbnail URL inside FCM payload | Credentials in plaintext through FCM/APNs and OS notification DB | App Group keychain in extension; or short-lived signed thumbnail URL minted server-side |
| Extension trusting any TLS cert to make self-signed work | MITM on the user's home network exposes events + auth | Pin against the same fingerprint the main app pins, retrieved from the App Group |
| Persisting snooze + per-monitor priority in plaintext localStorage where they reveal which cameras are armed | Local attacker / malicious browser extension can profile the user's home | Use the existing profile-scoped persisted settings; do not put quiet-hours / priority into a public-readable surface |
| Logging the full FCM payload when debugging | Server URL, profile id, possibly partial thumbnail URLs end up in `useLogStore` and the Logs page | Pass the payload through `lib/log-sanitizer.ts` (already exists) before logging |
| Web push subscription stored on ZM server forever | Stale subscriptions accumulate, expose endpoint URLs | Server unsubscribes on `pushsubscriptionchange`; client re-registers on visibilitychange |
| Tauri webview with `csp: null` plus a wider HTTP scope opens XSS-driven exfil paths if a ZM-served field renders unsafely | Per `CONCERNS.md` already an open concern; the new triage UI renders ZM-supplied event `cause` text and detection class strings | Apply CSP before this milestone or sanitize all ZM-supplied strings via DOMPurify-equivalent at render |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Unbounded notification spam from a noisy camera (the very thing the milestone is supposed to fix) | User mutes the whole app, then misses the one alert that mattered | Default per-monitor priority to "normal", expose a one-tap "this camera is too noisy → demote to low" affordance from any of its notifications |
| Bulk "mark all reviewed" without confirmation or undo | User accidentally clears 200 events and panics | Toast with 5-second undo; the action is local-first so undo is cheap |
| Noise filter hides events without an indicator that filtering is active | User thinks events are missing | Persistent banner in events list when any filter is non-default; one-tap "clear filters" |
| Quiet-hours toggle without a "currently quiet" indicator | User can't tell whether they're being silenced | Show the active state in settings and in the notification history page header |
| Action buttons on iOS shown in the wrong order (Apple ranks by category) | "Dismiss" appears first, "Review" buried | Use exactly two action buttons in stable order; rely on `UNNotificationCategory` registration with `foregroundAction` annotations |
| Per-monitor priority UI buried two levels deep in settings | Users never discover it; the noisy-camera case (above) never gets fixed | Surface "Priority" + "Snooze" as inline controls on each event detail page and on the notification's long-press menu |
| Widget tap deep-links to the events list instead of the specific event | User can't get to the event with one tap | Deep link straight to event detail with the right profile context (Pitfall 12 applies) |
| Quick-search filter bar that re-filters on every keystroke against thousands of events | Janky scroll, dropped frames | Debounce by 250ms; ensure server-side filter pushdown for date/monitor/score; only client-side filter on cause/class text |

---

## "Looks Done But Isn't" Checklist

- [ ] **Rich push (P1):** Often missing the iOS Notification Service Extension target itself — it must be added to the Xcode project under `app/ios/App/`, with App Group entitlement, push entitlement, and matched bundle id (`com.zoneminder.zmNinjaNG.NotificationService`). Verify by: NSE shows up in Xcode targets list and is signed with the same team id; `aps-environment` and `com.apple.security.application-groups` both present.
- [ ] **Rich push (P1):** Often missing a self-signed cert path. Verify by: install on a device pointing at a ZM server with self-signed cert, confirm thumbnail renders.
- [ ] **Action buttons (P1):** Often missing the `mutable_content` flag in payload. Verify by: enable extension OS log, send test push, confirm `didReceive(_:withContentHandler:)` fires.
- [ ] **Reviewed state (P2):** Often missing migration of existing local notification history to a default `reviewed: false` state — or a default `reviewed: true` if the user expects the badge not to spike on upgrade. Choose explicitly.
- [ ] **Noise filter (P3):** Often missing an indicator that a filter is active when the user navigates back to the events list. Verify by: filter, navigate away, return; banner is still visible.
- [ ] **Quick search (P4):** Often missing date/timezone alignment between filter input and ZM server timezone. Verify by: search "today" with the device set to a different tz than the server; correct events return.
- [ ] **Per-monitor priority (P5):** Often missing the channel-routing wiring on Android — settings UI updates `priority` field but the service that builds notifications still routes to the default channel. Verify by: change one monitor to `quiet`, send test push, confirm OS notification settings show the alert under the quiet channel.
- [ ] **Quiet hours (P5):** Often missing DST handling. Verify by: mock `Date.now()` to the spring-forward Sunday at 02:30 in the rule's tz; confirm the rule still evaluates correctly.
- [ ] **Quiet hours (P5):** Often missing the timezone-of-rule storage. Verify by: setting rule on device A at LAX time, opening on device B at JFK time, confirming the rule still says "America/Los_Angeles" not "America/New_York".
- [ ] **Widget (P6):** Often missing the `WidgetCenter.shared.reloadAllTimelines()` call from the host app on push receipt. Verify by: install widget, send push, observe widget refreshes within 5s rather than at the next scheduled timeline.
- [ ] **Widget (P6):** Often missing the App Group store the widget reads from. Verify by: kill app, send push, confirm widget still updates (it should, because the extension wrote to the App Group).
- [ ] **Tauri tray (P6):** Often missing Linux right-click-only handling. Verify by: build on Ubuntu/KDE, confirm right-click menu works and document that left-click is unsupported.
- [ ] **Multi-profile push (cross-cutting):** Often missing profile-id in payload or mid-tap profile switch. Verify by: register two profiles, send push from server B while A is active; tap and confirm the correct profile + event are loaded.
- [ ] **i18n (rule 5):** Often missing translations for action button labels in DE/FR/ZH because they're injected via UNNotificationAction in Swift. Verify by: action labels render in user's language, not English.
- [ ] **Telemetry on FCM latency:** Often missing — without it, Android quota downgrade (Pitfall 5) is invisible until users complain. Verify by: log delivery_time vs received_time and surface in dev Logs page.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong default Android channel shipped (Pitfall 4) | MEDIUM | Mint a new channel id (`.v2`), delete the old one; users re-grant per-channel permissions in OS settings. Ship a one-screen explainer the first time the new channel is used |
| FCM high-priority quota downgraded (Pitfall 5) | LOW (operationally) / HIGH (UX trust) | Stop the silent-data-no-notify path; ship a fix; the system gradually restores priority over a couple of weeks based on observed notify-rate. There is no API to "reset" quota |
| Critical Alerts entitlement rejected (Pitfall 6) | LOW (the milestone never depended on it if you followed the guidance) | Strip the entitlement request from the App Store submission and resubmit |
| Quiet-hours fired in the wrong tz (Pitfall 7) | LOW per user | Ship a fix; existing rules need a one-time migration to attach a timezone (default to the device's current tz with an in-app prompt to confirm) |
| Widget budget exhausted (Pitfall 9) | LOW per user | Sparse timelines + reloadAllTimelines fix forward; users see the new behavior on next budget window |
| Snooze lost (Pitfall 13) | LOW | Persist snooze in profile settings going forward; existing in-memory snoozes are gone but are by definition transient |
| Phantom unread events from action-button race (Pitfall 15) | MEDIUM | Add idempotency to the reviewed PUT; deduplicate on event id at the store level; one-shot reconciliation on app start |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. FCM payload bypasses NSE / data-only Android | P1 | iOS extension log fires for every test push; Android `onMessageReceived` fires for app in killed state |
| 2. NSE 24 MB OOM | P1 | Run on iPhone SE simulator with 4K thumbnail URLs; thumbnails appear |
| 3. Auth in thumbnail URL / self-signed in extension | P1 | Self-signed test server delivers thumbnails; FCM logs do not contain credentials |
| 4. Android channels immutable | P1 (channel set defined here, used by P5) | OS settings show the four-channel layout from first launch |
| 5. FCM high-priority quota downgrade | P1 | Latency histogram stays sub-3s after one week of normal use |
| 6. Critical Alerts entitlement rejection | P5 (do not request it) | App Store review approves the build without entitlement back-and-forth |
| 7. Quiet-hours timezone | P5 | Rule survives a tz switch on the device and a DST transition |
| 8. Quiet-hours-as-skip-notify | P5 | Code review finds no `return` short-circuit in `onMessageReceived` |
| 9. Widget timeline budget | P6 | Widget timestamp is < 30 min stale 24h after install |
| 10. Tauri tray click semantics | P6 | All three desktop OSes have a working menu path |
| 11. PWA push reliability | P6 | Web surface positioned as in-tab dock first; push is a labeled "best effort" enhancement |
| 12. Multi-profile push routing | P1 | Cross-profile push test passes |
| 13. Snooze persistence | P1 + P5 | Snooze survives app force-quit |
| 14. OEM aggressive battery kills | P1 | Hybrid payload tested on a Xiaomi/Realme device or confirmed via field reports |
| 15. Action-button race / phantom unread | P2 (schema), P1 (action) | No double-counting in notification history under WS+FCM concurrent delivery |

---

## Sources

- Apple Developer — [Critical Alerts entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.usernotifications.critical-alerts)
- Apple Developer — [Keeping a widget up to date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)
- Apple Developer — [TimelineProvider](https://developer.apple.com/documentation/widgetkit/timelineprovider)
- Apple Developer — [Sharing access to keychain items](https://developer.apple.com/documentation/security/sharing-access-to-keychain-items-among-a-collection-of-apps)
- Apple Developer — [Live Activities push update payload size (4KB)](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications)
- Apple Developer Forums — [UNNotificationServiceExtension memory limits](https://developer.apple.com/forums/thread/64634)
- Apple Developer Forums — [UNNotificationServiceExtension with FCM](https://developer.apple.com/forums/thread/664048)
- Apple Developer Forums — [PWA push notifications on iOS](https://developer.apple.com/forums/thread/732594)
- alastaircoote — [UNNotificationServiceExtension and memory](https://alastaircoote.github.io/notification-service/)
- Android Developers — [About notifications](https://developer.android.com/develop/ui/views/notifications)
- Android Developers — [Create and manage notification channels](https://developer.android.com/develop/ui/views/notifications/channels)
- Android Developers — [NotificationChannel API reference](https://developer.android.com/reference/android/app/NotificationChannel)
- Android Developers — [Notification runtime permission (POST_NOTIFICATIONS)](https://developer.android.com/develop/ui/views/notifications/notification-permission)
- Android Developers — [Foreground service types are required (Android 14)](https://developer.android.com/about/versions/14/changes/fgs-types-required)
- Android Developers — [Behavior changes: Apps targeting Android 12 (notification trampolines)](https://developer.android.com/about/versions/12/behavior-changes-12)
- Android Developers — [Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)
- Firebase — [FCM Android message priority](https://firebase.google.com/docs/cloud-messaging/android-message-priority)
- Firebase blog — [Notifications on Android (2025 update)](https://firebase.blog/posts/2025/04/fcm-on-android/)
- Firebase blog — [Creating visual notifications with FCM](https://firebase.blog/posts/2019/09/fcm-image-notification/)
- firebase-ios-sdk #3368 — [FCM v1 payload not invoking service extension](https://github.com/firebase/firebase-ios-sdk/issues/3368)
- Tauri — [System Tray (v2)](https://v2.tauri.app/learn/system-tray/)
- tauri-apps/tauri #7719 — [Windows tray menu on left click](https://github.com/tauri-apps/tauri/issues/7719)
- tauri-apps/tauri #4002 — [macOS tray menu shouldn't pop on left click](https://github.com/tauri-apps/tauri/issues/4002)
- Brainhub — [PWA on iOS — current status (2025)](https://brainhub.eu/library/pwa-on-ios)
- MagicBell — [PWA iOS Limitations and Safari Support (2026)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- HackerNews — [Apple's Critical Alert policy (community discussion)](https://news.ycombinator.com/item?id=43922698)
- flutter_local_notifications #118 — [DST notification time bug](https://github.com/MaikuB/flutter_local_notifications/issues/118)
- Codebase: `app/src/services/pushNotifications.ts`, `app/src/services/notifications.ts`, `app/src/components/NotificationHandler.tsx`, `app/src/plugins/ssl-trust/`, `app/src-tauri/src/lib.rs`
- Project: `.planning/codebase/CONCERNS.md` (notification stack fragility), `.planning/codebase/INTEGRATIONS.md` (existing FCM + Capacitor plugin choices), `.planning/PROJECT.md` (10-second triage core value)

---
*Pitfalls research for: zmNinjaNg 10-Second Triage milestone*
*Researched: 2026-04-26*
