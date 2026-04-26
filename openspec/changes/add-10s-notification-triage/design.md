## Context

zmNinjaNg currently delivers ZoneMinder events to users via FCM push (ES mode and Direct mode). The iOS side has a `NotificationServiceExtension` that downloads an image URL from the FCM payload and attaches it; on Android, Capacitor's default push plugin produces a plain title+body notification. The Events list shows a flat unfiltered stream with a hidden filter popover. There is no notion of "reviewed" — every alert keeps nagging until the user opens its detail.

The user-facing flow on a fresh push is: glance → tap → cold start (3–8 s) → JS routing → event detail load → maybe play stream. Triage cannot happen on the lock screen because the notification carries almost no signal beyond "Motion detected on Monitor 1," and there is no way to act on a notification without launching the app. Inside the app, finding "the moment that mattered" requires hunting through a list dominated by false-alarm noise.

The goal of this change is for the user to triage a push or browse recent events in under 10 seconds without opening the app for the common case. The decisions below put as much load as possible on Tier 1 (read at lock screen / glance at widget), Tier 2 (expand + action / list filter), and Tier 3 (probe via deep-link to existing PiP), and add an in-app review-state model so dismissals stick across surfaces.

Stakeholders: zmNinjaNg client (iOS, Android, web, Tauri desktop), zmeventnotificationNg (ES) which controls the FCM payload, and ZoneMinder Direct mode (read-only for us — we accept whatever ZM sends).

### Relationship to prior PROJECT.md

The prior `.planning/PROJECT.md` (commit `4698007`) defined the same milestone with the same Core Value statement. This OpenSpec change is the realization of that milestone, with two deliberate divergences:

1. **ES payload changes are in scope here**, where PROJECT.md framed the milestone as client-only with ES changes deferred. The user explicitly authorized this update during the explore-phase conversation that produced this change. The ES additions are strictly additive to keep the back-compat profile flat.
2. **Single OpenSpec change covering all six milestone hypotheses**, rather than six sequential changes. The user authorized this consolidation. `tasks.md` phases the internal work to mitigate the resulting size.

All other prior PROJECT.md positions are preserved: no Critical Alerts, no Live Activities, no Watch, no geofencing, no cloud, no ML, no Live-view redesign, functional-equivalent parity across platforms, milestone scope ~2–4 weeks (this proposal does not commit to that timeline; estimates are deferred to plan-phase).

## Goals / Non-Goals

**Goals:**
- A user receiving a push can decide "real / not real / mute / reviewed" within 10 seconds, primarily on the lock screen, secondarily in the expanded notification, without launching the app for the common case.
- A user opening the Events list can locate any specific event in under 10 seconds via the quick-search filter bar.
- A user glancing at a widget / tray / dock can answer "anything new and worth my time?" without launching the app.
- The Reviewed state is consistent across surfaces (notification action, list bulk action, individual card action all converge).
- Suppression — ad-hoc mute, recurring quiet-hours, noise-filter rules — is a single store consulted by both the push pipeline and the Events list filter.
- Per-monitor priority maps cleanly to OS notification importance on both iOS and Android, with `silent` fully suppressing display.
- iOS, Android, Tauri desktop, and web each expose a glanceable "latest events" surface — functional equivalents, not pixel parity.
- All ES payload additions are optional and back-compatible.
- All user-facing strings are localized in en, de, es, fr, zh, including extension-shipped strings and Android `strings.xml` accessed by the FCM service.

**Non-Goals:**
- Live Activities / Dynamic Island.
- iOS Notification Content Extension (custom expanded UI).
- iOS Critical Alerts entitlement — App Store rejects general home-security/surveillance use cases (per prior `.planning/research/PITFALLS.md`); standard `.timeSensitive` + Android `IMPORTANCE_HIGH` cover ~95% of the UX.
- Apple Watch / Wear OS app.
- Home-screen widget on Tauri (use system-tray instead) or a Progressive Web App push channel on web (use the in-tab dock instead).
- Geofence-based arm/disarm.
- Cloud / off-device storage / account sync.
- Server-side mute or quiet-hours on ES.
- New client-side ML / object-detection models.
- Live-view or Montage redesign.
- Any improvement for ZM Direct-mode users beyond what ZM core sends.
- Replacing the existing in-app FCM toast/dedup pipeline — new native paths must coexist with it for foreground delivery.

## Decisions

### D1. Suppression is client-side, single store, evaluated before display

A unified profile-scoped store holds three entry kinds: ad-hoc mutes, recurring quiet-hours, and noise-filter rules. Suppression evaluation runs in the iOS Service Extension and Android `FirebaseMessagingService` before the notification is shown. The same store is read by the Events list filter, so list and notification suppression always agree.

**Alternatives considered:**
- *Server-side suppression on ES.* Rejected: requires ES API changes, breaks offline semantics, adds round-trip in iOS extension action handlers (which have tight time/network budgets), and decouples list filter from notification filter.
- *Two separate stores* (one for notifications, one for list). Rejected: drift inevitable; user surprised when a "muted" monitor still floods the list.

### D2. Strong-default escape hatch via PiP-on-tap deep link

The Live notification action does open the app, but routes directly to `MonitorDetail?pip=auto`. The existing PiP plugin engages on mount, so the user sees a small live overlay rather than the dashboard. This is technically an app launch but counts as the "strong default" because the user did not invoke the full UI.

**Alternatives considered:**
- *iOS Notification Content Extension.* Closer to ideal but is the heaviest piece of new native code on the table; deferred.
- *Always launch into dashboard.* Defeats the goal.

### D3. Locale duplication into extension/service bundles

The iOS extension and Android `FirebaseMessagingService` run outside the React i18n context. Decision: ship a small set of templated strings (≤ ~12 keys) inside the extension bundle (`Localizable.strings`) and Android resources (`strings.xml`), per language. The extension/service reads the user's selected locale from App Group `UserDefaults` (iOS) / `SharedPreferences` (Android), which the React app writes whenever language changes. A build-time check asserts every extension key has values in all 5 locales.

### D4. ES payload contract is additive only

```
required (for any new behavior):
  monitor_id           string
  monitor_name         string
  event_id             string
  started_at           ISO8601 string
  profile_id           string

strong (Tier-1 read benefit):
  object_labels        [{label: string, confidence: number 0..1}]
  image_url_jpg        string
  alarm_score          number 0..100   // ZM-native; powers noise filter

nice (Tier-1/2 polish):
  image_urls_strip     [string]   // length 3
  color_hex            string
  category_id          string
  cause_text           string     // ZM-native; powers cause-exclude patterns
```

All fields are optional on the wire. Older ES servers and ZM Direct mode produce notifications using whatever fields are present, falling back to today's "Motion detected on <monitor>" body.

### D5. Android: wrap, don't replace, the Capacitor push plugin

Install a custom `FirebaseMessagingService` in the Android manifest with priority above the Capacitor plugin's. It runs first on every push:
1. Reads the suppression store; if matched, drops the push and returns.
2. If app is in foreground, hands the message to the Capacitor pipeline so JS can render the in-app toast and dedup with the WebSocket. No system notification is shown.
3. If app is in background, builds the rich `NotificationCompat` notification (BigPictureStyle + addAction) with the channel selected by per-monitor priority, and shows it.

A spike (Open Question §1) confirms whether this wrapping is tractable. If not, the Android plan reroutes to "replace + rewrite the JS pipeline" with a re-estimate.

### D6. Action handlers run natively without app launch (except Live)

iOS: `UNNotificationCategory` registered at app launch with three actions (`mute1h`, `reviewed`, `live`). Mute and Reviewed run in the background extension (no `.foreground`); Live launches the app via `.foreground` and a deep link.

Android: `addAction()` `PendingIntent`s target a `BroadcastReceiver` (mute, reviewed) or an `Activity` (live). Receivers run in the FCM service's process.

The Reviewed action writes to a "review-pending" shared file/list that the React app drains on next foreground, merging into the new `eventReviewState` Zustand store.

### D7. Multi-frame strip composition

When `image_urls_strip` is present (length 3), iOS and Android extensions parallel-fetch all 3 URLs, composite horizontally, and attach as a single JPEG. Single-image fallback when absent. Partial composite (n<3) when one or two URLs fail.

### D8. Profile scoping is mandatory at the payload boundary

Every ES push for a multi-profile user must carry `profile_id`. The suppression store is keyed `(profile_id, monitor_id_or_all)`; the review-state store is keyed `(profile_id, event_id)`. Action handlers preserve `profile_id` from the originating notification. Without `profile_id`, no new behavior triggers — the system falls back to today's pipeline rather than risk incorrect suppression.

### D9. Per-monitor priority maps directly to OS importance

Priority is one of `high` / `normal` / `low` / `silent`, stored profile-scoped per monitor.

| Priority | iOS `interruptionLevel` | Android channel | Effect |
|---|---|---|---|
| `high` | `.timeSensitive` | `zmn_high` (`IMPORTANCE_HIGH`) | Bypasses Focus on iOS where allowed; heads-up + sound on Android. |
| `normal` (default) | `.active` | `zmn_normal` (`IMPORTANCE_DEFAULT`) | Today's behavior. |
| `low` | `.passive` | `zmn_low` (`IMPORTANCE_LOW`) | Silent, no peek. |
| `silent` | (suppressed) | `zmn_silent` (`IMPORTANCE_NONE`) | Never displayed; appears in history only. |

Mapping happens after the suppression check passes; a `silent` monitor's push is recorded in history but never shown. The four channels are created at first launch; users with custom OS-level channel settings on the legacy single channel are migrated by writing the prior channel's preferences to `zmn_normal` and informing them via in-app notice on first run after upgrade.

**Alternatives considered:**
- *One channel per monitor.* Rejected: channel proliferation, unmanageable on prosumer setups with 30+ cameras.

### D10. Reviewed state lives in a Zustand store, sourced from three places

`eventReviewState` (Zustand, profile-scoped, persisted via `localStorage` adapter under a versioned key) holds `Set<event_id>`. Sources of truth:

1. **In-app**: per-card "mark reviewed" affordance and bulk-mark-reviewed action on the Events page.
2. **Notification action**: the Reviewed action writes the event to a shared "review-pending" file/list (App Group on iOS, shared `SharedPreferences` on Android); the app drains it on next foreground.
3. **Triage Center**: not directly — Triage Center manages suppression, not review state.

Visual treatment: reviewed events are dimmed (50% opacity on `EventCard`), the Reviewed state is shown as a small checkmark icon, and a per-list toggle ("Show reviewed") defaults to off in mobile portrait, on in desktop. Bulk-mark-reviewed acts on the current filtered set.

### D11. Quick-search filter bar replaces the popover for the common case

The hidden filter popover stays available for advanced filters; the common-case filters (date range, monitor multiselect, class, cause contains, alarm score min) appear inline as a sticky filter bar above the Events list. State is profile-scoped and persisted across navigations within a session; full reset on profile switch. The bar is collapsible on phone portrait (where space is constrained) and exposes a single-tap "today's high-score events" preset.

### D12. Noise filter is a list of rules, not a single global threshold

A noise-filter rule has `(profile_id, monitor_id_or_all, min_alarm_score, exclude_cause_patterns)`. Multiple rules per profile are supported; on evaluation, rules are OR'd (any match suppresses). The same rules apply to both notification suppression and Events list dimming/hiding (per-rule `mode: hide | dim`). A simple "score < 30 means below threshold" default rule is offered at first run.

### D13. Quick-look surface is platform-specific by design

Functional equivalents, not pixel parity:

- **iOS**: WidgetKit widget, three sizes (small / medium / large). Driven by App Group event-snapshot file.
- **Android**: AppWidget, three sizes via `AppWidgetProvider` minWidth/minHeight. Driven by `ContentProvider`-exposed event-snapshot.
- **Tauri**: `tauri-plugin-systemtray` (or current equivalent compatible with Tauri 2). Tray icon + click-to-popover listing recent events.
- **Web**: `QuickLookDock.tsx` — a small persistent strip mounted in the root layout. Dismissable per session via `sessionStorage`.

A shared **event-snapshot writer** in `app/src/services/notifications.ts` writes the latest 5 events to the platform-specific source on every successful event delivery. Snapshot format is JSON: `{updated_at, events: [{event_id, monitor_id, monitor_name, started_at, image_url, top_label}]}`. Each surface decides how many to render given its size.

**Alternatives considered:**
- *PWA push for web.* Rejected: spotty cross-browser support; the in-tab dock is reachable by every user with the tab open.
- *iOS / Android Live Activity for "in-progress" events.* Out of scope per prior PROJECT.md.

### D14. ZM Direct mode degrades; widgets/tray/dock still work

Direct-mode pushes lack `object_labels`, `category_id`, `cause_text`, etc. They still produce a basic system notification (no actions, no rich strip). They DO still update the event-snapshot, so widgets/tray/dock still surface them. The Events list quick-search and review-state work identically regardless of push origin.

## Risks / Trade-offs

**[R1: Capacitor + native FCM coexistence on Android may not be tractable]** → 1–2 day spike before implementation: write a stub `FirebaseMessagingService`, configure manifest priority, verify it runs first and that messages reach the Capacitor JS pipeline when handed off. If the spike fails, escalate to D5's rejected alternative (replace + rewrite JS handler) and re-estimate.

**[R2: iOS App Group + shared Keychain + WidgetKit target provisioning]** → Standard but App Store Connect and provisioning-profile changes are required for App Group, Keychain Sharing, and the new Widget Extension target. Allow buffer for the maintainer's Apple side. No code workaround.

**[R3: Extension localization drift]** → Mitigated by keeping the extension string set minimal (≤ ~12 keys), centralizing the key list in a shared constants file, and adding a build-time check that asserts every extension key has a translation in all 5 locales.

**[R4: Profile scoping discipline]** → Mitigated by making `profile_id` required for any new behavior and falling back to today's pipeline when absent. Spec scenarios cover the missing-`profile_id` path.

**[R5: FCM payload size near 4KB limit]** → Worst-case payload (3 strip URLs, 5 object labels, monitor name, all nice fields, `cause_text` to 200 chars) is under 2 KB. Headroom exists; truncate `cause_text` in ES if exceeded.

**[R6: Notification action handlers have tight time and network budgets]** → Mitigated by D1 (no network in mute/reviewed handlers); both write to local shared store. Live action runs `.foreground` so launches the full app — no budget concern.

**[R7: Suppression hidden from the user]** → Mitigated by the Triage Center listing all active mutes, quiet-hours, priority overrides, and noise-filter rules per profile; mutes naturally expire; quiet-hours show next-active time; priority overrides show on the monitor card in the existing Monitors page.

**[R8: Older ES servers + new client]** → No new behavior triggers (no `profile_id` → fallback). User sees today's notification.

**[R9: New ES server + older client]** → Client ignores unknown fields. User sees today's notification.

**[R10: Android `NotificationChannel` migration]** → Existing single channel's settings preserved by writing them to `zmn_normal`; users informed via one-time in-app notice. Worst case: user re-enables sound on the new channel.

**[R11: Tauri system-tray plugin compatibility]** → Confirm `tauri-plugin-systemtray` compatibility under Tauri 2 during plan-phase; if blocked, fall back to a foreground-window quick-look launched by a global keyboard shortcut. Rule #16 means JS and Rust packages must move together.

**[R12: Widget data freshness]** → iOS / Android widgets refresh on OS schedule (typically 5–15 min). Mitigated by writing the snapshot on every push and showing a `formatRelative(updated_at)` "X ago" timestamp so staleness is explicit. Force-refresh via WidgetCenter / AppWidgetManager on push receipt where the OS allows it.

**[R13: Scope size]** → This is a milestone-level change in one OpenSpec change. `tasks.md` phases the internal work and gates Android-side tasks behind R1's spike outcome. If plan-phase reveals the change is too large to land safely, this design supports a clean split: the existing 9 capabilities can become 3–5 follow-on changes (push pipeline, Events page improvements, Quick-look surfaces) without restructuring the spec content.

**[R14: Bulk-mark-reviewed performance]** → Bulk acting on a large filtered set could write many entries at once. Mitigated by a single-write batch API on `eventReviewState` and by capping bulk operations at the currently-rendered window (e.g., 500 events).

## Migration Plan

This change ships as a single client release plus an additive ES update. Rollout:

1. Land the additive ES payload changes in zmeventnotificationNg first; deploy to test environments.
2. Land the client change behind a small set of profile-scoped feature flags (rule-#7 compatible) — `useNativeFcmService` (Android), `useTriageCenter` (in-app surfaces), `useQuickLookDock` (web), `useQuickLookWidget` (mobile widgets), `useQuickLookTray` (Tauri). Default on; rollback by toggling.
3. Verify Tier-1 lock-screen behavior on real devices for both platforms with both old and new ES servers.
4. Verify suppression entries (mute / quiet-hours / noise-filter) survive app kill / reboot.
5. Verify Reviewed state converges across notification action, list action, and bulk action.
6. Verify quick-look surface refreshes on each platform within its OS budget.
7. Public release.

**Rollback strategies**:
- Android FCM service breaks foreground delivery → toggle `useNativeFcmService` off, fall back to today's Capacitor-only path.
- Triage Center buggy → toggle `useTriageCenter` off, surface only basic Notification Settings.
- Widget / tray / dock buggy → individual platform toggles off.
- iOS extension changes are additive and roll back by shipping a previous extension build.

**Data migration**:
- New `eventReviewState` Zustand store: empty on first run; no migration needed.
- New `notification-mute-store` entries: empty on first run.
- Android `NotificationChannel`s: prior single channel's user-tweaked settings copied to `zmn_normal`; one-time in-app notice on first launch after upgrade.
- Existing notification history: unchanged.

## Open Questions

1. **Spike outcome (R1).** Does Capacitor's push plugin tolerate a wrapping `FirebaseMessagingService`? Required answer before tasks dependent on §7 begin.
2. **Mute durations.** 1h only as the action button, longer durations from the in-app Triage Center? (Lean: yes.)
3. **Strip vs. single image when both sent.** Strip wins. (Settled.)
4. **Object label localization.** Client-side via a fixed vocabulary `{person, vehicle, animal, package, unknown}`. (Lean: yes; requires extension `Localizable.strings` keys.)
5. **Notification category set.** Single `zmEventStandard` category for now; add more if event kinds diverge.
6. **Quiet-hours collision with priority.** If quiet-hours says suppress but priority is `high` (`.timeSensitive`), which wins? Lean: quiet-hours wins (user explicitly scheduled silence; `time-sensitive` is for OS-level Focus, not user-scheduled silence).
7. **Web in-tab dock placement.** Top vs. bottom? Lean: bottom (matches mobile thumb-zone, doesn't fight with `Toolbar`); revisit in plan-phase with a UX sanity check.
8. **Tauri tray plugin pin.** Confirm exact plugin name + version pair (JS + Rust) before tasks.
9. **Bulk-mark-reviewed scope.** Filtered window only, or "all events through end of date X"? Lean: filtered window with a clear count badge; "all from X" can be added later.
10. **Noise-filter default rule.** Should we ship with `score < 30 → dim` enabled by default, or off until the user opts in? Lean: off by default; surface as a one-tap "enable noise filter" prompt the first time the Events list shows >50 low-score events.
