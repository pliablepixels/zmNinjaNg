# Phase 1: Reviewed State Foundation - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-profile reviewed-event store with toggle UI on EventCard, EventDetail header, and NotificationHistory rows; bulk multi-select on EventListView with a single bulk action (Mark reviewed); upgrade-safe default via a per-profile cutoff so the unreviewed count never spikes after install. Phase 1 ships the store, the indicator, the toggles, the bulk-select model, and the upgrade default — every later phase reads or writes this store.

Out of scope: hiding reviewed events (Phase 2 owns the "hide reviewed" filter toggle), saved filter presets, reviewed-state sync via ZM tags (v2), bulk delete or bulk favorite from selection mode.

</domain>

<decisions>
## Implementation Decisions

### Upgrade default mechanism (TRIAGE-03)
- **D-01:** Use a **cutoff cursor** per profile, stored as `maxEventIdAtCutoff: Record<profileId, number>`. An event is reviewed when `(event.Id <= cutoff) || reviewedSet.has(event.Id)`. No bulk write at first launch, no startup network call dedicated to seeding, no 5000-record cap on the implicit baseline.
- **D-02:** Cutoff is seeded from the **highest `Event.Id`** in the first successful events API response after upgrade, per profile. ZM event Ids are monotonic, so this is a correct ordering boundary. Until seeded, treat the store as "not bootstrapped" for that profile and suppress the unreviewed badge so the spike never appears even if the user opens NotificationHistory before the events page.
- **D-03:** Apply the same seeding rule to **profiles added after** this milestone ships — first successful events fetch sets that profile's cutoff. Behavior is consistent across upgrade-vs-add; new profiles do not start with a wall of historical "unreviewed" rows.
- **D-04:** Reviewed state is **resettable per profile** from Settings via a confirm dialog. Reset clears both the explicit reviewedSet AND the cutoff, then the cutoff re-seeds on the next successful events fetch.

### Reviewed visual indicator
- **D-05:** Reviewed events get **subtle dim (opacity ~60%) plus a small filled check-mark badge in the top-right corner** of the card/row. Dim matches the existing read-notification visual language so users already understand "lower priority"; the check-mark gives a positive at-a-glance cue and doubles as the tap target's resting state.
- **D-06:** EventDetail header shows a **"Reviewed" badge** near the title when the event is reviewed (in addition to the toggle button — see D-08).

### Reviewed control entry points
- **D-07:** EventCard adds a **check-mark icon button next to the existing favorite Star** in the top-right action cluster. Single tap toggles. Filled-green when reviewed, outline-muted when not. Mirrors the existing favorite pattern; no long-press, no overflow menu.
- **D-08:** EventDetail header gets a **labelled "Mark reviewed" / "Reviewed ✓" toggle button** in the action bar next to existing actions (back, favorite, etc.). No auto-mark-on-view — visiting detail does not flip state. User stays in control.
- **D-09:** NotificationHistory rows surface the same **corner check-mark** indicator (consistent with EventCard treatment); the explicit "Mark reviewed" toggle on a notification row reuses the existing row-action slot pattern.

### Bulk multi-select on EventListView (TRIAGE-02)
- **D-10:** Selection mode is entered via a **"Select" toggle button in the list header**, next to the filter controls. Cards swap from navigate-on-tap to select-on-tap; a checkbox appears in each card's top-left. "Cancel" exits the mode. Discoverable across web / mobile / Tauri / TV remote — no hidden gestures.
- **D-11:** When ≥1 item is selected a **sticky bottom action bar** slides up showing `{N} selected` on the left and a **single primary action: "Mark reviewed"** on the right. Bar also includes a "Select all visible" shortcut and a Cancel/clear control. Bottom placement is thumb-reachable on mobile and matches the standard batch-selection idiom.
- **D-12:** Phase 1 exposes **only "Mark reviewed"** as a bulk action — no bulk delete, no bulk favorite, no bulk unmark. Single-tap toggle on the card already covers undoing for one item. Keep the action surface minimal; widen later if telemetry shows demand.
- **D-13:** After the bulk action runs, **clear the selection and exit selection mode immediately**, with indicators updated in place (per success criterion 2).

### Reviewed vs notification "read" semantics
- **D-14:** **Two separate stores, two separate concepts.** `useNotificationStore.read` continues to mean "this notification row was opened" (notification-row-level). New `useReviewedStore.reviewed` means "this event was triaged" (event-level). They answer different questions and persist independently.
- **D-15:** **One-way link: reviewed implies read.** Marking an event reviewed flips the matching notification rows in `useNotificationStore` to `read`. Marking a notification read does NOT mark the underlying event reviewed. Reduces NotificationHistory clutter after triage without confusing the two semantics.
- **D-16:** When the reviewed→read flip fires, it flips **all notification rows for that EventId in the active profile** (not just the most recent). Handles push retry and poll-fallback duplicates so no stale "New" badges remain. Cross-profile rows are untouched per rule #7.

### Storage shape
- **D-17:** New store at `app/src/stores/reviewedEvents.ts`, modelled on `app/src/stores/eventFavorites.ts`:
  - `profileReviewed: Record<string, string[]>` — explicit reviewed event Ids per profile (Set semantics, persisted as array)
  - `profileCutoffs: Record<string, number>` — max-Id cutoff per profile from D-02
  - API: `isReviewed(profileId, eventId)`, `toggleReviewed(profileId, eventId)`, `markReviewed(profileId, eventIds: string[])`, `unmarkReviewed(profileId, eventId)`, `setCutoff(profileId, maxId)`, `getCutoff(profileId)`, `resetProfile(profileId)`
  - Persisted via Zustand `persist` middleware under the key `zmng-reviewed-events`
- **D-18:** Add a **soft cap of 5000 explicit reviewedSet entries per profile** (the cutoff handles the rest). On overflow, drop the lowest Ids first (FIFO by Id, since lower-Id events are also implicitly reviewable via a cutoff bump). Log overflow at INFO via `log.profile`. Confirms the STATE.md open question.

### Hook layer
- **D-19:** New `useReviewedState` hook at `app/src/hooks/useReviewedState.ts` exposes `(eventId) => { isReviewed, toggle, markReviewed, unmark }` bound to the active profile via `useCurrentProfile`. Hides the `(event.Id <= cutoff) || set.has(event.Id)` rule from consumers.

### Cross-cutting (per AGENTS.md)
- **D-20:** All new strings — toggle labels, badge text, sticky-bar copy, confirm-dialog text, settings reset entry — go through i18next and ship in en/de/es/fr/zh simultaneously. Labels stay short enough to fit on a 320px-wide phone (rule #23).
- **D-21:** All new interactive elements get `data-testid="kebab-case"` (rule #13). Required test IDs at minimum: `event-reviewed-button`, `event-reviewed-badge`, `events-select-toggle`, `event-card-checkbox`, `bulk-action-bar`, `bulk-mark-reviewed`, `bulk-cancel`, `event-detail-reviewed-toggle`, `notification-row-reviewed`, `settings-reset-reviewed`.
- **D-22:** New `.feature` scenarios in `app/tests/features/` cover: single-tap toggle on card, bulk-select-and-mark, EventDetail toggle, NotificationHistory toggle, upgrade-default seeding, profile-switch isolation, reviewed→read one-way link, settings reset. Tagged `@all` for web baseline; `@android @ios-phone` for mobile gestures; `@visual` for the dim+badge treatment.

### Claude's Discretion
- Exact opacity value for the dim treatment (60% is the baseline guess; planner may tune to match existing read-notification dim).
- Exact icon component for the check-mark (likely `lucide-react`'s `Check` or `CheckCheck` — matches existing iconography).
- Whether to debounce or batch persist writes during bulk-mark of a large selection.
- TypeScript types and Zod schema additions live with the implementation; no API call here, so no `app/src/api/types.ts` changes expected.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project rules and constraints
- `AGENTS.md` — All 25 project rules; rules 5 (i18n), 7 (profile-scoped settings), 12 (~400 LOC), 13 (`data-testid`), 14 (Capacitor dynamic imports), 24 (date/time via `useDateTimeFormat`) apply directly.

### Milestone planning
- `.planning/PROJECT.md` — Core value, constraints, decisions.
- `.planning/REQUIREMENTS.md` §TRIAGE — TRIAGE-01, TRIAGE-02, TRIAGE-03 (the three requirements this phase covers).
- `.planning/ROADMAP.md` §"Phase 1: Reviewed State Foundation" — Goal, dependencies, success criteria, phase-transition notes for Phase 1 → 2.
- `.planning/STATE.md` §"Open Questions" — "Reviewed-state cardinality cap (default 5000 per profile) — confirm in Phase 1 plan" (resolved by D-18).

### Codebase analogs (reference patterns to follow)
- `app/src/stores/eventFavorites.ts` — Closest existing analog for the reviewed store (per-profile Set, `persist` middleware, identical API shape).
- `app/src/stores/notifications.ts` — Owns `markEventRead` / `markAllRead`; the cross-store call site for D-15 (reviewed→read flip) lives here.
- `app/src/stores/profile.ts` — `switchProfile` semantics; reviewed store is profile-scoped and does not need clearing on switch (data is keyed by profileId).
- `app/src/stores/settings.ts` — Pattern for profile-scoped settings; settings reset entry (D-04) lives in the Settings page.
- `app/src/components/events/EventCard.tsx` — Tap-target cluster (Star button) where D-07 inserts the check-mark button; uses `useEventFavoritesStore` as a model for the new `useReviewedState` hook usage.
- `app/src/components/events/EventListView.tsx` — Where selection mode is introduced (D-10); currently no selection state.
- `app/src/pages/EventDetail.tsx` — Header action bar where D-08 toggle lives.
- `app/src/pages/NotificationHistory.tsx` — Existing read/unread row treatment (`opacity-50`, "New" badge) and `markEventRead` call sites; D-09 + D-15 + D-16 changes land here.
- `app/src/hooks/useCurrentProfile.ts` — Pattern for `useReviewedState` (D-19) — `useShallow` profile binding to avoid re-renders.

### Codebase maps (consult as needed)
- `.planning/codebase/STRUCTURE.md` — Where new files go (`stores/`, `hooks/`, locales).
- `.planning/codebase/CONVENTIONS.md` — Naming, store/hook patterns, store-cross-call patterns.
- `.planning/codebase/STACK.md` — Zustand `persist`, React Query keying.

### Research
- `.planning/research/SUMMARY.md` — "Decision Point 4" on TRIAGE-03 default behavior.
- `.planning/research/PITFALLS.md` — General pitfalls (Phase 1 has no FCM/native exposure, but referenced for cross-phase awareness).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useEventFavoritesStore` (`app/src/stores/eventFavorites.ts`): exact structural template for the new `useReviewedEventsStore` — same per-profile keying, same `persist` middleware, same toggle/add/remove/clear/count surface. Copy-shape, then add the cutoff fields.
- `useCurrentProfile` (`app/src/hooks/useCurrentProfile.ts`): the established hook for profile-bound subscriptions, including `useShallow` to prevent infinite re-renders. `useReviewedState` (D-19) builds on it.
- `useNotificationStore` (`app/src/stores/notifications.ts`): exposes `markEventRead(profileId, eventId)`. D-15 calls this from inside `markReviewed`/`toggleReviewed` to fire the one-way link.
- `app/src/components/ui/checkbox.tsx`: existing Radix-on-shadcn checkbox primitive — used for selection-mode card checkboxes (D-10).
- `app/src/components/ui/button.tsx` + `data-testid` conventions: pattern for the EventDetail header toggle (D-08) and the bulk action bar buttons (D-11).
- `app/src/components/ui/alert-dialog.tsx`: pattern for the Settings reset confirm dialog (D-04). NotificationHistory's clear-history dialog is a working example.
- `app/src/lib/logger.ts` `log.profile` helper: used by `eventFavorites` already; reuse for cap-overflow logging (D-18) and reset events (D-04).

### Established Patterns
- **Profile-scoped state via `Record<profileId, T[]>`** — `eventFavorites`, `notifications`, `settings.profileSettings`. Reviewed store follows the same shape (D-17).
- **`Zustand` + `persist` with a stable name key** — `zmng-event-favorites`, `zmng-notifications`, etc. Reviewed store uses `zmng-reviewed-events` (D-17).
- **Toggle pattern next to existing actions** — `EventCard` already shows the favorite Star with `e.stopPropagation()` so the row-tap navigation isn't triggered. Apply the same guard for the new check-mark button (D-07).
- **Dim-on-state via `opacity-50` on the row container** — `NotificationHistory` already does this for `event.read`. Reuse the same Tailwind utility for the reviewed dim treatment (D-05) so the visual language is consistent.
- **i18next dot-namespaced keys** — new keys live under a fresh `events.reviewed.*` and `events.bulk.*` namespace, plus `settings.reviewed_reset.*` for the reset action.

### Integration Points
- `app/src/stores/reviewedEvents.ts` (new) — entry point for the store.
- `app/src/hooks/useReviewedState.ts` (new) — hook consumed by EventCard, EventDetail, NotificationHistory rows, and the bulk action bar.
- `app/src/components/events/EventCard.tsx` — adds the check-mark button next to the Star (D-07) and applies the dim+badge visuals (D-05) when reviewed.
- `app/src/components/events/EventListView.tsx` — adds the "Select" toggle in the header (D-10), the selection state model, the per-card checkbox overlay, and renders the sticky bottom action bar (D-11) when selection is non-empty. Likely to push past ~400 LOC — extract a `EventSelectionBar.tsx` and a `useEventSelection.ts` hook to honor rule #12.
- `app/src/pages/EventDetail.tsx` — adds the labelled toggle in the header action area (D-08) and the "Reviewed" badge near the title (D-06).
- `app/src/pages/NotificationHistory.tsx` — adds the corner check-mark indicator on rows (D-09); does NOT need bulk multi-select in Phase 1 (TRIAGE-02 scopes bulk to the events list only).
- `app/src/stores/notifications.ts` — no surface change; `markReviewed` calls into `markEventRead` from `useReviewedEventsStore` (D-15, D-16). One-direction call only.
- `app/src/api/events.ts` — no API additions; reviewed state is client-only for v1 (server-side ZM-tag sync is v2 per `REQUIREMENTS.md`).
- `app/src/pages/Settings.tsx` (or `app/src/components/settings/AdvancedSection.tsx`) — adds the "Reset reviewed state for this profile" entry (D-04) with confirm dialog.
- `app/src/locales/{en,de,es,fr,zh}/translation.json` — new strings under `events.reviewed.*`, `events.bulk.*`, `settings.reviewed_reset.*` keys.
- `app/src/tests/setup.ts` — no Capacitor plugin additions for Phase 1.
- `app/tests/features/reviewed-events.feature` (new) and step definitions — see D-22.

</code_context>

<specifics>
## Specific Ideas

- "Subtle dim" for the reviewed treatment matches the existing `opacity-50` on read notification rows (`NotificationHistory.tsx:193`) — reuse the same Tailwind utility (or `opacity-60` if the planner finds 50% reads as "disabled" rather than "lower priority"). Goal: the visual idiom is already familiar to existing users.
- The check-mark button on EventCard is "next to the favorite Star, in the same top-right action cluster" (`EventCard.tsx:130-148`) — same paddings, same hover ring, same `e.stopPropagation()` guard so row-tap still navigates.
- The sticky bottom action bar pattern should match the project's existing toast/dialog elevation system (z-index, backdrop blur on glass surfaces) — no new design tokens.
- The "Reviewed" badge on EventDetail uses the existing `Badge` primitive (`app/src/components/ui/badge.tsx`) with the `secondary` or a new `success` variant; planner picks. Same primitive used today for the "Archived" badge on EventCard.

</specifics>

<deferred>
## Deferred Ideas

- **Bulk-mark from NotificationHistory** — TRIAGE-02 scopes bulk to the events list; if needed later, extend the same selection model to NotificationHistory in a follow-up phase or as part of v1.x.
- **"Mark unreviewed" as a bulk action** — D-12 keeps Phase 1 to a single bulk action. Add later if telemetry shows users want bulk-undo (single-tap toggle on a card already covers single-item undo).
- **Saved filter presets including reviewed-state** — TRIAGE-V2-01 in `REQUIREMENTS.md`.
- **Reviewed-state sync via ZoneMinder event tags** — TRIAGE-V2-02. Stays profile-local in v1.
- **Server-side persistence so reviewed state survives a fresh install** — out of scope per `REQUIREMENTS.md` "Out of Scope" (account-bound or cloud-synced reviewed-state).
- **AI summarize-my-last-24h digest** — TRIAGE-V2-03.
- **"Hide reviewed" toggle on the events list** — owned by Phase 2 (TRIAGE-07). Phase 1 must NOT auto-hide reviewed rows.

</deferred>

---

*Phase: 1-Reviewed State Foundation*
*Context gathered: 2026-04-26*
