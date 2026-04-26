# Feature Research

**Domain:** Self-hosted NVR client — event triage and mobile alert UX
**Milestone:** 10-Second Triage (zmNinjaNg subsequent milestone)
**Researched:** 2026-04-26
**Confidence:** MEDIUM-HIGH (Frigate, UniFi, Ring, Eufy, Reolink behaviour verified via vendor docs and community threads; iOS/Android/Capacitor/Tauri capabilities verified via official docs)

## Scope Note

The milestone is constrained to the triage + mobile-alert lanes. Live view, montage redesign, ZM server-side configuration, on-device ML, Apple Watch / WearOS apps, geofencing, and account-bound cloud features are explicitly out of scope (see `.planning/PROJECT.md` "Out of Scope"). Features below are categorized under that constraint.

The codebase already ships: `NotificationHistory`, `EventCard`, `EventListView`, `EventsFilterPopover`, `EventMontageFilterPanel`, `NotificationSettings`, `eventFavorites` store, FCM push (`services/pushNotifications.ts`), ZM event WebSocket (`services/notifications.ts`). The features below build on those — they are not greenfield.

## Feature Landscape

### Table Stakes (Users Will Churn Without These in 2026)

Benchmark apps (Ring, UniFi Protect, Eufy, Reolink, Frigate via HA mobile) all ship these. zmNinjaNg currently ships none of them.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Push notification with thumbnail preview** | Ring "Rich Notifications", UniFi Protect, Eufy, Reolink all show a snapshot in the push banner. Users decide "real or false alarm" without unlocking. zmNinjaNg today sends a text-only push. | M | iOS: FCM `fcm_options.image` + `mutable-content: 1` + Notification Service Extension that downloads from `cause` thumbnail URL. Android: FCM `notification.image` auto-binds to `BigPictureStyle`, 1MB cap. ZM event already exposes `EventID` and a frame URL — fetch over authenticated session in NSE. Dependency: image must be reachable from the device (auth token survival in NSE). |
| **Push notification action buttons** | Ring (snooze 30min/1h via long-press), UniFi (Alarm Manager actions), iOS Home app, Frigate via HA all expose 1–4 buttons on the push itself. Users mark or dismiss without launching the app. | M | iOS: `UNNotificationCategory` with up to 4 `UNNotificationAction` (system shows first 2 in banner). Capacitor `@capacitor/push-notifications` raises `pushNotificationActionPerformed` with `actionId`. Android: FCM data-payload + custom `NotificationCompat.Action`. Cross-platform coverage: iOS + Android only — web/Tauri get equivalent via in-app row actions. Dependency: requires a "reviewed" state to act on (see below). |
| **Event "reviewed" state with bulk action** | Frigate 0.14+ (review items get a viewed flag), UniFi Protect (events fade after view), Ring Event History. Without it, the same event keeps reappearing in lists. | M | Client-only is workable: profile-scoped Zustand store keyed by `eventId` (mirrors `eventFavorites.ts` shape). ZM has no server-side `reviewed` field, so this stays local per profile. UI: badge/dot on `EventCard`, "Mark all as reviewed" in list toolbar, "Unreviewed only" filter pill. Storage cost low — 1 row per event the user has seen. Dependency: needed by the rich-push action button "mark reviewed". |
| **Filter events by detection class / cause text** | UniFi separates Person / Vehicle / Package detection toggles in lists. Frigate filters by label and sub-label. ZM populates `cause` and detection text via `zmeventnotification.pl` already; not exposing it is a visible gap. | S–M | `EventsFilterPopover.tsx` already exists — extend with chip multi-select bound to a parsed set of distinct `cause`/label tokens from the loaded page. Server-side filter via existing `events.json` query string where possible; client-side fallback otherwise. Dependency: alarm-score filter shares the same popover. |
| **Filter events by alarm score range** | Frigate exposes a score slider; UniFi has motion sensitivity per detection class. Score is already in the ZM event payload and ignored today. Heavy false-positive cameras (e.g. cars on a street) become useless without it. | S | Score min/max slider in the existing filter popover. Cheap because the data is already loaded. Dependency: same popover refactor as cause/class filter. |
| **Quick date-range jump** | Eufy "Today / Yesterday / This week", UniFi smart-jump, Reolink calendar picker. zmNinjaNg has `quick-date-range-buttons.tsx` for some flows but it's not on the events list filter bar. | S | Reuse `quick-date-range-buttons.tsx`. Add presets: "Last hour", "Today", "Yesterday", "Last 7 days", "Custom". Dependency: bind to existing `useEventFilters`. |
| **Per-monitor notification priority + mute** | UniFi per-camera "Notify on detection: Person, Vehicle". Ring per-device snooze. Eufy per-camera schedules. Today zmNinjaNg's `NotificationSettings` is global only. | M | Profile-scoped settings entry: `Map<monitorId, { priority: 'high'\|'normal'\|'silent', muteUntil?: ISO }>`. Push routing happens client-side: incoming event checks the map before raising the local notification. Dependency: needs the profile-scoped settings pattern (`getProfileSettings`/`updateProfileSettings`) that's already established. |
| **Quiet-hours window** | Ring, Blink, Alarm.com, Eufy all expose a daily window (e.g. 22:00-07:00) where notifications are silenced or escalated to a digest. Without it, multi-camera prosumer setups become un-usable overnight. | S | Single window per profile, `{ enabled, startTime, endTime }`. Suppress local-notification raise during the window; ZM WebSocket events still log to `NotificationHistory`. Dependency: per-monitor priority (so user can tag one camera as "always wake me"). |

### Differentiators (Competitive Edge for a Self-Hosted ZM Client)

These either don't exist in commercial apps (because they assume a cloud account) or are specifically valuable in a multi-server, self-hosted, multi-camera prosumer context.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **One filter bar across date + monitor + class + score** | UniFi splits filters across tabs; Reolink hides them in nested menus; Frigate has a dense Explore page that requires desktop. A single horizontal filter row tuned for phone is genuinely faster than any commercial app for "show me person events on Front Door yesterday". | M | Compose existing `EventsFilterPopover`, `MonitorFilterPopover`, `quick-date-range-buttons` into one persistent filter bar at the top of `EventListView`. Save last-used filter set in profile-scoped settings. Dependency: cause/class filter, score filter, quick date range. |
| **Multi-server bulk-mark-reviewed across profiles** | Commercial apps each lock you to one account. zmNinjaNg already has multi-profile. "Mark all reviewed across all my ZMs" is a power-user move no consumer app offers. | S (additive) | Reviewed-state store iterates profiles. Dependency: reviewed state must exist first. |
| **Tauri menu-bar / system-tray quick-look** | Frigate has no desktop tray; UniFi Protect's desktop app is electron-heavy and slow. A macOS menu-bar dropdown showing the latest 5 events with thumbnails is something no ZM client does today. Fits the 10-second-verdict job for users glued to a laptop. | M | Tauri 2 supports tray icon + tray menu (`tauri::tray`). Render as small sub-window with React route `/quicklook`. Dependency: same event data the events list already pulls; reuse React Query cache. |
| **Web top-bar event dock (PWA)** | Cross-platform parity: same job as widget/menu-bar, lives in the existing `AppLayout` header. A persistent collapsed bar showing "Last event: 2m ago — Front Door — person". Most Frigate-on-tab users keep the page open all day; this avoids tab-switching. | S | New `LatestEventDock.tsx` in `components/layout/`. Subscribes to existing notification websocket. Hidden on phone widths (`md:flex`). Dependency: WebSocket event already wired. |
| **iOS/Android home-screen widget** | UniFi Protect, Eufy, Ring all have widgets but they require a logged-in cloud account and a recent fetch. A self-hosted-aware widget that talks to the user's ZM directly (over LAN or VPN) is uniquely valuable. | L–XL | iOS: native WidgetKit extension in `app/ios/`, shared App Group container with the Capacitor app for auth tokens. Refresh budget is 40–70 timeline reloads/day per Apple — design around that, do not poll. Push updates can wake the widget via `WidgetCenter.shared.reloadTimelines`. Android: `RemoteViews` + `AppWidgetProvider` in `app/android/app/`. Both need server reachability when the device is locked — same session/auth as the main app. Dependency: rich push (because widget refresh is push-driven, not poll-driven, to fit Apple's budget). |
| **Snooze monitor from the push itself** | Ring offers global snooze; UniFi doesn't expose per-camera snooze on the push itself. Putting "Snooze 30m / Snooze 1h / Mute until tomorrow" on the rich push action set means the user reacts in 2 seconds instead of unlocking → settings → camera → mute. | S (given push actions) | Action handler writes to per-monitor mute store. Dependency: push action buttons + per-monitor priority store. |
| **Search by free-text cause / sub-label** | Frigate has sub-label search on desktop; nobody has it on mobile. ZM's `cause` field often holds rich detection text from `zmeventnotification.pl` (e.g. "person:0.92, car:0.71"). A search box that queries the loaded events client-side is cheap and high-leverage. | S | Add `<input>` to filter bar; client-side `String.includes` over loaded events. Server-side via ZM `eventsByQuery` filter is a v1.x improvement. Dependency: filter bar. |
| **Notification History "unread" badge synced with reviewed state** | The existing `NotificationHistory` page is a list; no app distinguishes seen-on-device vs. acted-on. Tying it to the reviewed-state store gives a single-truth counter on the sidebar (`NotificationBadge.tsx` already exists). | S | Modify badge selector to count notifications whose linked event is unreviewed. Dependency: reviewed-state store. |

### Anti-Features (Deliberately Rejected for zmNinjaNg)

These are common in Ring / Eufy / UniFi but conflict with zmNinjaNg's self-hosted, privacy-respecting, ZM-server-only ethos.

| Feature | Why Requested | Why Problematic for zmNinjaNg | Alternative |
|---------|---------------|-------------------------------|-------------|
| **Cloud-side event sync / cross-device "reviewed" state** | iOS Home, Ring, UniFi all sync read-state via the vendor cloud. Tempting because it solves "I marked it on phone but laptop still shows unread." | zmNinjaNg has no cloud; adding one breaks the self-hosted promise and creates a service to operate. ZM has no `reviewed` column to host it server-side. | Per-profile local store. Document the trade-off ("reviewed state is per-device"). Add a future ZM API extension as a deferred milestone if users push. |
| **Account-bound profile sync** | Ring/Eufy push profile setup to all your devices. | Profiles contain ZM credentials; an account-bound sync would need vendor-operated key custody, contradicting `secureStorage.ts` design. | QR-profile share is already shipped (`lib/qr-profile.ts`). Promote it; don't replace it with an account model. |
| **Vendor-cloud face / object recognition** | UniFi Protect, Ring add ML on the server. Users assume the app does this. | Out of scope per PROJECT.md ("New client-side ML / object detection models"). Adding it client-side doubles bundle size and battery use; ZM's `zmeventnotification` already does it server-side when configured. | Surface the metadata ZM already returns (cause text, score) instead of inventing new ML. |
| **Geofence-based arm/disarm** | Ring "Auto-arm when away", UniFi location-based notifications. | Explicitly deferred per PROJECT.md ("Geofencing-based arm/disarm — not in this milestone"). Geofencing on iOS/Android requires `Always` location permission, which is a major privacy ask for a ZM client. | Quiet-hours window covers the time-based 80% case. Revisit geofence in a later milestone after triage lands. |
| **Always-on background polling for events** | Some users ask "why doesn't the app poll every 30s when closed?" | iOS BackgroundFetch ≤ 1×/hr, Android Doze caps `allowWhileIdle` to once per 9 minutes. Real-time only happens via push. Polling for liveness drains battery without delivering speed. | FCM push (already shipped) + WebSocket while in foreground. Document that "real-time alerts require push enabled." |
| **Per-event commenting / shared annotations** | UniFi adds notes; multi-user households want to leave "checked, was the cat" for others. | Requires server-side persistence ZM doesn't offer; would need a vendor-hosted backend. | Local-only event tags (already shipped in `eventFavorites.ts` and `TagChip.tsx`). Don't pretend single-user tags are shared. |
| **AI-summarised "what happened today" digest** | LLM-summary features in 2026 consumer apps are spreading (Ring "Smart Recap"). | Requires either on-device LLM (battery + model size) or vendor inference (cloud). Both contradict the ethos. | Quiet-hours digest (count + first thumbnail) without LLM is good enough and verifiable. |
| **Push delivery via vendor SMTP / SMS fallback** | Ring offers SMS. | Requires vendor relay infrastructure. ZM's email is local but inconsistent. | FCM is the contract; if push fails, users see events in NotificationHistory the next time they open the app. |
| **Cloud video clip storage tied to push** | Ring/Eufy attach a 30s clip to the alert. | Pulling a clip into a push at the FCM 4KB-payload boundary is impossible without an intermediate server. ZM clips live on the user's NVR. | Thumbnail-in-push + tap-to-open existing `ZmsEventPlayer` is the equivalent local path. |

## Feature Dependencies

```
[Push thumbnail preview] ──enables──> [Push action buttons] ──acts on──> [Reviewed state]
                                              │
                                              └──acts on──> [Per-monitor priority + mute]
                                                                  │
                                                                  └──complemented by──> [Quiet-hours window]

[Filter bar] ──composes──> [Cause/class filter]
                       └──> [Alarm-score filter]
                       └──> [Quick date range]
                       └──> [Free-text search]
                       └──> [Reviewed/unreviewed toggle]

[Reviewed state] ──feeds──> [Notification badge]
                       └──> [Bulk-mark-reviewed action]
                       └──> [Quick-look surfaces]

[Quick-look surfaces]:
  iOS widget ──requires──> Push-driven refresh (Apple budget) ──requires──> [Push thumbnail]
  Android widget ──requires──> [Push thumbnail]
  Tauri tray ──requires──> [WebSocket events] (already shipped)
  Web top-bar dock ──requires──> [WebSocket events] (already shipped)
```

### Dependency Notes

- **Push action buttons require reviewed-state store.** "Mark reviewed" as an action is meaningless without a state to write to. Build the state store first.
- **Per-monitor priority shares schema with quiet-hours.** Both write to a single `Map<monitorId, NotificationRouting>` — implement together or extract a `notificationRouting` profile slice once.
- **iOS widget depends on push thumbnail.** WidgetKit's 40–70 reloads/day budget makes pure-poll widgets useless; rich-push must already be in place to drive `WidgetCenter.shared.reloadTimelines` from the Notification Service Extension.
- **Filter bar features can ship independently but UX degrades.** Each filter alone is useful; the value compounds when they share one bar. Design the bar shell first, plug filters in.
- **Tauri tray and Web dock can ship before mobile widgets.** They reuse the in-process WebSocket; mobile widgets need extension/widget-process IPC. Order tray/dock earlier in the milestone.

## MVP Definition

### Launch With (10-Second Triage v1 — fits the 2–4 week milestone)

- [ ] **Push thumbnail preview (iOS + Android)** — direct unblock for the 10-second job. Touches `pushNotifications.ts` + iOS Notification Service Extension + Android FCM payload handling.
- [ ] **Push action buttons: Mark reviewed / Snooze monitor / Dismiss** — pairs with thumbnail. iOS + Android only; web/Tauri get equivalents in their quick-look surfaces.
- [ ] **Reviewed-state store + visual distinction in `EventListView` + bulk action** — required by the actions above.
- [ ] **Filter bar with cause/class chips + alarm-score slider + quick date range + reviewed-only toggle** — addresses the noise lever directly. Extends existing `EventsFilterPopover`.
- [ ] **Per-monitor notification priority + quiet-hours window** — addresses the routing lever. Profile-scoped settings only; no server changes.
- [ ] **Quick-look surface per platform**:
  - iOS + Android home-screen widget (latest event with thumbnail)
  - Tauri menu-bar tray (latest 5 events)
  - Web top-bar dock (collapsed latest event)

### Add After Validation (v1.x — next milestone candidate)

- [ ] **Free-text search across cause / sub-labels** — cheap once filter bar exists; defer if scope tight.
- [ ] **Notification History badge tied to reviewed state** — polish layer.
- [ ] **"Snooze all cameras until tomorrow" global** — once per-monitor proves out.
- [ ] **Server-side filter pushdown for cause/class** — extend ZM API client; today's client-side filter is fine for typical event volumes.

### Future Consideration (deferred milestones)

- [ ] **Server-side ZM `reviewed` column** — needs ZM core change; coordinate upstream.
- [ ] **Apple Watch / WearOS quick-glance** — already deferred per PROJECT.md.
- [ ] **Geofence-based arm/disarm** — already deferred per PROJECT.md.
- [ ] **iOS Live Activities for in-progress events** — interesting but ZM events are already terminal; doesn't fit ZM's data model.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Push thumbnail preview | HIGH | MEDIUM | P1 |
| Push action buttons | HIGH | MEDIUM | P1 |
| Reviewed-state store + UI | HIGH | MEDIUM | P1 |
| Cause/class + score filter (in filter bar) | HIGH | LOW–MEDIUM | P1 |
| Per-monitor priority + quiet hours | HIGH | MEDIUM | P1 |
| Web top-bar dock | MEDIUM | LOW | P1 |
| Tauri menu-bar tray | MEDIUM | MEDIUM | P1 |
| iOS / Android widget | HIGH | HIGH–XL | P1 (largest risk; may slip to v1.x) |
| Free-text cause search | MEDIUM | LOW | P2 |
| Notification badge tied to reviewed | MEDIUM | LOW | P2 |
| Multi-server bulk mark | LOW–MEDIUM | LOW | P2 |
| Server-side cause/class filter | MEDIUM | MEDIUM | P3 |

**Priority key:** P1 = milestone scope. P2 = stretch within milestone. P3 = subsequent milestone.

**Risk callout:** Native widgets (iOS WidgetKit + Android AppWidget) are the highest-cost item by far. Each widget needs platform-native code outside the Capacitor JS bundle (WidgetKit extension in Swift, AppWidgetProvider in Kotlin), shared App Group / SharedPreferences for auth, and per-platform refresh/auth lifecycles. Realistic call: include the widget surface but give it the most generous slot in the milestone schedule, and gate the milestone-completion definition on functional-equivalent parity (widget on mobile may slip to v1.x while tray/dock cover web/Tauri).

## Competitor Feature Analysis

| Feature | Frigate | UniFi Protect | Ring | Eufy | Reolink | zmNinjaNg Today | Our Approach |
|---------|---------|---------------|------|------|---------|-----------------|--------------|
| Rich push thumbnail | Via HA blueprint, app-side | Yes (iOS + Android) | Yes ("Rich Notifications", subscription-gated) | Yes | Yes | No | iOS NSE + Android FCM image; no subscription gate |
| Push action buttons | Via HA mobile app | Limited (Alarm Manager) | Snooze 30m/1h on long-press | Yes | Yes | No | 3 actions: Mark reviewed, Snooze monitor, Dismiss |
| Reviewed/seen state | Yes (per review item, 0.14+) | Yes (events fade) | Implicit (Event History) | Yes | Limited | No | Local profile-scoped store |
| Filter by detection class | Yes (label + sub-label) | Yes (Person/Vehicle/etc. tabs) | Yes (Person/Package/Other) | Yes | Yes | No | Single chip multi-select in filter bar, sourced from ZM `cause`/labels |
| Filter by score | Yes (slider) | Sensitivity per class | No | No | No | No | Slider in filter bar |
| Quick date range | Yes (calendar) | Smart-jump | Yes | Yes (Today/Yesterday/Week) | Yes (calendar) | Partial (`quick-date-range-buttons.tsx` exists, not in events list) | Promote to filter bar |
| Per-camera notification priority | Per-camera review/alert split | Yes (per-detection class) | Per-device snooze | Per-device | Per-device | Global only | Profile-scoped per-monitor map |
| Quiet hours | Via HA automations | Location-based (privacy issue) | Yes | Yes (modes) | Yes (schedule) | No | Single time window per profile |
| Home-screen widget | No (web-only) | Yes (cloud-bound) | Yes (cloud-bound) | Yes (cloud-bound) | Yes (cloud-bound) | No | Self-hosted-aware widget driven by push refresh |
| Desktop tray / menu-bar | No | Electron desktop app | No | No | No | No | Tauri tray dropdown — genuine differentiator |
| Account-bound cloud sync | No (self-hosted) | Yes | Yes | Yes | Yes | No (ethos) | Anti-feature |
| Geofence | No | Yes | Yes | Yes | Limited | No | Anti-feature this milestone |
| AI summary digest | No | No | "Smart Recap" rolling out | Limited | No | No | Anti-feature (ethos) |

## Sources

- [Frigate Review documentation](https://docs.frigate.video/configuration/review/) — review items, viewed state, label filtering
- [Frigate Notifications](https://docs.frigate.video/configuration/notifications/) — WebPush, alert vs detection split
- [Frigate Mobile App Notifications 2.0 (HA blueprint)](https://community.home-assistant.io/t/frigate-mobile-app-notifications-2-0/559732) — rich push pattern via HA mobile app
- [UniFi Alarm Manager docs](https://help.ui.com/hc/en-us/articles/27721287753239-UniFi-Alarm-Manager-Customize-Alerts-Integrations-and-Automations-Across-UniFi) — push routing, action types
- [UniFi Protect AI Detections and Facial Recognition](https://help.ui.com/hc/en-us/articles/360058867233-UniFi-Protect-Cameras-AI-Detections-and-Facial-Recognition) — Person/Vehicle separation
- [UniFi Protect 5.2 features (DPC Technology)](https://www.dpctechnology.com/2025/03/exploring-the-exciting-new-features-in-unifi-protect-5-2/) — timeline scrubber, frame-by-frame review
- [UniFi Protect location-based notifications](https://help.ui.com/hc/en-us/articles/360037982314-UniFi-Protect-Configure-Location-Based-Notifications) — geofence comparison
- [Ring Understanding Rich Notifications](https://ring.com/support/articles/ko6mf/Understanding-Rich-Notifications) — thumbnail UX, snooze 30m/1h, subscription gate
- [Eufy app introduction](https://service.eufy.com/article-description/Introduction-to-New-eufy-App) — event chronological feed with thumbnails
- [Eufy widgets community](https://community.eufy.com/t/how-to-install-a-eufy-security-widget/3810492) — home-screen widget shape
- [Reolink event history workflow](https://community.reolink.com/topic/15980/event-history-link-on-app-home-screen) — discoverability gap competitors fall into
- [Blink Do Not Disturb](https://helpdesk.joinblink.com/en/articles/6979886-do-not-disturb) — quiet-hours pattern
- [Apple UNNotificationCategory docs](https://developer.apple.com/documentation/usernotifications/unnotificationcategory) — up to 4 actions, banner shows first 2
- [Apple "Declaring your actionable notification types"](https://developer.apple.com/documentation/usernotifications/declaring-your-actionable-notification-types) — registration model
- [Apple WidgetKit "Keeping a widget up to date"](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date) — refresh budget context
- [WWDC 2025: What's new in widgets](https://developer.apple.com/videos/play/wwdc2025/278/) — iOS 26 widget changes
- [Capacitor Push Notifications API](https://capacitorjs.com/docs/apis/push-notifications) — `pushNotificationActionPerformed` listener
- [Capacitor Local Notifications API](https://capacitorjs.com/docs/apis/local-notifications) — action registration on iOS + Android
- [Firebase FCM cross-platform messages](https://firebase.google.com/docs/cloud-messaging/customize-messages/cross-platform) — `fcm_options.image`, BigPicture binding
- [Android Notification.BigPictureStyle](https://developer.android.com/reference/android/app/Notification.BigPictureStyle) — payload constraints
- [Tauri System Tray docs](https://v2.tauri.app/learn/system-tray/) — tray icon + menu API
- [Tauri Window Menu docs](https://v2.tauri.app/learn/window-menu/) — macOS menu-bar attachment
- [Tauri macOS menubar app example](https://github.com/ahkohd/tauri-macos-menubar-app-example) — reference implementation

---
*Feature research for: zmNinjaNg 10-Second Triage milestone*
*Researched: 2026-04-26*
