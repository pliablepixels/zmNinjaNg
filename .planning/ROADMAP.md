# Roadmap: zmNinjaNg "10-Second Triage" Milestone

**Defined:** 2026-04-26
**Granularity:** standard (5 phases, 3-5 plans each)
**Horizon:** 2-4 weeks
**Core Value:** A user can go from a push notification to "is this real, do I care?" in under 10 seconds without ever opening the full app.

## Overview

Five phases delivering 25 v1 requirements across three categories (TRIAGE, ALERT, QUICKLOOK). Phases follow the dependency-constrained build order from `research/SUMMARY.md` and `research/ARCHITECTURE.md`. Phase 1 is the foundation every other phase reads or writes. Phase 3 locks the Android channel set before any rich push lands (channels are immutable after first push). Phase 4 holds the highest engineering risk (iOS NSE auth handoff) and includes a pre-phase spike. Phase 5 reuses Phase 4's App Group plumbing.

Each phase represents a coherent shippable capability with 3-5 GitHub issues filed per project rule 2 before execution begins. Cross-cutting platform constraints (i18n in en/de/es/fr/zh, `data-testid` on every interactive element, `.feature` e2e scenarios with platform tags, profile-scoped settings, `useBandwidthSettings()` for polling, `lib/logger`/`lib/http`/`useDateTimeFormat` exclusively, dynamic Capacitor imports, JS/Rust Tauri version sync) apply to every phase and are not separate requirements.

## Phases

- [ ] **Phase 1: Reviewed State Foundation** - Per-profile event reviewed store with list/detail/history UI and upgrade-safe default
- [ ] **Phase 2: Triage Filter Bar + Desktop/Web Quick-Look** - Single filter bar across events + notifications, plus Tauri tray and web in-tab dock sharing one snapshot source
- [ ] **Phase 3: Notification Channels + Per-Monitor Priority + Quiet Hours** - Four-tier channel/category model (locked before first push), per-monitor priority, quiet-hours window, shared routing predicate
- [ ] **Phase 4: Rich Push (iOS NSE + Android BigPicture + Action Buttons)** - Thumbnails, three action buttons, profile-aware routing, capability-detect nudge, graceful degradation for legacy payloads
- [ ] **Phase 5: Mobile Widgets + PWA Push** - iOS WidgetKit, Android Glance, best-effort PWA push, all reading the shared latest-event snapshot

## Phase Details

### Phase 1: Reviewed State Foundation
**Goal**: Users can mark ZoneMinder events as reviewed across the app, with the state persisted per profile and existing events defaulted to reviewed on upgrade so the badge does not spike.
**Depends on**: Nothing (first phase)
**Requirements**: TRIAGE-01, TRIAGE-02, TRIAGE-03
**Success Criteria** (what must be TRUE):
  1. User can tap a reviewed control on an event card, in `EventDetail`, or in `NotificationHistory`, and the event shows a visible reviewed indicator that survives app restart and profile switch.
  2. User can multi-select events in `EventListView` and mark all selected events reviewed in one action, with the selection cleared and indicators updated immediately.
  3. After upgrading to this milestone build, no events that existed before the upgrade are flagged unreviewed (verified by inspecting `NotificationHistory` immediately after first launch).
  4. Reviewed state for a given event is scoped to the active profile — switching profiles does not carry reviewed state across, and switching back restores the prior profile's state.
**Plans**: TBD
**UI hint**: yes

### Phase 2: Triage Filter Bar + Desktop/Web Quick-Look
**Goal**: Users can filter the events list and notification history through one consolidated filter bar with score / cause / monitor / date / reviewed controls, and Tauri desktop + web users get an always-visible latest-event surface that does not require opening the full app.
**Depends on**: Phase 1 (the reviewed-filter chip and the "hide reviewed" toggle read the reviewed store; the quick-look surfaces highlight unreviewed events)
**Requirements**: TRIAGE-04, TRIAGE-05, TRIAGE-06, TRIAGE-07, TRIAGE-08, QL-04, QL-05, QL-07
**Success Criteria** (what must be TRUE):
  1. User can adjust minimum alarm score, pick monitors, pick cause/object-class chips (sourced from values ZM has actually returned for the active profile), and pick a date range from one filter bar above the events list, and the list updates in place.
  2. The same filter bar appears on `NotificationHistory` with identical fields and persists the same state, so filters set on one page apply on the other.
  3. After changing filters, navigating away, and returning, the filter state is restored from `profileSettings.eventsPageFilters` (extended with `minScore`, `causeExclude`, `objectClasses`, `reviewedFilter`).
  4. User can toggle "Hide reviewed" and see the list scope to events still needing attention; toggling off restores the full list.
  5. Tauri desktop user sees a tray icon with the current latest-event count and title; clicking it shows the most recent five events; double-clicking opens the main app on the active event. Web user sees an in-tab dock that shows the latest event for the active profile and opens event detail on tap.
  6. The Tauri tray, the web in-tab dock, and any future quick-look surfaces all read from the same per-profile latest-event snapshot — pushing a new event to the snapshot updates every surface within one render cycle.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Notification Channels + Per-Monitor Priority + Quiet Hours
**Goal**: Users can set per-monitor notification priority and a daily quiet-hours window, and the app routes incoming events to the correct of four notification tiers on Android (channel) and iOS (category) with deterministic, testable rules.
**Depends on**: Phase 1 (predicate input includes reviewed state for future "skip reviewed in priority count" use; settings UI lives next to existing per-profile settings)
**Requirements**: ALERT-01, ALERT-02, ALERT-03, ALERT-04, ALERT-05
**Success Criteria** (what must be TRUE):
  1. On a fresh Android install, opening the OS notification settings for zmNinjaNg shows exactly the four channels `zmng.event.critical` (high), `zmng.event.normal` (default), `zmng.event.quiet` (low), `zmng.event.silent_summary` (min) with importance/sound defaults from `research/PITFALLS.md`. Re-launching the app does not duplicate channels.
  2. On iOS, the four-tier model is registered as `UNNotificationCategory` entries that map one-to-one to the Android channels, and per-priority routing produces the matching Focus-mode behavior (`timeSensitive` for critical, `passive` for silent) without requesting the Critical Alerts entitlement.
  3. User can pick a priority (critical / normal / quiet / silent) for each monitor from `MonitorDetail` or `NotificationSettings`, the choice persists in profile-scoped settings, and an arriving foreground event is routed to that priority's channel/category by `lib/triage-predicate.ts`.
  4. User can set a quiet-hours window (start, end, optional days-of-week) in `NotificationSettings`, the rule is stored with an explicit timezone, and during the window every alert (except those for monitors set to `critical`) is routed to the `quiet` channel — the alert still lands in `NotificationHistory` and never short-circuits `notify()`.
  5. The same predicate input fixture produces identical verdicts when run through the TypeScript predicate (foreground + JS push handler) and through the predicate's documented Swift/Kotlin reference contract (verified via a shared JSON fixture set, ready for Phase 4 to consume).
**Plans**: TBD
**UI hint**: yes

### Phase 4: Rich Push (iOS NSE + Android BigPicture + Action Buttons)
**Goal**: Users on iOS and Android receive push notifications that include a thumbnail of the triggering frame and three action buttons (Mark reviewed / Snooze monitor 1h / Dismiss), routed to the right profile, with a clear in-app prompt for operators whose servers send legacy payloads and a clean text-only fallback when rich payloads are absent.
**Depends on**: Phase 1 (action targets), Phase 3 (channel set + predicate); pre-phase iOS NSE auth-handoff spike (1-2 days) before native target setup begins
**Requirements**: ALERT-06, ALERT-07, ALERT-08, ALERT-09, ALERT-10
**Success Criteria** (what must be TRUE):
  1. User running iOS receives a push that displays a thumbnail of the triggering frame fetched by the Notification Service Extension, working on a device pointed at a self-signed-cert ZoneMinder server, with the SSL fingerprint and short-lived ZM access token read from the App Group (no credentials embedded in the FCM payload).
  2. User running Android receives a push that displays the thumbnail via FCM `notification.image` rendered as `BigPictureStyle`, on a stock device and on at least one OEM-aggressive device profile (Xiaomi/Realme/Samsung deep-sleep), via the hybrid `notification`+`data` payload shape.
  3. Each push surfaces three action buttons in stable order — Mark reviewed, Snooze monitor (1h), Dismiss. Tapping Mark reviewed launches/foregrounds the app and the event is marked reviewed in the active profile; the badge decrements; the same notification dismisses.
  4. With two profiles registered (Profile A and Profile B), a push from Profile A's server while Profile B is active routes the action against Profile A's data — opening the event opens Profile A's event detail, not "event not found".
  5. On first launch after upgrade against a server whose FCM payload lacks `mutable-content: 1` and the hybrid `notification`+`data` shape, the user sees a one-time, dismissible-per-profile in-app prompt explaining the operator must update `zmeventnotification.pl` config with the exact required keys; meanwhile every push still arrives as a plain text notification routed to the correct channel and still opens the correct event on tap.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Mobile Widgets + PWA Push
**Goal**: Users on iOS and Android home screens see a widget showing the latest event for the active profile (thumbnail, monitor name, relative time, alarm score), refreshed by push receipt rather than polling, and web/PWA users on supporting browsers receive best-effort push notifications labelled as such.
**Depends on**: Phase 4 (App Group + native auth bundle, FCM-driven refresh path); Phase 2 (shared latest-event snapshot infrastructure, `services/widgetSync.ts`)
**Requirements**: QL-01, QL-02, QL-03, QL-06
**Success Criteria** (what must be TRUE):
  1. iOS user sees a small and a medium WidgetKit widget on the home screen showing the latest event for the active profile (thumbnail, monitor name, relative time, alarm score); tapping the widget opens that event's detail page in the main app on the correct profile.
  2. Android user sees a small and a medium Glance home-screen widget rendering the same content as the iOS widget for the same profile, also tap-to-event-detail.
  3. After a push arrives, the widget timeline reloads via `WidgetCenter.reloadAllTimelines()` on iOS and the equivalent Glance refresh on Android — verified by sending a test push and observing the widget update within five seconds — with no widget-side polling timer running (no widget process hits ZoneMinder on its own schedule).
  4. On a browser that supports Web Push (Chrome / Firefox / Edge / Safari 16.4+ when installed to home screen), the user can opt into PWA push from `NotificationSettings`; the surface is labelled "best-effort" and a subscription failure displays a message but does not break the in-tab dock from Phase 2.
**Plans**: TBD
**UI hint**: yes

## Coverage Map

Every v1 REQ-ID is mapped to exactly one phase. No orphans. No duplicates. Coverage 25/25.

| Phase | Requirements | Count |
|-------|--------------|-------|
| Phase 1 | TRIAGE-01, TRIAGE-02, TRIAGE-03 | 3 |
| Phase 2 | TRIAGE-04, TRIAGE-05, TRIAGE-06, TRIAGE-07, TRIAGE-08, QL-04, QL-05, QL-07 | 8 |
| Phase 3 | ALERT-01, ALERT-02, ALERT-03, ALERT-04, ALERT-05 | 5 |
| Phase 4 | ALERT-06, ALERT-07, ALERT-08, ALERT-09, ALERT-10 | 5 |
| Phase 5 | QL-01, QL-02, QL-03, QL-06 | 4 |
| **Total** | | **25** |

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Reviewed State Foundation | 0/? | Not started | - |
| 2. Triage Filter Bar + Desktop/Web Quick-Look | 0/? | Not started | - |
| 3. Notification Channels + Per-Monitor Priority + Quiet Hours | 0/? | Not started | - |
| 4. Rich Push (iOS NSE + Android BigPicture + Action Buttons) | 0/? | Not started | - |
| 5. Mobile Widgets + PWA Push | 0/? | Not started | - |

## Cross-Cutting Constraints

These apply to every phase and are not separate requirements (per `AGENTS.md` and `PROJECT.md` constraints):

- i18n in en, de, es, fr, zh for every new user-facing string (rule 5)
- `data-testid="kebab-case-name"` on every new interactive element (rule 13)
- `.feature` e2e scenarios with platform tags `@all` / `@ios-phone` / `@android` / `@tauri` / `@web` for every new UX (rule 6)
- Visual regression baselines (`@visual`) for new UI surfaces
- Profile-scoped settings via `getProfileSettings` / `updateProfileSettings` (rule 7)
- `useBandwidthSettings()` for any polling (rule 8)
- `lib/logger`, `lib/http`, `useDateTimeFormat()` exclusively (rules 9, 10, 24)
- Capacitor plugins via dynamic imports + platform check; mocks in `tests/setup.ts` (rule 14)
- Tauri JS `@tauri-apps/*` and Rust `tauri-plugin-*` versions move together (rule 16)
- GitHub issue per phase (or per major plan) before implementation begins (rule 2)
- File-size budget ~400 LOC per file; extract complex logic (rule 12)

## Phase Transition Notes

Phase 1 → 2: Reviewed store and `useReviewedState` hook in place; Phase 2 can wire the reviewed filter chip and the unreviewed badge.

Phase 2 → 3: `eventsPageFilters` extended; `services/widgetSync.ts` and the latest-event snapshot exist; Phase 3 introduces `triageRules.ts` + `triage-predicate.ts` that the widget surfaces will later route through.

Phase 3 → 4: Channel set locked in production. Predicate exists in TypeScript with a JSON fixture set. Phase 4's NSE Swift implementation and Android FCM service Kotlin implementation must produce identical verdicts against the fixture set.

Phase 4 → 5: App Group entitlement, NSE auth-handoff bridge, App Group `UserDefaults` writer, and Android DataStore writer are in place. Phase 5 wires WidgetKit + Glance as readers of that same store; no new auth plumbing.

After Phase 5: PROJECT.md Active list moves these requirements to Validated; v1.x candidates from `research/FEATURES.md` (free-text cause search, notification-history badge tied to reviewed, multi-server bulk mark) become candidates for the next milestone.

---

*Roadmap defined: 2026-04-26 after research synthesis*
*Coverage: 25/25 v1 requirements mapped*
