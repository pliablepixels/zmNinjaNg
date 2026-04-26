# zmNinjaNg

## What This Is

zmNinjaNg is a cross-platform (web, iOS, Android, macOS/Windows/Linux desktop) client for ZoneMinder NVR servers. It connects to a user's ZoneMinder portal to show live monitors, browse events, scrub timelines, manage zones, and receive real-time + push notifications. Users are home/hobbyist installs, prosumer multi-camera setups, and mobile-first owners checking alerts on the go.

## Core Value

A user can go from a push notification to "is this real, do I care?" in under 10 seconds without ever opening the full app.

## Requirements

### Validated

<!-- Capabilities already shipped in the codebase. Locked. -->

- ✓ Multi-profile ZoneMinder portal client with secure-storage auth — existing
- ✓ Live monitor view, montage, Picture-in-Picture — existing
- ✓ Events list, EventDetail, EventMontage, Timeline scrubbing, Heatmap — existing
- ✓ Real-time event WebSocket via `zmeventnotification.pl` — existing (`services/notifications.ts`)
- ✓ FCM push notifications on iOS and Android — existing (`services/pushNotifications.ts`)
- ✓ NotificationHistory page + NotificationSettings page — existing
- ✓ Event tags and favorites — existing (`stores/eventFavorites.ts`)
- ✓ Cross-platform packaging: web, iOS (Capacitor 7), Android (Capacitor 7), Tauri 2 desktop — existing
- ✓ i18n in en/de/es/fr/zh — existing (`locales/{lang}/translation.json`)
- ✓ Bandwidth-aware polling via `useBandwidthSettings()` — existing
- ✓ Background download tasks (`stores/backgroundTasks.ts`) — existing
- ✓ Profile-scoped settings via `getProfileSettings`/`updateProfileSettings` — existing
- ✓ Codebase map under `.planning/codebase/` — generated 2026-04-26

### Active

<!-- "10-Second Triage" milestone hypotheses — 2-4 week horizon. -->

- [ ] Rich push notifications: thumbnail preview, action buttons (mark reviewed / snooze monitor / dismiss) without launching the app
- [ ] Event "reviewed" state: visual distinction in lists + bulk mark-reviewed action so the same alert stops nagging
- [ ] Event noise filter: filter list and notifications by alarm score and detection class/cause text already returned by ZoneMinder
- [ ] Event quick-search: fast jump by date range, monitor, object class/cause, alarm score from one filter bar
- [ ] Per-monitor notification priority + quiet-hours window: route alerts differently per camera, suppress during user-defined windows
- [ ] Home-screen quick-look surface (functional-equivalent per platform): iOS + Android home-screen widget showing latest event, Tauri menu-bar / system-tray quick-look, web in-tab dock primary + best-effort PWA push where supported

### Out of Scope

- Live view / Montage redesign — already working; this milestone stays in the triage + alert lanes
- ZoneMinder server-side or `zmeventnotification.pl` source code changes — milestone is client-only (a configuration / payload-shape contract update may still be needed for rich push; resolved in REQUIREMENTS.md)
- New client-side ML / object detection models — consume only metadata ZM and `zmeventnotification` already populate (alarm score, cause text, detection frames)
- iOS Critical Alerts entitlement — App Store rejects general home-security/surveillance use cases; standard `time-sensitive` + Android `IMPORTANCE_HIGH` cover ~95% of the UX (per research/PITFALLS.md)
- iOS Live Activities / Dynamic Island — wrong data model for discrete ZM events; revisit if continuous-detection metadata appears server-side
- Apple Watch / WearOS companion apps — deferred; widget + rich push cover the on-the-go case for now
- Cloud-style features (off-device storage, account sync) — outside the ZoneMinder self-hosted model
- Geofencing-based arm/disarm — not in this milestone; revisit after triage lane lands

## Context

**Brownfield, post-map.** This is an established React 19 + TypeScript 5.9 + Vite 7 codebase already shipping on five platforms. A `/gsd-map-codebase` pass produced `.planning/codebase/{ARCHITECTURE,STACK,CONVENTIONS,STRUCTURE,INTEGRATIONS,TESTING,CONCERNS}.md` on 2026-04-26 — read those before planning each phase.

**Domain.** ZoneMinder is a self-hosted NVR. Events have `score`, `cause`, frame metadata, and (when ML hooks are configured server-side) detection text. `zmeventnotification.pl` pushes real-time events via WebSocket and FCM. zmNinjaNg currently displays this metadata but doesn't lean on it for filtering, summarization, or notification routing.

**Benchmarks.** Frigate (event review polish, sub-labels), UniFi Protect (mobile push polish, smart filters, timeline), Reolink/Eufy/Ring (consumer-grade rich notifications, action buttons, widgets).

**User mix.** Home/hobbyist + prosumer (multi-camera, ZM-literate) + mobile-first on the go. The same triage UX needs to scale from 1 to 30+ cameras.

**Known concerns to keep on the radar (from `.planning/codebase/CONCERNS.md`).** Several call sites still bypass `useDateTimeFormat()` (rule 24); deprecated settings flags persist in storage; legacy crypto fallbacks in `secureStorage.ts`. None block the milestone, but new code must follow current rules.

## Constraints

- **Tech stack**: TypeScript 5.9, React 19, Vite 7, Capacitor 7, Tauri 2, shadcn-on-Radix UI, Zustand, React Query, react-i18next — locked by the existing codebase. New deps must match Capacitor major version and verify peer deps.
- **Cross-platform**: every feature must work on web + iOS + Android + Tauri desktop — but via *functional equivalents*, not pixel parity. Widget on mobile = menu-bar/tray on Tauri = top-bar dock on web. Same job, different surface.
- **i18n**: every user-facing string ships simultaneously in en, de, es, fr, zh. Labels stay short enough to render on a 320px-wide phone.
- **Profile-scoped settings**: anything user-tweakable goes through `getProfileSettings`/`updateProfileSettings`. No global singletons.
- **Bandwidth-aware**: any polling/refresh runs via `useBandwidthSettings()` — never hardcode intervals.
- **Logging / HTTP / dates**: use `lib/logger`, `lib/http`, and `useDateTimeFormat()` exclusively. No `console.*`, raw `fetch`, or hardcoded date-fns patterns in user-visible output.
- **Capacitor plugins**: dynamic-import + platform check only. Add tests/setup.ts mocks for any new plugin.
- **Tauri packages**: JS `@tauri-apps/*` and Rust `tauri-plugin-*` versions must move together.
- **Testing**: `npm test` + `npx tsc --noEmit` + `npm run build` + relevant `npm run test:e2e` must pass before every commit. UI changes need `data-testid` and a `.feature` scenario with platform tags. Device e2e (`ios-phone`, `android-phone`, `ios-tablet`, `tauri`) is manual-invoke only.
- **Issues-first**: every feature gets a GitHub issue before implementation; commits use conventional format and reference the issue.
- **No superlatives in any artifact** (per project rule 1).
- **Timeline**: ~2-4 weeks for the milestone.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Milestone is client-only | Avoids coordinating ZM server reconfiguration; keeps blast radius small; ships independently | — Pending |
| Functional-equivalent parity, not pixel parity | Widgets/rich-push don't exist on every platform; same user job can be served by different surfaces | — Pending |
| Consume existing ZM event metadata, don't add ML | Score and cause text already populate; new ML belongs in a future milestone with server-side coordination | — Pending |
| Live view + Montage are off-limits this milestone | They're working; focus stays on triage + alert lanes where the user feels the pain | — Pending |
| Mobile-first push/widget surfaces, web/Tauri get equivalents | Mobile is where the alert-driven 10-second job lives; desktop equivalents exist but aren't the primary surface | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-26 after initialization*
