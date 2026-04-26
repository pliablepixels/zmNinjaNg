---
phase: 1
slug: reviewed-state-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.x (unit) + playwright-bdd 8.x (e2e web/Android) + WebdriverIO 9.x + Appium (e2e iOS/Tauri) |
| **Config file** | `app/vitest.config.ts`, `app/playwright.config.ts`, `app/wdio.config.device-screenshots.ts` |
| **Quick run command** | `cd app && npm test -- --run src/stores/__tests__/eventReviewed.test.ts` |
| **Full suite command** | `cd app && npm test && npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~30s quick / ~3-5 min full (excluding device e2e) |

---

## Sampling Rate

- **After every task commit:** Run `cd app && npm test -- --run <relevant>.test.ts`
- **After every plan wave:** Run `cd app && npm test && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green: `npm test && npx tsc --noEmit && npm run build && npm run test:e2e -- events-reviewed.feature`
- **Max feedback latency:** 60 seconds for unit, ~3 min for build+web e2e
- **Device e2e (`@ios-phone`, `@android`, `@ios-tablet`, `@tauri`):** manual-invoke only — never auto-run during execution

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-W0 | 01 | 0 | TRIAGE-01 | — | N/A | unit-stub | `cd app && test -f src/stores/__tests__/eventReviewed.test.ts` | ❌ W0 | ⬜ pending |
| 01-01 | 01 | 1 | TRIAGE-01 | — | reviewed flag persisted to localStorage scoped by profileId | unit | `cd app && npm test -- --run src/stores/__tests__/eventReviewed.test.ts` | ❌ W0 | ⬜ pending |
| 01-02 | 02 | 2 | TRIAGE-01 | — | indicator visible after restart and profile switch | unit + e2e-web | `cd app && npm test -- --run src/components/events/__tests__/ReviewedToggle.test.tsx && npm run test:e2e -- events-reviewed.feature` | ❌ W0 | ⬜ pending |
| 01-03 | 03 | 2 | TRIAGE-02 | — | bulk-mark mutates all selected, clears selection, updates indicators | unit + e2e-web | `cd app && npm test -- --run src/components/events/__tests__/EventListSelection.test.tsx && npm run test:e2e -- events-bulk-review.feature` | ❌ W0 | ⬜ pending |
| 01-04 | 04 | 1 | TRIAGE-03 | — | first-launch-after-upgrade seeds cutoff so existing events are reviewed | unit | `cd app && npm test -- --run src/hooks/__tests__/useReviewedCutoffSeeder.test.ts` | ❌ W0 | ⬜ pending |
| 01-05 | 05 | 2 | TRIAGE-01, TRIAGE-03 | — | notification badge does not spike post-upgrade | unit | `cd app && npm test -- --run src/stores/__tests__/notifications.badge.test.ts` | ❌ W0 | ⬜ pending |
| 01-06 | 06 | 3 | TRIAGE-01, TRIAGE-02, TRIAGE-03 | — | i18n strings present in all 5 locales for reviewed UI | unit | `cd app && npm test -- --run src/locales/__tests__/reviewed-keys.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Plan IDs and task counts are placeholders — finalize during planning. Each plan's `<automated>` verify must reference a row above.*

---

## Wave 0 Requirements

- [ ] `app/src/stores/__tests__/eventReviewed.test.ts` — unit stubs for TRIAGE-01 (toggle, persist, profile-scope, restart-survives)
- [ ] `app/src/hooks/__tests__/useReviewedCutoffSeeder.test.ts` — unit stubs for TRIAGE-03 (cutoff sets on first run, no-op thereafter, profile-scoped)
- [ ] `app/src/stores/__tests__/notifications.badge.test.ts` — extend existing notification store tests with badge-suppression-after-cutoff scenario
- [ ] `app/src/components/events/__tests__/ReviewedToggle.test.tsx` — unit stubs for the indicator/toggle component
- [ ] `app/src/components/events/__tests__/EventListSelection.test.tsx` — unit stubs for multi-select + bulk-mark action
- [ ] `app/src/locales/__tests__/reviewed-keys.test.ts` — assert each new translation key exists in en/de/es/fr/zh
- [ ] `app/tests/features/events-reviewed.feature` — Gherkin scenarios for single mark/unmark + restart/profile-switch invariants (`@all @visual` initially)
- [ ] `app/tests/features/events-bulk-review.feature` — Gherkin scenarios for multi-select bulk mark (`@all`)
- [ ] `app/tests/steps/eventList.steps.ts` (extend) — selection-mode + bulk-action steps

*Framework already installed — no Wave 0 install task. Existing test infra (vitest + playwright-bdd) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Indicator legibility on iOS phone in landscape | TRIAGE-01 | Visual baseline only meaningful on real WKWebView; device e2e is manual-invoke per project rule | `npm run test:e2e:ios-phone -- events-reviewed.feature` then visually confirm indicator + multi-select bar fit on iPhone 15 simulator landscape |
| Indicator legibility on Android emulator | TRIAGE-01 | Same — Android WebView rendering parity check | `npm run test:e2e:android -- events-reviewed.feature` |
| Tauri desktop indicator + multi-select | TRIAGE-01, TRIAGE-02 | Native window + WebKitGTK/WebView2 parity | `npm run test:e2e:tauri -- events-reviewed.feature` |
| Real ZoneMinder server post-upgrade behavior | TRIAGE-03 | Cutoff seeding is migration-style — only meaningful when run against an upgrade from a previous build with prior event history | Install previous build, generate events, install Phase 1 build, confirm `NotificationHistory` shows zero unreviewed and badge stays at 0 |
| Profile-switch isolation with two real ZM portals | TRIAGE-01 (success criterion 4) | Profile switch triggers query-cache clear + auth swap; only fully exercised against two distinct backends | Configure two profiles via `.env` `ZM_HOST_1`/`ZM_HOST_2`, mark an event reviewed in profile A, switch to B, confirm event in B is unreviewed, switch back, confirm A still reviewed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`--watch`, `--ui` are forbidden in CI/agent runs)
- [ ] Feedback latency < 60s for unit, < 5 min for full+e2e-web
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
