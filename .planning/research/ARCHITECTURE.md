# Architecture Research

**Domain:** zmNinjaNg "10-Second Triage" milestone — six client-only triage capabilities slotted into an established React 19 + Capacitor 7 + Tauri 2 cross-platform NVR client.
**Researched:** 2026-04-26
**Confidence:** HIGH for in-app capabilities (reviewed state, filter, search, quiet hours, surfaces) where existing patterns map cleanly; MEDIUM for rich push (iOS NSE auth handoff is non-trivial and benefits from a feasibility spike); MEDIUM for native widgets (iOS WidgetKit + Android Glance both require native shell code outside Capacitor's plugin idiom).

## Standard Architecture (existing, unchanged)

The milestone slots into the existing layered architecture documented in `.planning/codebase/ARCHITECTURE.md`. No layer is replaced. New modules attach at well-defined seams:

```
                    ┌────────────────────────────────────────────────────┐
                    │  Native shells (Capacitor iOS/Android, Tauri)       │
                    │  + NEW: iOS NSE, Android Glance widget, Tauri tray  │
                    └─────────────────────────┬──────────────────────────┘
                                              │ loads dist/
                    ┌─────────────────────────▼──────────────────────────┐
                    │  Pages / Components / Contexts                      │
                    │  + NEW: events review chips, filter bar, settings   │
                    └─────────────────────────┬──────────────────────────┘
                                              │
                    ┌─────────────────────────▼──────────────────────────┐
                    │  Hooks (bridge UI ↔ data)                           │
                    │  + NEW: useReviewedState, useEventFilterBar,        │
                    │         useQuietHours                               │
                    └─────────────────────────┬──────────────────────────┘
                                              │
            ┌─────────────────────────────────┼─────────────────────────┐
            ▼                                 ▼                         ▼
    ┌──────────────┐                ┌──────────────────┐      ┌─────────────────┐
    │  Stores      │                │  Services        │      │  API / HTTP     │
    │  (Zustand)   │                │  (long-lived)    │      │  (existing)     │
    │              │                │                  │      │                 │
    │  + NEW:      │                │  + NEW:          │      │  + NEW reads:   │
    │  reviewed.ts │                │  quietHoursGate  │      │  GET event      │
    │  triageRules │                │  widgetSync      │      │      thumbnail  │
    └──────────────┘                └──────────────────┘      │  (already in    │
                                                              │   url-builder)  │
                                                              └─────────────────┘
```

### Component Responsibilities (new modules)

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `stores/reviewed.ts` | Per-profile event "reviewed" state with optional ZM-tag mirroring | New Zustand `create(persist(...))` modeled on `eventFavorites.ts` |
| `stores/triageRules.ts` | Per-profile alarm-score floor, cause-text excludes, per-monitor priority, quiet-hours windows | New Zustand store; selectors return derived "should this event surface?" booleans |
| `services/quietHoursGate.ts` | Pure module that decides at app layer whether an arriving notification surfaces, given current rules + time | Synchronous predicate; injected into `NotificationHandler` and `pushNotifications` foreground path |
| `services/widgetSync.ts` | Writes latest event payload + auth token to a shared store readable by widgets/extensions; refreshes timeline/AppGroup | Dynamic-imported on native; calls into iOS App Group `UserDefaults` and Android `glance-appwidget` data store |
| `hooks/useReviewedState.ts` | Read/write reviewed state, with bulk-mark and per-event toggle; returns selector-stable shape | Mirrors `useCurrentProfile` `useShallow` pattern |
| `hooks/useEventFilterBar.ts` | Composes existing event filters + new score/cause/reviewed filters into one filter bar state | Reads/writes `profileSettings.eventsPageFilters` (extend existing key, do not add a parallel store) |
| `hooks/useQuietHours.ts` | React-side accessor for quiet-hours config; exposes `isQuietNow()` | Wraps `triageRules` store; uses `useDateTimeFormat` for display only |
| `components/events/EventReviewedChip.tsx` | Visual marker on `EventCard`/`EventListView` | New component in existing `components/events/` |
| `components/events/EventFilterBar.tsx` | Single filter bar with date/monitor/class/score/reviewed | Built on existing `EventsFilterPopover`/`MonitorFilterPopover` primitives |
| `components/notifications/QuietHoursSection.tsx` | Settings UI for quiet-hours window | New section in `pages/NotificationSettings.tsx` |
| `components/notifications/PriorityRulesSection.tsx` | Per-monitor priority + score floor + cause excludes | Extends existing `MonitorFilterSection.tsx` |
| `components/dashboard/QuickLookCard.tsx` | Web/PWA "latest alert" widget surface | New widget in existing `components/dashboard/widgets/` |
| `plugins/quick-look-mobile/` | Custom Capacitor plugin: bridge between web layer and native widget data | New `app/src/plugins/quick-look-mobile/` (kebab-case dir; `definitions.ts`, `index.ts`, `web.ts`) |
| iOS NSE target | Notification Service Extension — fetches thumbnail with auth, attaches to FCM payload | New Xcode target under `app/ios/App/`; reads creds from App Group |
| iOS WidgetKit target | Latest-event widget | New Xcode target |
| Android Glance widget | Latest-event app widget | New Kotlin module under `app/android/app/src/main/` |
| Tauri tray module | macOS menu-bar / Win/Linux system-tray quick-look | Rust additions in `app/src-tauri/src/`; new `tauri-plugin-positioner` or hand-rolled `TrayIcon` API |

## Recommended Project Structure (delta only)

```
app/
├── src/
│   ├── stores/
│   │   ├── reviewed.ts              # NEW — per-profile reviewed event IDs
│   │   └── triageRules.ts           # NEW — score floor, cause excludes, per-monitor priority, quiet hours
│   ├── services/
│   │   ├── quietHoursGate.ts        # NEW — app-layer suppression predicate
│   │   └── widgetSync.ts            # NEW — push latest event + auth bundle to widget surfaces
│   ├── hooks/
│   │   ├── useReviewedState.ts      # NEW
│   │   ├── useEventFilterBar.ts     # NEW
│   │   └── useQuietHours.ts         # NEW
│   ├── components/
│   │   ├── events/
│   │   │   ├── EventReviewedChip.tsx     # NEW
│   │   │   ├── EventFilterBar.tsx        # NEW (composed of existing primitives)
│   │   │   └── BulkReviewedToolbar.tsx   # NEW
│   │   ├── notifications/
│   │   │   ├── QuietHoursSection.tsx     # NEW
│   │   │   └── PriorityRulesSection.tsx  # NEW
│   │   └── dashboard/widgets/
│   │       └── QuickLookWidget.tsx       # NEW (web/Tauri-window quick-look)
│   ├── plugins/
│   │   └── quick-look-mobile/            # NEW Capacitor plugin (definitions/index/web)
│   ├── lib/
│   │   ├── triage-predicate.ts           # NEW — pure: (event, rules, now) → 'show'|'silent'|'priority'
│   │   └── reviewed-sync.ts              # NEW — optional ZM-tag mirror
│   └── api/
│       └── (no new modules — extends events.ts/tags.ts call sites)
├── ios/App/
│   ├── App/                              # existing main target
│   ├── NotificationService/              # NEW NSE target
│   │   ├── NotificationService.swift
│   │   └── Info.plist
│   ├── QuickLookWidget/                  # NEW WidgetKit target
│   │   ├── QuickLookWidget.swift
│   │   ├── TimelineProvider.swift
│   │   └── Info.plist
│   └── App.entitlements                  # ADD AppGroup com.zoneminder.zmNinjaNG.shared
├── android/app/src/main/
│   ├── java/.../widget/                  # NEW Kotlin sources
│   │   ├── QuickLookWidget.kt           # GlanceAppWidget
│   │   ├── QuickLookWidgetReceiver.kt   # AppWidgetProvider
│   │   └── WidgetActions.kt             # PendingIntents for buttons
│   └── AndroidManifest.xml               # register receiver + intent filters
└── src-tauri/
    ├── Cargo.toml                        # ADD tray crate
    └── src/
        ├── lib.rs                        # register tray + tray commands
        └── tray.rs                       # NEW — menu-bar / system-tray quick-look
```

### Structure Rationale

- **stores/ get two new modules, not one.** Reviewed state is a flat ID set (mirrors `eventFavorites.ts`); rules are structured config. Mixing them would force every reviewed-toggle to re-marshal a complex object.
- **Filter state stays in `profileSettings.eventsPageFilters`.** That key already persists `monitorIds`, `tagIds`, `startDateTime`, `endDateTime`, `favoritesOnly`, `onlyDetectedObjects`, `activeQuickRange` (verified in `app/src/stores/settings.ts:88-95`). Adding `minScore`, `causeExclude`, `objectClasses`, `reviewedFilter` to the same object preserves the existing persistence path and avoids creating a parallel filter store.
- **Pure predicate in `lib/triage-predicate.ts`.** Quiet-hours and rule evaluation must run in three places (foreground toast, background push handler, widget refresh). A pure function imported from `lib/` is the single source of truth and is unit-testable.
- **`widgetSync.ts` is a service, not a hook.** It runs from the app's authenticated session whenever a new event lands or token refreshes, regardless of which page is mounted.
- **Native targets live in their respective shells.** `ios/App/NotificationService/` and `ios/App/QuickLookWidget/` are Xcode targets siblings to the main `App/` target; Android Glance lives under `app/android/app/src/main/java/`. None of this code is reachable from `app/src/`; the Capacitor plugin (`plugins/quick-look-mobile/`) is the only bridge.

## Architectural Patterns

### Pattern 1: Profile-Scoped Persisted Store (reuse)

**What:** New Zustand stores follow the exact `eventFavorites.ts` shape — `Record<profileId, T>` keyed by profile id, with persist middleware and selector functions on the store object.
**When to use:** All new client state for the milestone (reviewed events, triage rules, quiet-hours config).
**Trade-offs:** Re-derive selectors on every change; fine at ZoneMinder scale (tens of events, a few profiles). Avoids the `useCurrentProfile` re-render trap because callers select the raw record and merge inside `useMemo`.

```typescript
// stores/reviewed.ts (sketch)
interface ReviewedState {
  profileReviewed: Record<string, string[]>; // eventIds
  isReviewed: (profileId: string, eventId: string) => boolean;
  markReviewed: (profileId: string, eventIds: string[]) => void;
  unmarkReviewed: (profileId: string, eventIds: string[]) => void;
}
```

### Pattern 2: Pure Predicate + Injection Site (new)

**What:** `triagePredicate(event, rules, now)` is a pure function. Three call sites import it: `NotificationHandler` (foreground toast suppression), `pushNotifications._setupListeners` (FCM foreground handler), and `widgetSync` (drop suppressed events from widget timeline).
**When to use:** Any rule system that must run in the same way across foreground, background, and widget contexts.
**Trade-offs:** The iOS NSE runs out-of-process and cannot import TypeScript — its server-side payload filtering must be replicated in Swift, OR rules are made readable via App Group `UserDefaults` and the predicate is reimplemented in Swift. We accept the duplication cost for now (rules are small).

```typescript
// lib/triage-predicate.ts
export type TriageVerdict = 'show' | 'silent' | 'priority';
export function evaluate(event: ZMAlarmEvent, rules: TriageRules, nowMs: number): TriageVerdict {
  if (isInQuietHours(rules.quietHours, nowMs) && !rules.priorityMonitorIds.has(event.MonitorId)) return 'silent';
  if (event.score < rules.minScore) return 'silent';
  if (rules.causeExcludes.some(s => event.Cause.toLowerCase().includes(s))) return 'silent';
  if (rules.priorityMonitorIds.has(event.MonitorId)) return 'priority';
  return 'show';
}
```

### Pattern 3: Capacitor Plugin Bridge for Native-Only Surfaces (new)

**What:** A custom Capacitor plugin (`plugins/quick-look-mobile/`) exposes `pushLatestEvent(payload)`, `clearEvent()`, `setAuthBundle({...})`. Web fallback is a no-op. iOS implementation writes to App Group `UserDefaults` and calls `WidgetCenter.shared.reloadAllTimelines()`. Android implementation writes to a Glance `DataStore` and triggers `updateAppWidget()`.
**When to use:** Any feature that needs to push data from the JS layer to a native surface that runs out of the WebView.
**Trade-offs:** Doubles the implementation surface (Swift + Kotlin) for one feature; isolates the native concern behind one TypeScript interface so the rest of the app stays portable.

### Pattern 4: Bandwidth-Aware Polling (reuse, mandatory)

**What:** Any new polling — for example, the Tauri tray "latest event" refresh, or the web QuickLookWidget refresh on Dashboard — must add its property to `BandwidthSettings` in `app/src/lib/zmninja-ng-constants.ts` (both `normal` and `low` modes, low ~2x slower) and read via `useBandwidthSettings()`.
**When to use:** Always. Rule #8.
**Trade-offs:** None. Hardcoded intervals are an existing rule violation.

### Pattern 5: Dynamic Capacitor Imports + Platform Guards (reuse, mandatory)

**What:** Every native plugin call (FirebaseMessaging, the new quick-look-mobile plugin, badge, share) is dynamically imported inside `if (Capacitor.isNativePlatform())` guards. Static imports break the web build.
**When to use:** Every new native call. Rule #14.

## Data Flow

### Flow 1 — Rich-push end-to-end (iOS, the hardest case)

The iOS Notification Service Extension runs out-of-process and gets ~30 seconds to mutate the FCM payload before the OS displays it. It does not have JS access. Auth handoff is the central problem.

```
1. ZoneMinder event fires.
2. zmeventnotification.pl posts FCM payload {mid, eid, cause, monitorName,
   score, mutable_content: 1, attachment_url: "ZM_PORTAL/index.php?view=image&fid=alarm&eid={eid}"}.
3. APNs delivers to iOS device → OS spawns NotificationService.swift (NSE).
4. NSE reads App Group UserDefaults (suite "group.com.zoneminder.zmNinjaNG.shared"):
   - portalUrl
   - currentProfileId
   - shortLivedThumbnailToken (a ZM access_token written by the JS app
     whenever it refreshes; rotated on every refresh, expires with
     ZM_INTEGRATION.accessTokenLeewayMs window)
5. NSE constructs URL: "${portalUrl}/index.php?view=image&fid=alarm&eid=${eid}&token=${token}"
6. NSE downloads with URLSession.dataTask (subject to ATS — uses iosScheme: 'http' override
   from capacitor.config.ts where applicable, plus self-signed handling via
   server-trust delegate that mirrors the existing ssl-trust plugin's TOFU fingerprint).
7. NSE writes the image to a temp URL, sets bestAttemptContent.attachments = [UNNotificationAttachment].
8. NSE sets bestAttemptContent.categoryIdentifier = "EVENT_TRIAGE" so the OS
   shows the action buttons defined for that category.
9. contentHandler(bestAttemptContent) — OS displays rich notification.
```

**Auth handoff details — the non-obvious part:**

- The JS layer must write the current ZM access token (and refresh timestamp) into the shared App Group on every `useTokenRefresh` cycle. This requires either: (a) extending the custom `ssl-trust` plugin pattern with a small native bridge that writes to `UserDefaults(suiteName: ...)` from Swift, or (b) a new lightweight Capacitor plugin (`plugins/native-bridge/`) that exposes `setSharedDefaults({key, value})`.
- Tokens written to the App Group are by definition exposed to any process the App Group covers. Acceptable because the access token is short-lived (ZM `access_token_expires`, default ~2h) and the App Group is gated by the app's signing identity. The refresh token must NOT be written there — keep it where it is (encrypted in localStorage / Keychain).
- Profile passwords stored in Keychain are NOT accessible from the NSE unless the Keychain item is created with `kSecAttrAccessGroup`. Avoid passwords entirely; the access token approach is sufficient.
- TLS trust: NSE has its own URLSession; it does not inherit the main app's accepted-cert state. Write the trusted cert SHA-256 fingerprint (`profileSettings.trustedCertFingerprint`) to the App Group too, then implement an NSURLSessionDelegate in Swift that enforces it (mirrors the existing `lib/ssl-trust.ts` TOFU model).
- Tauri/Android equivalents: Android FCM rich notifications use `BigPictureStyle` and can be handled by the existing app process' service (no separate extension needed) — easier. Tauri desktop has no rich-push concept; native-OS notifications via `tauri-plugin-notification` show plain text — accept the gap (functional-equivalent rule).

### Flow 2 — Action button round-trip (mark-reviewed / snooze / dismiss)

```
iOS:
1. User taps "Mark reviewed" on lock screen.
2. iOS delivers UNNotificationAction with identifier "MARK_REVIEWED" + userInfo
   { eid, mid, profile } to the app via UNUserNotificationCenter delegate.
3. @capacitor-firebase/messaging forwards this through its
   notificationActionPerformed listener → JS receives { actionId, notification }.
4. New listener (added in services/pushNotifications.ts) routes by actionId:
   - "MARK_REVIEWED" → useReviewedStore.getState().markReviewed(profileId, [eid])
   - "SNOOZE_MONITOR" → useTriageRulesStore.getState().setMonitorSnooze(profileId, mid, durationMs)
   - "DISMISS" → useNotificationStore.getState().markEventRead(profileId, eid)
5. If the app was killed and the action launched it: same listener fires after
   the app's standard bootstrap completes. The listener queues actions in
   memory until profile bootstrap is done, then drains the queue.
6. If the app remained backgrounded: the listener fires immediately and
   updates the store; persist middleware writes localStorage.
7. UI on next foreground reflects the updated reviewed set.

Android:
1. Same shape, but action buttons on Android are configured via the
   notification channel + RemoteInput. Capacitor Firebase Messaging
   exposes the same notificationActionPerformed event.
2. Optionally: an Android BroadcastReceiver can perform mark-reviewed
   without launching the app at all by writing directly to the same
   DataStore Glance reads. Out of scope for first cut — start with
   "wakes the JS layer" parity.
```

**Round-trip risk:** Capacitor Firebase Messaging's `notificationActionPerformed` event historically only fires reliably for taps that launch/foreground the app. "Silent" actions that don't open the app are platform-quirky. Recommend: first cut launches the app (reduces surface area, still keeps the user under 10 seconds), then iterate to silent actions.

### Flow 3 — Widget refresh (iOS WidgetKit + Android Glance)

```
iOS WidgetKit:
1. The app, on every event-store change or token refresh, calls
   QuickLookMobile.pushLatestEvent({eid, mid, monitorName, cause, score, ts, thumbnailURL}).
2. The Capacitor plugin's iOS implementation writes JSON to App Group UserDefaults.
3. Plugin calls WidgetCenter.shared.reloadAllTimelines().
4. WidgetKit asks the TimelineProvider for new entries.
5. TimelineProvider reads UserDefaults, returns a single-entry timeline
   (no future schedule — refresh is event-driven, not time-driven).
6. Widget view fetches the thumbnail with the same App Group token bundle
   used by the NSE (Flow 1, step 4-6).

Refresh budget:
- WidgetKit gives ~40-70 timeline reloads per widget per day on iOS 17+,
  enforced by the OS. Event-driven reload via reloadAllTimelines() is
  preferred over a scheduled TimelineProvider with frequent entries.
- Throttle: widgetSync only calls reloadAllTimelines() when the event
  timestamp is newer than the last-pushed timestamp.

Android Glance:
1. The plugin writes new event JSON to a Glance DataStore.
2. Calls QuickLookWidget.update(context, glanceId).
3. Glance composes the widget view; image fetch happens inside Glance via
   coil-glance with an OkHttp client that reads the auth bundle from the
   same DataStore.

Refresh budget:
- Android allows widget update intervals as low as 30 minutes via
  AppWidgetProviderInfo.updatePeriodMillis; event-driven updates have
  no quota limit. Push-driven updates from FCM (when the app is alive)
  are immediate.
```

### Flow 4 — Quiet-hours suppression (multi-layer)

Quiet hours suppress at the app layer, not the OS layer, for a reason: server-side filtering is out of scope, and OS-layer DND mode is system-wide and the user may not want to silence everything. The model: ZM still fires events, the user still receives FCM, but the app's foreground/background handler decides not to display.

```
Foreground (app open):
1. NotificationHandler receives WS event from ZMNotificationService.
2. Calls evaluate(event, rules, Date.now()) from lib/triage-predicate.ts.
3. Verdict 'silent' → store the event in useNotificationStore with read: false,
   suppress toast (do not call sonner.toast), do not update badge count,
   do not call widgetSync.pushLatestEvent.
4. Verdict 'priority' → call sonner.toast with priority styling (loud), update
   badge count, push to widget.
5. Verdict 'show' → existing path unchanged.

Background push (app killed/backgrounded):
1. FCM payload arrives. iOS NSE / Android FirebaseMessagingService receive it.
2. NSE/MessagingService reads triage rules from App Group / DataStore.
3. NSE re-implements evaluate() in Swift (or, simpler: iOS NSE always lets
   the notification through and the app-on-foreground handler later marks it
   silent in the store. Lock-screen noise tradeoff — accept for v1, refine
   if user complaint).
4. Android: FirebaseMessagingService can suppress display by NOT calling
   notificationManager.notify() when evaluate returns 'silent'. This is the
   recommended starting point on Android.

Channel/DND interaction:
- Android: still create per-priority notification channels (default,
  priority, silent) so the user can also use system-level channel toggles.
  evaluate() picks the channel; OS handles channel DND interplay.
- iOS: use UNNotificationInterruptionLevel (.timeSensitive for priority,
  .passive for silent) on iOS 15+. .timeSensitive can pierce Focus modes
  if the user enables it.
```

### Flow 5 — Event filter bar (existing pattern, extended)

```
1. Events page mounts; useEventFilterBar reads
   profileSettings.eventsPageFilters (extended with new keys).
2. User changes a filter chip → updates partial settings via
   updateProfileSettings — already debounced by existing settings store.
3. useEventFilters (existing hook) recomputes the events query key:
   ['events', profileId, monitorIds, tagIds, startDate, endDate,
    minScore, causeExclude, objectClasses, reviewedFilter].
4. React Query refetches via api/events.ts; existing pagination and
   bandwidth-aware refetchInterval untouched.
5. Reviewed-state filter is post-fetch: events come back from ZM
   unfiltered for reviewed-state (server doesn't know), then the
   page applies useReviewedStore.profileReviewed[profileId] as a
   client-side filter. This must happen BEFORE virtualization to
   avoid empty rows.
```

### Flow 6 — Event reviewed state, with optional ZM-tag mirror

```
Local-only path (default):
1. User taps "mark reviewed" on EventCard.
2. useReviewedStore.markReviewed(profileId, [eventId]) updates the store.
3. persist middleware writes localStorage.
4. UI re-renders with EventReviewedChip.

Cross-device path (opt-in via setting "Sync reviewed state to ZoneMinder tags"):
5. lib/reviewed-sync.ts subscribes to reviewed-store changes.
6. On mark, calls existing api/tags.ts to ensure a tag named "reviewed"
   exists for this profile (cached after first lookup).
7. POSTs the eventId↔tagId association via the existing tag-event endpoint.
8. On other devices, useReviewedStore subscribes to incoming WS events
   and to tag changes (next reviewed-sync interval), reconciles local
   set with server tags.

Why ZM tags as the sync mechanism:
- ZoneMinder server changes are out of scope; tags are an existing API.
- The app already imports api/tags.ts with extractUniqueTags and
  getEventTags helpers (verified in app/src/api/tags.ts).
- "reviewed" is just another tag from ZM's perspective — no schema change.

Why opt-in, not default:
- Sync introduces a write on every mark; users with slow servers
  feel it. Local-only is instant.
```

## Suggested Build Order

Build in this sequence so each capability stands alone but compounds. Dependencies are stated.

| # | Capability | Depends on | Why this order |
|---|------------|------------|----------------|
| 1 | **Reviewed state (local-only)** | nothing | Foundation. Filter and search query the reviewed set; rich-push action buttons mutate the reviewed set; widget surfaces highlight unreviewed events. Ship first so everything else can read it. Mirrors `eventFavorites.ts` pattern → low risk. |
| 2 | **Event noise filter (alarm score + cause text)** | (1) for the reviewed filter chip | Pure UI + extension of existing `eventsPageFilters` settings key. No new infrastructure. Lands the "stop nagging" win on existing list views immediately. |
| 3 | **Event quick-search bar** | (1), (2) | Composes (1) and (2) into one filter bar component on the Events page. UI consolidation; adds date-range presets and class chips. |
| 4 | **Per-monitor priority + quiet hours (app-layer)** | nothing structural; reuses (1) for "skip reviewed in priority count" | Add `triageRules` store + `triage-predicate.ts` + integration into `NotificationHandler` foreground path and `pushNotifications` JS-layer foreground listener. **Ship before rich push** — once rich push lands, suppression has more places to live and more chances to drift. |
| 5 | **Rich push (thumbnail + action buttons)** | (1) for action button targets; (4) for predicate definition; new App Group + native-bridge plugin for token handoff | Highest implementation surface (NSE, Android NotificationCompat with BigPictureStyle, action handlers). Schedule a feasibility spike on iOS NSE auth handoff before committing the phase. |
| 6 | **Quick-look surfaces (widget / tray / dock)** | (1), (4), (5) — same auth bundle and native bridge. Web/PWA QuickLook can ship alongside (1) earlier with no native dependency | iOS WidgetKit + Android Glance + Tauri tray are three separate native efforts. The web/Tauri-window dashboard widget can ship as soon as (1) is done; mobile widgets ride the native-bridge plumbing established in (5). |

**Dependency rationale (why "reviewed state lands first" matters):**
- Filter (2) needs a "reviewed" predicate to filter on.
- Search (3) groups all filters; reviewed is one chip.
- Rich-push action button "Mark reviewed" (5) writes into the reviewed store.
- Widget "latest unreviewed event" (6) reads from the reviewed store.
- If reviewed lands last, four other features ship with placeholder behavior and need rework.

## Per-Capability Platform Support Matrix

| Capability | Web | iOS Capacitor | Android Capacitor | Tauri Desktop | Notes |
|------------|-----|---------------|-------------------|---------------|-------|
| 1. Reviewed state | full | full | full | full | Pure JS; persists in localStorage on all platforms |
| 2. Noise filter | full | full | full | full | Pure JS settings + query key |
| 3. Quick-search bar | full | full | full | full | Pure JS; touch targets sized for phones |
| 4a. Per-monitor priority | full | full | full | full | App-layer routing via predicate |
| 4b. Quiet hours (foreground) | full | full | full | full | Predicate suppresses sonner + badge |
| 4c. Quiet hours (background push) | n/a (no push) | partial — see Flow 4 | full — message service drops | n/a | Web has no FCM; Tauri has no push integration |
| 5a. Rich push thumbnail | n/a | full (NSE + App Group + ssl-trust) | full (BigPictureStyle in service) | n/a | Tauri desktop notifications are text-only via `tauri-plugin-notification` |
| 5b. Action buttons | n/a | full (UNNotificationCategory + actions) | full (NotificationCompat actions) | partial — Tauri tray menu items can offer "mark reviewed" on the cached latest event | |
| 6a. Home-screen widget | n/a | full (WidgetKit) | full (Glance) | n/a | |
| 6b. Menu-bar / tray quick-look | n/a | n/a | n/a | full (`tauri-plugin-positioner`/`TrayIcon`) | |
| 6c. PWA / web dock | full (Dashboard widget) | n/a (Capacitor uses native widget) | n/a | full (also visible in app window) | The "functional equivalent" — Dashboard QuickLookWidget on web + Tauri |

## Anti-Patterns

### Anti-Pattern 1: Putting reviewed state in `useNotificationStore.markEventRead`

**What people do:** Reuse the existing `markEventRead` action because it's "sort of like reviewed."
**Why it's wrong:** `markEventRead` tracks whether the user has *seen the notification banner*, scoped per notification delivery. "Reviewed" tracks whether the user has *acknowledged the underlying ZM event*, scoped per event id. They diverge: a user can see a notification (read) but not yet decide if it matters (reviewed); the same event can fire multiple notifications.
**Do this instead:** New `useReviewedStore` keyed by event id. Keep `markEventRead` as-is.

### Anti-Pattern 2: Hardcoding the FCM payload contract in the NSE

**What people do:** NSE Swift code reads `mid`/`eid`/`monitorName`/`cause` directly from the FCM dictionary.
**Why it's wrong:** `pushNotifications.ts` already documents two payload shapes (ES format and ZM direct mode — see `PushNotificationData` interface, lines 27-40). Duplicating that knowledge in Swift drifts.
**Do this instead:** Use a single canonical key set in the FCM payload. If the server sends both shapes, normalize to one before NSE writes — but the current code reads both shapes only on the JS side. The NSE only needs `eid` + a thumbnail URL; have zmeventnotification format the URL once and pass it as `attachment_url` so NSE doesn't do URL building.

### Anti-Pattern 3: Server-side filtering for the noise filter

**What people do:** Try to push score/cause filters into the ZM events API query.
**Why it's wrong:** ZM `/events.json` supports limited filter shapes; cause-text filtering is fragile across ZM versions, and we explicitly carved server changes out of scope.
**Do this instead:** Fetch with the existing date/monitor/tag filters, apply score/cause/class filters client-side before virtualization. ZoneMinder event volumes per page are bounded by `defaultEventLimit`; client-side filtering is fine.

### Anti-Pattern 4: A widget that polls ZM directly on its own timer

**What people do:** TimelineProvider hits ZM `/events.json` every 15 minutes.
**Why it's wrong:** Burns the WidgetKit refresh budget, runs without bandwidth-mode awareness (rule #8), and duplicates auth.
**Do this instead:** Widget is a passive view of the App Group / DataStore. JS app pushes updates on event arrival via `widgetSync.ts`; widget reloads its timeline only when pushed.

### Anti-Pattern 5: Static import of `tauri-plugin-positioner` / Tauri tray crate

**What people do:** `import { TrayIcon } from '@tauri-apps/api/tray'` at the top of a shared module.
**Why it's wrong:** Pulls Tauri-only code into the web bundle. Mirrors the static Capacitor anti-pattern.
**Do this instead:** Wrap in `if (Platform.isTauri) { const { TrayIcon } = await import('@tauri-apps/api/tray'); … }`.

### Anti-Pattern 6: Shared mutable state between the JS app and the iOS NSE

**What people do:** Write a JSON object to App Group that the JS layer mutates on event arrival and the NSE reads while it's mid-write.
**Why it's wrong:** No locking primitive across processes. NSE may read a torn write.
**Do this instead:** Atomic writes only (write whole UserDefaults entries; UserDefaults serializes by suite). Never mutate sub-fields of a serialized blob; always replace the whole entry.

## Integration Points

### External Services (existing, extended)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| ZoneMinder REST API | Existing api/events.ts (unchanged), api/tags.ts (used by reviewed-sync), api/notifications.ts (token registration unchanged) | No new endpoints; reviewed-sync writes existing tag-event associations only |
| zmeventnotification.pl | Existing WS via services/notifications.ts | Out of scope to modify; client-only milestone. The FCM payload it sends already includes mid/eid/cause; thumbnail URL must already be reachable (it is — `index.php?view=image&fid=alarm&eid=...`) |
| Firebase Cloud Messaging | Existing `@capacitor-firebase/messaging` 7.5.0 | Add `mutable_content: 1` (iOS) and `notification.image` (Android) to the server-side payload — but server is out of scope. Workaround: NSE always runs and reconstructs the thumbnail URL from `eid` even if `attachment_url` is missing, using the App Group portalUrl |

### Internal Boundaries (new)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| JS app ↔ App Group / DataStore | Capacitor plugin `quick-look-mobile` | Single bridge; all native-surface data flows through it |
| JS app ↔ Tauri tray | Tauri commands (`set_tray_event`, `clear_tray_event`) | Defined in `app/src-tauri/src/tray.rs`; registered in `lib.rs::run` |
| Notification listener ↔ stores | Direct `useStore.getState()` calls in `services/pushNotifications.ts` | Existing pattern (lines 13-15); add `useReviewedStore` and `useTriageRulesStore` to imports |
| Predicate ↔ NSE | Replicated in Swift; rules read from App Group | Predicate logic small enough to maintain in two places; document the contract in `lib/triage-predicate.ts` JSDoc |

## Risks / Open Questions

These are surfaced for the planner to resolve before each phase commits.

1. **iOS NSE auth handoff feasibility.** Can the existing custom Capacitor plugins (`ssl-trust`, `pip`) extend with an App Group writer, or does this need a new `native-bridge` plugin? Spike: 2 days. **Blocker for capability 5.**
2. **Capacitor Firebase Messaging notificationActionPerformed reliability when app is killed.** Documented community issues exist; verify behavior on iOS 17+ and Android 14+ before committing action button UX. Spike: 1 day. **Blocker for capability 5b.**
3. **WidgetKit refresh budget under heavy event load.** A user with 30 cameras + many events will overflow the 40-70/day budget if we naively reload on every event. Need throttling rule (debounce 60s, drop intermediates). **Tunable post-launch.**
4. **Android Glance vs legacy RemoteViews.** Glance requires Android 12+ for the latest features. Min-SDK in `app/android/variables.gradle` needs verification. **Investigation, not blocker.**
5. **Tauri tray on Linux.** AppIndicator support on Wayland-only desktops is partial. Falls back to a window-mode quick-look. **Functional-equivalent already accommodates.**
6. **Duplicate predicate logic JS↔Swift.** Risk of drift. Mitigation: keep rules small (score floor, monitorIds set, cause excludes, quiet-hours window — all serializable as JSON). Add a unit test in `lib/__tests__/triage-predicate.test.ts` and a Swift unit test that asserts identical verdicts for a fixture set. **Process risk, not architectural.**
7. **Reviewed-state cardinality.** Storing all reviewed event IDs forever grows localStorage unboundedly. Mitigation: cap at last N (e.g., 5000) per profile, drop oldest. **Tunable; default value to confirm with planner.**
8. **Quiet-hours timezone.** Use the user's device timezone or the ZM server timezone? `api/time.ts` exposes server tz. Recommend device tz (matches user's lived experience), surface server-tz in settings as info. **Decision needed before capability 4 ships.**

## Build/CI Implications

- **Capacitor plugin mocks.** Each new plugin (`quick-look-mobile`, optional `native-bridge`) needs a mock added to `app/src/tests/setup.ts` per rule #14.
- **iOS targets in CI.** `.github/workflows/build-ios.yml` (if present) and the iOS build chain (`scripts/test-ios.sh`) must add the NSE and WidgetKit targets. Each target compiles separately; build time grows ~30%.
- **Android Glance dependency.** Add `androidx.glance:glance-appwidget` to `app/android/app/build.gradle`; verify min-SDK aligns with current `android/variables.gradle`.
- **Tauri tray crate.** Add to `app/src-tauri/Cargo.toml`; per rule #16, the matching JS package version (if any — `@tauri-apps/api` already covers `tray`) must be pinned together. `scripts/check-tauri-versions.js` already validates this.
- **`tauri-plugin-notification`.** Optional for capability 4 background path on Tauri; if added, JS+Rust pair locked.
- **Visual regression baselines.** Each new component (`EventReviewedChip`, `EventFilterBar`, `QuickLookWidget`) needs `@visual` E2E coverage with per-platform baselines under `app/tests/screenshots/`.
- **i18n.** Every new user-facing string ships in en/de/es/fr/zh per rule #5. Labels for action buttons must fit iOS lock-screen width and Android notification action constraints — short verbs only ("Reviewed", "Snooze", "Dismiss" / equivalents).
- **`data-testid` coverage.** New interactive elements get `data-testid` per rule #13; e2e features tagged appropriately.
- **Documentation.** Per rule #4, update `docs/developer-guide/05-component-architecture.rst` (new components/hooks), `07-api-and-data-fetching.rst` (reviewed-sync uses tags API), and `12-shared-services-and-components.rst` (`triage-predicate`, `quietHoursGate`, `widgetSync`, `quick-look-mobile` plugin).

## Sources

- Existing codebase: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/STACK.md`, `.planning/codebase/STRUCTURE.md` (all dated 2026-04-26)
- Verified files: `app/src/services/pushNotifications.ts` (FCM listener pattern, payload shape lines 27-40), `app/src/services/notifications.ts` (WS service shape), `app/src/stores/eventFavorites.ts` (per-profile persisted-set pattern), `app/src/stores/notifications.ts` (existing markEventRead distinction, lines 18-40, 76), `app/src/stores/settings.ts` (eventsPageFilters extension point, lines 87-95), `app/src/api/notifications.ts` (token register/update/delete surface), `app/src/api/tags.ts` (existing tag CRUD), `app/capacitor.config.ts` (presentationOptions, scheme overrides), `app/src/lib/zmninja-ng-constants.ts` (BANDWIDTH_SETTINGS extension point), `app/src/plugins/ssl-trust/` and `app/src/plugins/pip/` (custom Capacitor plugin layout precedent)
- AGENTS.md rules referenced: 5 (i18n), 7 (profile-scoped settings), 8 (bandwidth), 9 (logger), 10 (HTTP), 13 (data-testid), 14 (dynamic Capacitor imports), 16 (Tauri version pairs), 24 (date/time format)
- iOS NSE / WidgetKit / App Group patterns: Apple developer documentation conventions widely documented; specific NSE auth-handoff via App Group is standard practice for image-attachment FCM extensions. Confidence MEDIUM until the spike confirms the existing custom-plugin pattern carries the App Group write.

---
*Architecture research for: zmNinjaNg "10-Second Triage" milestone (subsequent — established codebase)*
*Researched: 2026-04-26*
