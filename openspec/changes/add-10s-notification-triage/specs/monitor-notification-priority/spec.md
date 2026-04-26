## ADDED Requirements

### Requirement: Per-Monitor Priority Field

Each monitor in the current profile SHALL carry a notification priority field stored in profile-scoped settings via `getProfileSettings`/`updateProfileSettings` (rule #7). Allowed values: `high`, `normal` (default), `low`, `silent`. Unknown / missing values SHALL be treated as `normal`.

#### Scenario: Reading priority for a monitor with no explicit value
- **WHEN** a monitor has no priority field stored
- **THEN** reads SHALL return `normal`

#### Scenario: User changes a monitor's priority
- **WHEN** the user sets monitor `m1` to `high` via the Triage Center Per-Monitor Priority section
- **THEN** the value SHALL be persisted profile-scoped and SHALL be readable by the iOS Service Extension and Android FCM service via the cross-process accessor

#### Scenario: Migration from legacy "notifications-enabled" boolean
- **WHEN** a monitor has the legacy boolean `notifications_enabled = false` and no priority field
- **THEN** the priority SHALL be presented as `silent` in the UI; on first save, the legacy field SHALL be migrated to `priority = silent` and the legacy field cleared

### Requirement: OS-Level Mapping

Per-monitor priority SHALL map to OS-level notification importance at the moment of presentation, after the suppression check passes.

| Priority | iOS `interruptionLevel` | Android channel | Channel importance |
|---|---|---|---|
| `high` | `.timeSensitive` | `zmn_high` | `IMPORTANCE_HIGH` |
| `normal` | `.active` | `zmn_normal` | `IMPORTANCE_DEFAULT` |
| `low` | `.passive` | `zmn_low` | `IMPORTANCE_LOW` |
| `silent` | (suppressed) | `zmn_silent` | `IMPORTANCE_NONE` |

The four Android channels SHALL be created at app first launch and SHALL persist. `silent` SHALL prevent display while still updating notification history and the event-snapshot for the quick-look surface.

#### Scenario: Priority high on iOS
- **WHEN** a push for a monitor with priority `high` is presented on iOS
- **THEN** the system SHALL set `interruptionLevel = .timeSensitive`

#### Scenario: Priority silent on Android
- **WHEN** a push for a monitor with priority `silent` is processed on Android
- **THEN** no system notification SHALL be shown; the event SHALL still be appended to notification history and the event-snapshot SHALL still be updated

### Requirement: Channel Migration on First Launch After Upgrade

The Android FCM service SHALL migrate the legacy single notification channel's user-tweaked settings (sound, vibration, importance) to the new `zmn_normal` channel exactly once on first launch after the upgrade. The legacy channel SHALL be deleted after a successful copy. A one-time in-app notice SHALL inform the user that channels have changed and that they may need to reconfirm preferences.

#### Scenario: First launch after upgrade
- **WHEN** the user upgrades from a build with the single legacy channel and launches the new build for the first time
- **THEN** the four `zmn_*` channels SHALL be created, the legacy channel's settings SHALL be copied to `zmn_normal`, the legacy channel SHALL be deleted, and a one-time in-app notice SHALL be shown

#### Scenario: Subsequent launches
- **WHEN** the user launches the upgraded build any subsequent time
- **THEN** the migration SHALL NOT run again

### Requirement: Cross-Process Read Path

The iOS Service Extension and Android `FirebaseMessagingService` SHALL be able to read the current monitor's priority cross-process (App Group `UserDefaults` on iOS, `SharedPreferences` on Android) without invoking the React app. The React app SHALL write priority changes to that shared store on save.

#### Scenario: Priority readable from iOS extension
- **WHEN** the React app sets monitor `m1` priority to `low` and a push arrives
- **THEN** the iOS Service Extension SHALL read `low` and select `interruptionLevel = .passive`

#### Scenario: Priority readable from Android FCM service
- **WHEN** the same conditions apply on Android
- **THEN** the FCM service SHALL select channel `zmn_low`

### Requirement: Display in Existing Monitor Surfaces

The current priority SHALL be visible on the monitor's row in the Triage Center Per-Monitor Priority section AND as a small icon/badge on `MonitorCard` (capability path `app/src/components/monitors/MonitorCard.tsx`). The badge SHALL be hidden when priority is `normal` to reduce visual noise.

#### Scenario: Non-default priority shows badge on MonitorCard
- **WHEN** monitor `m1` priority is `high`, `low`, or `silent`
- **THEN** `MonitorCard` SHALL display a small icon/badge indicating the priority

#### Scenario: Default priority hides the badge
- **WHEN** monitor priority is `normal`
- **THEN** no badge SHALL be displayed on `MonitorCard`
