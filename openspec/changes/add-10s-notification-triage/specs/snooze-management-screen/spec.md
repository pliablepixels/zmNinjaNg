## ADDED Requirements

### Requirement: Triage Center Screen

The app SHALL provide an in-app **Triage Center** screen that consolidates management of all notification triage controls for the current profile. The screen SHALL be reachable from Notification Settings via a labelled link/button. It SHALL contain four sections, each addressable via tab or scroll-anchor:

1. **Mutes** — list of active ad-hoc mutes (capability `notification-mute-store` kind `"mute"`), ordered by `until` ascending. Each row shows monitor name, time remaining (relative, via `useDateTimeFormat()`), and Clear / Extend actions.
2. **Quiet Hours** — list of recurring quiet-hours windows (kind `"quiet_hours"`). Each row shows label, time range, weekdays, monitor scope (specific or "All monitors"), and Edit / Delete. An "Add quiet-hours window" affordance is always present.
3. **Per-Monitor Priority** — list of monitors for the current profile with their current priority level (`high` / `normal` / `low` / `silent`). Each row exposes a priority selector. An info banner explains the OS-level mapping.
4. **Noise Filter** — list of noise-filter rules (kind `"noise_filter"`). Each row shows the monitor scope, score threshold, cause-exclude patterns, and mode (hide / dim). Edit / Delete + Add. A help line shows the active default rule (if any).

#### Scenario: User opens Triage Center
- **WHEN** the user opens Triage Center
- **THEN** all four sections SHALL be present and SHALL render without error even when each section is empty

#### Scenario: Empty state in any section
- **WHEN** a section has no entries
- **THEN** a localized empty-state message SHALL be shown for that section, alongside its Add affordance where applicable

### Requirement: Mute Section Operations

The Mutes section SHALL allow Clearing or Extending each mute entry.

#### Scenario: User clears a mute
- **WHEN** the user taps Clear on a mute row
- **THEN** the entry SHALL be removed from the suppression store and the row SHALL be removed from the list

#### Scenario: User extends a mute
- **WHEN** the user taps Extend, picks a duration (1h, 4h, 24h, custom), and confirms
- **THEN** the entry's `until` SHALL be set to `now + duration` and the time-remaining SHALL update

#### Scenario: Mute expires while screen is open
- **WHEN** a mute's `until` passes while the user views the screen
- **THEN** the row SHALL be removed (refresh on focus or via interval)

### Requirement: Quiet-Hours Section Operations

The Quiet Hours section SHALL allow adding, editing, and deleting recurring quiet-hours windows.

#### Scenario: User adds a quiet-hours window
- **WHEN** the user taps Add, enters a label, picks start/end times and weekdays and monitor scope, and confirms
- **THEN** an entry of kind `"quiet_hours"` SHALL be written to the suppression store with the chosen fields

#### Scenario: User edits a quiet-hours window
- **WHEN** the user opens an existing window for edit, changes the time range, and saves
- **THEN** the underlying entry SHALL be updated; subsequent pushes during the new range SHALL be suppressed

#### Scenario: User deletes a quiet-hours window
- **WHEN** the user deletes a window
- **THEN** the entry SHALL be removed and pushes during what was its active range SHALL be presented normally

#### Scenario: Window with empty weekday mask is rejected
- **WHEN** the user attempts to save a window with no weekdays selected
- **THEN** the save SHALL be blocked with a localized validation message

### Requirement: Per-Monitor Priority Section Operations

The Per-Monitor Priority section SHALL list monitors for the current profile with their current priority and SHALL allow inline change.

#### Scenario: User changes a monitor's priority
- **WHEN** the user changes a monitor's priority from `normal` to `high`
- **THEN** the change SHALL be persisted via `updateProfileSettings` (rule #7) and SHALL take effect on the next push

#### Scenario: Monitor list reflects current profile only
- **WHEN** the user switches profiles
- **THEN** the monitor list SHALL refresh to the new profile's monitors

### Requirement: Noise Filter Section Operations

The Noise Filter section SHALL allow adding, editing, and deleting noise-filter rules.

#### Scenario: User adds a default noise-filter rule
- **WHEN** the user taps Add, picks `min_alarm_score = 30`, no cause patterns, mode hide, all monitors, and confirms
- **THEN** an entry of kind `"noise_filter"` SHALL be written

#### Scenario: User adds a cause-exclude rule
- **WHEN** the user adds a rule with `exclude_cause_patterns = ["Continuous", "TestEvent"]`, mode dim, all monitors
- **THEN** matching events SHALL be dimmed in the Events list and notifications SHALL still be shown

#### Scenario: User edits an existing rule
- **WHEN** the user changes an existing rule's mode from hide to dim
- **THEN** the underlying entry SHALL be updated

### Requirement: Profile Scoping in Triage Center

The screen SHALL only show entries belonging to the currently active profile. Switching profiles SHALL refresh all four sections.

#### Scenario: Profile switch refreshes all sections
- **WHEN** the user is viewing Triage Center and switches profiles
- **THEN** all four sections SHALL refresh and show only the new profile's entries

### Requirement: Localization in 5 Languages

All user-facing strings on Triage Center (titles, section headers, labels, empty states, action labels, validation messages, duration picker options, weekday names, priority level names, help banners) SHALL be present in the React i18n bundle for en, de, es, fr, zh, and SHALL fit on a 320 px-wide screen (rule #23).

#### Scenario: Each supported locale renders without missing keys
- **WHEN** the user switches to any of en, de, es, fr, zh and opens Triage Center
- **THEN** all visible strings SHALL be localized; no raw translation keys SHALL appear

### Requirement: Entry Point from Notification Settings

The Notification Settings page SHALL include a clearly labelled entry point ("Triage Center" or equivalent, localized) that navigates to the Triage Center screen. The entry point SHALL be visible regardless of whether any entries currently exist.

#### Scenario: Notification Settings shows entry point
- **WHEN** the user opens Notification Settings
- **THEN** a localized "Triage Center" link SHALL be visible and tapping it SHALL navigate to the Triage Center screen
