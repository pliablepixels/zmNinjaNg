## 1. Spike — Android FCM coexistence (BLOCKER for §8–§10)

- [ ] 1.1 Stub a custom `FirebaseMessagingService` in `app/android/app/src/main/java/...`, register it in `AndroidManifest.xml` with priority above the Capacitor plugin's, and confirm it receives FCM messages first
- [ ] 1.2 Verify foreground delivery still reaches the existing JS handler in `NotificationHandler.tsx` after the custom service runs (in-app toast + ES/Direct dedup unchanged)
- [ ] 1.3 Verify background delivery results in a single system notification (no duplicate from Capacitor's default handling)
- [ ] 1.4 Document findings in `design.md` § Open Questions; if blocked, escalate to D5's rejected alternative and re-estimate before proceeding

## 2. Spike — Tauri system-tray plugin compatibility (BLOCKER for §16)

- [ ] 2.1 Confirm `tauri-plugin-systemtray` (or current equivalent) version pair compatible with the project's Tauri 2 + Rust setup; pin both JS and Rust packages (rule #16)
- [ ] 2.2 Stub a tray icon + click-to-popover in a throwaway branch; verify it works on macOS, Windows, Linux
- [ ] 2.3 If blocked: design fallback (global keyboard shortcut → foreground popover window); update `design.md` § Open Questions

## 3. ES payload contract (zmeventnotificationNg)

- [ ] 3.1 Land additive payload fields per `proposal.md` (`monitor_id`, `monitor_name`, `event_id`, `started_at`, `profile_id`, `object_labels`, `image_url_jpg`, `alarm_score`, `image_urls_strip`, `color_hex`, `category_id`, `cause_text`)
- [ ] 3.2 Generate strip URLs server-side using existing `nph-zms` frame endpoints
- [ ] 3.3 Truncate `cause_text` server-side at 200 chars to keep payload < 4KB worst-case
- [ ] 3.4 Confirm payload size with worst-case populated values; deploy to a test ES instance for client integration testing

## 4. Cross-platform suppression store (mute + quiet-hours + noise-filter)

- [x] 4.1 Define on-disk format: JSON array of entries `{kind, profile_id, …}` per `notification-mute-store/spec.md`
- [ ] 4.2 iOS: `MuteStore.swift` module backed by App Group `UserDefaults` (suite `group.com.zoneminder.zmNinjaNG`); read/write/lookup/expire APIs covering all three entry kinds
- [ ] 4.3 Android: `MuteStore.kt` module backed by `SharedPreferences` (single shared file); same API surface
- [ ] 4.4 JS bridge: `app/src/plugins/suppression-store/` Capacitor plugin shim with `list()`, `add()`, `update()`, `remove()`, plus typed entry-kind helpers
- [x] 4.5 Web shim: `localStorage`-backed implementation for parity (no native push on web, but the noise-filter rules must still drive the Events list)
- [x] 4.6 Quiet-hours evaluator (shared logic): given `now` (local) and a window entry, return active/inactive — handle weekday mask, midnight crossing
- [x] 4.7 Noise-filter evaluator (shared logic): given event and rule, return `match: bool, mode`
- [~] 4.8 Unit tests for read/write/expiry semantics on both native sides + JS shim — 41 unit tests on JS shim + evaluators landed; native sides deferred
- [ ] 4.9 Concurrent access test (read during write does not return torn data)

## 5. Per-monitor priority — settings + cross-process read

- [ ] 5.1 Add `priority` field to monitor settings under `getProfileSettings`/`updateProfileSettings`; default `normal`
- [ ] 5.2 Migration: detect legacy `notifications_enabled = false` and present as `silent`; on first save, write `priority = silent` and clear the legacy field
- [ ] 5.3 Cross-process read accessor: extension/service reads from same App Group / SharedPreferences source the React app writes to
- [ ] 5.4 Display priority badge on `MonitorCard` (`app/src/components/monitors/MonitorCard.tsx`) when non-default

## 6. iOS — App Group + entitlements + Widget target setup

- [ ] 6.1 Add App Group capability to main app target, `ImageNotification` extension, and the new Widget target in Xcode
- [ ] 6.2 Add Keychain Sharing capability if action handlers need credentials (defer if not needed for v1)
- [ ] 6.3 Update Apple Developer provisioning profiles for all three targets (maintainer-side)
- [ ] 6.4 Verify all three targets read/write the same App Group `UserDefaults` suite and shared file paths

## 7. iOS — Service Extension upgrades

- [ ] 7.1 Extend `app/ios/App/ImageNotification/NotificationService.swift` to read `profile_id`, `monitor_id`, `alarm_score`, `cause_text`; consult the suppression store; drop the push when matched
- [ ] 7.2 Add locale resolution from App Group `UserDefaults` (key: `selectedLocale`); default to English when missing
- [ ] 7.3 Ship `Localizable.strings` for en, de, es, fr, zh inside the extension bundle (templated keys: title format, label vocabulary, action labels, monitor-fallback)
- [ ] 7.4 Implement title formatting: `<top-label> <confidence>% · <monitor_name>` when applicable; fallback to `<monitor_name>`
- [ ] 7.5 Implement multi-frame strip composition (parallel `URLSession` fetches via `DispatchGroup`, `UIGraphics` horizontal composite, single JPEG attachment); fallback to single image when strip absent
- [ ] 7.6 Honour `category_id` and per-monitor priority — set `interruptionLevel` based on priority lookup
- [ ] 7.7 Update event-snapshot file in App Group container with the new event (capability `quick-look-surfaces`)

## 8. iOS — Notification categories + action handlers

- [ ] 8.1 Register `UNNotificationCategory` (`zmEventStandard`) with three `UNNotificationAction`s in `AppDelegate.swift` at app launch: `mute1h` (no `.foreground`), `reviewed` (no `.foreground`), `live` (with `.foreground`)
- [ ] 8.2 Implement `userNotificationCenter(_:didReceive:withCompletionHandler:)` to dispatch on `actionIdentifier`
- [ ] 8.3 `mute1h` handler: write a mute entry via `MuteStore` with `until = now + 3600s`, log via `os_log`, complete without UI
- [ ] 8.4 `reviewed` handler: append the `event_id` to a "review-pending" file in App Group container; the React app drains on next foreground
- [ ] 8.5 `live` handler: emit deep link `zmninja://monitor/<monitor_id>?profile_id=<profile_id>&pip=auto`
- [ ] 8.6 Wire deep-link handler in `AppDelegate.swift` / `Info.plist` URL schemes if not already present (also used by widgets)

## 9. Android — Custom FirebaseMessagingService + channels

- [ ] 9.1 Create `app/android/app/src/main/java/.../ZMNFirebaseMessagingService.kt` extending `FirebaseMessagingService`
- [ ] 9.2 Register in `AndroidManifest.xml` ahead of Capacitor's plugin service
- [ ] 9.3 Create the four `NotificationChannel`s on first launch: `zmn_high`, `zmn_normal`, `zmn_low`, `zmn_silent`
- [ ] 9.4 Channel migration: copy legacy single channel's user-tweaked settings to `zmn_normal`, delete legacy channel, set a one-time-shown flag, surface in-app notice on first foreground after migration
- [ ] 9.5 In `onMessageReceived`: parse same payload fields as iOS; consult suppression store via `MuteStore`; drop if matched
- [ ] 9.6 Foreground branch: hand off to Capacitor pipeline (per spike #1.2 outcome) so existing JS toast/dedup runs
- [ ] 9.7 Background branch: build `NotificationCompat.Builder` with `BigPictureStyle` (single image or composited strip), formatted title, three `addAction()` entries; pick channel based on per-monitor priority
- [ ] 9.8 Ship per-language `strings.xml` keys for title format, label vocabulary, action labels (en, de, es, fr, zh)
- [ ] 9.9 Read selected locale from `SharedPreferences` (key: `selectedLocale` written by React app)
- [ ] 9.10 Implement Bitmap composite for the 3-frame strip (parallel OkHttp calls, `Canvas` horizontal composite)
- [ ] 9.11 Update event-snapshot file via `ContentProvider` (capability `quick-look-surfaces`)

## 10. Android — Action handlers

- [ ] 10.1 Create `MuteActionReceiver` (`BroadcastReceiver`) — writes mute entry via `MuteStore`, dismisses notification, returns
- [ ] 10.2 Create `ReviewedActionReceiver` — appends to review-pending shared file, dismisses, returns
- [ ] 10.3 Wire `addAction()` `PendingIntent`s targeting the receivers (mute, reviewed) and an Activity (live) with extras: `monitor_id`, `profile_id`
- [ ] 10.4 Live action target: existing `MainActivity` with deep-link URI `zmninja://monitor/<monitor_id>?profile_id=<profile_id>&pip=auto`

## 11. PiP-on-tap deep link

- [x] 11.1 Update `app/src/plugins/pip/index.ts` (and platform implementations) to expose `engageOnReady(videoEl)` API safe to call when PiP is unsupported
- [x] 11.2 Update `app/src/pages/MonitorDetail.tsx` to read `pip=auto` query param; call `engageOnReady` once the video is ready
- [x] 11.3 Update the app's deep-link handler (Capacitor `App.addListener('appUrlOpen', ...)`) to route `zmninja://monitor/<id>?…` to `MonitorDetail` and `zmninja://event/<id>?…` to `EventDetail`
- [x] 11.4 Handle profile mismatch — switch active profile before mounting the target route if `profile_id` differs from the currently active one

## 12. Reviewed-state store + integrations

- [x] 12.1 Create `app/src/stores/eventReviewState.ts` (Zustand, profile-scoped, persisted via Capacitor `Preferences` / `localStorage`); versioned key
- [ ] 12.2 Drain logic: on app foreground, read the iOS App Group / Android shared "review-pending" source and merge into store; clear source after successful merge
- [x] 12.3 Per-card "Mark reviewed" affordance + "Unmark reviewed" overflow item on `EventCard`
- [x] 12.4 Bulk "Mark all reviewed" action on the Events page; cap at 500 events with localized notice when exceeded
- [ ] 12.5 Visual treatment: 50% opacity + checkmark icon on reviewed events across `EventCard`, `Events.tsx`, dashboard recent-events widget, montage view (where applicable)
- [~] 12.6 "Show reviewed" toggle integration with quick-search filter bar (default off on phone portrait, on for tablet/desktop, persisted profile-scoped within session) — lightweight integration into existing filter popover; final inline placement on the quick-search bar follows §13
- [~] 12.7 Unit tests for store, batched-write performance test, drain test (store + batched-write covered; drain test deferred to §12.2)

## 13. Events page — Quick-Search filter bar

- [ ] 13.1 Create `app/src/components/events/QuickSearchFilterBar.tsx` mounted above the events list on `Events.tsx`
- [ ] 13.2 Implement filters: date range presets + custom picker; monitor multiselect; class chips ({person, vehicle, animal, package, unknown}); cause-contains input; alarm-score-min slider; "Show reviewed"; "Show filtered"
- [ ] 13.3 Phone-portrait collapse to "Filters · N" with expandable inline panel
- [ ] 13.4 "Today's high-score events" preset and "Clear all" buttons
- [ ] 13.5 Persist bar state profile-scoped within session; reset on profile switch and on app restart
- [ ] 13.6 Coexist with existing `EventsFilterPopover` (popover filters AND with bar filters; independent active-filter counts)
- [ ] 13.7 Add `data-testid` to every interactive element (rule #13)
- [ ] 13.8 Use `useDateTimeFormat()` for date display (rule #24)

## 14. Events page — Noise filter integration

- [x] 14.1 Apply suppression-store `noise_filter` rules to the events list render — hide events where any rule in `mode: hide` matches; dim events where any rule in `mode: dim` matches
- [x] 14.2 Distinct visual treatment: noise-dimmed events show a "filtered" icon, distinct from the reviewed-checkmark
- [x] 14.3 Resolve stacked dim: cap opacity at 50% when both reviewed and noise-dim apply
- [x] 14.4 "Show filtered" session-scoped toggle in the quick-search bar — temporarily un-hides hide-mode events, rendered as noise-dimmed
- [ ] 14.5 First-run default-rule offer: when >50 low-score events detected in the user's history for the active profile, show one-time dismissable offer (Accept / Decline / Ask later)
- [x] 14.6 Single-source-of-truth: rule add/edit/delete in Triage Center reflects in events list on next focus

## 15. Triage Center screen

- [x] 15.1 Create `app/src/pages/TriageCenter.tsx` with four sections: Mutes, Quiet Hours, Per-Monitor Priority, Noise Filter
- [~] 15.2 Mutes section: list ordered by `until` ascending, Clear / Extend (1h, 4h, 24h, custom) per row, empty state — 1h extend in MVP; 4h/24h/custom in §15 follow-up
- [x] 15.3 Quiet Hours section: list with label, time range, weekdays, monitor scope; Add / Edit / Delete; weekday-mask validation (reject empty)
- [~] 15.4 Per-Monitor Priority section: list current profile's monitors with priority selector (`high` / `normal` / `low` / `silent`); info banner explaining OS-level mapping — placeholder card; depends on §5 cross-process priority field
- [x] 15.5 Noise Filter section: list rules with monitor scope, score threshold, cause-exclude patterns, mode; Add / Edit / Delete; help line showing default rule status
- [x] 15.6 Use `useDateTimeFormat()` for time-remaining and time-range display (rule #24)
- [ ] 15.7 Auto-refresh on focus and on a 30 s interval (use `useBandwidthSettings()` if a fitting interval already exists; else hardcoded 30 s with comment justification)
- [x] 15.8 Add `data-testid` attributes to all interactive elements (rule #13)
- [x] 15.9 Add an entry-point link/button to `app/src/pages/NotificationSettings.tsx`
- [x] 15.10 Add route to the app router

## 16. Quick-look surfaces

### iOS Widget
- [ ] 16.1 Create new WidgetKit extension target in Xcode; configure App Group; bundle identifier
- [ ] 16.2 Implement three widget sizes (small / medium / large) reading from App Group event-snapshot file
- [ ] 16.3 Force-refresh on push receipt via `WidgetCenter.shared.reloadTimelines`
- [ ] 16.4 Tap deep-link via `zmninja://event/...` and `zmninja://monitor/...?pip=auto`
- [ ] 16.5 Empty state with localized placeholder (extension-shipped strings)

### Android Widget
- [ ] 16.6 Create `AppWidgetProvider` with three sizes (1×1, 2×2, 4×2) and `RemoteViewsService` for list rendering
- [ ] 16.7 Read event-snapshot via `ContentProvider`; refresh on push receipt via `AppWidgetManager.notifyAppWidgetViewDataChanged`
- [ ] 16.8 Tap deep-link to `EventDetail` / `MonitorDetail?pip=auto`
- [ ] 16.9 Empty state localized via `strings.xml`

### Tauri system-tray
- [ ] 16.10 Install `tauri-plugin-systemtray` (or equivalent — version-pinned per spike #2)
- [ ] 16.11 Tray icon with badge dot when unreviewed events exist
- [ ] 16.12 Click → popover/window listing latest 5 events; click event → bring main window front + route to `EventDetail` / `MonitorDetail?pip=auto`
- [ ] 16.13 Read event-snapshot from app-data directory; refresh on push delivery
- [ ] 16.14 Fallback: global keyboard shortcut opening the same popover as a foreground window when tray plugin unavailable

### Web in-tab dock
- [x] 16.15 Create `app/src/components/layout/QuickLookDock.tsx` mounted in the root layout
- [~] 16.16 Read event-snapshot from `localStorage` (profile-scoped key); subscribe to events store updates for live refresh — currently subscribes to `useNotificationStore.profileEvents` directly; localStorage snapshot adapter pairs with §16.21
- [x] 16.17 Hide on viewports < 480 px wide
- [x] 16.18 Dismiss button persists per-session in `sessionStorage`
- [x] 16.19 Tap event row → navigate to `EventDetail`
- [x] 16.20 Empty state localized

### Shared snapshot writer
- [ ] 16.21 Implement event-snapshot writer in `app/src/services/notifications.ts` (or shared utility) that writes the latest 5 events for the active profile to the platform-specific source on every successful event delivery
- [ ] 16.22 Snapshot is written on iOS by the Service Extension (capability `push-notification-triage`) and on Android by `ZMNFirebaseMessagingService` (additionally to the JS-side writer for foreground delivery)
- [ ] 16.23 Profile switch re-points the snapshot to the new profile's source

## 17. i18n — all 5 languages (rule #5)

- [ ] 17.1 Add Triage Center strings to `app/src/locales/{en,de,es,fr,zh}/translation.json` (titles, section headers, labels, empty states, action labels, validation messages, weekday names, priority level names, duration picker options, help banners)
- [ ] 17.2 Add quick-search filter bar strings (preset names, picker labels, class chip labels, toggle labels, "Clear all", "Today's high-score", collapsed-bar count text)
- [ ] 17.3 Add reviewed-state strings (action labels, toggle, bulk confirmation, 500-cap notice, overflow menu)
- [ ] 17.4 Add noise-filter strings (icon tooltips, "Show filtered" toggle, first-run offer copy and buttons, dimmed-card a11y labels)
- [ ] 17.5 Add web-dock strings (empty state, dismiss tooltip, time-ago via `useDateTimeFormat()`)
- [ ] 17.6 Add iOS extension `Localizable.strings` for title format template, label vocabulary (`person/vehicle/animal/package/unknown`), action labels (`Mute 1h / Reviewed / Live`), widget empty-state — all 5 locales
- [ ] 17.7 Add Android `strings.xml` keys for the same set under `values/`, `values-de/`, `values-es/`, `values-fr/`, `values-zh/`
- [ ] 17.8 Add a build-time check (script in `scripts/`) asserting every extension-shipped key has a value in all 5 locales for both platforms; the script SHALL fail the build on drift
- [ ] 17.9 Verify all labels fit on a 320 px-wide screen / are concise per rule #23

## 18. Tests

- [ ] 18.1 Unit tests: title formatter (locales × confidence × label counts) — JS helper for in-app surfaces, Swift `XCTest` for iOS extension, Kotlin instrumented test for Android service
- [ ] 18.2 Unit tests: suppression store — add / lookup / expiry / extend / clear / quiet-hours window evaluation (incl. midnight crossing) / noise-filter rule evaluation / profile-scoped collision
- [ ] 18.3 Unit tests: deep-link parser for `zmninja://monitor/...?pip=auto` and `zmninja://event/...`
- [ ] 18.4 Unit tests: `eventReviewState` store — add / batched-add / unmark / persistence / profile switch
- [ ] 18.5 Unit tests: priority OS-level mapping — given priority, return correct iOS `interruptionLevel` and Android channel id
- [ ] 18.6 E2E (web/Chromium) `app/tests/features/triage-center.feature` — open from notification settings, list each section, add/edit/delete entries in each, profile switch refresh, with `@visual` baseline
- [ ] 18.7 E2E (web) `app/tests/features/quick-search-bar.feature` — date / monitor / class / cause / score combinations; preset; clear all; popover coexistence; phone-portrait collapse; persistence across navigation; reset on profile switch
- [ ] 18.8 E2E (web) `app/tests/features/event-review-state.feature` — per-card mark/unmark; bulk action; show-reviewed toggle; persistence; profile-scoped isolation
- [ ] 18.9 E2E (web) `app/tests/features/noise-filter.feature` — hide vs. dim mode; cause-exclude; show-filtered session toggle; first-run offer
- [ ] 18.10 E2E (web) `app/tests/features/web-dock.feature` — visible across routes; dismiss session-scoped; phone-portrait hidden; tap event navigates
- [ ] 18.11 E2E (web) `app/tests/features/monitor-live-deeplink.feature` — deep-link routes to MonitorDetail; PiP engagement is platform-dependent and verified manually
- [ ] 18.12 Manual platform verification matrix (iOS phone, iOS tablet, Android phone, Tauri desktop) for: lock-screen presentation, expanded notification action set, Mute 1h enforcement after app kill, Reviewed flow drain, Live deep-link auto-PiP, widget refresh + tap, tray icon + popover, channel migration in-app notice — captured as a checklist artifact in this change directory before archiving
- [ ] 18.13 Visual baselines on web for all new UI (`@visual` tagged scenarios) regenerated and committed via screenshot-diff (NOT raw screenshots — per memory)

## 19. Documentation

- [ ] 19.1 Update `docs/user-guide/notifications.md`: lock-screen behavior, action buttons, per-monitor priority + OS mapping, mute lifecycle, quiet-hours, noise filter, Triage Center, graceful degradation against older ES + Direct mode
- [ ] 19.2 Update `docs/user-guide/events.md`: reviewed state, quick-search filter bar, noise filter, "Show reviewed" / "Show filtered" toggles
- [ ] 19.3 Update `docs/user-guide/dashboard.md` (or new `docs/user-guide/quick-look.md`): widgets / tray / web dock per platform, including how to add the widget on each OS
- [ ] 19.4 Update `docs/developer-guide/`: `suppression-store` plugin shim, `engageOnReady` PiP API, deep-link contract (`zmninja://`), event-snapshot format and writer, `eventReviewState` Zustand store, Triage Center component map (rule #4)
- [ ] 19.5 Add a maintainer note covering Apple Developer portal steps for App Group, Keychain Sharing, and the new Widget Extension target

## 20. Verification gate (per AGENTS.md rules #3, #20)

- [ ] 20.1 `npm test` passes
- [ ] 20.2 `npx tsc --noEmit` passes
- [ ] 20.3 `npm run build` passes (rule #3 — final check, not just `tsc --noEmit`)
- [ ] 20.4 `npm run test:e2e -- triage-center.feature quick-search-bar.feature event-review-state.feature noise-filter.feature web-dock.feature monitor-live-deeplink.feature` passes
- [ ] 20.5 Manual platform matrix from §18.12 passes on iOS phone, iOS tablet, Android phone, Tauri desktop (rule #6 — manual-invoke only, not auto-run)
- [ ] 20.6 GitHub issue created (rule #2) and conventional-commit messages reference it via `refs #<id>` / `fixes #<id>`
- [ ] 20.7 Per-task atomic commits per rule #20 — one logical change per commit; no batched unrelated changes per rule #21

## 21. Internal phasing guidance (informational)

The following phase order is the suggested execution sequence within this single change. It is not part of the apply checklist; it exists to coordinate work across the surface area without re-fragmenting the change.

- **Phase A (foundation):** §1, §2, §3, §4, §5, §6 — spikes, ES contract, store, priority field, iOS entitlements
- **Phase B (push pipeline):** §7, §8, §9, §10 — iOS extension upgrades + actions, Android service + actions
- **Phase C (in-app surfaces):** §11, §12, §13, §14, §15 — deep link, reviewed state, quick-search, noise filter integration, Triage Center
- **Phase D (quick-look):** §16 — widgets, tray, dock, snapshot writer
- **Phase E (polish + ship):** §17, §18, §19, §20 — i18n, tests, docs, verification gate

If plan-phase reveals the change is too large to land safely, this design supports a clean split into 3–5 follow-on changes without restructuring spec content (per `design.md` § R13).
