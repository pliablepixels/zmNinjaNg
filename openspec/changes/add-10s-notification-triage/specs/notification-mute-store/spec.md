## ADDED Requirements

### Requirement: Cross-Process Suppression Store

The system SHALL maintain a profile-scoped suppression store accessible from the iOS Service Extension, the iOS app process, the Android `FirebaseMessagingService`, the Android `BroadcastReceiver`s, and the Android app process. The store covers three entry kinds, each persisted across app kill, device reboot, and OS update.

Storage:
- iOS: App Group `UserDefaults` (suite name shared between extension, widget, and main app).
- Android: `SharedPreferences` (or shared file via `ContentProvider`) accessible from FCM service, broadcast receivers, widget provider, and the Capacitor `WebView` host activity.

Entry kinds:

1. **Ad-hoc mute**: `{kind: "mute", profile_id, monitor_id, until, created_at}`
2. **Quiet-hours window**: `{kind: "quiet_hours", profile_id, monitor_id_or_all, start_local_time: "HH:MM", end_local_time: "HH:MM", weekday_mask: number 0..127, label, created_at}`
3. **Noise-filter rule**: `{kind: "noise_filter", profile_id, monitor_id_or_all, min_alarm_score, exclude_cause_patterns: string[], mode: "hide" | "dim", created_at}`

`monitor_id_or_all` is either a specific monitor id or the literal `"*"` meaning all monitors for that profile.

#### Scenario: Action handler writes a mute entry
- **WHEN** the user taps Mute 1h on a notification
- **THEN** an entry of kind `"mute"` SHALL be written with `until = now + 3600s` and the entry SHALL be readable from the extension/service on the next push

#### Scenario: User adds a quiet-hours window from Triage Center
- **WHEN** the user adds a quiet-hours window covering weekdays 22:00–07:00 for all monitors
- **THEN** an entry of kind `"quiet_hours"` SHALL be written with the corresponding fields and the entry SHALL be readable from the extension/service

#### Scenario: User adds a noise-filter rule
- **WHEN** the user adds a noise-filter rule with `min_alarm_score = 30, mode = hide` for all monitors
- **THEN** an entry of kind `"noise_filter"` SHALL be written and SHALL be consulted by both the push pipeline and the Events list (capability `event-noise-filter`)

#### Scenario: Read after device reboot
- **WHEN** the device is rebooted while a mute, quiet-hours, or noise-filter entry exists
- **THEN** the entry SHALL still be present and matched by the next push

#### Scenario: Multiple profiles, same `monitor_id` collision
- **WHEN** profile A mutes its `monitor_id=1` and profile B receives a push for its own `monitor_id=1`
- **THEN** profile B's push SHALL NOT be suppressed

### Requirement: Profile Scoping

All entries SHALL be keyed `(profile_id, …)` and lookups SHALL match on `profile_id` exactly. Action handlers SHALL preserve `profile_id` from the originating notification. The `monitor_id_or_all` `"*"` wildcard SHALL match any `monitor_id` for the same `profile_id` only.

#### Scenario: Action preserves profile_id
- **WHEN** a notification carrying `profile_id=p1, monitor_id=m1` triggers a Mute action
- **THEN** the written entry SHALL have `profile_id=p1, monitor_id=m1`

#### Scenario: Lookup with mismatched profile_id
- **WHEN** the store contains an entry for `(p1, m1)` and a push arrives for `(p2, m1)`
- **THEN** the lookup SHALL return no match

#### Scenario: Wildcard quiet-hours respects profile boundary
- **WHEN** profile A has a quiet-hours window with `monitor_id_or_all = "*"` and profile B receives a push during the same time window
- **THEN** profile B's push SHALL NOT be suppressed by profile A's window

### Requirement: Mute Lifecycle

Each ad-hoc mute entry SHALL have an absolute expiry timestamp (`until`). When the current time is greater than or equal to `until`, the entry is expired and SHALL NOT suppress notifications. Expired entries MAY be lazily removed; readers MUST treat them as inert regardless.

#### Scenario: Mute set, then time passes beyond `until`
- **WHEN** a mute is set with `until = now + 60s`, time advances to `now + 90s`, and a push arrives
- **THEN** the push SHALL be presented normally

#### Scenario: User clears mute via Triage Center
- **WHEN** the user clears a mute via Triage Center (capability `snooze-management-screen`)
- **THEN** the entry SHALL be removed and subsequent pushes for the `(profile_id, monitor_id)` SHALL be presented normally

#### Scenario: User extends mute duration via Triage Center
- **WHEN** the user extends an active mute
- **THEN** `until` SHALL be set to the new absolute time and `created_at` SHALL be preserved

### Requirement: Quiet-Hours Lifecycle

Quiet-hours entries SHALL have `start_local_time` and `end_local_time` in the user's local timezone (read from the device at evaluation time) and a `weekday_mask` bitfield (bit 0 = Sunday … bit 6 = Saturday). A window is "active" when (a) today's weekday bit is set, AND (b) the current local time falls between `start_local_time` and `end_local_time` (inclusive of start, exclusive of end). Windows that cross midnight (e.g., 22:00–07:00) SHALL be treated as active when current time ≥ start OR current time < end, with the weekday check applying to whichever date the start belongs to.

#### Scenario: Window 22:00–07:00 weekdays, current time 23:30 Tuesday
- **WHEN** a window is configured 22:00–07:00 with weekday_mask covering Mon–Fri, and the current local time is Tuesday 23:30
- **THEN** the window is active

#### Scenario: Window 22:00–07:00, current time 03:00 Saturday
- **WHEN** the same window is configured Mon–Fri and the current local time is Saturday 03:00 (Friday's window crossing midnight)
- **THEN** the window is active (weekday check applies to Friday, the start date)

#### Scenario: Window outside its weekdays
- **WHEN** a Mon–Fri window is queried at 23:30 Saturday
- **THEN** the window is inactive

### Requirement: Noise-Filter Rule Evaluation

Noise-filter rules SHALL be evaluated by both the push pipeline and the Events list filter. A rule "matches" a push or event when:

- `min_alarm_score > payload.alarm_score` (rule's threshold strictly exceeds event's score), OR
- ANY string in `exclude_cause_patterns` is found as a case-insensitive substring of `payload.cause_text`.

Multiple rules per profile are OR'd; ANY match suppresses (or dims). Rules in `mode: hide` cause the push pipeline to suppress the notification AND the Events list to hide the event. Rules in `mode: dim` cause only the Events list to dim the event (notification is still shown).

#### Scenario: Rule with score 30 hide-mode, push score 12
- **WHEN** a rule has `min_alarm_score = 30, mode = hide` and a push has `alarm_score = 12`
- **THEN** the push is suppressed and the corresponding event is hidden in the Events list

#### Scenario: Rule with score 30 dim-mode, push score 12
- **WHEN** a rule has `min_alarm_score = 30, mode = dim` and a push has `alarm_score = 12`
- **THEN** the push is presented; the event appears in the Events list dimmed

#### Scenario: Cause-exclude match
- **WHEN** a rule has `exclude_cause_patterns = ["Continuous"]` and a push has `cause_text = "Continuous Recording"`
- **THEN** the rule matches and `mode` decides hide vs. dim

#### Scenario: No `cause_text` on payload
- **WHEN** a push lacks `cause_text`
- **THEN** cause-exclude patterns SHALL NOT match; only the score check applies

### Requirement: Concurrent Access Safety

Reads from the iOS Service Extension or Android `FirebaseMessagingService` MAY race with writes from action handlers, the Triage Center, or the in-app filter UI. The store SHALL guarantee that reads return either the pre-write or the post-write state — never a torn or partial state.

#### Scenario: Read during write
- **WHEN** an action handler writes an entry while the extension reads the store on a concurrent push
- **THEN** the read SHALL return either the new state (push suppressed) or the prior state (push shown), and SHALL NOT crash or return torn data
