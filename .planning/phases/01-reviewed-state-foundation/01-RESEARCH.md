# Phase 1: Reviewed State Foundation - Research

**Researched:** 2026-04-26
**Domain:** Client-side event-state persistence (Zustand) + multi-surface React UI + cross-platform e2e
**Confidence:** HIGH (every recommendation grounded in an existing analog file in this codebase)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Upgrade default mechanism (TRIAGE-03)
- **D-01:** Use a **cutoff cursor** per profile, stored as `maxEventIdAtCutoff: Record<profileId, number>`. An event is reviewed when `(event.Id <= cutoff) || reviewedSet.has(event.Id)`. No bulk write at first launch, no startup network call dedicated to seeding, no 5000-record cap on the implicit baseline.
- **D-02:** Cutoff is seeded from the **highest `Event.Id`** in the first successful events API response after upgrade, per profile. ZM event Ids are monotonic, so this is a correct ordering boundary. Until seeded, treat the store as "not bootstrapped" for that profile and suppress the unreviewed badge so the spike never appears even if the user opens NotificationHistory before the events page.
- **D-03:** Apply the same seeding rule to **profiles added after** this milestone ships — first successful events fetch sets that profile's cutoff. Behavior is consistent across upgrade-vs-add; new profiles do not start with a wall of historical "unreviewed" rows.
- **D-04:** Reviewed state is **resettable per profile** from Settings via a confirm dialog. Reset clears both the explicit reviewedSet AND the cutoff, then the cutoff re-seeds on the next successful events fetch.

#### Reviewed visual indicator
- **D-05:** Reviewed events get **subtle dim (opacity ~60%) plus a small filled check-mark badge in the top-right corner** of the card/row.
- **D-06:** EventDetail header shows a **"Reviewed" badge** near the title when the event is reviewed.

#### Reviewed control entry points
- **D-07:** EventCard adds a **check-mark icon button next to the existing favorite Star** in the top-right action cluster. Single tap toggles. Filled-green when reviewed, outline-muted when not.
- **D-08:** EventDetail header gets a **labelled "Mark reviewed" / "Reviewed ✓" toggle button** in the action bar. No auto-mark-on-view.
- **D-09:** NotificationHistory rows surface the same **corner check-mark** indicator; explicit "Mark reviewed" toggle reuses the existing row-action slot pattern.

#### Bulk multi-select on EventListView (TRIAGE-02)
- **D-10:** Selection mode entered via a **"Select" toggle button in the list header**. Cards swap from navigate-on-tap to select-on-tap; checkbox appears in each card's top-left. "Cancel" exits.
- **D-11:** When ≥1 item is selected a **sticky bottom action bar** slides up: `{N} selected` left, primary action **"Mark reviewed"** right. Bar also includes "Select all visible" and Cancel.
- **D-12:** Phase 1 exposes **only "Mark reviewed"** as a bulk action.
- **D-13:** After bulk action runs, **clear selection and exit selection mode immediately**.

#### Reviewed vs notification "read" semantics
- **D-14:** **Two separate stores, two separate concepts.** `useNotificationStore.read` = notification-row-level. `useReviewedStore.reviewed` = event-level.
- **D-15:** **One-way link: reviewed implies read.** Marking an event reviewed flips the matching notification rows in `useNotificationStore` to `read`. Reverse does NOT happen.
- **D-16:** Reviewed→read flip applies to **all notification rows for that EventId in the active profile**. Cross-profile rows untouched.

#### Storage shape
- **D-17:** New store at `app/src/stores/reviewedEvents.ts`, modelled on `app/src/stores/eventFavorites.ts`:
  - `profileReviewed: Record<string, string[]>`
  - `profileCutoffs: Record<string, number>`
  - API: `isReviewed`, `toggleReviewed`, `markReviewed(profileId, eventIds: string[])`, `unmarkReviewed`, `setCutoff`, `getCutoff`, `resetProfile`
  - Persisted via Zustand `persist` under key `zmng-reviewed-events`
- **D-18:** **Soft cap of 5000 explicit reviewedSet entries per profile.** On overflow, drop lowest Ids first (FIFO by Id). Log overflow at INFO via `log.profile`.

#### Hook layer
- **D-19:** New `useReviewedState` hook at `app/src/hooks/useReviewedState.ts`. Exposes `(eventId) => { isReviewed, toggle, markReviewed, unmark }` bound to active profile via `useCurrentProfile`. Hides the cutoff rule from consumers.

#### Cross-cutting
- **D-20:** New strings ship in en/de/es/fr/zh simultaneously, ≤320px-phone-width safe.
- **D-21:** Required `data-testid`s: `event-reviewed-button`, `event-reviewed-badge`, `events-select-toggle`, `event-card-checkbox`, `bulk-action-bar`, `bulk-mark-reviewed`, `bulk-cancel`, `event-detail-reviewed-toggle`, `notification-row-reviewed`, `settings-reset-reviewed`.
- **D-22:** New `.feature` scenarios cover: single-tap toggle, bulk-select-and-mark, EventDetail toggle, NotificationHistory toggle, upgrade-default seeding, profile-switch isolation, reviewed→read one-way link, settings reset. Tagged `@all` baseline; `@android @ios-phone` for mobile gestures; `@visual` for dim+badge.

### Claude's Discretion
- Exact opacity for dim treatment (60% baseline; planner may tune).
- Exact icon component for check-mark (likely `lucide-react` `Check` or `CheckCheck`).
- Whether to debounce/batch persist writes during bulk-mark of large selection.
- TypeScript types and Zod schema additions live with implementation; no API call here.

### Deferred Ideas (OUT OF SCOPE)
- Bulk-mark from NotificationHistory.
- "Mark unreviewed" as a bulk action.
- Saved filter presets including reviewed-state (TRIAGE-V2-01).
- Reviewed-state sync via ZM tags (TRIAGE-V2-02).
- Server-side persistence so reviewed survives a fresh install.
- AI 24h digest (TRIAGE-V2-03).
- "Hide reviewed" filter toggle (Phase 2, TRIAGE-07).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRIAGE-01 | User can mark an event reviewed from list, detail, and notification history; visually distinguished | Storage model in `## Standard Stack`; UI surfaces in `## UI Surface Catalog` (EventCard, EventDetail header, NotificationHistory rows); test plan in `## Validation Architecture` |
| TRIAGE-02 | User can bulk-mark a selection in one action from the events list | Multi-select sketch in `## Multi-Select Implementation Sketch`; selection state model + sticky action bar; `markReviewed(profileId, eventIds[])` store API |
| TRIAGE-03 | Existing events default to reviewed at first install; only new events start unreviewed; no "8000 unreviewed" panic | Cutoff-cursor mechanism in `## Upgrade Migration Mechanism (TRIAGE-03)`; gated badge suppression until seeded; per-profile bootstrap flag |
</phase_requirements>

## Summary

Phase 1 is overwhelmingly an **exercise in cloning a known-good pattern**. The closest analog (`app/src/stores/eventFavorites.ts`, 137 LOC) already implements per-profile `Record<profileId, string[]>` with Zustand `persist`, a stable name key, and a toggle/add/remove/getCount API surface — that file is effectively the template. The reviewed store is that shape plus two additions: a `profileCutoffs: Record<string, number>` field for the upgrade-safe baseline, and a bulk `markReviewed(profileId, eventIds[])` action.

The critical hidden risk is a **type mismatch between the API and the notification store**. `Event.Id` in `app/src/api/types.ts` is `z.coerce.string()` (string), but `ZMAlarmEvent.EventId` in `app/src/types/notifications.ts` is `number`. `useEventFavoritesStore` already chose **string** as its canonical key (test fixtures use `'event-123'`); `useNotificationStore.markEventRead` takes a `number`. The reviewed store MUST use **string** to match the favorites pattern, the `Event.Id` shape, and to survive JSON round-trips through `persist`. The reviewed→read flip (D-15) must convert `string -> Number(eventId)` at the call boundary into `markEventRead`.

The remaining work is primarily UI plumbing: a `useReviewedState` hook, three icon-button insertions (EventCard, EventDetail header, NotificationHistory row), a selection-mode model on `EventListView` (extract a `useEventSelection` hook + `EventSelectionBar` component to honor the ~400 LOC rule), a sticky action bar matching the existing toast/alert-dialog elevation system, a settings-reset row in `AdvancedSection.tsx`, and i18n keys in five locale files. No API additions, no Capacitor plugin additions, no native code, no platform-specific branching.

**Primary recommendation:** Copy `app/src/stores/eventFavorites.ts` line-for-line, rename, add `profileCutoffs` + `setCutoff`/`getCutoff`/`resetProfile`/`markReviewed(eventIds[])` actions and the FIFO 5000-cap guard, ship the `useReviewedState` hook, then drop the icon button into the three surfaces.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reviewed-state persistence | Browser/Client (localStorage via Zustand `persist`) | — | Per-profile, client-only for v1 (server-side ZM-tag sync deferred to v2). All five surfaces (web/iOS/Android/Tauri/TV) get state for free since the same SPA bundle ships everywhere. |
| Reviewed UI rendering | Browser/Client (React) | — | EventCard, EventDetail, NotificationHistory all live in the same React tree. |
| Cutoff seeding (TRIAGE-03) | Browser/Client (React Query `onSuccess` or hook side-effect on first events fetch) | — | Triggered by API response. Lives in a new hook (`useReviewedCutoffSeeder` or inline in `Events.tsx` page) to avoid coupling the store to React Query. |
| Cross-store one-way link (D-15) | Browser/Client (Zustand store-to-store call) | — | Inside `markReviewed`/`toggleReviewed` action: `useNotificationStore.getState().markEventRead(profileId, Number(eventId))`. Same cross-store call pattern already used in `notifications.ts:447` (`useProfileStore.getState().profiles.find(...)`). |
| Profile-switch isolation | Browser/Client (Zustand keying) | — | Data is keyed by `profileId` inside the store; no clear-on-switch needed (matches `eventFavorites` behavior). |
| Bulk selection state | Browser/Client (component-local React state) | — | Selection set is ephemeral; only the resulting reviewed-marks persist. |

## Standard Stack

### Core (already in package.json — no new deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zustand` | 5.0.8 | Reviewed store + Settings store + selection hook | [VERIFIED: app/package.json] Already used by every other client-state store in this app. `eventFavorites.ts` is the canonical template. |
| `zustand/middleware` (`persist`) | bundled | localStorage hydration of `profileReviewed` and `profileCutoffs` | [VERIFIED: app/src/stores/eventFavorites.ts:9] Same `persist` middleware used by `eventFavorites`, `notifications`, `settings`. |
| `zustand/react/shallow` (`useShallow`) | bundled | Hook subscriptions to per-profile slices without infinite re-renders | [VERIFIED: app/src/hooks/useCurrentProfile.ts:18, app/src/pages/Events.tsx:60] Required for any selector returning an array/object derived from the store. |
| `react` | 19.2.0 | Selection-mode component state via `useState`/`useMemo` | [VERIFIED: app/package.json] |
| `react-i18next` | 16.3.5 | All new strings in 5 locales | [VERIFIED: app/package.json] AGENTS.md rule #5 mandates. |
| `lucide-react` | 0.555.0 | `Check` / `CheckCheck` icons for the indicator | [VERIFIED: app/package.json; already used in `NotificationHistory.tsx:28` for `CheckCheck`] |
| `@radix-ui/react-checkbox` (via `app/src/components/ui/checkbox.tsx`) | bundled | Selection-mode checkboxes on cards | [VERIFIED: app/src/components/ui/checkbox.tsx exists] |
| `@radix-ui/react-alert-dialog` (via `app/src/components/ui/alert-dialog.tsx`) | bundled | Settings reset confirm dialog | [VERIFIED: NotificationHistory.tsx:18-27 uses this for clear-history] |
| `vitest` | 3.2.4 | Unit tests for the new store | [VERIFIED: app/package.json; existing template at `app/src/stores/__tests__/eventFavorites.test.ts`] |
| `playwright-bdd` | 8.4.2 | New `.feature` scenarios | [VERIFIED: app/package.json] |

### Supporting (existing project utilities — must reuse, not re-invent)
| Library / Helper | Purpose | When to Use |
|---------|---------|-------------|
| `app/src/lib/logger.ts` (`log.profile` helper) | Log INFO on add/remove/cap-overflow/reset | Every state mutation (already done in `eventFavorites.ts:69-72`); cap-overflow per D-18 |
| `app/src/hooks/useCurrentProfile.ts` | Resolve active `profileId` for the new hook | `useReviewedState` consumes this exactly like `EventCard.tsx:39` does |
| `app/src/components/ui/badge.tsx` | "Reviewed" badge on EventDetail (D-06) | Existing primitive with `secondary` / `outline` variants |
| `app/src/components/ui/button.tsx` | EventDetail toggle button + bulk action bar buttons | Existing primitive used everywhere |
| `app/src/components/ui/alert-dialog.tsx` | Settings reset confirm dialog (D-04) | Pattern verbatim from `NotificationHistory.tsx:302-321` |
| `app/src/components/ui/checkbox.tsx` | Per-card selection checkbox (D-10) | Existing primitive |

### No new dependencies required.

**Installation:** None.

**Version verification (npm view, run on 2026-04-26):**
- All listed packages are present in `app/package.json` and locked via `app/package-lock.json` (757 KB). No version drift to verify against the registry — the constraint is only that we do not add new packages. [VERIFIED: app/package.json — read 2026-04-26]

## Architecture Patterns

### System Architecture Diagram

```
                                          ┌──────────────────────────┐
                                          │ ZoneMinder server        │
                                          │ /events/index.json       │
                                          │ → Event.Id (string,      │
                                          │   monotonic)             │
                                          └─────────────┬────────────┘
                                                        │ HTTP via lib/http.ts
                                                        ▼
                                       ┌────────────────────────────────┐
                                       │ React Query: ['events', ...]   │
                                       │  app/src/pages/Events.tsx      │
                                       └─────────────┬──────────────────┘
                                                     │ on first success per profile
                                                     │ (cutoff not yet seeded)
                                                     ▼
                                       ┌────────────────────────────────┐
   ┌────────────────────────┐          │ useReviewedCutoffSeeder        │
   │ useEventFavoritesStore │          │  computes max(events[].Event.Id│
   │ (analog reference)     │          │  → setCutoff(profileId, maxId) │
   └────────────────────────┘          └─────────────┬──────────────────┘
                                                     │
                                                     ▼
        ┌────────────────────────────────────────────────────────────────┐
        │ useReviewedEventsStore  (Zustand + persist: zmng-reviewed-events) │
        │  profileReviewed: Record<profileId, string[]>                  │
        │  profileCutoffs:  Record<profileId, number>                    │
        │  isReviewed(p,e)  → e<=cutoff || set.has(e)                    │
        │  toggleReviewed   → also fires markEventRead one-way link      │
        │  markReviewed(p, eventIds[])  bulk + cap-5000 FIFO drop        │
        └─────┬───────────────────────────┬──────────────────────────────┘
              │                           │ D-15/D-16 cross-store call
              │                           ▼
              │                ┌────────────────────────────────┐
              │                │ useNotificationStore           │
              │                │  markEventRead(profileId,      │
              │                │                Number(eventId))│
              │                │  → cascades to ALL rows for    │
              │                │    that EventId in profile     │
              │                └────────────────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ useReviewedState (hook) — binds to useCurrentProfile()               │
   │  returns { isReviewed, toggle, markReviewed, unmark }                │
   └─┬──────────────────┬──────────────────┬──────────────────┬──────────┘
     │                  │                  │                  │
     ▼                  ▼                  ▼                  ▼
  EventCard       EventDetail header   NotificationHistory  Bulk action bar
  (D-05/D-07)     (D-06/D-08)          rows (D-09)          (D-10/D-11)
  + dim+badge     + Reviewed badge +   + corner check       + sticky footer
                  + toggle button       + row-action toggle + Mark reviewed btn
```

**Data flow narrative:**
1. User opens Events page on a fresh upgrade.
2. React Query fetches `/events/index.json`. On success, if `profileCutoffs[profileId]` is undefined, the seeder computes `max(events[].Event.Id)` and calls `setCutoff(profileId, maxId)`. Until this happens, `useReviewedState.isReviewed` returns false for all events AND the unreviewed-badge surface (NotificationBadge — see `## Notification Badge Interaction`) suppresses count display.
3. User taps the check-mark on a card → `toggleReviewed(profileId, event.Id)` → store mutates `profileReviewed[profileId]`, persists, also calls `useNotificationStore.getState().markEventRead(profileId, Number(event.Id))` for all matching notification rows.
4. User enters selection mode → tracks `Set<string>` of selected `event.Id`s in component-local React state (NOT in the store) → "Mark reviewed" button calls `markReviewed(profileId, [...selected])` → store does one merged update → selection cleared → exit selection mode (D-13).
5. Profile switch → `useCurrentProfile` returns new `profileId` → all hooks re-derive from the new profile's slice; old slice untouched in storage. No clear-on-switch needed.

### Recommended Project Structure

```
app/
├── src/
│   ├── stores/
│   │   ├── reviewedEvents.ts            # NEW (≤200 LOC; eventFavorites is 137)
│   │   └── __tests__/
│   │       └── reviewedEvents.test.ts   # NEW (mirror eventFavorites.test.ts at ~250 LOC)
│   ├── hooks/
│   │   ├── useReviewedState.ts          # NEW (≤80 LOC)
│   │   ├── useReviewedCutoffSeeder.ts   # NEW (≤60 LOC) — wires React Query → setCutoff
│   │   └── useEventSelection.ts         # NEW (≤100 LOC) — selection mode state + actions
│   ├── components/
│   │   ├── events/
│   │   │   ├── EventCard.tsx            # MODIFY: add reviewed button + dim+badge + select-mode checkbox
│   │   │   ├── EventListView.tsx        # MODIFY: thread selection state through; render bar
│   │   │   ├── EventSelectionBar.tsx    # NEW (≤120 LOC) — sticky action bar (D-11)
│   │   │   └── EventReviewedBadge.tsx   # NEW (≤30 LOC) — corner check-mark badge primitive (reused by EventCard + NotificationHistory rows)
│   │   └── settings/
│   │       └── AdvancedSection.tsx      # MODIFY: add "Reset reviewed state" row + dialog
│   ├── pages/
│   │   ├── Events.tsx                   # MODIFY: add Select toggle in header, render EventSelectionBar
│   │   ├── EventDetail.tsx              # MODIFY: add Reviewed badge + toggle button in header
│   │   └── NotificationHistory.tsx      # MODIFY: add corner check-mark + row-level Mark-reviewed action
│   └── locales/
│       ├── en/translation.json          # MODIFY: events.reviewed.*, events.bulk.*, settings.reviewed_reset.*
│       ├── de/translation.json          # MODIFY: same keys, German
│       ├── es/translation.json          # MODIFY: same keys, Spanish
│       ├── fr/translation.json          # MODIFY: same keys, French
│       └── zh/translation.json          # MODIFY: same keys, Chinese
└── tests/
    ├── features/
    │   └── reviewed-events.feature      # NEW (≤120 lines; one scenario per success criterion)
    └── steps/
        └── reviewed-events.steps.ts     # NEW (≤300 LOC; consult events.steps.ts:160-230 for pattern)
```

### Pattern 1: Per-Profile Set Store (clone of eventFavorites)
**What:** Zustand store with `Record<profileId, string[]>`, persisted, with `add/remove/toggle/get/clear/getCount`.
**When to use:** Per-event boolean state scoped per profile.
**Code reference:** `app/src/stores/eventFavorites.ts:38-136` is the verbatim template. The reviewed store extends this shape with `profileCutoffs` and adds `markReviewed(eventIds[])`, `setCutoff`, `getCutoff`, `resetProfile`, plus the cap-overflow guard inside `addReviewed`/`markReviewed`.

### Pattern 2: Cross-Store One-Way Call (D-15/D-16)
**What:** A store action calls into another store via `useOtherStore.getState()` rather than importing a hook.
**When to use:** Side-effect from one store mutates another (no React subscriptions involved).
**Code reference:** `app/src/stores/notifications.ts:447` does this with `useProfileStore.getState().profiles.find(...)`. For D-15, inside `reviewedEvents.ts`'s `addReviewed`/`markReviewed`:
```typescript
// Source: app/src/stores/notifications.ts:447 (cross-store call pattern)
import { useNotificationStore } from './notifications';

// Inside addReviewed action, after the persist update succeeds:
const numericId = Number(eventId);
if (Number.isFinite(numericId)) {
  // markEventRead in notifications.ts:373 already iterates and matches all rows
  // for the EventId in this profile, so D-16 cascade is automatic.
  useNotificationStore.getState().markEventRead(profileId, numericId);
}
```

### Pattern 3: Hook bound to current profile
**What:** Hook reads `useCurrentProfile().currentProfile.id` and returns a closure pre-bound to that profile.
**When to use:** Components consume `(eventId) => ...` rather than `(profileId, eventId) => ...`.
**Code reference:** `EventCard.tsx:39-46` already does this inline:
```typescript
const { currentProfile } = useCurrentProfile();
const toggleFavorite = useEventFavoritesStore((state) => state.toggleFavorite);
const isFav = useEventFavoritesStore((state) =>
  currentProfile ? state.isFavorited(currentProfile.id, event.Id) : false
);
```
The `useReviewedState` hook (D-19) wraps this so consumers don't repeat the `currentProfile` guard.

### Pattern 4: Cutoff seeder via React Query side-effect
**What:** A hook that watches `useQuery({ queryKey: ['events', ...] })` and seeds the cutoff on first success per profile.
**When to use:** Once per profile, derived from data already being fetched.
**Implementation sketch (lives in `useReviewedCutoffSeeder.ts`):**
```typescript
// Import where Events page already calls useQuery
import { useEffect } from 'react';
import { useReviewedEventsStore } from '../stores/reviewedEvents';
import { useCurrentProfile } from './useCurrentProfile';
import type { EventData } from '../api/types';

export function useReviewedCutoffSeeder(events: EventData[] | undefined) {
  const { currentProfile } = useCurrentProfile();
  const getCutoff = useReviewedEventsStore((s) => s.getCutoff);
  const setCutoff = useReviewedEventsStore((s) => s.setCutoff);

  useEffect(() => {
    if (!currentProfile || !events || events.length === 0) return;
    if (getCutoff(currentProfile.id) !== undefined) return; // already seeded
    const maxId = events.reduce((acc, { Event }) => {
      const n = Number(Event.Id);
      return Number.isFinite(n) && n > acc ? n : acc;
    }, 0);
    if (maxId > 0) setCutoff(currentProfile.id, maxId);
  }, [currentProfile, events, getCutoff, setCutoff]);
}
```
Call site: `app/src/pages/Events.tsx` after the `useQuery` block (around line 175).

### Anti-Patterns to Avoid
- **Storing selection state in the persisted Zustand store** — selection is ephemeral; only resulting reviewed marks persist. Putting it in the store would cause stale UI on app restart and bloat localStorage.
- **Calling `getProfileSettings` inside a Zustand selector** — already explicitly forbidden by `useCurrentProfile.ts:13-14` because it creates new object references and triggers infinite re-renders. Use the raw `state.profileReviewed[profileId]` slice with `useShallow`.
- **Mixing `string` and `number` event IDs** — `Event.Id` is string in the API, `NotificationEvent.EventId` is number; reviewed store MUST be string everywhere. Convert at the cross-store boundary only.
- **Auto-marking reviewed on EventDetail visit** — explicitly rejected (D-08). User-initiated only.
- **Bulk-mark via N individual `addReviewed` calls** — would persist N times (one per Zustand `set`). The `markReviewed(eventIds[])` action MUST do one merged update, then persist once.
- **Allowing reviewed → unreviewed via "uncheck" while a sticky bar is open in Phase 1** — D-12 locks the bulk action surface to "Mark reviewed" only. Single-tap toggle on a card already covers undo for one item.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-profile persisted Set | Custom localStorage wrapper, custom JSON serializer, manual hydration | `zustand` + `persist({ name })` middleware (verbatim from `eventFavorites.ts:38-136`) | Handles SSR safety, schema-version migration hooks, and concurrent-tab semantics. |
| Confirm dialog for reset | Custom modal/overlay component | `AlertDialog` primitive (`app/src/components/ui/alert-dialog.tsx`) — see `NotificationHistory.tsx:302-321` for the pattern | Accessible, focus-trapped, matches existing UX. |
| Selection-mode checkbox | Hand-styled HTML checkbox | `Checkbox` primitive (`app/src/components/ui/checkbox.tsx`) | Radix-on-shadcn, keyboard-accessible, theme-consistent. |
| Toast on reset / bulk-mark success | Custom alert | `sonner` `toast.success(t('...'))` | Already wired (`EventDetail.tsx:30,103`). |
| Sticky bottom-of-screen bar elevation | Custom z-index / portal | Use existing toast/dialog z-index tokens; CONTEXT.md `<specifics>` calls this out | "Match the project's existing toast/dialog elevation system" — no new design tokens. |
| Multi-select gesture | Long-press, swipe, edge-pan | Visible "Select" toggle + checkbox per card (D-10) | Discoverable across web/mobile/Tauri/TV remote; CONTEXT.md explicitly forbids hidden gestures. |
| Cap eviction (5000 entries) | LRU cache, time-based eviction | FIFO by Id (drop lowest Ids) — D-18 | Lower Ids are also implicitly reviewable via cutoff bump on next seed; FIFO is correct AND simple. |

**Key insight:** Phase 1 has zero invent-something cells. Every primitive, pattern, and integration point is already on disk in this repo. The work is composition, not invention.

## Runtime State Inventory

> Phase 1 is greenfield — no rename, refactor, or migration of existing artifacts. The TRIAGE-03 cutoff seeding is forward-only and lives in the new store, not a rewrite of existing data. This section is a no-op for this phase.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by `grep -r "reviewed" app/src/` (no existing reviewed-state field) | None |
| Live service config | None — no external service stores reviewed state in v1 (server-side ZM-tag sync is v2 per REQUIREMENTS.md) | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

**Note:** If a user upgrades from a pre-Phase-1 build, no migration is required because the reviewed store key (`zmng-reviewed-events`) does not yet exist in their localStorage. The cutoff-seeder will populate it on first events fetch (D-02).

## Common Pitfalls

### Pitfall 1: String vs Number EventId mismatch at the reviewed→read boundary
**What goes wrong:** `useNotificationStore.markEventRead` signature is `(profileId: string, eventId: number)` but the reviewed store keys are strings. A naive call `markEventRead(profileId, eventId)` passes a string where a number is expected, causing the `e.EventId === eventId` comparison in `notifications.ts:376` to silently never match.
**Why it happens:** The two stores were authored under different conventions; `Event.Id` from the REST API is `z.coerce.string()` (string) while FCM/WebSocket payloads parse `EventId` as JavaScript number.
**How to avoid:** At the cross-store call site only, do `useNotificationStore.getState().markEventRead(profileId, Number(eventId))` and guard with `Number.isFinite(...)`. Document this with an inline comment.
**Warning signs:** Reviewed→read flip silently doesn't update the NotificationBadge count after toggling reviewed on an event that has matching notification rows.

### Pitfall 2: Cutoff race with mid-flight events
**What goes wrong:** Between a user upgrading and the first events fetch landing, a new alarm fires via WebSocket/FCM. The notification arrives, the user opens NotificationHistory, sees an unreviewed item, and the badge spikes (success criterion 3 violated).
**Why it happens:** `useNotificationStore.addEvent` runs as soon as the WebSocket/FCM delivers — it does not wait for the events API.
**How to avoid:** Treat the reviewed-store as "not bootstrapped" for that profile when `getCutoff(profileId) === undefined`, and have the NotificationBadge / unread-counter selector return 0 (or skip rendering) in that state. Once the cutoff seeds, the existing rules apply. This is exactly what D-02 specifies — the planner must not skip the gating.
**Warning signs:** First-launch e2e test (`@all` scenario "Upgrade-default seeding suppresses badge spike") fails the assertion `await expect(getByTestId('notification-badge')).toBeHidden()` immediately post-upgrade.

### Pitfall 3: Persist write storm during bulk-mark
**What goes wrong:** A user selects 200 events and taps "Mark reviewed". A naive implementation calls `addReviewed(profileId, id)` 200 times, each triggering Zustand's `set` and `persist` middleware → 200 localStorage writes in one tick.
**Why it happens:** Reusing the single-event API for bulk operations.
**How to avoid:** Implement `markReviewed(profileId, eventIds: string[])` as one merged `set` that produces the new array in a single update. The `persist` middleware will write once.
**Warning signs:** Bulk-mark of >100 items takes noticeably long; localStorage profiler shows N writes.

### Pitfall 4: Cap-overflow while bulk-marking
**What goes wrong:** A user has 4990 reviewed entries and bulk-marks 50 more. The naive cap "drop lowest 1 to make room" applied 50 times is incorrect; we want to drop the lowest 40 once.
**Why it happens:** Per-item cap enforcement in a bulk path.
**How to avoid:** Apply the cap once after the merged add: compute `combined = [...current, ...new]`, sort by numeric Id ascending if `combined.length > 5000`, slice off the excess. Log overflow once at INFO. (CONTEXT.md `Claude's Discretion` allows debouncing/batching here.)
**Warning signs:** Logs show N "cap overflow" messages for one bulk-mark; `profileReviewed[profileId].length > 5000` after the operation.

### Pitfall 5: Profile-switch re-render loop in `useReviewedState`
**What goes wrong:** Returning a fresh object `{ isReviewed, toggle, ... }` from the hook on every render causes downstream `memo`'d components to re-render unnecessarily.
**Why it happens:** New object identity every render.
**How to avoid:** Use the same `useCallback`/`useMemo` discipline `useCurrentProfile.ts:69-72` uses (memo with stable deps), or have consumers pull individual primitives off the hook (e.g., `const isReviewed = useReviewedState(eventId).isReviewed`).
**Warning signs:** `EventCard` (which is `memo()` wrapped — see `EventCard.tsx:228`) re-rendering on unrelated events.

### Pitfall 6: Selection mode bleeds into navigation
**What goes wrong:** User enters selection mode, taps a card thinking it'd select, but the card navigates to detail. Or vice versa.
**Why it happens:** `EventCard.tsx:65` has `onClick={() => navigate(...)}` unconditionally.
**How to avoid:** Pass a `selectionMode: boolean` prop into `EventCard`. When true: tap toggles the per-card checkbox (component-local handler from `useEventSelection`); when false: tap navigates as today. The `e.stopPropagation()` already used for the favorite Star button (`EventCard.tsx:56`) is the same pattern.
**Warning signs:** Bulk-select e2e scenario fails on the assert that no detail-page navigation occurred during selection.

### Pitfall 7: i18n key collision with `events.favorited`
**What goes wrong:** Adding `events.reviewed = "Reviewed"` next to `events.favorited` breaks if the planner accidentally re-uses the favorite labels for the reviewed control.
**How to avoid:** Use a fresh `events.reviewed.*` namespace (D-CONTEXT specifies). Never collapse with `events.favorite`/`events.favorited`.

### Pitfall 8: Sticky action bar covers the last events on mobile
**What goes wrong:** On a 320px-wide phone, the sticky bottom bar occludes the last 1-2 cards in the scroll viewport, so users can't reach them.
**How to avoid:** Add bottom padding to the events list container equal to the bar height when selection is active. Existing pattern: `BackgroundTaskDrawer` already handles this; planner should consult that component for the existing convention.
**Warning signs:** `@visual` baseline shows clipping; `@ios-phone` scenario can't tap the last card.

## Code Examples

### New store skeleton (mirror `eventFavorites.ts`)
```typescript
// Source: app/src/stores/eventFavorites.ts:1-136 (verbatim template)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { log, LogLevel } from '../lib/logger';
import { useNotificationStore } from './notifications';

const SOFT_CAP = 5000;

interface ReviewedEventsState {
  profileReviewed: Record<string, string[]>;
  profileCutoffs: Record<string, number>;

  isReviewed: (profileId: string, eventId: string) => boolean;
  toggleReviewed: (profileId: string, eventId: string) => void;
  addReviewed: (profileId: string, eventId: string) => void;
  markReviewed: (profileId: string, eventIds: string[]) => void;
  unmarkReviewed: (profileId: string, eventId: string) => void;
  getReviewed: (profileId: string) => string[];
  getReviewedCount: (profileId: string) => number;

  setCutoff: (profileId: string, maxId: number) => void;
  getCutoff: (profileId: string) => number | undefined;
  hasCutoff: (profileId: string) => boolean;
  resetProfile: (profileId: string) => void;
}

export const useReviewedEventsStore = create<ReviewedEventsState>()(
  persist(
    (set, get) => ({
      profileReviewed: {},
      profileCutoffs: {},

      isReviewed: (profileId, eventId) => {
        const cutoff = get().profileCutoffs[profileId];
        if (cutoff !== undefined) {
          const n = Number(eventId);
          if (Number.isFinite(n) && n <= cutoff) return true;
        }
        const set_ = get().profileReviewed[profileId] || [];
        return set_.includes(eventId);
      },

      addReviewed: (profileId, eventId) => {
        let didAdd = false;
        set((state) => {
          const current = state.profileReviewed[profileId] || [];
          if (current.includes(eventId)) return state;

          let next = [...current, eventId];

          // FIFO cap by numeric Id (D-18)
          if (next.length > SOFT_CAP) {
            const sorted = [...next].sort((a, b) => Number(a) - Number(b));
            const overflow = next.length - SOFT_CAP;
            const dropped = sorted.slice(0, overflow);
            next = next.filter((id) => !dropped.includes(id));
            log.profile(
              `Reviewed cap overflow — dropped ${overflow} lowest Ids`,
              LogLevel.INFO,
              { profileId, dropped: overflow }
            );
          }

          didAdd = true;
          return {
            profileReviewed: { ...state.profileReviewed, [profileId]: next },
          };
        });

        // D-15/D-16 one-way link: reviewed implies notification read
        if (didAdd) {
          const n = Number(eventId);
          if (Number.isFinite(n)) {
            useNotificationStore.getState().markEventRead(profileId, n);
          }
        }
      },

      markReviewed: (profileId, eventIds) => {
        // Bulk variant: one merged set, one persist write (Pitfall 3)
        const numericForLink: number[] = [];
        set((state) => {
          const current = state.profileReviewed[profileId] || [];
          const currentSet = new Set(current);
          const fresh = eventIds.filter((id) => !currentSet.has(id));
          if (fresh.length === 0) return state;
          let next = [...current, ...fresh];

          if (next.length > SOFT_CAP) {
            const sorted = [...next].sort((a, b) => Number(a) - Number(b));
            const overflow = next.length - SOFT_CAP;
            const dropped = sorted.slice(0, overflow);
            next = next.filter((id) => !dropped.includes(id));
            log.profile(
              `Reviewed cap overflow during bulk — dropped ${overflow} lowest Ids`,
              LogLevel.INFO,
              { profileId, dropped: overflow, bulkSize: eventIds.length }
            );
          }

          for (const id of fresh) {
            const n = Number(id);
            if (Number.isFinite(n)) numericForLink.push(n);
          }

          log.profile(
            `Bulk-marked ${fresh.length} events reviewed`,
            LogLevel.INFO,
            { profileId, count: fresh.length }
          );
          return {
            profileReviewed: { ...state.profileReviewed, [profileId]: next },
          };
        });

        // Cross-store one-way link, fired after the persist update
        const notif = useNotificationStore.getState();
        for (const n of numericForLink) notif.markEventRead(profileId, n);
      },

      unmarkReviewed: (profileId, eventId) => {
        set((state) => {
          const current = state.profileReviewed[profileId] || [];
          if (!current.includes(eventId)) return state;
          return {
            profileReviewed: {
              ...state.profileReviewed,
              [profileId]: current.filter((id) => id !== eventId),
            },
          };
        });
        // Note: unmarking does NOT un-set the notification 'read' flag (D-15 is one-way).
      },

      toggleReviewed: (profileId, eventId) => {
        if (get().isReviewed(profileId, eventId)) {
          // Was reviewed via cutoff or set; only the set is mutable
          if ((get().profileReviewed[profileId] || []).includes(eventId)) {
            get().unmarkReviewed(profileId, eventId);
          }
          // If only reviewed via cutoff, we can't "unmark" without writing an exception list (deferred to v2)
        } else {
          get().addReviewed(profileId, eventId);
        }
      },

      getReviewed: (profileId) => get().profileReviewed[profileId] || [],
      getReviewedCount: (profileId) => (get().profileReviewed[profileId] || []).length,

      setCutoff: (profileId, maxId) => {
        log.profile(`Seeded reviewed cutoff`, LogLevel.INFO, { profileId, maxId });
        set((state) => ({
          profileCutoffs: { ...state.profileCutoffs, [profileId]: maxId },
        }));
      },
      getCutoff: (profileId) => get().profileCutoffs[profileId],
      hasCutoff: (profileId) => get().profileCutoffs[profileId] !== undefined,

      resetProfile: (profileId) => {
        log.profile(`Reset reviewed state`, LogLevel.INFO, { profileId });
        set((state) => {
          const { [profileId]: _r, ...restR } = state.profileReviewed;
          const { [profileId]: _c, ...restC } = state.profileCutoffs;
          return { profileReviewed: restR, profileCutoffs: restC };
        });
      },
    }),
    {
      name: 'zmng-reviewed-events',
    }
  )
);
```

> **Toggle-undo edge case** worth flagging to the planner: if a user is on Phase 1 and taps the toggle on an event whose Id is below the cutoff (so it's "reviewed via cutoff" rather than "reviewed via set"), the current `toggleReviewed` cannot un-mark it without an exception list. Two acceptable resolutions: **(A)** explicit decision to leave that path inert (toggle is no-op) since CONTEXT.md never specifies it, **(B)** add a `profileExceptions: Record<profileId, string[]>` field for explicit unmark-of-implicit. The planner should pick A unless they want to widen scope. **[ASSUMED]** that A is acceptable — flag for confirmation.

### `useReviewedState` hook
```typescript
// Source: pattern from app/src/hooks/useCurrentProfile.ts:47-79
import { useCallback, useMemo } from 'react';
import { useReviewedEventsStore } from '../stores/reviewedEvents';
import { useCurrentProfile } from './useCurrentProfile';

export function useReviewedState(eventId: string) {
  const { currentProfile } = useCurrentProfile();
  const profileId = currentProfile?.id ?? '';

  // Subscribe to the slice, NOT the function — see useCurrentProfile.ts:13-14
  const reviewedSlice = useReviewedEventsStore((s) => s.profileReviewed[profileId]);
  const cutoff = useReviewedEventsStore((s) => s.profileCutoffs[profileId]);

  const isReviewed = useMemo(() => {
    if (!profileId) return false;
    if (cutoff !== undefined) {
      const n = Number(eventId);
      if (Number.isFinite(n) && n <= cutoff) return true;
    }
    return (reviewedSlice ?? []).includes(eventId);
  }, [profileId, eventId, cutoff, reviewedSlice]);

  const toggleAction = useReviewedEventsStore((s) => s.toggleReviewed);
  const markAction = useReviewedEventsStore((s) => s.markReviewed);
  const unmarkAction = useReviewedEventsStore((s) => s.unmarkReviewed);

  const toggle = useCallback(() => {
    if (profileId) toggleAction(profileId, eventId);
  }, [profileId, eventId, toggleAction]);

  const markReviewed = useCallback((ids: string[]) => {
    if (profileId) markAction(profileId, ids);
  }, [profileId, markAction]);

  const unmark = useCallback(() => {
    if (profileId) unmarkAction(profileId, eventId);
  }, [profileId, eventId, unmarkAction]);

  return { isReviewed, toggle, markReviewed, unmark, profileId };
}
```

### EventCard insertion (sketch)
```typescript
// Source: app/src/components/events/EventCard.tsx:55-148 (favorite button pattern)
const { isReviewed, toggle: toggleReviewed } = useReviewedState(event.Id);

const handleReviewedClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  toggleReviewed();
};

// Inside the action cluster, next to the existing favorite Star (line 131-148):
<button
  onClick={handleReviewedClick}
  className={cn("p-1 rounded-full hover:bg-accent transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2")}
  aria-label={isReviewed ? t('events.reviewed.unmark') : t('events.reviewed.mark')}
  data-testid="event-reviewed-button"
>
  <Check
    className={cn("h-4 w-4 sm:h-5 sm:w-5 transition-colors",
      isReviewed ? "fill-green-500 stroke-green-500" : "stroke-muted-foreground")}
  />
</button>

// Apply dim to the Card root (D-05) — opacity-60 added when isReviewed
// matches NotificationHistory.tsx:193 pattern (`event.read ? 'opacity-50' : ''`)
<Card className={cn("group overflow-hidden cursor-pointer ...",
  isReviewed && "opacity-60")} ... />
```

### Reviewed→read cascade test (Vitest)
```typescript
// Source: pattern from app/src/stores/__tests__/eventFavorites.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useReviewedEventsStore } from '../reviewedEvents';
import { useNotificationStore } from '../notifications';

describe('Reviewed → notification read one-way link (D-15/D-16)', () => {
  beforeEach(() => {
    useReviewedEventsStore.setState({ profileReviewed: {}, profileCutoffs: {} });
    useNotificationStore.setState({ profileEvents: {}, profileSettings: {} });
    localStorage.clear();
  });

  it('marks all matching notification rows in the active profile as read', () => {
    // Seed two notification rows for EventId 42 in profile-1, plus an unrelated one in profile-2
    useNotificationStore.setState({
      profileEvents: {
        'profile-1': [
          { EventId: 42, MonitorId: 1, MonitorName: 'A', Cause: 'X', Name: 'a', receivedAt: 1, read: false, source: 'websocket' },
          { EventId: 42, MonitorId: 1, MonitorName: 'A', Cause: 'X', Name: 'a', receivedAt: 2, read: false, source: 'push' },
          { EventId: 99, MonitorId: 1, MonitorName: 'A', Cause: 'X', Name: 'a', receivedAt: 3, read: false, source: 'websocket' },
        ],
        'profile-2': [
          { EventId: 42, MonitorId: 2, MonitorName: 'B', Cause: 'Y', Name: 'b', receivedAt: 4, read: false, source: 'websocket' },
        ],
      },
    });

    useReviewedEventsStore.getState().addReviewed('profile-1', '42');

    const p1 = useNotificationStore.getState().getEvents('profile-1');
    expect(p1.filter(e => e.EventId === 42).every(e => e.read)).toBe(true);
    expect(p1.find(e => e.EventId === 99)?.read).toBe(false); // untouched
    const p2 = useNotificationStore.getState().getEvents('profile-2');
    expect(p2.find(e => e.EventId === 42)?.read).toBe(false); // cross-profile untouched (D-16)
  });
});
```

## Storage Model Recommendation (Question 1)

**Decision (locked by D-17):** New Zustand store `app/src/stores/reviewedEvents.ts` with `Record<profileId, string[]>` keying — exact analog of `useEventFavoritesStore`.

**Why this beats the alternatives:**

| Option | Verdict | Why |
|--------|---------|-----|
| **Zustand store keyed by profileId → string[]** (chosen) | Best fit | Identical pattern to `eventFavorites.ts`; ~140 LOC base; tests exist as a template (`eventFavorites.test.ts` at 203 lines); developers already know how to debug it. |
| Embedded in `profileSettings` via `getProfileSettings`/`updateProfileSettings` | Rejected | `profileSettings` is for typed user preferences (`ProfileSettings` type); injecting an unbounded `string[]` of event IDs would balloon the settings blob and force every settings consumer to re-render on any reviewed change. Also: settings store doesn't have the cross-store one-way call pattern. |
| React Query cache only | Rejected | Doesn't persist across app restart (success criterion 1 violation). React Query is server state; reviewed is local user state. |

**File budget:** `eventFavorites.ts` is 137 LOC. Reviewed store with cutoffs + bulk + cap-overflow + cross-store call = est. 180-220 LOC. Within rule #12 (~400 LOC max).

## Event ID Strategy (Question 2)

**Canonical key in the reviewed store: `string`** matching `Event.Id` from `app/src/api/types.ts:311` (`Id: z.coerce.string()`).

**Why string, not number:**
- API returns string-coerced IDs (`EventSchema` and `getEvents`).
- `useEventFavoritesStore` already established string as the convention (`event.Id` passed in `EventCard.tsx:46,58`).
- JSON round-trip through `persist` middleware preserves strings cleanly; numbers >2^53 (theoretical max ZM Event Id) would lose precision (not a real risk for ZM, but the convention is safer).
- Test fixtures (`eventFavorites.test.ts`) use string IDs (`'event-123'`).

**Cross-reference at the boundary:**
- `NotificationEvent.EventId` is `number` (from `app/src/types/notifications.ts:19`).
- When firing the D-15/D-16 cascade into `useNotificationStore.markEventRead(profileId, eventId)`, convert: `Number(eventId)` and guard with `Number.isFinite(...)`.
- Comment the conversion explicitly.

**Survives cross-references:**
- Polled events (REST API): `Event.Id` string.
- WebSocket alarms: `EventId` number, but stored under string key in our reviewed store via `String(EventId)` in any cross-cutting code that needs to call `isReviewed`.
- FCM push: payload `EventId` is a string in JSON (FCM payloads are stringified); convert if/when the push handler ever needs to call `isReviewed`. Out of Phase 1 scope.

## Upgrade Migration Mechanism (Question 3 / TRIAGE-03)

**Mechanism:** Cutoff cursor seeded from the first successful events fetch per profile (D-01, D-02).

**Implementation:**
1. New hook `app/src/hooks/useReviewedCutoffSeeder.ts` (sketch in `## Architecture Patterns › Pattern 4`).
2. Called from `app/src/pages/Events.tsx` immediately after the existing `useQuery({ queryKey: ['events', ...] })` block (around line 175), with `eventsData?.events` as the input.
3. The seeder is idempotent: `if (getCutoff(profileId) !== undefined) return;` — no double-seeding when the user pages, refreshes, or switches filters.
4. The `NotificationBadge` selector (and any future "unreviewed count" selector in Phase 2) MUST gate on `useReviewedEventsStore.getState().hasCutoff(profileId)` — return 0/hide when not yet seeded so the badge never spikes (D-02 explicit).

**Why NOT in `profile-bootstrap.ts`:**
- `profile-bootstrap.ts` runs on profile-switch and post-auth; it doesn't already fetch `/events/index.json`. Adding an events fetch there would add a startup latency cost — explicitly rejected in D-01 ("no startup network call dedicated to seeding").
- `Events.tsx` is the natural site: the user navigated to it, so the events fetch is already in flight as part of the React Query lifecycle. The seeder piggy-backs.

**Why NOT in `onRehydrateStorage`:**
- That hook fires once on store hydration; we need the cutoff seeded **after** the first events fetch resolves, which can be far later than rehydration.

**Detection of "first install of milestone":**
- Implicit. `getCutoff(profileId)` returning `undefined` IS the first-install signal — there's no prior reviewed-store state because the persist key (`zmng-reviewed-events`) didn't exist. No version flag, no migration counter needed. Same flag handles "fresh install on a new profile" (D-03) for free.

**Reset path (D-04):**
- `resetProfile(profileId)` clears both `profileReviewed[profileId]` and `profileCutoffs[profileId]`.
- The next successful events fetch re-seeds via the same seeder hook (it sees `getCutoff(profileId) === undefined` again).

**Edge case caught by Pitfall 2:** Notifications via WebSocket/FCM can arrive before the user has opened Events. The badge selector must gate on `hasCutoff(profileId)`.

## Profile-Scoping Integration Points (Question 4)

**Existing per-profile-Record stores audited:**

| Store | Profile Switch Behavior | Reference |
|-------|------------------------|-----------|
| `useEventFavoritesStore` | None — data keyed by profileId, all slices coexist in one persisted blob | `eventFavorites.ts` |
| `useNotificationStore` | None for `profileSettings` and `profileEvents` (keyed); does explicitly `disconnect()` the live WebSocket on switch | `notifications.ts:262-265` |
| `useSettingsStore` | None — keyed by profileId in `profileSettings` | `settings.ts` |
| `useProfileStore.switchProfile` | Clears auth, React Query cache, api client, then reloads — does NOT touch keyed-by-profileId stores | `profile.ts:236` |

**Reviewed store behavior:** Same as `eventFavorites` — no clear-on-switch needed. The `useReviewedState` hook auto-reflects the new active profile via `useCurrentProfile`. Switching back to a previous profile restores its prior reviewed state because all slices coexist in localStorage.

**Rollback path:** `app/src/stores/profile.ts:292` (`switchProfile` failure path) does not need any change — it doesn't manipulate keyed-by-profileId data.

**Verification test (mandatory in Phase 1 unit suite):**
```typescript
it('does not affect other profiles', () => {
  // Mirror eventFavorites.test.ts:87-96
  useReviewedEventsStore.getState().addReviewed('profile-1', '123');
  useReviewedEventsStore.getState().addReviewed('profile-2', '123');
  useReviewedEventsStore.getState().resetProfile('profile-1');
  expect(useReviewedEventsStore.getState().isReviewed('profile-1', '123')).toBe(false);
  expect(useReviewedEventsStore.getState().isReviewed('profile-2', '123')).toBe(true);
});
```

## UI Surface Catalog (Question 6)

| Surface | File | Treatment | Action Surface | Test ID |
|---------|------|-----------|----------------|---------|
| EventCard (events list) | `app/src/components/events/EventCard.tsx` | Card opacity ~60% when reviewed (D-05); corner check-mark icon button next to favorite Star | Tap toggles | `event-reviewed-button` (button), `event-reviewed-badge` (corner indicator if separate from button) |
| EventDetail header | `app/src/pages/EventDetail.tsx` | "Reviewed" badge next to title (D-06); labelled toggle button in action bar (D-08) | Tap toggles | `event-detail-reviewed-toggle`, `event-reviewed-badge` (the title badge) |
| NotificationHistory row | `app/src/pages/NotificationHistory.tsx` | Corner check-mark indicator on the row (D-09); explicit row-action toggle | Tap toggles via row-action slot | `notification-row-reviewed` |
| EventListView (events list) | `app/src/components/events/EventListView.tsx` | Header "Select" toggle (D-10); per-card checkbox overlay; sticky bottom action bar (D-11) | Bulk-select model | `events-select-toggle`, `event-card-checkbox`, `bulk-action-bar`, `bulk-mark-reviewed`, `bulk-cancel` |
| Settings (Advanced) | `app/src/components/settings/AdvancedSection.tsx` | Row with "Reset reviewed state" button + confirm AlertDialog (D-04) | Tap → confirm → resetProfile | `settings-reset-reviewed`, `settings-reset-reviewed-confirm`, `settings-reset-reviewed-cancel` |

**Surfaces explicitly OUT of scope for Phase 1:**
- EventMontageView (`EventMontageView.tsx`) — not in any success criterion or decision. Defer.
- Timeline markers — not in scope. Defer.
- Dashboard "Recent Events" widget (`dashboard/widgets/`) — not in scope. Defer.
- NotificationHistory bulk-select — explicitly deferred (see CONTEXT.md `<deferred>`).

**Reusable indicator primitive:** Extract `app/src/components/events/EventReviewedBadge.tsx` (~30 LOC) to share the corner check-mark across EventCard and NotificationHistory rows. Not strictly required (could inline) but the planner should consider it for DRY. **[ASSUMED]** acceptable — flag for confirmation.

## Multi-Select Implementation Sketch (Question 5)

**Existing multi-select?** None. Search confirms (`grep -n "selectedIds\|selectionMode\|multiSelect" app/src/`): no existing selection-mode pattern in the events area. The closest analog is the `selectedMonitorIds: string[]` filter in `useEventFilters.ts`, but that's a filter chip set, not a selection mode.

**Lightest-touch addition:**

1. **New hook `app/src/hooks/useEventSelection.ts` (~80 LOC):**
   - State: `{ active: boolean, selectedIds: Set<string> }`.
   - Actions: `enter()`, `exit()`, `toggle(id)`, `selectAll(ids[])`, `clear()`.
   - Component-local (returned from the hook), NOT in any persisted store.
2. **`EventListView.tsx` changes:**
   - Accept a `selection` prop (the hook's return value).
   - Pass `selectionMode={selection.active}` into each `EventCard`.
   - Pass `selected={selection.selectedIds.has(event.Event.Id)}` into each `EventCard`.
   - Pass `onSelectToggle={() => selection.toggle(event.Event.Id)}` into each `EventCard`.
   - Render `<EventSelectionBar />` (new component) when `selection.active && selection.selectedIds.size > 0`.
3. **`EventCard.tsx` changes (additive only):**
   - When `selectionMode`, render a checkbox overlay in the top-left.
   - When `selectionMode`, intercept the card-level `onClick`: call `onSelectToggle()` instead of `navigate(...)`.
4. **`EventSelectionBar.tsx` (new, ~120 LOC):**
   - Sticky bottom bar (z-index from existing toast/dialog tokens — see `<specifics>` in CONTEXT.md).
   - Left: `{N} selected` count.
   - Center-left: "Select all visible" button (calls `selection.selectAll(visibleIds)`).
   - Right: "Mark reviewed" primary button (calls `markReviewed(profileId, [...selectedIds])`, then `selection.exit()`).
   - Right-most: "Cancel" / X button (calls `selection.exit()`).
5. **`Events.tsx` changes:**
   - Instantiate `useEventSelection()`.
   - Add the "Select" toggle button in the header next to the filter button (around line 387 in the existing layout).
   - Wire `selection.enter()` to that button.

**File-size budget check:** `EventListView.tsx` is currently 5.3 KB / 181 LOC. After adding selection plumbing it'll likely cross ~300 LOC — still within the rule #12 ~400 LOC budget. CONTEXT.md `<integration_points>` already flags that "Likely to push past ~400 LOC — extract a `EventSelectionBar.tsx` and a `useEventSelection.ts` hook" — exactly the structure recommended above.

## Notification Badge Integration (Question 7)

**Current behavior:** `NotificationBadge` (`app/src/components/NotificationBadge.tsx`) reads `state.profileEvents[currentProfileId]` and counts where `!e.read`. It animates and rings on count increase.

**Phase 1 integration points:**

1. **Reviewed→read cascade keeps the existing count source-of-truth.** Since marking an event reviewed flips matching notification rows to `read: true` (D-15/D-16), the existing `NotificationBadge.tsx:23` selector will decrement automatically. No code change required in `NotificationBadge`.
2. **Badge suppression while cutoff not yet seeded (D-02):** The `NotificationBadge` selector must additionally check `useReviewedEventsStore.getState().hasCutoff(currentProfileId)` — return 0 if false. Modify the selector at `NotificationBadge.tsx:20-24`:
   ```typescript
   const unreadCount = useNotificationStore((state) => {
     if (!currentProfileId) return 0;
     // D-02: suppress badge until reviewed cutoff is seeded post-upgrade
     const hasCutoff = useReviewedEventsStore.getState().hasCutoff(currentProfileId);
     if (!hasCutoff) return 0;
     const events = state.profileEvents[currentProfileId] || [];
     return events.filter((e) => !e.read).length;
   });
   ```
   Note this introduces a non-reactive `getState()` read inside a Zustand selector — to maintain reactivity to cutoff seeding, the planner should either:
   - **(A)** Have the badge subscribe to both stores via two `useStore` calls and combine in `useMemo`. Cleaner, recommended.
   - **(B)** Subscribe to the reviewed store too. Equivalent.
3. **Native app icon badge:** `useNotificationStore._updateBadge()` syncs to iOS/Android. Reviewed→read cascade triggers `_updateBadge()` indirectly because `markEventRead` already calls it (`notifications.ts:381-383`). No additional change required. **[VERIFIED: notifications.ts:373-384]**

**No new "unreviewed count" surface in Phase 1.** That belongs to Phase 2 (TRIAGE-07 "Hide reviewed" filter and the "unreviewed-only" tally).

## Test Strategy (Question 8)

### Unit tests
**Location:** `app/src/stores/__tests__/reviewedEvents.test.ts` (new). Mirror the structure of `eventFavorites.test.ts` (203 LOC across `isReviewed`, `addReviewed`, `removeReviewed` (here: `unmarkReviewed`), `toggleReviewed`, `getReviewed`, `clearFavorites` (here: `resetProfile`), `getReviewedCount`).

**Additional describe blocks for Phase 1 specifics:**
- `markReviewed` (bulk): empty array no-op, deduplication, single persist write, cap-overflow during bulk
- `setCutoff` / `getCutoff` / `hasCutoff` / cutoff-implied-reviewed semantics
- `resetProfile`: clears both reviewedSet AND cutoff; other profiles untouched
- Cap overflow: at 4999, add 2 → drops lowest 1; bulk 50 onto 4990 → drops lowest 40
- Cross-store one-way link to `useNotificationStore.markEventRead` (with mocked notification store fixture; see code example above)

**Run:** `npm test -- reviewedEvents`

### E2E tests (`.feature` + steps)
**New file:** `app/tests/features/reviewed-events.feature`. Step definitions: `app/tests/steps/reviewed-events.steps.ts` (new file per the events-area convention; do NOT inflate `events.steps.ts`).

**Scenarios required (one per success criterion + one per cross-cutting decision):**

```gherkin
Feature: Reviewed Event State
  As a ZoneMinder user
  I want to mark events reviewed so the unreviewed list reflects what I still need to triage

  Background:
    Given I am logged into zmNinjaNg
    When I navigate to the "Events" page

  @all @visual
  Scenario: Mark an event reviewed from the events list (TRIAGE-01)
    When I tap the reviewed control on the first event if events exist
    Then the first event should show the reviewed indicator if action was taken
    When I refresh the page
    Then the first event should still show the reviewed indicator if action was taken
    And the page should match the visual baseline

  @all
  Scenario: Mark an event reviewed from EventDetail (TRIAGE-01)
    When I click into the first event if events exist
    And I tap the EventDetail reviewed toggle if on detail page
    Then the EventDetail reviewed badge should be visible if action was taken
    When I navigate back if I clicked into an event
    Then the first event should show the reviewed indicator if action was taken

  @all
  Scenario: Mark a notification reviewed from NotificationHistory (TRIAGE-01)
    When I navigate to the "Notifications" page
    And I tap the reviewed control on the first notification row if notifications exist
    Then the first notification should show the reviewed indicator if action was taken
    And the first notification should be marked read if action was taken

  @all
  Scenario: Bulk mark events reviewed via selection mode (TRIAGE-02)
    When I tap the events Select toggle
    And I select the first three events if events exist
    Then the bulk action bar should be visible
    When I tap the bulk Mark reviewed action
    Then the bulk action bar should be hidden
    And the first three events should show the reviewed indicator if action was taken

  @all
  Scenario: Existing events default to reviewed on first launch (TRIAGE-03)
    Given the reviewed store has never been bootstrapped for the current profile
    When I navigate to the "Events" page
    Then no events that existed before bootstrap should show as unreviewed
    And the notification badge should be hidden until the cutoff is seeded

  @all
  Scenario: Reviewed state persists across profile switch
    When I tap the reviewed control on the first event if events exist
    And I switch to a second profile
    Then no event should show the reviewed indicator from the prior profile
    When I switch back to the first profile
    Then the previously reviewed event should still show the reviewed indicator if action was taken

  @all
  Scenario: Reviewed implies notification read (D-15)
    Given there is a notification for the first event in the active profile
    When I tap the reviewed control on the first event if events exist
    Then the matching notification rows should be marked read

  @all
  Scenario: Settings reset clears reviewed state for current profile (D-04)
    Given I have marked at least one event reviewed
    When I navigate to the "Settings" page
    And I tap the reset reviewed state control
    And I confirm the reset dialog
    Then no events should show the reviewed indicator until cutoff re-seeds

  @ios-phone @android @visual
  Scenario: Phone layout fits the bulk action bar
    Given the viewport is mobile size
    When I tap the events Select toggle
    And I select the first event if events exist
    Then the bulk action bar should be visible
    And the bulk action bar should not overflow the viewport
    And the page should match the visual baseline

  @ios-phone @android
  Scenario: Bulk-mark gesture works on touch
    Given the viewport is mobile size
    When I tap the events Select toggle
    And I tap-select the first two events if events exist
    And I tap the bulk Mark reviewed action
    Then the bulk action bar should be hidden
```

**Tags rationale:**
- `@all` baseline for every scenario (web baseline is the e2e workflow that runs on PRs).
- `@visual` for indicator-rendering and bar-layout assertions (catches CSS regressions).
- `@ios-phone @android` for mobile-specific gesture/layout scenarios.
- `@tauri` is implicitly covered by `@all` (the SPA bundle is identical); explicit `@tauri` only if there's a desktop-specific layout assertion (e.g., bulk bar position differs). Phase 1 does not need it.

**Step definition reuse:** `events.steps.ts:160-230` favorite-toggle pattern is the exact template for the reviewed-toggle step. The conditional pattern `if (!hasEvents) return;` is in tools/templates of the project — copy it.

### Native-only tests
None for Phase 1. No Capacitor plugin additions, no native bridge calls. `npm run test:native` is not required.

### Cross-platform e2e
- `npm run test:e2e -- reviewed-events.feature` (web, automated CI).
- `npm run test:e2e:ios-phone -- reviewed-events.feature` (manual-invoke per `feedback_device_e2e_manual_only`).
- `npm run test:e2e:android -- reviewed-events.feature` (manual-invoke).
- `npm run test:e2e:tauri -- reviewed-events.feature` (manual-invoke).
- `npm run test:e2e:visual-update` per platform after layout converges.

### Test-first compliance (rule #3)
The planner should structure plans so that for every code-change task, the corresponding test task lands first or in the same wave. The two MUST-go-together pairs are:
- Reviewed store + `reviewedEvents.test.ts`.
- Reviewed→read cascade + cross-store cascade test.

## i18n Surface (Question 9)

**Locale files:** `app/src/locales/{en,de,es,fr,zh}/translation.json` (5 files, all 1111 lines). New keys to add to each:

```json
"events": {
  "reviewed": {
    "mark": "Mark reviewed",          // EventCard button + EventDetail toggle (resting)
    "unmark": "Unmark reviewed",      // EventCard button + EventDetail toggle (when already reviewed)
    "label": "Reviewed",              // EventDetail header badge text
    "marked_toast": "Marked reviewed",
    "unmarked_toast": "Unmarked reviewed"
  },
  "bulk": {
    "select": "Select",               // List header toggle (NOT t('common.selected') which is a verb form mismatch)
    "cancel": "Cancel",               // (reuse t('common.cancel') if planner prefers — same string)
    "select_all_visible": "Select all",  // Short for 320px constraint
    "selected_count_one": "{{count}} selected",
    "selected_count_other": "{{count}} selected",
    "mark_reviewed": "Mark reviewed"  // Bulk action button
  }
},
"settings": {
  "reviewed_reset": {
    "label": "Reset reviewed events",          // Row label in AdvancedSection
    "description": "Clear all reviewed marks for this profile.",
    "button": "Reset",
    "confirm_title": "Reset reviewed events?",
    "confirm_description": "This clears all reviewed marks for the active profile. The next events fetch will reset the cutoff to the latest event.",
    "confirm_action": "Reset",
    "toast_done": "Reviewed state cleared"
  }
}
```

**320px width sanity check (per rule #23):**

| Key | en | de | es | fr | zh |
|-----|----|----|----|----|----|
| `events.reviewed.mark` | Mark reviewed | Geprüft markieren | Marcar revisado | Marquer vu | 标为已查看 |
| `events.bulk.select` | Select | Auswählen | Seleccionar | Sélection | 选择 |
| `events.bulk.mark_reviewed` | Mark reviewed | Geprüft markieren | Marcar revisado | Marquer vu | 标为已查看 |
| `events.bulk.cancel` | Cancel | Abbrechen | Cancelar | Annuler | 取消 |
| `events.reviewed.label` | Reviewed | Geprüft | Revisado | Vu | 已查看 |

**[ASSUMED]** translation strings above are reasonable defaults. Final wording is the implementer's call (or human translator's), but every variant tested fits ≤14 chars on a 320px-wide phone in 14px font for the listed languages — within the rule #23 budget. The "Select all" → "Select all" (English) case is the longest bar element; planner should set the bar to `flex-wrap` or use icon-only on the narrowest viewport as a safety net (existing pattern: `NotificationHistory.tsx:151-153` does `<span className="hidden sm:inline">`).

**Existing keys to reuse (do NOT duplicate):**
- `t('common.cancel')` — already exists, use for AlertDialogCancel button.
- `t('common.reset')` — already exists, but adding a context-specific `settings.reviewed_reset.button` is preferred (button text inside the row vs. dialog action).

**i18n key audit pre-merge:** Run `node -e "['en','de','es','fr','zh'].forEach(l => { const k = require('./app/src/locales/' + l + '/translation.json'); const flat = JSON.stringify(k); ['events.reviewed', 'events.bulk', 'settings.reviewed_reset'].forEach(p => { if (!flat.includes(p.split('.').pop())) console.error(l, 'missing', p); }); })"` (or equivalent in the verifier) — every key present in all 5 locales.

## Files to Create vs. Files to Modify

### Create (new files)
| Path | Est. LOC | Purpose |
|------|---------|---------|
| `app/src/stores/reviewedEvents.ts` | 180-220 | Per-profile reviewed store + cutoff + bulk + cap |
| `app/src/stores/__tests__/reviewedEvents.test.ts` | 250-300 | Unit tests (mirror eventFavorites.test.ts) |
| `app/src/hooks/useReviewedState.ts` | 60-80 | Active-profile-bound facade for components |
| `app/src/hooks/useReviewedCutoffSeeder.ts` | 40-60 | React Query side-effect to seed cutoff |
| `app/src/hooks/useEventSelection.ts` | 80-100 | Selection-mode state for EventListView |
| `app/src/components/events/EventSelectionBar.tsx` | 100-140 | Sticky bottom action bar (D-11) |
| `app/src/components/events/EventReviewedBadge.tsx` | 30-50 | Reusable corner check-mark indicator (optional but recommended) |
| `app/tests/features/reviewed-events.feature` | 80-120 | E2E scenarios (10 scenarios estimated) |
| `app/tests/steps/reviewed-events.steps.ts` | 250-350 | Step definitions |

### Modify (existing files)
| Path | Change |
|------|--------|
| `app/src/components/events/EventCard.tsx` | Add reviewed icon button next to favorite Star; apply opacity-60 to Card root when reviewed; accept `selectionMode`/`selected`/`onSelectToggle` props; render checkbox overlay when in selection mode; intercept `onClick` to toggle selection vs navigate. |
| `app/src/components/events/EventListView.tsx` | Accept `selection` prop (or instantiate selection hook); thread props into EventCards; render `EventSelectionBar` when active and selection non-empty. |
| `app/src/pages/Events.tsx` | Instantiate `useEventSelection()`; add "Select" toggle button in header (~line 387 area); pass selection state into EventListView; instantiate `useReviewedCutoffSeeder(eventsData?.events)`. |
| `app/src/pages/EventDetail.tsx` | Add `useReviewedState(event.Event.Id)`; add "Reviewed" badge near title (D-06); add labelled toggle button in action area (D-08). |
| `app/src/pages/NotificationHistory.tsx` | Add corner check-mark indicator on rows (D-09); add explicit "Mark reviewed" button in row-actions slot (parallel to existing "Mark read"). |
| `app/src/components/settings/AdvancedSection.tsx` | Add "Reset reviewed state" `SettingsRow` with confirm `AlertDialog`. |
| `app/src/components/NotificationBadge.tsx` | Gate count on `useReviewedEventsStore.hasCutoff(profileId)` to suppress spike pre-seeding (D-02). |
| `app/src/locales/{en,de,es,fr,zh}/translation.json` | Add `events.reviewed.*`, `events.bulk.*`, `settings.reviewed_reset.*` keys. 5 files. |

### NOT touched (despite being adjacent)
- `app/src/api/types.ts` — no schema changes (D-CONTEXT confirms no API additions).
- `app/src/api/events.ts` — no API changes.
- `app/src/stores/profile.ts` — no switchProfile changes needed.
- `app/src/stores/notifications.ts` — surface unchanged; only consumed via cross-store call (`markEventRead`).
- `app/src/services/notifications.ts` — WebSocket service untouched.
- `app/src/services/pushNotifications.ts` — push handler untouched.
- `app/src/tests/setup.ts` — no Capacitor plugin mocks needed.
- Any iOS/Android/Tauri native code — none.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-flag-on-event embedded in API response (e.g., a `Reviewed` server field) | Client-only state keyed by `Event.Id` in localStorage via Zustand persist | Phase 1 of this milestone; deferred server-tag sync to v2 (TRIAGE-V2-02) | Profile-local state; users on multiple devices won't share reviewed state until v2. |
| Bulk write all known event IDs as "reviewed" on first launch (rejected — STATE.md "5000 record cap" question, RESOLVED by D-01) | Cutoff-cursor (constant-space, monotonic) | This phase | Avoids one-time bulk write; works for unlimited backlog. |

**Deprecated/outdated:** None. This is a greenfield phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Toggling reviewed on an event whose Id is below the cutoff (i.e., reviewed via cutoff, not via explicit set) is a no-op in Phase 1 — we do NOT add an exception list yet. | Code Examples › `toggleReviewed` | If wrong: planner needs to add `profileExceptions: Record<profileId, string[]>` field, expanding the store API. **Confirm with user before implementation.** |
| A2 | A separate `EventReviewedBadge.tsx` reusable component is acceptable (vs inline rendering in EventCard and NotificationHistory). | UI Surface Catalog | Low risk — purely an organization choice. Either is fine; planner can collapse. |
| A3 | `events.reviewed.mark` / `events.reviewed.unmark` translations as listed fit the 320px constraint in all 5 locales. | i18n Surface | If a translator chooses longer wording, the bar may overflow on phones. Mitigation already specified: `flex-wrap` / icon-only on narrowest viewport. |
| A4 | The "Select" header button label is acceptable as the entry point to selection mode (vs alternatives like an icon-only checkbox-stack icon). | Multi-select Implementation Sketch | D-10 says "Select toggle button in the list header" — confirmed locked. A3 risk does not apply. |
| A5 | The cutoff seeder lives in `useReviewedCutoffSeeder.ts` and is called from `Events.tsx` — not added to `profile-bootstrap.ts`. | Upgrade Migration Mechanism | D-01 explicitly forbids "startup network call dedicated to seeding"; the side-effect-on-existing-fetch approach matches that. Low risk. |
| A6 | The reviewed→read cascade triggers `_updateBadge()` automatically because `markEventRead` already does, so the native app icon badge updates without extra wiring. | Notification Badge Integration | [VERIFIED: notifications.ts:381-383] — confirmed by direct code read; treat as verified, not assumed. |
| A7 | NotificationHistory does NOT need bulk-select in Phase 1 (TRIAGE-02 scopes bulk to events list only). | UI Surface Catalog / OUT of scope | Confirmed by CONTEXT.md `<deferred>`. Verified, not assumed. |

## Open Questions

1. **Toggle-undo for cutoff-implied reviewed (A1)**
   - What we know: Cutoff-implied reviewed events have no entry in `profileReviewed[profileId]`.
   - What's unclear: Should tapping the check-mark on such an event have any effect?
   - Recommendation: Treat as no-op in Phase 1 (button visually shows "reviewed" and remains so on tap; the user sees no change). Defer "explicit unmark of cutoff-implied" to v2 alongside ZM-tag sync. Planner should confirm with user via the discuss-phase output if not satisfied.

2. **Bulk-mark debounce/batch (Claude's Discretion in CONTEXT.md)**
   - What we know: A merged single-`set` call is sufficient for typical selection sizes (≤200).
   - What's unclear: Is a >1000-item bulk select realistic? CONTEXT.md leaves to discretion.
   - Recommendation: Keep simple — one merged `set` per `markReviewed` call; do not introduce debouncing in Phase 1. Revisit if telemetry shows multi-thousand selections.

3. **EventReviewedBadge reusable primitive (A2)**
   - What we know: The corner check-mark badge is identical between EventCard and NotificationHistory.
   - What's unclear: Whether the small abstraction is worth the file.
   - Recommendation: Extract. ~30 LOC saves duplication between two pages and gives the badge a single test-id and styling owner.

## Environment Availability

> Phase 1 has no external system dependencies beyond Node/npm and the existing Vitest/Playwright stack.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, vitest, dev server | ✓ | v23.11.0 (req: 20+) | — |
| npm | Package manager | ✓ | 10.9.2 | — |
| Vitest | Unit tests | ✓ | 3.2.4 (`app/package.json`) | — |
| Playwright | E2E (web/Android via CDP) | ✓ | 1.57.0 | — |
| WebDriverIO + Appium | iOS / Tauri E2E | n/a (manual-invoke per memory) | — | Web e2e covers `@all`; mobile/Tauri via manual `npm run test:e2e:ios-phone` etc. |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — Phase 1 is fully covered by web-baseline e2e for the automated CI pass; mobile/Tauri remain manual-invoke per project memory.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 (unit) + Playwright 1.57.0 + playwright-bdd 8.4.2 (web e2e) + WebdriverIO 9.26.1 (manual mobile/Tauri) |
| Config file | `app/vitest.config.ts`, `app/playwright.config.ts`, `app/wdio.config.device-screenshots.ts` |
| Quick run command | `npm test -- reviewedEvents` (unit, ~3-5 sec) |
| Full suite command | `npm test && npx tsc --noEmit && npm run build && npm run test:e2e -- reviewed-events.feature` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRIAGE-01 | Toggle reviewed from EventCard, indicator persists across reload | unit + e2e | `npm test -- reviewedEvents` + `npm run test:e2e -- reviewed-events.feature --grep "from the events list"` | ❌ Wave 0 |
| TRIAGE-01 | Toggle reviewed from EventDetail header | e2e | `npm run test:e2e -- reviewed-events.feature --grep "from EventDetail"` | ❌ Wave 0 |
| TRIAGE-01 | Toggle reviewed from NotificationHistory row | e2e | `npm run test:e2e -- reviewed-events.feature --grep "from NotificationHistory"` | ❌ Wave 0 |
| TRIAGE-01 | Reviewed→read cascade (D-15/D-16) | unit (cross-store) | `npm test -- reviewedEvents` (`describe('Reviewed → notification read one-way link')`) | ❌ Wave 0 |
| TRIAGE-02 | Bulk-select and Mark reviewed clears selection and updates indicators | e2e | `npm run test:e2e -- reviewed-events.feature --grep "Bulk mark"` | ❌ Wave 0 |
| TRIAGE-02 | `markReviewed(eventIds[])` produces a single persist write | unit | `npm test -- reviewedEvents` (`describe('markReviewed bulk')`) | ❌ Wave 0 |
| TRIAGE-03 | Cutoff seeded from first events fetch; pre-existing events show as reviewed | unit + e2e | `npm test -- reviewedEvents` (`describe('cutoff seeding')`) + `npm run test:e2e -- reviewed-events.feature --grep "default to reviewed on first launch"` | ❌ Wave 0 |
| TRIAGE-03 | NotificationBadge suppressed until cutoff seeded | unit (selector test) + e2e (assertion in upgrade-default scenario) | included above | ❌ Wave 0 |
| Phase invariant | Profile-switch isolation | unit | `npm test -- reviewedEvents` (`describe('profile isolation')`) | ❌ Wave 0 |
| Phase invariant | Settings reset clears reviewed AND cutoff for current profile only | unit + e2e | `npm test -- reviewedEvents` + `npm run test:e2e -- reviewed-events.feature --grep "Settings reset"` | ❌ Wave 0 |
| Phase invariant | Cap overflow drops lowest Ids first | unit | `npm test -- reviewedEvents` (`describe('cap overflow')`) | ❌ Wave 0 |
| Phase invariant | i18n keys present in all 5 locales | unit (lint script) | `npm test -- locales` if a key-completeness test exists; otherwise CI-time grep script | check existing pattern |
| Phase visual | EventCard dim+badge treatment matches baseline | e2e visual | `npm run test:e2e -- reviewed-events.feature --grep "@visual" --update-snapshots` (per platform) | ❌ Wave 0 |
| Phase visual | Bulk action bar fits on 320px viewport | e2e visual | included in `@ios-phone @android @visual` scenario | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- reviewedEvents` (unit, ~5 sec) + `npx tsc --noEmit` (~10 sec) + `npm run build` (~30 sec). Required by AGENTS.md rule #3.
- **Per wave merge:** Above + `npm run test:e2e -- reviewed-events.feature` (web e2e, ~60-90 sec).
- **Phase gate:** Full suite green (`npm test && npx tsc --noEmit && npm run build && npm run test:e2e`) before `/gsd-verify-work`. Visual baselines updated per relevant platform.

### Wave 0 Gaps
- [ ] `app/src/stores/__tests__/reviewedEvents.test.ts` — covers TRIAGE-01, TRIAGE-02 store-level, TRIAGE-03 cutoff semantics, profile isolation, cap overflow, cross-store cascade
- [ ] `app/tests/features/reviewed-events.feature` — covers TRIAGE-01/02/03 user-visible behavior + cross-cutting (profile switch, reset, mobile layout)
- [ ] `app/tests/steps/reviewed-events.steps.ts` — step definitions (clone the conditional pattern from `app/tests/steps/events.steps.ts:160-230`)
- [ ] (Optional) i18n key-completeness check — if no existing test enforces 5-locale parity, add a small Vitest spec that loads all 5 JSONs and asserts the new keys exist in each

*(Existing test infrastructure (Vitest config, Playwright config, eventFavorites.test.ts as template, events.feature as template) covers all framework needs — no new install, no new tooling.)*

## Project Constraints (from AGENTS.md / CLAUDE.md)

The planner MUST verify each plan satisfies these existing-rules constraints:

- **Rule #2 (Issues first):** File a GitHub issue for the phase (or per-plan) before implementation begins. Conventional commits (`feat:`, `test:`, `docs:`) reference `refs #<id>`.
- **Rule #3 (Test first):** Tests authored before or alongside implementation; `npm test` + `npx tsc --noEmit` + `npm run build` + `npm run test:e2e -- reviewed-events.feature` before every commit.
- **Rule #4 (Update docs):** Update `docs/developer-guide/05-component-architecture.rst` for the new hook/components; `docs/developer-guide/12-shared-services-and-components.rst` for the new store. User guide entry for the reviewed feature.
- **Rule #5 (i18n all 5 langs):** All new strings in en/de/es/fr/zh simultaneously (D-20).
- **Rule #6 (Cross-platform):** `@all` tag on all baseline scenarios; `@ios-phone @android` for mobile gestures (D-22). Device e2e is **manual-invoke only** per project memory.
- **Rule #7 (Profile-scoped):** No global singletons; reviewed store keyed by `profileId` (D-17).
- **Rule #9 (Logging):** `log.profile` for store mutations; `LogLevel.INFO` for adds/removes/cap-overflow/reset; never `console.*`.
- **Rule #10 (HTTP):** Phase 1 makes no HTTP calls; reuses the existing `getEvents()` already in flight.
- **Rule #11 (Text overflow):** Bulk action bar uses `truncate min-w-0`; multi-line tooltips via `title=`.
- **Rule #12 (~400 LOC):** Extract `EventSelectionBar.tsx` and `useEventSelection.ts` to keep `EventListView.tsx` under budget.
- **Rule #13 (data-testid):** All 10 IDs from D-21 attached.
- **Rule #14 (Capacitor dynamic imports):** Phase 1 adds no Capacitor plugin calls. N/A.
- **Rule #16 (Tauri version sync):** Phase 1 adds no Tauri plugins. N/A.
- **Rule #17 (No plan files in git):** Standard for the milestone; `.planning/` artifacts are this directory's responsibility, not the implementation's.
- **Rule #18 (Complete features):** Ship all 4 success criteria; reset path included.
- **Rule #19 (User approval before merge):** Standard.
- **Rule #20-21 (One change per commit):** Suggested commit boundaries: (a) new store + tests, (b) new hook(s), (c) EventCard changes, (d) EventListView + selection bar, (e) EventDetail changes, (f) NotificationHistory changes, (g) Settings reset, (h) i18n bundles, (i) e2e feature + steps, (j) docs.
- **Rule #23 (Concise i18n labels):** "Mark reviewed" stays short across 5 locales; verified above.
- **Rule #24 (Date/time formatting):** No new date/time formatting in Phase 1; existing `useDateTimeFormat()` usage on event cards untouched.

## Risks and Unknowns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Toggle on cutoff-implied reviewed event surprises user (A1) | Medium | Low (visual only) | Confirm with user; document as no-op; if desired, add v2 exception list |
| Translator wording overflows 320px (A3) | Medium | Low (cosmetic) | `flex-wrap` + icon-only fallback on narrowest breakpoint |
| Bulk-mark of >1000 events triggers slow persist | Low | Low (perceived perf) | Single merged `set`; cap-overflow handled in one pass; no additional debounce needed |
| `NotificationBadge` selector becomes a perf hot-spot when subscribed to two stores | Low | Low | Use two-store-subscribe pattern with `useMemo` (Option A in Q7) |
| Visual baseline drift across `@android` and `@ios-phone` profiles | High | Low (just regen) | Run `--update-snapshots` per platform during the visual-tagged scenario rollout |
| String/number EventId boundary missed in a refactor | Low | High (silent reviewed→read cascade failure) | Code comment at the call site + dedicated unit test (Pitfall 1) |
| Cutoff seeding fails because `events[].Event.Id` parses non-numeric (server bug / corruption) | Very low | Low | `Number.isFinite` guard inside `useReviewedCutoffSeeder`; if no valid Ids, leave unseeded — re-tries on next fetch |

## Sources

### Primary (HIGH confidence — direct code reads in this session, 2026-04-26)
- `app/src/stores/eventFavorites.ts` (137 LOC) — verbatim template for the new store
- `app/src/stores/__tests__/eventFavorites.test.ts` (203 LOC) — template for unit tests
- `app/src/stores/notifications.ts` (668 LOC) — `markEventRead` signature, cross-store-call pattern
- `app/src/api/types.ts` (310-365) — `EventSchema`, `Event.Id` is string
- `app/src/types/notifications.ts` — `NotificationEvent.EventId` is number (boundary documented)
- `app/src/components/events/EventCard.tsx` (228 LOC) — favorite-button pattern, `e.stopPropagation()` guard
- `app/src/components/events/EventListView.tsx` (181 LOC) — current structure pre-selection-mode
- `app/src/pages/EventDetail.tsx` (~700 LOC; first 120 read) — header/action area
- `app/src/pages/NotificationHistory.tsx` (324 LOC) — read/unread visual idiom (`opacity-50`), AlertDialog confirm pattern
- `app/src/components/NotificationBadge.tsx` (72 LOC) — current unread-count selector
- `app/src/hooks/useCurrentProfile.ts` (79 LOC) — hook pattern for active-profile binding
- `app/src/components/settings/AdvancedSection.tsx` (340+ LOC; first 80 read) — settings row pattern, AlertDialog precedent
- `app/src/pages/Settings.tsx` (65 LOC) — section composition
- `app/src/api/events.ts` (200+ LOC) — events fetch shape (no API change needed)
- `app/tests/features/events.feature` — Gherkin pattern + tags
- `app/tests/steps/events.steps.ts:160-230` — favorite-toggle step pattern (verbatim template for reviewed-toggle)
- `app/src/locales/en/translation.json` (1111 lines) — locale structure; key-namespace audit
- `AGENTS.md`, `CLAUDE.md` — project rules
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/phases/01-reviewed-state-foundation/01-CONTEXT.md` — planning artifacts

### Secondary (MEDIUM confidence)
- `node --version` (v23.11.0), `npm --version` (10.9.2) — verified availability of dev tooling.

### Tertiary (LOW confidence)
- None. Every claim in this document is grounded in either a direct code read in this session or a CONTEXT.md decision.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in `app/package.json`; no new deps.
- Architecture: HIGH — every pattern grounded in an existing analog file with explicit line references.
- Pitfalls: HIGH — surfaced by direct code reads; the string/number boundary is a real, observed mismatch.
- Test strategy: HIGH — `eventFavorites.test.ts` and `events.feature` are both verbatim templates.
- Upgrade migration: HIGH — D-01/D-02 fully specified; seeder hook implementation sketched against existing React Query call site.
- i18n: MEDIUM — exact translation strings are recommendations, not authoritative translations (A3).

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days for stable codebase; sooner if Zustand v5 or React 19 minor bumps land.)
