# Phase 1: Reviewed State Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 1-Reviewed State Foundation
**Areas discussed:** Upgrade default mechanism, Reviewed visual indicator, Bulk multi-select UX, Reviewed vs notification 'read'

---

## Upgrade default mechanism (TRIAGE-03)

### Q1: How should existing events default to reviewed at first install?

| Option | Description | Selected |
|--------|-------------|----------|
| Cutoff cursor | Store one number per profile: `maxEventIdAtFirstLaunch`. Any event with `Id ≤ cutoff` is implicitly reviewed (no per-event record). Anything new is unreviewed unless explicitly marked. Scales forever, no 5000 cap, no startup network call. | ✓ |
| Bulk write at first launch | On first launch, fetch the recent events list and write a reviewed record for each. Simpler 'one source of truth' but bounded by the cap, costs an extra API call, older events stay unreviewed forever. | |
| Hybrid | Cursor for the implicit baseline AND a one-time 'mark everything as reviewed' user action in settings. | |

**User's choice:** Cutoff cursor.

### Q2: How should the per-profile cutoff be initialized and what does it key on?

| Option | Description | Selected |
|--------|-------------|----------|
| Max event Id, set on first successful events fetch | Cutoff = highest `Event.Id` from the first successful events API response post-upgrade, per profile. ZM event Ids are monotonic. Until seeded, treat the store as 'not bootstrapped' so the badge spike never appears. | ✓ |
| Timestamp, set at first launch immediately | Cutoff = wall-clock at first launch. Anything older is implicit-reviewed. Works fully offline but vulnerable to ZM clock skew and late-arriving historical events. | |
| Both — timestamp seed, upgraded to max-Id on first fetch | Two-stage: timestamp immediately, then replace with max-Id on first fetch. | |

**User's choice:** Max event Id, set on first successful events fetch.

### Q3: What about profiles added AFTER this milestone ships?

| Option | Description | Selected |
|--------|-------------|----------|
| Seed cutoff on profile creation too | Same rule applies: highest `Event.Id` at first successful fetch becomes that profile's cutoff. Consistent behavior across upgrade-vs-add. | ✓ |
| No cutoff for new profiles | Treat new profiles as a fresh slate; every existing event is unreviewed. | |
| Ask the user per-profile at creation | Prompt 'Mark all existing events on this server as reviewed?' Yes/No at profile creation. | |

**User's choice:** Seed cutoff on profile creation too.

### Q4: Should the cutoff be resettable, and where?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — in profile/settings, with confirm dialog | User can hit 'Reset reviewed state for this profile' in Settings, clearing both the explicit reviewed Set AND the cutoff. Confirm dialog because destructive. | ✓ |
| No reset in v1 | Cutoff is set-once; defer reset to a later phase. | |

**User's choice:** Yes — in profile/settings, with confirm dialog.

---

## Reviewed visual indicator

### Q1: What should a reviewed event look like across EventCard, NotificationHistory row, and EventDetail header?

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle dim + corner check-mark badge | opacity-60 dim plus a small filled check-mark in the top-right corner. Dim matches existing read-notification visual language; check-mark is the positive cue. EventDetail shows a 'Reviewed' badge near the title. | ✓ |
| Dim only (no badge) | Just opacity reduction. Quietest but no positive-state cue and no obvious tap target. | |
| Check-mark badge only (no dim) | Badge gives strong positive cue, no priority signal. | |
| Side accent stripe (left border) | 4px green left border on reviewed cards/rows. Distinct but new visual idiom. | |

**User's choice:** Subtle dim + corner check-mark badge.

### Q2: Where on EventCard does the reviewed control live?

| Option | Description | Selected |
|--------|-------------|----------|
| Check-mark button next to favorite star | Add a check-mark icon button in the top-right action cluster, paired with the Star. Single tap toggles. Filled-green when reviewed, outline when not. | ✓ |
| Tap-anywhere on card (no button) | Tap navigates AND marks reviewed; long-press marks without navigating. Mixes navigate-and-mark (risk of accidental marks) and inconsistent across platforms. | |
| Overflow menu (⋮) | Three-dot menu with 'Mark reviewed' / 'Unmark.' Hides the most common action behind two taps. | |

**User's choice:** Check-mark button next to favorite star.

### Q3: How is the reviewed toggle presented on EventDetail?

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle button in header action bar | A 'Mark reviewed' / 'Reviewed ✓' button alongside existing header actions. Explicit label, mirrors the EventCard pattern. | ✓ |
| Auto-mark on view | Visiting EventDetail automatically marks reviewed (with undo toast). Friction-free but removes user agency. | |
| Auto-mark on view + visible toggle | Auto-marks on first visit AND shows the toggle. Friction-free with escape hatch but ambiguous state. | |

**User's choice:** Toggle button in header action bar.

---

## Bulk multi-select on EventListView (TRIAGE-02)

### Q1: How does the user enter selection mode?

| Option | Description | Selected |
|--------|-------------|----------|
| 'Select' toggle in the list header | Button in the header next to filter controls flips the list into selection mode; cards swap navigate-on-tap for select-on-tap; checkbox appears on each card; 'Cancel' exits. Discoverable on every platform. | ✓ |
| Long-press on a card | Long-press to enter mode with that card pre-selected. Common mobile idiom but inconsistent on Tauri/web/TV remote. | |
| Always-visible checkboxes | Every card shows a checkbox at all times. Zero discovery cost but adds permanent visual weight and conflicts with normal tap-to-navigate. | |
| Both — 'Select' toggle AND long-press | Long-press as power-user shortcut, button as discoverable path. Two interaction models to test/document. | |

**User's choice:** 'Select' toggle in the list header.

### Q2: Where does 'Mark reviewed' appear and what bulk actions are exposed in v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky bottom action bar, single 'Mark reviewed' action | When ≥1 item is selected, a sticky bar slides up showing '{N} selected' on the left, 'Select all visible' shortcut, 'Cancel,' and the primary 'Mark reviewed' button. Phase 1 ships only this single bulk action. | ✓ |
| Header action bar replacement | Page header swaps to '{N} selected' with a 'Mark reviewed' button. Pulls eye away from list and harder to thumb-reach on mobile. | |
| Sticky bottom bar with 'Mark reviewed' + 'Mark unreviewed' | Same as recommended but exposes both directions. Slightly more powerful, slightly more visual weight. | |

**User's choice:** Sticky bottom action bar, single 'Mark reviewed' action.

---

## Reviewed vs notification 'read' semantics

### Q1: How should 'reviewed' (event-level judgment) relate to the existing notification 'read' (notification was opened)?

| Option | Description | Selected |
|--------|-------------|----------|
| Fully separate stores, separate UI cues | Keep `useNotificationStore.read` as-is. New `useReviewedStore.reviewed` means 'this event was triaged.' Marking reviewed does NOT auto-mark read; they answer different questions. | |
| Reviewed implies read (one-way link) | Marking an event reviewed flips matching notification rows to read. Marking a notification read does NOT mark the event reviewed. Reduces NotificationHistory clutter after triage. | ✓ |
| Collapse both into 'reviewed' | Drop `notifications.read` entirely; reviewed is the single signal. Simplest model but breaks 'mark all read' UX and erases the dismiss-vs-judge distinction. | |

**User's choice:** Reviewed implies read (one-way link).

### Q2: When the reviewed→read flip fires, which notification rows get marked read?

| Option | Description | Selected |
|--------|-------------|----------|
| All notification rows for that EventId in the active profile | Every row with the same EventId in the current profile flips to read. Handles push-retry and poll-fallback duplicates. Cross-profile rows untouched (rule #7). | ✓ |
| Only the most recent notification row for that EventId | Only the latest matching row flips; older duplicates stay 'New.' | |

**User's choice:** All notification rows for that EventId in the active profile.

---

## Claude's Discretion

- Exact opacity value for the dim treatment (planner may tune to match existing `opacity-50` read-notification dim).
- Exact lucide icon for the check-mark (`Check` vs `CheckCheck`).
- Whether to debounce/batch persist writes during bulk-mark of a large selection.
- Whether to extract `EventSelectionBar.tsx` and `useEventSelection.ts` from `EventListView.tsx` (likely required by rule #12 ~400 LOC budget).

## Deferred Ideas

- Bulk-mark from NotificationHistory.
- 'Mark unreviewed' as a bulk action.
- Saved filter presets including reviewed-state (TRIAGE-V2-01).
- Reviewed-state sync via ZM event tags (TRIAGE-V2-02).
- Server-side persistence (out of scope per REQUIREMENTS.md).
- AI summarize-my-last-24h (TRIAGE-V2-03).
- "Hide reviewed" toggle (owned by Phase 2 / TRIAGE-07).
