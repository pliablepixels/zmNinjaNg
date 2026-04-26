# Project Research Summary

**Project:** zmNinjaNg — 10-Second Triage milestone
**Domain:** Cross-platform self-hosted NVR client — rich push, home-screen widgets, event triage UX
**Researched:** 2026-04-26
**Confidence:** MEDIUM-HIGH (HIGH for in-app capabilities, MEDIUM for iOS NSE auth handoff and widget integration, LOW for web push delivery)

---

## HEADLINE RECOMMENDATION

Ship the milestone in the dependency-constrained order documented below. The foundation is a **reviewed-state store + filter bar** (pure JS, low risk) that everything else reads. Rich push and native widgets are the high-risk items; schedule the iOS NSE auth-handoff spike before committing Phase 4 scope, and treat mobile widgets as the item most likely to slip to a v1.x follow-up.

Do NOT request the iOS Critical Alerts entitlement in this milestone. See "Cross-doc contradictions" below for the FCM payload-contract issue that requires a user decision before Phase 4 can be fully designed.

---

## Executive Summary

zmNinjaNg is a brownfield React 19 / Capacitor 7 / Tauri 2 application already shipping FCM push and WebSocket event delivery on five platforms. The 10-Second Triage milestone adds the six capabilities that close the gap with commercial NVR clients (Ring, UniFi Protect, Eufy): rich push with thumbnail and action buttons, a "reviewed" event state, a consolidated filter/search bar, per-monitor notification routing with quiet hours, and home-screen quick-look surfaces per platform. None of these require ZoneMinder server changes in their baseline form — with one exception detailed in the contradictions section below.

The recommended approach builds from the inside out. Client-side state (reviewed store, triage rules, filter bar) ships first because four other features depend on reading those stores. Rich push and native quick-look surfaces ship last because they require platform-native code (iOS Notification Service Extension, WidgetKit extension, Android Glance widget) outside the Capacitor JS bundle and carry the highest implementation risk. The Tauri tray and web top-bar dock can ship alongside the filter bar phase because they reuse the existing in-process WebSocket and have no native-extension dependency.

The two risks that could derail the milestone are: (1) the iOS NSE authentication handoff — the extension runs out-of-process and cannot use the main app's ssl-trust plugin or Keychain without an App Group entitlement and a new lightweight native bridge, and (2) Android OEM-aggressive battery management (Xiaomi, Realme, Oppo, Samsung One UI deep sleep) which silently drops data-only FCM payloads and requires a hybrid notification+data payload shape that currently depends on `zmeventnotification.pl` being configured to send that shape. This is the FCM payload contract issue the user must decide on; see the decision points below.

---

## BUILD ORDER WITH DEPENDENCIES

The following order is agreed across all three architecture documents (ARCHITECTURE.md, FEATURES.md, PITFALLS.md):

```
Phase 1: Reviewed state (local-only)
    └── unblocks everything else that reads or writes reviewed status

Phase 2: Noise filter + quick-search bar + Tauri tray + web dock
    └── depends on (1) for the "reviewed" filter chip
    └── Tauri tray + web top-bar dock ship here (WebSocket already exists, no native extension needed)

Phase 3: Per-monitor priority + quiet hours (app-layer)
    └── depends on (1) for "skip reviewed in priority count"
    └── MUST define Android channel set here (immutable after first push — Pitfall 4)
    └── must ship before rich push — more suppression sites once push lands

Phase 4: Rich push (iOS NSE + Android NotificationCompat + action buttons)
    └── depends on (1) for "mark reviewed" action target
    └── depends on (3) for predicate definition and channel routing
    └── requires App Group native bridge (new plugin or extended ssl-trust)
    └── requires 2-day NSE auth-handoff spike before committing scope

Phase 5: Home-screen quick-look (iOS WidgetKit + Android Glance)
    └── depends on (4) for the auth bundle and App Group plumbing already built
    └── web/Tauri dock already shipped in Phase 2
    └── mobile widgets are the item most likely to slip to v1.x
```

**Why this order matters:**

- Reviewed state lands first or four other features ship with placeholder behavior and need rework.
- Per-monitor priority + quiet hours lands before rich push: once push is live there are more suppression sites to keep in sync.
- Android notification channels must be designed in Phase 3 and locked before Phase 4 first push. Channel importance is immutable after creation — a wrong default cannot be changed without minting a new channel ID and a user-visible migration.
- The web top-bar dock and Tauri tray are the cheapest surfaces and have no native dependency; schedule them in Phase 2 to deliver visible value early.

---

## KEY FINDINGS

### Stack

The delta stack above the existing codebase is small and version-constrained by `@capacitor/core` 7.4.4:

| Technology | Version | Status |
|------------|---------|--------|
| `@capacitor-firebase/messaging` | 7.5.0 | Already installed; do not upgrade to 8.x |
| `@capacitor/local-notifications` | 7.0.6 | NEW — last Capacitor-7-compatible release |
| `capacitor-widget-bridge` (kisimedia fork) | 7.0.0 | NEW — only Capacitor-7 line release; iOS + Android bridge |
| iOS Notification Service Extension | Swift, no plugin | NEW Xcode target in `app/ios/App/NotificationService/` |
| iOS WidgetKit extension | Swift, no plugin | NEW Xcode target in `app/ios/App/QuickLookWidget/` |
| Android Glance app widget | `androidx.glance:glance-appwidget:1.1.1` | NEW Kotlin module in `app/android/` |
| `tauri-plugin-notification` + `@tauri-apps/plugin-notification` | 2.3.3 (both) | NEW; JS+Rust pair must stay version-locked per AGENTS.md rule 16 |
| Tauri built-in tray-icon API | Tauri 2.10.2 (already installed) | Built-in; no new dep |

The 8.x line of every Capacitor plugin requires Capacitor 8 and cannot be used. The `kisimedia` fork of `capacitor-widget-bridge` is one-author and may need to be vendored into `app/src/plugins/widget-bridge/` if it goes unmaintained — the existing in-repo `ssl-trust` and `pip` plugin pattern is the documented fallback.

**What NOT to install:** `@capacitor/push-notifications` (duplicates FCM plugin), `@capacitor-firebase/messaging 8.x` (wrong Capacitor version), iOS Live Activities (wrong data model for discrete ZM events), iOS Critical Alerts entitlement (App Store rejection risk — see contradictions).

### Features

**Must-have (table stakes — zmNinjaNg ships none of these today):**

| Feature | Complexity | Phase |
|---------|------------|-------|
| Push notification with thumbnail | M | 4 |
| Push action buttons (mark reviewed / snooze / dismiss) | M | 4 |
| Event "reviewed" state + bulk mark | M | 1 |
| Filter by detection class / cause text | S–M | 2 |
| Filter by alarm score range | S | 2 |
| Quick date-range presets on events list | S | 2 |
| Per-monitor notification priority + mute | M | 3 |
| Quiet-hours window | S | 3 |

**Should-have (differentiators):**

- Single filter bar composing date + monitor + class + score + reviewed (Phase 2)
- Tauri menu-bar / system-tray quick-look (Phase 2; genuine differentiator — no Frigate or UniFi Protect desktop equivalent)
- Web top-bar event dock inside open tab (Phase 2)
- iOS + Android home-screen widget reading from the user's own ZM server (Phase 5; not cloud-bound unlike Ring/Eufy/UniFi equivalents)
- Snooze monitor from the push itself (Phase 4, given action buttons)
- Notification History badge synced with reviewed state (Phase 2 stretch)

**Defer to v1.x or later:**

- Free-text cause search (cheap once filter bar exists)
- Multi-server bulk-mark-reviewed across profiles
- Server-side cause/class filter pushdown to ZM API
- ZM-tag-backed cross-device reviewed sync (opt-in; no schema change needed but involves server writes)

**Anti-features (out of scope):** cloud event sync, AI digests, geofencing, Apple Watch / WearOS.

### Architecture

New modules attach at five seams in the existing layered architecture without replacing any layer:

**New Zustand stores (profile-scoped, persisted — model on `eventFavorites.ts`):**
- `stores/reviewed.ts` — per-profile reviewed event ID set
- `stores/triageRules.ts` — alarm-score floor, cause excludes, per-monitor priority, quiet-hours windows, snooze state

**New services:**
- `services/quietHoursGate.ts` — pure suppression predicate; three JS call sites (foreground toast, FCM foreground handler, widget sync)
- `services/widgetSync.ts` — pushes latest event + auth bundle to native surfaces; dynamic-imported on native only

**New hooks:** `useReviewedState`, `useEventFilterBar`, `useQuietHours`

**New components:** `EventReviewedChip`, `EventFilterBar`, `BulkReviewedToolbar`, `QuietHoursSection`, `PriorityRulesSection`, `QuickLookWidget` (web/Tauri window)

**New native targets (outside JS bundle):**
- iOS NSE (`app/ios/App/NotificationService/`) — fetches thumbnail, attaches to FCM payload, reads auth from App Group
- iOS WidgetKit (`app/ios/App/QuickLookWidget/`)
- Android Glance widget (`app/android/app/src/main/java/.../widget/`)
- Tauri tray (`app/src-tauri/src/tray.rs`)

**Key pattern: pure predicate in `lib/triage-predicate.ts`.** Quiet-hours and routing logic must run identically in three JS contexts and must be replicated in Swift for the iOS NSE. Keep rules small and serializable as JSON; unit-test both TS and Swift versions against the same fixture set to prevent drift.

**Filter state stays in `profileSettings.eventsPageFilters`** — not a parallel store. Add `minScore`, `causeExclude`, `objectClasses`, `reviewedFilter` to the existing key (verified extension point at `app/src/stores/settings.ts:88-95`).

### Critical Pitfalls (Top 5 of 15)

1. **FCM payload bypasses the iOS NSE** — `zmeventnotification.pl` may send a `notification`-type payload without `mutable-content: 1`, in which case the NSE never runs and the user sees plain text with no thumbnail and no action buttons. On Android, `notification`-type auto-display drops `data` fields when the app is killed. **Prevention:** hybrid `notification`+`data` payload with `mutable-content: 1` on the APNs override. See Contradiction 1 below.

2. **Android notification channels are immutable after creation** — Importance, sound, and vibration cannot be changed once a channel exists. Shipping a wrong default locks all v1.0 installs forever. **Prevention:** design the full four-channel set (`zmng.event.critical`, `zmng.event.normal`, `zmng.event.quiet`, `zmng.event.silent_summary`) in Phase 3 before any push lands.

3. **iOS NSE OOM at 24 MB** — Full-resolution camera frames (2-4 MP JPEG, 8-16 MB decoded) will exceed the extension memory ceiling on iPhone SE-class devices. **Prevention:** download via `URLSession` directly to a temp file and pass the file URL to `UNNotificationAttachment` without decoding into memory; hard-cap download at 6 MB.

4. **Quiet hours implemented as "skip notify()"** — On Android, not calling `notify()` for a high-priority FCM causes the system to gradually downgrade FCM priority over days/weeks, resulting in 30-90 second alert latency. **Prevention:** quiet hours is a channel routing decision, not a skip. Always call `notify()`; route to `zmng.event.quiet` (IMPORTANCE_LOW) during quiet windows.

5. **iOS Critical Alerts entitlement → App Store rejection** — General home-security apps have been rejected; the entitlement is reserved for medical/severe-weather/regulated-industry apps. **Prevention:** do not request it in this milestone. Use `interruptionLevel: .timeSensitive` as the top priority tier.

---

## CROSS-DOC CONTRADICTIONS AND RESOLUTIONS

### CONTRADICTION 1 — FCM PAYLOAD CONTRACT: server-side change required vs. milestone is "client-only"

**The conflict:**

PROJECT.md Out of Scope: *"ZoneMinder server-side or `zmeventnotification.pl` configuration changes — milestone is client-only."*

STACK.md, ARCHITECTURE.md, and PITFALLS.md all agree that the full rich-push experience (iOS NSE invocation, Android killed-app action buttons) requires the FCM payload to include:
- `mutable-content: 1` in the APNs override block
- a `data` block alongside the `notification` block
- a reconstructable thumbnail reference (`attachment_url` or `eid`+`portalUrl`)

The current `zmeventnotification.pl` payload (two shapes documented in `pushNotifications.ts` lines 27-40) is not guaranteed to include `mutable-content: 1` or a usable thumbnail URL by default.

**This failure is silent.** If the payload is wrong, every iOS user gets a plain text push — the core Phase 4 deliverable is dead on real devices with no obvious error.

**Recommended resolution — requires user decision:**

- **Option A (strictly client-only + graceful degradation):** NSE attempts thumbnail fetch using `eid` + App-Group portalUrl reconstruction. If the server sends a `notification`-only payload, the NSE silently falls back to plain text. Ship a "your push is not enriched — tap to configure" prompt in NotificationSettings documenting the required server config for operators. Rich push works fully for operators who configure it; degrades gracefully for those who don't.

- **Option B (include payload-contract documentation as in-scope):** Treat a configuration guide / `zmeventnotification.pl` setup doc as part of the milestone. No code change to ZM itself. The client implementation is identical; the milestone additionally ships documentation that operators must act on to get the full experience.

**FLAG FOR USER: This is the one cross-cutting decision that affects Phase 4 scope and the milestone completion definition. Which option?**

---

### CONTRADICTION 2 — iOS Critical Alerts: STACK.md neutral → PITFALLS.md says drop

**Conflict:** STACK.md describes the Critical Alerts path neutrally as an option. PITFALLS.md (Pitfall 6) says clearly: do not request it; Apple has rejected general-purpose home security apps.

**Resolution (no user decision needed):** Follow PITFALLS.md. Use `interruptionLevel: .timeSensitive` as the maximum priority tier. Add to PROJECT.md Out of Scope: *"iOS Critical Alerts entitlement — deferred; Apple's current policy rejects general home-security submissions. Revisit with a narrower safety-specific justification if a future milestone introduces an Alarm-state panic feature."*

---

### CONTRADICTION 3 — Live Activities: STACK.md defers, PROJECT.md is silent

**Conflict:** STACK.md explicitly defers Live Activities (correct reasoning: ZM events are discrete, not continuous; the lifecycle doesn't fit). PROJECT.md doesn't mention Live Activities.

**Resolution:** Add to PROJECT.md Out of Scope: *"iOS Live Activities — deferred; ZoneMinder events are discrete and terminal, not continuous. ActivityKit's start→update→end lifecycle doesn't map to a motion event. Revisit if a future milestone introduces server-supplied ongoing-event semantics."*

---

### CONTRADICTION 4 — Web push: PROJECT.md says "PWA push where supported", PITFALLS.md says push is unreliable on web

**Conflict:** PROJECT.md Active requirements include *"web top-bar dock or PWA push where supported."* PITFALLS.md (Pitfall 11) documents that web push delivers to fewer than ~10% of web users in practice.

**Resolution:** Reframe the web surface. The primary web quick-look is the in-tab top-bar dock driven by the existing WebSocket. PWA push is a best-effort enhancement, labeled as such. Adjust PROJECT.md Active requirement: *"Web top-bar dock (in-tab, WebSocket-driven) — primary web quick-look surface. Web Push / PWA push — best-effort enhancement for users who install the PWA; document that browser delivery is not guaranteed."*

---

## DECISION POINTS (user must resolve before requirements scoping)

Items 1 and 2 are blocking for their respective phases.

**1. FCM payload contract — BLOCKING for Phase 4 scope**
Does the milestone include documenting the required `zmeventnotification.pl` payload configuration for operators (Option B), or does rich push degrade silently for unconfigured servers (Option A)?

**2. Android notification channel set — BLOCKING for Phase 3 implementation**
The four-channel defaults must be finalized before Phase 3 ships because the first push in Phase 4 locks them. Channel names and importance levels need approval: `zmng.event.critical` (IMPORTANCE_HIGH), `zmng.event.normal` (IMPORTANCE_DEFAULT), `zmng.event.quiet` (IMPORTANCE_LOW), `zmng.event.silent_summary` (IMPORTANCE_MIN).

**3. Quiet-hours timezone — needed before Phase 3 UI design**
Store rules with an explicit timezone (`{ start, end, tz: "America/Los_Angeles" }`) or evaluate against device timezone? Recommended: explicit timezone at creation, defaulting to device timezone, with a UI "use current device tz" toggle.

**4. Reviewed-state default on upgrade — needed before Phase 1 ships**
When the reviewed store is empty on upgrade, treat existing notification history as `reviewed: true` (no badge spike, recommended) or `reviewed: false` (badge shows full unread count)?

**5. Mobile widget scope in milestone definition — affects completion criteria**
Are iOS WidgetKit + Android Glance in the milestone completion definition, or are they a stretch goal with Tauri tray + web dock defining "done"? Recommended: include mobile widgets but give them the last slot with the most generous schedule; if they slip, v1.x.

---

## TOP 5 RISKS

| Risk | Impact | Mitigation |
|------|--------|------------|
| iOS NSE auth handoff is harder than expected | Phase 4 blocked | 2-day feasibility spike before committing Phase 4. If App Group writer can't attach to existing ssl-trust plugin, a new lightweight `native-bridge` plugin is the fallback (~150 LOC per platform; existing pip/ssl-trust plugins are the precedent). |
| FCM payload from operator's server lacks `mutable-content: 1` | iOS rich push silently dead for all users | NSE graceful-degrade path (reconstruct from `eid`+portalUrl) + "not enriched" prompt in NotificationSettings. See Decision Point 1. |
| Android channel importance locked at wrong default | Per-monitor routing broken for all v1.0 installs | Design the four-channel set in Phase 3 and lock before Phase 4. See Decision Point 2. |
| Mobile widget scope exceeds the 2-4 week window | Milestone ships incomplete | Gate "milestone complete" on Tauri tray + web dock. Mobile widgets are last phase, first to slip. |
| `capacitor-widget-bridge` (kisimedia fork) goes unmaintained | Phase 5 widget bridge breaks | Vendor it to `app/src/plugins/widget-bridge/` — one-day task using the existing ssl-trust/pip plugin pattern. |

---

## Implications for Roadmap

### Phase 1: Reviewed State Foundation
**Rationale:** Zero native dependencies; mirrors `eventFavorites.ts` shape — lowest risk item. Everything else reads or writes reviewed status.
**Delivers:** `stores/reviewed.ts`, `useReviewedState` hook, `EventReviewedChip`, bulk-mark toolbar, reviewed filter chip, badge counter update.
**Avoids:** Reusing `markEventRead` (wrong semantics); phantom-unread race (Pitfall 15 — schema defined here).
**Research flag:** Standard patterns; no deeper research needed.

### Phase 2: Filter Bar + Noise Reduction + Quick-Look Surfaces (Tauri + Web)
**Rationale:** Pure JS extension of existing `EventsFilterPopover`. Tauri tray + web dock ship here — they reuse the existing WebSocket and have no native dependencies. Delivers visible quick-look value before mobile widget work begins.
**Delivers:** `EventFilterBar` (score slider, cause chips, date presets, reviewed toggle), `triageRules.ts` (score/cause portion), Tauri `tray.rs` quick-look, web `QuickLookWidget.tsx` top-bar dock.
**Avoids:** Server-side filter pushdown (anti-pattern 3); missing "active filter" banner (UX pitfall); Tauri tray click semantics differ per OS (Pitfall 10 — use the three-OS handler pattern).
**Research flag:** Tauri tray click semantics are fully documented in PITFALLS.md; no research phase needed.

### Phase 3: Per-Monitor Priority + Quiet Hours
**Rationale:** Must ship before rich push so the predicate exists at all suppression sites. Must lock the Android channel set here — immutable after first push.
**Delivers:** `triageRules.ts` (complete), `lib/triage-predicate.ts`, `quietHoursGate.ts`, NotificationSettings additions (QuietHoursSection, PriorityRulesSection), Android four-channel layout registered at app start.
**Avoids:** Quiet-hours-as-skip-notify (Pitfall 8 — route to quiet channel, never return early); timezone bug (Pitfall 7 — store explicit tz at rule creation).
**Research flag:** Decision Point 3 (timezone) must be resolved before implementation starts.

### Phase 4: Rich Push (iOS NSE + Android NotificationCompat + Action Buttons)
**Rationale:** Highest native implementation surface. Gates on Phase 1 (reviewed store) and Phase 3 (predicate + channel set). NSE auth-handoff spike before committing scope.
**Delivers:** iOS NSE Xcode target, Android FCM service with BigPictureStyle + action buttons, `pushNotifications.ts` action listener routing, `@capacitor/local-notifications` quiet-hours rewrite, multi-profile push routing.
**Avoids:** NSE OOM (Pitfall 2 — file URL approach, 6 MB cap); credential leak in payload (Pitfall 3 — App Group keychain only, never in URL); OEM battery kills (Pitfall 14 — hybrid notification+data payload); multi-profile routing bug (Pitfall 12).
**Research flag:** iOS NSE auth handoff needs 2-day spike. Action button reliability on killed-app iOS 17+/Android 14+ needs 1-day verification before committing silent-action UX.

### Phase 5: Home-Screen Quick-Look (iOS WidgetKit + Android Glance)
**Rationale:** Requires App Group auth bundle built in Phase 4. Three separate native efforts. Mobile widgets are the item most likely to slip to v1.x.
**Delivers:** `plugins/quick-look-mobile/` Capacitor bridge, iOS WidgetKit extension, Android Glance widget, `services/widgetSync.ts`.
**Avoids:** WidgetKit budget exhaustion (Pitfall 9 — sparse timelines, push-driven `reloadAllTimelines`, no self-polling); static Capacitor/Tauri imports (AGENTS.md rule 14).
**Research flag:** Android Glance min-SDK alignment with `android/variables.gradle` needs verification before starting. iOS deployment target floor (must be ≥ 16.1 for WidgetKit) needs verification.

### Phase Ordering Rationale

- Reviewed state → filter bar reflects the dependency graph documented identically across all three research documents.
- Tauri tray + web dock belong in Phase 2 because they have no native-extension dependency and de-risk the milestone scope by delivering visible value early.
- Android channels belong in Phase 3, before Phase 4's first push, because channel importance is frozen after creation.
- Rich push in Phase 4 before widgets in Phase 5: the App Group auth bundle built for the NSE is the same bundle WidgetKit reads — build it once.

### Research Flags

Phases needing feasibility spikes or deeper investigation during planning:
- **Phase 4 (iOS NSE auth handoff):** 2-day spike to confirm App Group writer can attach to the existing ssl-trust plugin or needs a new `native-bridge` plugin.
- **Phase 4 (action button killed-app reliability):** 1-day verification on iOS 17+/Android 14+ before committing silent-action UX.
- **Phase 5 (Android min-SDK):** verify `compileSdk` + `minSdk` in `app/android/app/build.gradle` against Glance 1.1.1's `compileSdk 34+` requirement.

Phases with standard patterns (skip `/gsd-research-phase`):
- **Phase 1:** direct port of `eventFavorites.ts` — well-documented in codebase.
- **Phase 2:** extending existing `EventsFilterPopover`; Tauri tray click semantics fully covered in PITFALLS.md.
- **Phase 3:** standard Zustand + profile settings pattern; timezone handling covered by existing `date-fns-tz` dep.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack — plugin versions and version locks | HIGH | npm registry verified; Capacitor 7 constraint is hard |
| Stack — widget bridge (kisimedia fork) long-term | MEDIUM | One-author plugin; in-repo vendor path documented |
| Features — table stakes definition | HIGH | Verified against Frigate, UniFi Protect, Ring, Eufy official docs |
| Architecture — JS-layer components | HIGH | Direct extension of existing codebase patterns, verified in source |
| Architecture — iOS NSE auth handoff | MEDIUM | Standard Apple pattern but not yet verified against existing ssl-trust/pip plugin structure |
| Architecture — Android Glance integration | MEDIUM | GA library but no Glance code is in tree yet; learning-curve risk |
| Pitfalls — platform API constraints | HIGH | Apple/Google docs verified |
| Pitfalls — ZM-specific FCM payload shape | MEDIUM | Based on codebase reading of `pushNotifications.ts` lines 27-40 + community |
| Web push delivery reliability | LOW | Field evidence of <10% delivery on iOS PWA; Safari behaviour changes frequently |

**Overall confidence:** MEDIUM-HIGH for the JS-layer and Tauri work; MEDIUM for native extension work.

### Gaps to Address

- **FCM payload contract:** The actual payload shape sent by the user's `zmeventnotification.pl` instance is not verified. Audit the live payload at the start of Phase 4 before writing the NSE.
- **iOS deployment target floor:** WidgetKit requires iOS 16.1+. Verify `app/ios/App/App.xcodeproj` deployment target before Phase 5 starts. If currently iOS 15, raise the floor.
- **Android `compileSdk` + `minSdk`:** Glance 1.1.1 requires `compileSdk 34+`. Verify in `app/android/app/build.gradle` and `android/variables.gradle` before Phase 5.
- **`capacitor-widget-bridge` 7.0.0 resolvability:** Confirm the package is still on npm and peer dep satisfied before committing Phase 5. If removed, vendor it using the in-repo plugin pattern.

---

## Sources

Aggregated from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md (all dated 2026-04-26).

### Primary (HIGH confidence)
- Apple Developer documentation — WidgetKit, UNNotificationServiceExtension, Critical Alerts entitlement, App Group keychain sharing, ActivityKit
- Android Developers documentation — NotificationChannel immutability, Doze/App Standby, FCM Android message priority
- Firebase documentation — FCM HTTP v1 send guide, per-platform override blocks, message types
- Tauri v2 documentation — system tray API, notification plugin, action button limitations (mobile-only)
- npm registry — `@capacitor-firebase/messaging` 7.5.0, `@capacitor/local-notifications` 7.0.6, `capacitor-widget-bridge` 7.0.0 version verification
- Existing codebase — `pushNotifications.ts`, `notifications.ts`, `eventFavorites.ts`, `settings.ts:88-95`, `ssl-trust/`, `pip/` (verified directly)

### Secondary (MEDIUM confidence)
- Frigate, UniFi Protect, Ring, Eufy, Reolink feature documentation — competitor feature matrix
- Firebase blog 2025 — FCM on Android (OEM aggressive battery, high-priority quota changes)
- Apple Developer Forums — NSE memory limits (24 MB), NSE + FCM invocation
- Community sources — `kisimedia` capacitor-widget-bridge plugin; iOS Critical Alerts rejection patterns (HN thread + one Medium post)

### Tertiary (LOW confidence)
- Web push delivery rates on iOS PWA — MagicBell, Brainhub 2025/2026 field reports
- iOS Critical Alerts rejection rates for specific categories — community inference; Apple's written policy is HIGH confidence but per-category rejection rates are MEDIUM-LOW

---

*Research completed: 2026-04-26*
*Ready for roadmap: yes — pending resolution of Decision Points 1 and 2 (FCM payload contract, Android channel set)*
