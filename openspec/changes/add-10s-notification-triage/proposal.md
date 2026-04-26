## Why

When a push notification fires, the user has one question: *is this real, do I care?* Today the only way to answer it is to open the app, wait for cold start, route to event detail, and load a stream — well past 10 seconds. Most events are false alarms (pets, wind, headlights), so the app burns the user's attention on triage that the OS notification surfaces and a small set of in-app affordances could handle directly.

This change is the full **10-second triage milestone**: it moves triage out of the React app shell and into (a) the OS notification layer, (b) targeted improvements in the Events list, and (c) a glanceable home-screen / tray / dock surface — so obvious cases resolve at the lock screen, less-obvious cases resolve in expanded notifications or via Events-list filters, and only ambiguous cases need to launch the full app. Cross-platform parity is achieved by *functional equivalents* (widget on mobile = system-tray on Tauri = in-tab dock on web), not pixel parity.

This proposal is the OpenSpec realization of the milestone described in the prior `.planning/PROJECT.md`. The two divergences from that document are deliberate and recorded in `design.md` § "Relationship to prior PROJECT.md":

1. ES (`zmeventnotificationNg`) payload changes are now in scope (the prior document had this client-only). The user explicitly authorized this trade.
2. The same milestone but consolidated into a single OpenSpec change rather than 6 sequential ones.

## What Changes

### Push pipeline (lock-screen + expand triage)

- ES FCM payload gains optional fields: `monitor_id`, `monitor_name`, `event_id`, `started_at`, `profile_id` (required for new behavior); `object_labels[{label,confidence}]`, `image_url_jpg`, `alarm_score` (strong); `image_urls_strip[3]`, `color_hex`, `category_id`, `cause_text` (nice). All additions are optional on the wire — older ES servers degrade to today's behavior, older clients ignore unknown fields.
- iOS `NotificationServiceExtension` extended: locale-aware title formatted from `object_labels` + `monitor_name`; multi-frame strip composition; reads cross-process suppression store (mute / quiet-hours / noise-filter / priority-silent) and suppresses if matched; honours `category_id` and per-monitor priority.
- iOS adds `UNNotificationCategory` and `UNNotificationAction` handlers for **Mute monitor 1h**, **Reviewed**, and **Live**. Mute and Reviewed run natively without app launch; Live deep-links into `MonitorDetail?pip=auto`.
- iOS gains an App Group entitlement and shared Keychain so extension and main app share the suppression store and (optionally) credentials.
- Android replaces / wraps the Capacitor default push handler with a custom `FirebaseMessagingService` that builds rich notifications (`BigPictureStyle`, `addAction` for the same three actions), formats the same locale-aware title, and runs the same suppression check before display. Coexists with the existing JS in-app FCM toast/dedup flow when the app is in the foreground.
- iOS notification interruption level (`.passive` / `.active` / `.timeSensitive`) and Android `NotificationChannel` importance are mapped from the per-monitor priority setting.

### Suppression model (mute, quiet-hours, noise-filter)

- Profile-scoped, client-side **suppression store** (NOT server-side). Three entry kinds, all consulted before a notification is shown:
  - **Ad-hoc mutes** — `(profile_id, monitor_id, until)`. Action-button writes; expires automatically.
  - **Recurring quiet-hours windows** — `(profile_id, monitor_id_or_all, start_local_time, end_local_time, weekday_mask)`. User-configured.
  - **Noise-filter rules** — `(profile_id, monitor_id_or_all, min_alarm_score, exclude_cause_patterns)`. Apply to both notification suppression *and* the Events list filter (single source of truth).
- Suppression evaluation runs in the iOS Service Extension and Android FCM service before display. Survives app kill and reboot.

### Per-monitor notification priority

- Per-monitor priority field added to profile settings: `high` / `normal` / `low` / `silent`.
- Maps at notification time to iOS `interruptionLevel` and Android `NotificationChannel` importance. `silent` suppresses display entirely. **BREAKING — Android channels:** four new channels (`zmn_high`, `zmn_normal`, `zmn_low`, `zmn_silent`) replace the single legacy channel; users may need to re-confirm channel preferences.

### Events page improvements

- **Reviewed state** per event: stored in a profile-scoped Zustand store, persisted; visual distinction in `EventCard` and list views; bulk-mark-reviewed action; integrates with the notification "Reviewed" action so dismissing from the lock screen marks the underlying event reviewed.
- **Noise filter** UI: applies the suppression-store noise-filter rules to the Events list (hide / dim events below score or matching cause-exclude). Single source of truth shared with the notification suppression path.
- **Quick-search filter bar** on the Events page: unified date range, monitor multiselect, object class, cause text contains, alarm score min — all visible at once, replacing today's hidden filter popover for the common case (popover stays available for advanced).

### Triage Center screen

- Renames the planned "Snooze Management" screen to **Triage Center** and consolidates: active mutes (with Clear / Extend), quiet-hours schedules (add / edit / delete), per-monitor priority (high/normal/low/silent), noise-filter rules (per-profile and per-monitor). Reachable from Notification Settings.

### Quick-look surfaces (functional-equivalent parity)

- **iOS** home-screen widget (WidgetKit, separate target): three sizes; shows latest event thumbnail, monitor name, time-ago, and object label per latest event; tap deep-links to that event or `MonitorDetail`.
- **Android** home-screen widget (`AppWidgetProvider`): same data, three sizes (1x1, 2x2, 4x2).
- **Tauri** desktop: system-tray / menu-bar quick-look with a popover listing the last N events, click-to-open. Uses `tauri-plugin-systemtray`.
- **Web**: in-tab dock — a small persistent strip at the top or bottom of the app showing the last N events with thumbnail + monitor + time, present on every route, dismissable per-session.
- Widget / tray / dock data source: a shared snapshot file written by the app (App Group on iOS, content provider on Android, app-data dir on Tauri, IndexedDB/localStorage on web). Updates whenever a new event is delivered.

### Live action deep-link

- Existing PiP plugin extended to auto-engage when `MonitorDetail` mounts with `?pip=auto`.

### Localization & dedup

- Extension/service-shipped `Localizable.strings` and Android `strings.xml` for all 5 supported languages (en, de, es, fr, zh) — extensions cannot use the React i18n bundle, so a small set of templated strings (≤ ~12 keys) is duplicated and read using locale from App Group `UserDefaults`.
- ES/Direct deduplication for foreground delivery is preserved.

### Documentation

- `docs/user-guide/notifications.md` updated for the lock-screen behavior, action buttons, priority, quiet-hours, mute lifecycle, and graceful degradation against older servers.
- `docs/user-guide/events.md` updated for reviewed state, quick-search filter bar, and noise filter.
- `docs/user-guide/dashboard.md` (or new `quick-look.md`) updated for the widget / tray / dock surfaces.
- `docs/developer-guide/` updated per rule #4 for new APIs, hooks, plugin shims, and deep-link contract.

## Capabilities

### New Capabilities
- `push-notification-triage`: end-to-end behavior of the FCM push pipeline from ES payload through OS notification surface — payload contract, locale-aware title formatting, rich attachments, action set, suppression rules, priority mapping, and graceful degradation. iOS and Android.
- `notification-mute-store`: profile-scoped, cross-process suppression store covering ad-hoc mutes, recurring quiet-hours, and noise-filter rules. Single source of truth consumed by the iOS extension, Android FCM service, and the in-app Events list filter.
- `monitor-notification-priority`: per-monitor priority (high / normal / low / silent) mapped to iOS `interruptionLevel` and Android `NotificationChannel` importance at notification time.
- `monitor-live-deeplink`: deep-link route into `MonitorDetail` with auto-PiP engagement on mount. Used by the Live action and reusable from any future deep link source (widget, tray, dock).
- `snooze-management-screen`: in-app **Triage Center** screen — manages all suppression-store entries (mutes, quiet-hours, priority, noise-filter rules) per profile. Entry point from Notification Settings.
- `event-review-state`: per-event reviewed/unreviewed state, bulk mark-reviewed, visual distinction in lists, and integration with the notification "Reviewed" action so cross-surface state stays consistent.
- `event-noise-filter`: applies the suppression-store noise-filter rules to the Events list (alarm-score threshold, cause-text exclude patterns) — same data the push pipeline consumes.
- `event-quick-search`: unified filter bar on the Events page (date range, monitor multiselect, class, cause contains, alarm score min) for sub-second event location.
- `quick-look-surfaces`: home-screen widget on iOS and Android, system-tray quick-look on Tauri desktop, in-tab dock on web — functional equivalents driven from a shared event-snapshot source.

### Modified Capabilities
<!-- No existing OpenSpec specs in this repository. All work is new capabilities. The PROJECT.md / .planning/ artifacts are external context, not OpenSpec specs. -->

## Impact

**Code (large surface)**
- `app/src/components/NotificationHandler.tsx`, `app/src/services/notifications.ts`, `app/src/services/pushNotifications.ts`: foreground dedup updated for new payload; integrate with suppression store; preserve ES/Direct dedup.
- `app/src/pages/NotificationHistory.tsx`, `app/src/pages/NotificationSettings.tsx`: link to Triage Center, surface reviewed-state badges.
- `app/src/pages/Events.tsx`, `app/src/components/events/EventCard.tsx`, `app/src/components/events/EventListView.tsx`, `app/src/components/events/EventsFilterPopover.tsx`: reviewed-state visuals + quick-search filter bar + noise-filter integration.
- `app/src/pages/MonitorDetail.tsx`: read `pip=auto` query param; engage PiP on stream-ready.
- `app/src/plugins/pip/`: expose `engageOnReady(videoEl)` API safe to call when PiP is unsupported.
- New `app/src/plugins/suppression-store/`: thin Capacitor plugin shim for the cross-process suppression store (iOS Swift, Android Kotlin, web shim using `localStorage`).
- New `app/src/pages/TriageCenter.tsx` (replaces the originally-planned Snooze Management screen).
- New `app/src/stores/eventReviewState.ts` (Zustand, profile-scoped, persisted).
- `app/ios/App/ImageNotification/NotificationService.swift`: locale resolution, suppression check, priority mapping, strip composition.
- New iOS sources: `MuteStore.swift`, notification category registration, action handlers, App Group accessors, per-language `Localizable.strings`, **WidgetKit target** for the home-screen widget.
- New Android sources: `ZMNFirebaseMessagingService.kt`, `MuteStore.kt`, action `BroadcastReceiver`s, four `NotificationChannel`s, per-language `strings.xml`, `AppWidgetProvider` for the home-screen widget.
- New Tauri sources: system-tray icon + popover via `tauri-plugin-systemtray` (or equivalent — version-pinned to current Tauri 2 setup), event-snapshot reader.
- New web component: `app/src/components/layout/QuickLookDock.tsx` mounted in the root layout, dismissable per-session.
- `app/src/locales/{en,de,es,fr,zh}/translation.json`: new strings for Triage Center, quick-search bar, reviewed-state, noise filter, priority labels, widget/dock empty states.

**APIs / external systems**
- ES payload contract (zmeventnotificationNg): additive only. Coordination required with the ES project to publish the new fields. Older ES versions remain supported.
- ZM Direct mode: no improvement beyond what ZM core already sends; client gracefully formats whatever fields are present.
- FCM payload size: stays well under 4KB even with all nice fields populated.

**Dependencies**
- iOS App Group entitlement and shared Keychain — App Store Connect provisioning-profile updates required.
- iOS WidgetKit target — Xcode project configuration updates required.
- Tauri: confirm `tauri-plugin-systemtray` (or current-equivalent) compatibility with the Tauri 2 + Rust setup; JS and Rust packages must move together (rule #16).
- No new Capacitor plugins. The existing push plugin is wrapped (Android) or coexists (iOS) without replacement.

**Out of scope (explicit non-goals — partly mirrors prior PROJECT.md)**
- Live Activities / Dynamic Island.
- iOS Notification Content Extension (custom expanded UI).
- iOS Critical Alerts entitlement (App Store rejects general home-security/surveillance use cases per `.planning/research/PITFALLS.md`).
- Apple Watch / Wear OS app.
- Geofence-based arm/disarm.
- Cloud / off-device storage / account sync.
- Server-side mute on ES; server-side quiet-hours.
- New client-side ML / object detection models — the noise filter consumes existing ZM `score` and `cause` text only.
- Live view / Montage redesign — out of scope per prior milestone scope.
- Any improvement for ZM Direct-mode users beyond what ZM core sends.

**Risks (full design treatment in `design.md`)**
1. Capacitor + native FCM coexistence on Android — needs a pre-implementation spike (highest risk).
2. iOS App Group + shared Keychain provisioning + WidgetKit target setup.
3. Extension/service-shipped localization drift (extensions outside the React i18n context).
4. Profile scoping discipline — every payload and store entry must carry `profile_id`.
5. Android `NotificationChannel` migration from one legacy channel to four — users with custom per-channel settings need clear handling.
6. Tauri system-tray plugin compatibility under Tauri 2.
7. Widget data freshness on iOS / Android — widgets refresh on OS schedule, not on arbitrary push; staleness must be explicit (timestamp shown).
8. Scope size — this is a milestone-level change inside one OpenSpec change. `tasks.md` phases the work internally.
