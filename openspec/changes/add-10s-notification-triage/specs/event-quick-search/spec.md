## ADDED Requirements

### Requirement: Quick-Search Filter Bar

The Events page SHALL expose a quick-search filter bar above the events list. The bar SHALL contain the following common-case filters, all visible at once on tablet / desktop and collapsible on phone portrait:

- **Date range** — presets (Today, Last 7 days, Last 30 days, Custom) plus a custom date-range picker.
- **Monitor multiselect** — chip-style multiselect of the current profile's monitors.
- **Object class** — chip-style multiselect of `{person, vehicle, animal, package, unknown}` (matching the extension-shipped vocabulary).
- **Cause contains** — free-text input matching against `event.cause` (case-insensitive substring).
- **Alarm score min** — numeric input or slider 0–100.
- **Show reviewed** toggle (binds to capability `event-review-state`).
- **Show filtered** toggle (binds to capability `event-noise-filter`, session-only).

The advanced popover (existing `EventsFilterPopover.tsx`) SHALL remain available for advanced filters not covered by the bar.

#### Scenario: User narrows by date range and monitor
- **WHEN** the user selects "Last 7 days" and picks two monitors
- **THEN** the events list SHALL filter to events from those monitors in that range

#### Scenario: User combines filters
- **WHEN** the user selects "Today" + monitor `m1` + class "person" + score min 30
- **THEN** the events list SHALL filter to today's events from `m1` with object label `person` (any confidence) AND `score >= 30`

#### Scenario: Cause contains
- **WHEN** the user types "package" into the cause-contains input
- **THEN** events whose cause text contains "package" (case-insensitive) SHALL match

#### Scenario: All filters cleared
- **WHEN** the user taps "Clear all"
- **THEN** all bar filters SHALL reset to their defaults (today's preset on phone, last-7-days on tablet/desktop, all monitors, all classes, no cause text, score min 0); the popover advanced filters SHALL NOT be cleared

### Requirement: Filter State Persistence

Filter bar state SHALL persist across navigations within a session and SHALL reset when the active profile changes. State SHALL NOT persist across full app restarts (per the "fresh session" expectation).

#### Scenario: Navigate away and back, filters persist
- **WHEN** the user sets filters, navigates to Dashboard, and returns to Events
- **THEN** the filters SHALL still be set

#### Scenario: Profile switch resets filters
- **WHEN** the user switches profiles
- **THEN** filters SHALL reset to defaults for the new profile

#### Scenario: App restart resets filters
- **WHEN** the user closes the app and relaunches
- **THEN** filters SHALL be at defaults

### Requirement: Phone Portrait Collapse

On phone portrait, the filter bar SHALL collapse to a single row showing the active filter count and a "Filters" expand button. Tapping expands an inline panel containing the same filters as the bar.

#### Scenario: Phone portrait, no active filters
- **WHEN** the screen is in phone portrait orientation and no non-default filters are active
- **THEN** the bar collapses to a single "Filters" button with no count

#### Scenario: Phone portrait, 3 filters active
- **WHEN** 3 non-default filters are active in phone portrait
- **THEN** the bar shows "Filters · 3"

### Requirement: One-Tap Preset

The bar SHALL expose a one-tap "Today's high-score events" preset that sets: date range = Today, score min = 50, all monitors, all classes, cause text empty. The preset SHALL be a button next to "Clear all" and SHALL be present on all screen sizes.

#### Scenario: User taps "Today's high-score" preset
- **WHEN** the user taps the preset button
- **THEN** filters SHALL be set as specified and the list SHALL re-render

### Requirement: Popover Advanced Filters Coexist

Filters set in the popover (e.g., tag filters, alarm-frame-only) SHALL apply on top of the bar filters as an AND. The popover SHALL surface its own active-filter count and Clear button independent of the bar's.

#### Scenario: Bar and popover active simultaneously
- **WHEN** the user sets the bar to "Last 7 days" + monitor `m1`, and adds a tag filter `tag = "garbage"` in the popover
- **THEN** the events list SHALL filter to events satisfying ALL of those constraints

### Requirement: data-testid Attributes

Every interactive element on the filter bar SHALL carry a `data-testid="kebab-case-name"` per rule #13 to support e2e testing across platforms.

#### Scenario: All bar elements have data-testid
- **WHEN** the bar is rendered in any state
- **THEN** every button, chip, input, and toggle SHALL have a stable `data-testid`

### Requirement: Localization in 5 Languages

All user-facing strings on the filter bar (preset names, picker labels, class chip labels, toggle labels, "Clear all", "Today's high-score events" label, collapsed-bar count text, validation messages) SHALL be localized in en, de, es, fr, zh per rule #5 and SHALL fit on a 320 px-wide screen per rule #23.

#### Scenario: Each supported locale renders without missing keys
- **WHEN** the user switches locale and uses the filter bar
- **THEN** all visible strings SHALL be localized
