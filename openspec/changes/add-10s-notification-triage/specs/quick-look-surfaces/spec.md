## ADDED Requirements

### Requirement: Shared Event-Snapshot Source

The system SHALL maintain a platform-specific event-snapshot source that holds the most recent 5 delivered events for the active profile. The snapshot SHALL be written from `app/src/services/notifications.ts` (or equivalent shared location) on every successful event delivery and at notification-time on iOS / Android (capability `push-notification-triage`).

Snapshot format (JSON):
```
{
  updated_at: ISO8601,
  profile_id: string,
  events: [
    { event_id, monitor_id, monitor_name, started_at, image_url, top_label, alarm_score }
  ]
}
```

Storage:
- iOS: App Group container file (suite shared with extension and widget).
- Android: `ContentProvider`-exposed file or `SharedPreferences`.
- Tauri: app-data directory file.
- Web: `localStorage` keyed by profile.

Suppressed pushes (mute / quiet-hours / noise-filter `mode: hide`) SHALL NOT update the snapshot. Pushes for `silent`-priority monitors SHALL update the snapshot.

#### Scenario: Push delivered, snapshot updated
- **WHEN** a notification is presented or recorded as silent
- **THEN** the event SHALL be prepended to the snapshot's events array; entries beyond 5 SHALL be dropped

#### Scenario: Push suppressed, snapshot unchanged
- **WHEN** a push is suppressed by mute / quiet-hours / noise-filter hide
- **THEN** the snapshot SHALL NOT be updated

#### Scenario: Profile switch
- **WHEN** the user switches active profile
- **THEN** the snapshot SHALL be re-pointed to the new profile's snapshot file/key; widgets / tray / dock SHALL render the new profile's events on next refresh

### Requirement: iOS Home-Screen Widget

A WidgetKit widget SHALL ship in a separate iOS extension target. It SHALL support three sizes:

- **Small (1×1 home grid)**: 1 event — thumbnail + monitor name + relative time + top label.
- **Medium (2×1 home grid)**: 3 events — thumbnail strip + monitor name + relative time per item.
- **Large (2×2 home grid)**: 5 events — list with thumbnails + monitor name + relative time + top label per item.

Each item SHALL deep-link via `zmninja://event/<event_id>?profile_id=<profile_id>` to `EventDetail` when tapped (or `zmninja://monitor/<monitor_id>?profile_id=<profile_id>&pip=auto` when configured).

Widget refresh: WidgetKit OS-driven cadence (typically 5–15 min) with a force-refresh attempt via `WidgetCenter.shared.reloadTimelines` on every push receipt. The widget SHALL display `formatRelative(updated_at)` so staleness is explicit.

#### Scenario: Widget shows latest events
- **WHEN** the user adds the small widget to the home screen and a push is delivered
- **THEN** the widget SHALL refresh (within OS budget) to show the new event with thumbnail, monitor name, and relative time

#### Scenario: Widget tap deep-links
- **WHEN** the user taps an event row in any size widget
- **THEN** the app launches and routes to `EventDetail` for that event

#### Scenario: Widget when no events available
- **WHEN** the snapshot is empty (no events delivered yet for this profile)
- **THEN** the widget SHALL render a localized empty-state placeholder

### Requirement: Android Home-Screen Widget

An `AppWidgetProvider` SHALL ship with three sizes:

- **1×1**: 1 event — thumbnail + monitor name.
- **2×2**: 3 events.
- **4×2**: 5 events.

Tap deep-link semantics SHALL match iOS. Refresh on push receipt via `AppWidgetManager.notifyAppWidgetViewDataChanged`. Empty state SHALL match iOS.

#### Scenario: User adds 4×2 widget, receives push
- **WHEN** the user has the 4×2 widget installed and a push is delivered
- **THEN** the widget SHALL refresh to show the new event at the top of the list

#### Scenario: Widget tap deep-links
- **WHEN** the user taps an event row
- **THEN** the app launches and routes to `EventDetail`

### Requirement: Tauri Desktop System-Tray Quick-Look

A system-tray (menu-bar on macOS, system tray on Windows / Linux) icon SHALL be installed via `tauri-plugin-systemtray` (or current Tauri 2-compatible equivalent). Clicking the icon SHALL open a popover or compact window listing the latest 5 events with thumbnail, monitor name, started-at, and top label. Clicking an event SHALL bring the main window to front and route to `EventDetail` or `MonitorDetail?pip=auto`.

The tray icon SHALL show a small dot/badge when there are unreviewed events in the snapshot, cleared when the user opens the popover or marks events reviewed.

#### Scenario: Tray icon click opens popover
- **WHEN** the user clicks the tray icon
- **THEN** a popover/compact window SHALL appear listing the 5 most recent events

#### Scenario: Unreviewed badge
- **WHEN** the snapshot contains events the user has not yet reviewed
- **THEN** the tray icon SHALL display a small dot/badge

#### Scenario: Click event in popover
- **WHEN** the user clicks an event row in the popover
- **THEN** the main app window SHALL come to front and route to `EventDetail` for that event

#### Scenario: Plugin unavailable / unsupported on host OS
- **WHEN** the host OS or plugin version does not support the system-tray API
- **THEN** the app SHALL log via `log.notifications` (rule #9), continue without the tray, and fall back to a global keyboard shortcut that opens the same popover as a foreground window

### Requirement: Web In-Tab Dock

A `QuickLookDock.tsx` component SHALL be mounted in the root layout on web. It SHALL display a compact strip at the bottom of the viewport listing the latest 3–5 events (responsive count) with thumbnail, monitor name, and relative time. Each item SHALL be a link to `EventDetail`. The dock SHALL be present on every route.

The dock SHALL be dismissable per session (state in `sessionStorage`); the next session SHALL start with the dock visible. The dock SHALL be hidden on mobile-web phone-portrait viewports below 480 px wide to avoid stealing thumb space.

#### Scenario: Dock visible on every route
- **WHEN** the user navigates between Dashboard, Events, Monitors, Settings on web
- **THEN** the dock SHALL be present at the bottom of every route

#### Scenario: Dock dismiss
- **WHEN** the user dismisses the dock
- **THEN** the dock SHALL hide for the remainder of the session and reappear on the next session

#### Scenario: Phone-portrait web viewport
- **WHEN** the viewport width is < 480 px
- **THEN** the dock SHALL be hidden regardless of dismiss state

#### Scenario: Dock empty state
- **WHEN** the snapshot has no events
- **THEN** the dock SHALL render a localized empty-state line and SHALL still be dismissable

### Requirement: Functional-Equivalent Parity

The four surfaces SHALL deliver the same user job — "answer 'anything new and worth my time?' without launching the full UI" — on every supported platform. Pixel parity is NOT required; functional parity (latest events glanceable, deep-linkable on tap, refresh on event delivery, empty-state localized) IS required.

#### Scenario: Same job across platforms
- **WHEN** the user has set up the appropriate surface on each of iOS, Android, Tauri, web
- **THEN** each surface SHALL display the latest events and SHALL deep-link to `EventDetail` on tap/click

### Requirement: Localization in 5 Languages

All visible strings on widgets, tray popover, and dock (empty states, accessibility labels, badge tooltips, time-ago text) SHALL be localized in en, de, es, fr, zh. Time-ago text SHALL go through `useDateTimeFormat()` on web/Tauri and through extension-shipped formatters on iOS/Android (rule #24).

#### Scenario: Each surface renders in current locale
- **WHEN** the user switches locale and the surface refreshes
- **THEN** all visible strings SHALL be localized

### Requirement: data-testid for Web and Tauri

Interactive elements on the web dock and (where the test harness can reach them) Tauri popover SHALL carry `data-testid="kebab-case-name"` per rule #13.

#### Scenario: Dock items have data-testid
- **WHEN** the dock is rendered with events
- **THEN** each event row, the dismiss button, and the dock root SHALL have stable `data-testid`s
