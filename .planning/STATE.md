# State: zmNinjaNg "10-Second Triage" Milestone

**Last updated:** 2026-04-26 after roadmap creation

## Project Reference

**Core Value:** A user can go from a push notification to "is this real, do I care?" in under 10 seconds without ever opening the full app.

**Current focus:** Phase 1 — Reviewed State Foundation. Land the per-profile reviewed event store and bulk-mark UI; everything in phases 2-5 reads or writes this store.

**Active milestone:** 10-Second Triage (5 phases, 25 v1 requirements, 2-4 week horizon)

## Current Position

- **Milestone:** 10-Second Triage
- **Current phase:** 1 (Reviewed State Foundation)
- **Current plan:** None — phase 1 plans not yet generated (`/gsd-plan-phase 1`)
- **Status:** Roadmap defined; awaiting phase 1 planning
- **Progress:** 0/5 phases complete

```
[░░░░░░░░░░] 0% (0/5 phases)
Phase 1: ░░░░░░░░░░  Not started
Phase 2: ░░░░░░░░░░  Not started
Phase 3: ░░░░░░░░░░  Not started
Phase 4: ░░░░░░░░░░  Not started
Phase 5: ░░░░░░░░░░  Not started
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 5 |
| Plans complete | 0 |
| Requirements mapped | 25 / 25 |
| Requirements validated | 0 |
| Phases shipped | 0 |

## Accumulated Context

### Decisions

| Decision | Source | Date |
|----------|--------|------|
| 5-phase structure honoring dependency-constrained build order from `research/SUMMARY.md` | Roadmap synthesis | 2026-04-26 |
| Tauri tray + web dock ship in Phase 2 (parallel with reviewed-state foundation) — no native dependency, banks "functional-equivalent quick-look" promise early | `research/SUMMARY.md`, `research/FEATURES.md` | 2026-04-26 |
| Android channel set locked in Phase 3 before any rich push (channels are immutable after first push, per `research/PITFALLS.md` pitfall 4) | `research/PITFALLS.md` | 2026-04-26 |
| iOS NSE auth-handoff spike (1-2 days) precedes Phase 4 native-target setup | `research/SUMMARY.md` Top 5 Risks, `research/ARCHITECTURE.md` open question 1 | 2026-04-26 |
| Capability-detect + nudge for legacy FCM payloads lives in Phase 4, not its own phase (Option A: graceful degradation client-side) | Resolution to `research/SUMMARY.md` Contradiction 1 | 2026-04-26 |
| Mobile widgets stay in milestone scope (Phase 5), reuse Phase 4 App Group plumbing — user confirmed must ship in this milestone | Instructions from orchestrator | 2026-04-26 |
| Web "quick-look" surface is the in-tab dock first (Phase 2), PWA push is best-effort enhancement (Phase 5) | `research/PITFALLS.md` pitfall 11, `research/SUMMARY.md` Contradiction 4 | 2026-04-26 |
| Reviewed state defaults to true for events that existed before the upgrade (TRIAGE-03), to avoid an "8000 unreviewed events" panic | `REQUIREMENTS.md` TRIAGE-03; `research/SUMMARY.md` Decision Point 4 | 2026-04-26 |
| Quiet hours route to a low-importance channel; never short-circuit `notify()` (avoids Android FCM priority downgrade per `research/PITFALLS.md` pitfalls 5 and 8) | `research/PITFALLS.md` | 2026-04-26 |
| iOS Critical Alerts entitlement deferred (App Store rejection risk per `research/PITFALLS.md` pitfall 6); top tier is `interruptionLevel: .timeSensitive` | `research/PITFALLS.md`, `PROJECT.md` Out of Scope | 2026-04-26 |

### Open Questions

Items from `research/ARCHITECTURE.md` "Risks / Open Questions" still to resolve in plan-phase:

- iOS NSE auth handoff feasibility — needs 2-day spike before Phase 4 commits scope. Can the existing `ssl-trust` plugin extend with an App Group writer, or does this need a new `native-bridge` plugin?
- Capacitor Firebase Messaging `notificationActionPerformed` reliability when app is killed on iOS 17+ / Android 14+ — 1-day verification before committing silent-action UX (already deferred to v2 per ALERT-V2-01, but the launching-app path also needs verification)
- WidgetKit refresh-budget throttle — debounce 60s, drop intermediates; tunable in Phase 5
- Android Glance min-SDK alignment with `app/android/variables.gradle` — verify before Phase 5 starts
- iOS deployment target floor (must be ≥ 16.1 for WidgetKit) — verify in `app/ios/App/App.xcodeproj` before Phase 5 starts
- `capacitor-widget-bridge` 7.0.0 still resolvable — confirm before Phase 5; vendor to `app/src/plugins/widget-bridge/` if removed
- Reviewed-state cardinality cap (default 5000 per profile) — confirm in Phase 1 plan
- Quiet-hours timezone storage — explicit `tz` field at rule creation, defaulting to device tz with "use device timezone" toggle (decided; implement in Phase 3)

### Blockers

None.

### Pending TODOs

- File GitHub issues for Phase 1 (rule 2 — issues-first workflow)
- Run `/gsd-plan-phase 1` to decompose Phase 1 into executable plans
- Verify iOS deployment target and Android compileSdk/minSdk before Phase 5 begins (defer until Phase 4 ships)
- Schedule iOS NSE auth-handoff spike before Phase 4 plan-phase

## Session Continuity

**Last session ended:** 2026-04-26 with roadmap created

**Next action:** `/gsd-plan-phase 1` to generate executable plans for Phase 1 (Reviewed State Foundation).

**Files of record:**
- `.planning/PROJECT.md` — core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — 25 v1 requirements with phase mappings
- `.planning/ROADMAP.md` — 5 phases with goals, requirements, success criteria
- `.planning/research/{SUMMARY,STACK,FEATURES,ARCHITECTURE,PITFALLS}.md` — research aggregated 2026-04-26
- `.planning/codebase/{ARCHITECTURE,STACK,CONVENTIONS,STRUCTURE,INTEGRATIONS,TESTING,CONCERNS}.md` — codebase map generated 2026-04-26
- `AGENTS.md` — 25 project rules (non-negotiable)

---

*State initialized: 2026-04-26 after roadmap creation*
