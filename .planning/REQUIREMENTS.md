# Requirements: zmNinjaNg "10-Second Triage" Milestone

**Defined:** 2026-04-26
**Core Value:** A user can go from a push notification to "is this real, do I care?" in under 10 seconds without ever opening the full app.

## v1 Requirements

Each requirement maps to one roadmap phase. Categories: TRIAGE (in-app event review), ALERT (notification path + routing), QUICKLOOK (always-on quick-look surfaces).

### TRIAGE — In-app event review

- [ ] **TRIAGE-01**: User can mark an event as "reviewed" from the events list, event detail, and notification history. Reviewed events are visually distinguished (subtle dim or check-mark) without being hidden.
- [ ] **TRIAGE-02**: User can bulk-mark a selection of events as reviewed in one action from the events list.
- [ ] **TRIAGE-03**: Existing events at first install of this milestone default to "reviewed". Only new events going forward start as unreviewed. Prevents an "8,000 unreviewed events" panic on upgrade.
- [ ] **TRIAGE-04**: A single filter bar above the events list lets the user filter by minimum alarm score, monitor (multi-select), object class / cause text (multi-select with the values ZM has actually returned for this profile), and date range — all in one toolbar.
- [ ] **TRIAGE-05**: The same filter bar is available on the NotificationHistory page with the same field set.
- [ ] **TRIAGE-06**: Filter state persists in profile-scoped settings under the existing `eventsPageFilters` key, extended with `minScore`, `causeExclude`, `objectClasses`, `reviewedFilter`.
- [ ] **TRIAGE-07**: User can toggle a "hide reviewed" filter to scope the list to events still needing attention.
- [ ] **TRIAGE-08**: User can quick-jump from the filter bar to a date range (today / yesterday / last 7 days / custom), with date inputs going through `useDateTimeFormat()` per project rule 24.

### ALERT — Notification path + routing

- [ ] **ALERT-01**: Android ships exactly four notification channels at first push: `critical`, `normal`, `quiet`, `silent`. Importance levels and sound/vibrate defaults follow research/PITFALLS.md. Channels are registered idempotently on app start so re-installs do not double-create.
- [ ] **ALERT-02**: iOS surfaces an equivalent four-tier model via `UNNotificationCategory` (no Critical Alerts entitlement requested). The four tiers map cleanly to the Android channels for a single per-priority abstraction in app code.
- [ ] **ALERT-03**: User can set a per-monitor priority (`critical` / `normal` / `quiet` / `silent`) from MonitorDetail or NotificationSettings. Priority is profile-scoped via `getProfileSettings`/`updateProfileSettings`.
- [ ] **ALERT-04**: User can configure a quiet-hours window per profile (start/end time, optional days-of-week). Window is interpreted in the device's local timezone. During quiet hours, all alerts route to the `quiet` channel — they are NOT suppressed at the send layer (per Pitfalls research; suppressing degrades FCM quota).
- [ ] **ALERT-05**: A profile-scoped predicate `lib/triage-predicate.ts` decides routing (incoming event → channel) deterministically from the per-monitor priority + quiet-hours window. The predicate is invoked from `NotificationHandler` (foreground) and `pushNotifications.ts` (background JS path), and replicated in Swift (NSE) and Kotlin (Android FCM service) using a shared fixture file for parity tests.
- [ ] **ALERT-06**: Push notifications display a thumbnail of the triggering frame on iOS (via Notification Service Extension fetching the ZM image with auth handed off via App Group `UserDefaults`) and on Android (via FCM `notification.image` + `BigPictureStyle`).
- [ ] **ALERT-07**: Each push notification surfaces three action buttons: "Mark reviewed", "Snooze monitor (1h)", "Dismiss". Actions land in the running app via `notificationActionPerformed`. Action taps launch / foreground the app for v1 (silent actions are deferred — they have known reliability gaps in `@capacitor-firebase/messaging`).
- [ ] **ALERT-08**: Each push notification carries a profile id; the action handler resolves the correct profile and applies the action against it (no cross-profile contamination).
- [ ] **ALERT-09**: At first launch after the milestone ships, the app capability-detects whether incoming FCM payloads carry `mutable-content: 1` and the hybrid `notification`+`data` shape needed for rich push. If absent, the app shows a one-time in-app prompt explaining the operator must update `zmeventnotification.pl` config, with the exact required keys (no source code change). The prompt is dismissible per profile.
- [ ] **ALERT-10**: When the FCM payload is the legacy text-only shape, all rich-push features (thumbnails, action buttons) gracefully degrade to a plain text notification that still routes to the correct channel and still opens the correct event on tap.

### QUICKLOOK — Always-on quick-look surfaces

- [ ] **QL-01**: An iOS WidgetKit small + medium widget shows the latest event for the active profile: thumbnail, monitor name, relative time, alarm score. Tap opens the event detail page.
- [ ] **QL-02**: An Android Glance home-screen widget (small + medium) shows the same content.
- [ ] **QL-03**: Widgets refresh on push receipt (`WidgetCenter.reloadAllTimelines()` from NSE on iOS; equivalent Glance refresh from FCM service on Android), NOT by polling. Polling is rejected per Pitfalls research (would burn the 40-70/day budget).
- [ ] **QL-04**: A Tauri menu-bar / system-tray icon shows latest event count + last event title at-a-glance. Click reveals a quick-look popover with the most recent 5 events; double-click opens the main app to the active event.
- [ ] **QL-05**: The web build shows an in-tab dock (collapsible bottom or top bar) with the latest event for the active profile when the app tab is open. Tap opens event detail. This is the primary web "quick-look" surface.
- [ ] **QL-06**: Web also registers a best-effort PWA push subscription on browsers that support it (Chrome / Firefox / Edge / Safari 16.4+ when installed to home screen). Push is labeled as "best-effort" in NotificationSettings — failure does not block the in-tab dock from working.
- [ ] **QL-07**: All five quick-look surfaces (iOS widget, Android widget, Tauri tray, web dock, web PWA push) read from the same per-profile "latest event" snapshot maintained in shared storage (App Group on iOS, DataStore on Android, app store on web/Tauri) so the source of truth is single.

## v2 Requirements

Deferred to a follow-on milestone. Tracked here so they don't get re-discovered.

### TRIAGE

- **TRIAGE-V2-01**: Saved filter presets (named filter combinations the user can recall in one tap)
- **TRIAGE-V2-02**: Reviewed-state sync via ZoneMinder event tags (server-side persistence so the state survives across devices)
- **TRIAGE-V2-03**: AI-powered "summarize my last 24h" digest

### ALERT

- **ALERT-V2-01**: Silent action buttons (mark-reviewed without launching the app) once Capacitor Firebase Messaging reliability lands
- **ALERT-V2-02**: Per-camera DND that overrides global quiet-hours
- **ALERT-V2-03**: Configurable snooze durations beyond 1h (15m / 4h / until tomorrow)

### QUICKLOOK

- **QL-V2-01**: iOS Lock Screen widget (vs home-screen) — needs separate Apple review path
- **QL-V2-02**: Live grid widget showing all monitors at a glance
- **QL-V2-03**: Apple Watch / WearOS companion app
- **QL-V2-04**: macOS Tauri "Today widget" / Notification Center widget

## Out of Scope

Explicit exclusions for this milestone. Each carries its rationale to prevent re-adding.

| Feature | Reason |
|---------|--------|
| ZoneMinder server-side or `zmeventnotification.pl` source code changes | Milestone is client-only. Payload-shape config update is operator-side documentation, not source code. |
| iOS Critical Alerts entitlement | Apple App Store rejects general home-security/surveillance use cases. `time-sensitive` + Android `IMPORTANCE_HIGH` cover ~95% of the UX. |
| iOS Live Activities / Dynamic Island | Wrong data model — ZM events are discrete, not in-progress activities. |
| New client-side ML / object detection models | Consume only metadata ZM and `zmeventnotification` already populate. |
| Live view / Montage redesign | Working today; this milestone stays in the triage + alert lanes. |
| Cloud-style features (off-device storage, account sync) | Outside the ZoneMinder self-hosted model. |
| Geofencing-based arm/disarm | Different feature surface; revisit after triage lane lands. |
| Apple Watch / WearOS companion apps | Mobile widget + rich push cover the on-the-go case for v1. |
| Vendor-cloud face/object recognition | Conflicts with self-hosted/privacy ethos. |
| Account-bound or cloud-synced reviewed-state | Self-hosted ethos; reviewed-state stays profile-local with optional v2 ZM-tag sync. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRIAGE-01 | Phase 1 | Pending |
| TRIAGE-02 | Phase 1 | Pending |
| TRIAGE-03 | Phase 1 | Pending |
| TRIAGE-04 | Phase 2 | Pending |
| TRIAGE-05 | Phase 2 | Pending |
| TRIAGE-06 | Phase 2 | Pending |
| TRIAGE-07 | Phase 2 | Pending |
| TRIAGE-08 | Phase 2 | Pending |
| ALERT-01 | Phase 3 | Pending |
| ALERT-02 | Phase 3 | Pending |
| ALERT-03 | Phase 3 | Pending |
| ALERT-04 | Phase 3 | Pending |
| ALERT-05 | Phase 3 | Pending |
| ALERT-06 | Phase 4 | Pending |
| ALERT-07 | Phase 4 | Pending |
| ALERT-08 | Phase 4 | Pending |
| ALERT-09 | Phase 4 | Pending |
| ALERT-10 | Phase 4 | Pending |
| QL-01 | Phase 5 | Pending |
| QL-02 | Phase 5 | Pending |
| QL-03 | Phase 5 | Pending |
| QL-04 | Phase 2 | Pending |
| QL-05 | Phase 2 | Pending |
| QL-06 | Phase 5 | Pending |
| QL-07 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---

*Requirements defined: 2026-04-26 after research synthesis*
*Traceability filled: 2026-04-26 after roadmap creation*
