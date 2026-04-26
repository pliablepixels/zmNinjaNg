## ADDED Requirements

### Requirement: Reviewed-State Store

The system SHALL maintain a profile-scoped Zustand store (`eventReviewState`) holding the set of `event_id`s the user has marked reviewed. The store SHALL persist via `localStorage` (web) / Capacitor `Preferences` (native) under a versioned key, scoped per profile.

#### Scenario: Reviewed state survives app restart
- **WHEN** the user marks event `e1` reviewed and reloads / re-opens the app
- **THEN** event `e1` is still marked reviewed for the same profile

#### Scenario: Profile switch isolates reviewed state
- **WHEN** profile A has `e1` marked reviewed and the user switches to profile B
- **THEN** profile B's view of event `e1` (if it exists in B's data) SHALL NOT be marked reviewed

### Requirement: Sources of Reviewed-State Writes

Reviewed state SHALL be writable from three sources, all converging on the same store:

1. **Per-card "Mark reviewed" affordance** on `EventCard` (and equivalent in list views).
2. **Bulk "Mark all reviewed" action** on the Events page, acting on the currently filtered/rendered window of up to 500 events.
3. **Notification "Reviewed" action** (capability `push-notification-triage`), via a "review-pending" shared file/list (App Group on iOS, shared `SharedPreferences` on Android) drained on next foreground.

#### Scenario: Marking reviewed from EventCard
- **WHEN** the user taps "Mark reviewed" on an `EventCard`
- **THEN** the event's `event_id` SHALL be added to `eventReviewState` for the current profile

#### Scenario: Bulk mark reviewed
- **WHEN** the user taps "Mark all reviewed" with 47 events visible in the filtered window
- **THEN** all 47 `event_id`s SHALL be added in a single batched write; the operation SHALL not block the UI for more than 100 ms

#### Scenario: Bulk action exceeds 500-event cap
- **WHEN** the filtered window contains more than 500 events
- **THEN** the bulk action SHALL act on at most 500 (the rendered window) and surface a localized notice; events beyond the window SHALL be unaffected

#### Scenario: Reviewed action drained from notification
- **WHEN** the user tapped Reviewed on a background notification while the app was killed, then opens the app
- **THEN** the React app SHALL drain the review-pending shared store on first foreground and merge entries into `eventReviewState`; the review-pending source SHALL be cleared after successful merge

### Requirement: Visual Distinction in Lists

Reviewed events SHALL be visually distinct in `EventCard` and list views: 50% opacity on the card, with a small reviewed-checkmark icon adjacent to the title. The visual distinction SHALL apply consistently in `Events.tsx`, `EventsFilterPopover` results, dashboard recent-events widget, and any other surface that renders `EventCard`.

#### Scenario: Reviewed event in main Events list
- **WHEN** an event is reviewed and rendered in the main Events list
- **THEN** the card SHALL render at 50% opacity with a checkmark icon

#### Scenario: Reviewed event in dashboard recent-events widget
- **WHEN** the same event appears in the dashboard recent-events widget
- **THEN** the same dimmed treatment SHALL apply

### Requirement: Show / Hide Reviewed Toggle

The Events page SHALL expose a "Show reviewed" toggle in the quick-search filter bar (capability `event-quick-search`). The toggle SHALL default to off on phone portrait (where space is constrained) and on for tablet / desktop. State SHALL be persisted profile-scoped.

#### Scenario: Toggle off — reviewed events hidden
- **WHEN** the toggle is off
- **THEN** events whose `event_id` is in `eventReviewState` SHALL NOT appear in the filtered list

#### Scenario: Toggle on — reviewed events visible but dimmed
- **WHEN** the toggle is on
- **THEN** reviewed events SHALL appear in the list with the dimmed-reviewed treatment

### Requirement: Per-Card Unmark

Reviewed state SHALL be reversible per event from the `EventCard` overflow / context menu.

#### Scenario: User unmarks a reviewed event
- **WHEN** the user opens the overflow menu on a reviewed event and taps "Unmark reviewed"
- **THEN** the event_id SHALL be removed from `eventReviewState` and the visual treatment SHALL revert

### Requirement: Localization in 5 Languages

All user-facing strings related to reviewed state (action labels, toggle label, bulk action confirmation, notice when bulk caps at 500, overflow menu items) SHALL be localized in en, de, es, fr, zh per rule #5.

#### Scenario: Each supported locale renders without missing keys
- **WHEN** the user switches locale and interacts with reviewed-state UI
- **THEN** all visible strings SHALL be localized; no raw translation keys SHALL appear
