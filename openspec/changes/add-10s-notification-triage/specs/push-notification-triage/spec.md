## ADDED Requirements

### Requirement: ES FCM Payload Contract

The system SHALL accept an additive FCM data payload from zmeventnotificationNg with the following fields. All fields are optional on the wire. The client MUST tolerate any subset of fields being absent and fall back to the closest legacy behavior.

Required for any new (Tier-1+) behavior to engage:
- `monitor_id` (string)
- `monitor_name` (string)
- `event_id` (string)
- `started_at` (ISO 8601 string)
- `profile_id` (string)

Strong (Tier-1 read benefit):
- `object_labels` — array of `{label: string, confidence: number 0..1}`. Client SHALL show at most 2 labels in the title, sorted by confidence descending.
- `image_url_jpg` (string) — single thumbnail URL.
- `alarm_score` (number 0..100) — ZM-native alarm score; consumed by the noise filter and may be displayed in the title when present.

Nice (Tier-1/2 polish):
- `image_urls_strip` — array of exactly 3 URLs. When present, supersedes `image_url_jpg` for attachment composition.
- `color_hex` (string, e.g. `#FF8800`) — monitor brand colour.
- `category_id` (string) — selects iOS `UNNotificationCategory` action set.
- `cause_text` (string) — ZM-native cause text; consumed by noise-filter cause-exclude patterns.

#### Scenario: Full payload received from upgraded ES
- **WHEN** an FCM message arrives with all required and strong fields plus `image_urls_strip`
- **THEN** the system SHALL fetch all three strip URLs in parallel, composite them horizontally into a single JPEG attachment, format the title using `object_labels` + `monitor_name`, and present the notification

#### Scenario: Older ES — only legacy fields present
- **WHEN** an FCM message arrives with only `monitor_name` and a single image URL (today's pre-change behavior)
- **THEN** the system SHALL present the notification using legacy formatting (no object label in title, single-image attachment) without error

#### Scenario: Newer ES — client ignores unknown future fields
- **WHEN** an FCM message arrives with a field the client does not recognize
- **THEN** the system SHALL ignore the unknown field and present the notification using only fields it does recognize

#### Scenario: Required field missing — Tier-1 disabled
- **WHEN** an FCM message lacks any of the required fields (`monitor_id`, `monitor_name`, `event_id`, `started_at`, `profile_id`)
- **THEN** the system SHALL fall back to the legacy presentation (today's title and single-image attachment) and SHALL NOT consult the mute store or attach action buttons

### Requirement: Locale-Aware Title Formatting in Extensions

The iOS Service Extension and the Android `FirebaseMessagingService` SHALL format the notification title using the user's selected locale, read from a cross-process store (App Group `UserDefaults` on iOS, `SharedPreferences` on Android) that the React app writes whenever language changes. Templated strings SHALL be shipped inside the extension/service bundle (`Localizable.strings` for iOS, `strings.xml` for Android) for each of en, de, es, fr, zh.

Title format: `<top-label> <confidence>% · <monitor_name>` when `object_labels` is present and the top label has confidence ≥ 0.5; otherwise `<monitor_name>`.

Body format (legacy fallback only): today's "Motion detected" string, localized.

#### Scenario: User locale is Spanish, payload has person label at 92%
- **WHEN** a push arrives with `object_labels: [{label: "person", confidence: 0.92}]` and the user's locale is `es`
- **THEN** the title SHALL be presented using the `es` `Localizable.strings` template (e.g., `Persona 92% · Driveway`)

#### Scenario: User locale is unknown to the extension
- **WHEN** the user's locale is missing from the cross-process store or is one not shipped inside the extension bundle
- **THEN** the system SHALL fall back to English

#### Scenario: Confidence below display threshold
- **WHEN** the top object label has confidence < 0.5
- **THEN** the title SHALL contain only the monitor name, with no label

### Requirement: Multi-Frame Strip Composition

When the FCM payload contains `image_urls_strip` (length 3), the iOS Service Extension and Android `FirebaseMessagingService` SHALL fetch the three URLs in parallel and composite them horizontally into a single JPEG, which is attached to the notification. When `image_urls_strip` is absent and `image_url_jpg` is present, the single image SHALL be attached.

#### Scenario: Strip fetch succeeds for all 3 URLs
- **WHEN** all three strip URLs are reachable
- **THEN** a single horizontally-composited JPEG SHALL be attached to the notification

#### Scenario: One of the 3 strip URLs fails
- **WHEN** any one strip URL fails to fetch within the extension's time budget
- **THEN** the system SHALL composite from the URLs that did succeed; if at least one succeeded, the notification SHALL include that partial image; if all failed, the system SHALL fall back to `image_url_jpg` if present, otherwise no attachment

#### Scenario: Only `image_url_jpg` present
- **WHEN** the payload contains `image_url_jpg` and not `image_urls_strip`
- **THEN** the single image SHALL be attached unchanged (today's behavior)

### Requirement: Suppression Before Display

The iOS Service Extension and Android `FirebaseMessagingService` SHALL consult the cross-process suppression store (see capability `notification-mute-store`) before presenting any notification. The store covers three entry kinds: ad-hoc mutes, recurring quiet-hours windows, and noise-filter rules. When ANY entry kind matches the incoming push for the `(profile_id, monitor_id)` pair, the system SHALL drop the push without showing a system notification and without invoking the JS-side foreground handler.

Match semantics:
- **Ad-hoc mute**: matches when an unexpired entry exists for `(profile_id, monitor_id)`.
- **Quiet-hours**: matches when the current local time falls inside an active window for `(profile_id, monitor_id_or_all)` whose `weekday_mask` includes today.
- **Noise-filter**: matches when a rule for `(profile_id, monitor_id_or_all)` has `min_alarm_score > payload.alarm_score`, OR when any `exclude_cause_patterns` entry is found in `payload.cause_text` (substring, case-insensitive). Noise-filter rules in `mode: hide` suppress the notification; rules in `mode: dim` do NOT suppress notifications (they affect only the Events list — see capability `event-noise-filter`).

Quiet-hours collision with priority: when a push would be suppressed by quiet-hours but the per-monitor priority is `high`, quiet-hours SHALL still win (user explicitly scheduled silence; `time-sensitive` is for OS Focus, not user schedule).

#### Scenario: Push for muted monitor while app is backgrounded
- **WHEN** an FCM message arrives for a `(profile_id, monitor_id)` pair with an active unexpired ad-hoc mute
- **THEN** no system notification is shown and no JS handler is invoked

#### Scenario: Push for muted monitor while app is foregrounded
- **WHEN** the same conditions apply but the app is in the foreground
- **THEN** no system notification is shown and no in-app toast is shown

#### Scenario: Mute expired
- **WHEN** the mute entry's `until` timestamp is in the past at push receipt time
- **THEN** the system SHALL ignore the entry and present the notification normally

#### Scenario: Push falls inside an active quiet-hours window
- **WHEN** an FCM message arrives during an active quiet-hours window for the matching `(profile_id, monitor_id_or_all)` and today's weekday is included in the window's `weekday_mask`
- **THEN** no system notification is shown and no JS handler is invoked

#### Scenario: Quiet-hours active but priority is high
- **WHEN** a push would be suppressed by quiet-hours and the per-monitor priority is `high`
- **THEN** quiet-hours wins; no system notification is shown

#### Scenario: Push below noise-filter score threshold (hide mode)
- **WHEN** a push arrives with `alarm_score = 12` and a noise-filter rule for the matching `(profile_id, monitor_id_or_all)` has `min_alarm_score = 30, mode = hide`
- **THEN** no system notification is shown

#### Scenario: Push below noise-filter score threshold (dim mode)
- **WHEN** the same conditions apply but `mode = dim`
- **THEN** the notification SHALL be presented normally (dim mode affects Events list only)

#### Scenario: Push matches a noise-filter cause-exclude pattern
- **WHEN** a push arrives with `cause_text = "Continuous"` and a noise-filter rule has `exclude_cause_patterns: ["Continuous"], mode = hide`
- **THEN** no system notification is shown

#### Scenario: Required `profile_id` missing
- **WHEN** the push lacks `profile_id`
- **THEN** the system SHALL skip suppression entirely and fall back to legacy presentation

### Requirement: Notification Action Set

When `category_id` is present in the FCM payload, the system SHALL present three actions on the notification: **Mute monitor 1h**, **Reviewed**, and **Live**. Action labels SHALL be localized via the same extension/service `Localizable.strings` / `strings.xml` mechanism as the title.

- **Mute monitor 1h**: writes a mute entry to the cross-process suppression store with `until = now + 1 hour`. Runs natively without app launch. iOS uses non-`.foreground` action option; Android uses a `BroadcastReceiver` `PendingIntent`.
- **Reviewed**: writes the event to a "review-pending" shared file/list (see capability `event-review-state`) and dismisses the notification. Runs natively without app launch.
- **Live**: deep-links to `MonitorDetail?pip=auto` (see capability `monitor-live-deeplink`). iOS uses `.foreground` action option; Android uses an `Activity` `PendingIntent` with appropriate flags.

#### Scenario: User taps Mute 1h on iOS background
- **WHEN** the user taps the Mute action on a notification while the app is not running
- **THEN** the action handler runs in the background, writes the mute entry, and the app does not launch

#### Scenario: User taps Mute 1h on Android background
- **WHEN** the user taps the Mute action on Android while the app is not running
- **THEN** the `BroadcastReceiver` runs, writes the mute entry, and the app does not launch

#### Scenario: User taps Reviewed
- **WHEN** the user taps the Reviewed action
- **THEN** the notification is dismissed, the event is recorded as reviewed in the review-pending shared store, and the app does not launch. On next foreground, the React app drains the pending entries into the `eventReviewState` Zustand store.

#### Scenario: User taps Live
- **WHEN** the user taps the Live action
- **THEN** the app launches (foreground), routes to `MonitorDetail` for the corresponding `monitor_id`, and engages PiP on mount

### Requirement: Coexistence with Existing Foreground Handler

When the app is in the foreground, the existing in-app FCM toast and ES-vs-Direct deduplication flow (today's behavior in `NotificationHandler.tsx`) SHALL continue to operate. The new native pipeline MUST NOT show a system notification when the app is in the foreground; instead, it SHALL hand off to the JS layer so the in-app toast renders and dedup runs.

#### Scenario: Push arrives while app is foreground, monitor not muted
- **WHEN** an FCM message arrives and the app is in the foreground
- **THEN** the system SHALL NOT show a system notification and SHALL deliver the message to the JS handler so it renders an in-app toast and runs ES/Direct deduplication

#### Scenario: Push arrives while app is foreground, monitor muted
- **WHEN** an FCM message arrives, the app is foreground, and the monitor is muted
- **THEN** the system SHALL NOT show a system notification and SHALL NOT deliver the message to the JS handler

### Requirement: Per-Monitor Priority Mapping at Display Time

After the suppression check passes, the system SHALL apply per-monitor priority (see capability `monitor-notification-priority`) to OS-level notification importance. iOS sets `interruptionLevel`; Android selects the corresponding `NotificationChannel`. A `silent` priority SHALL prevent display entirely while still allowing the event to be recorded in notification history and the event-snapshot for the quick-look surface.

#### Scenario: Monitor priority is high
- **WHEN** a push arrives, suppression does not match, and the monitor's priority is `high`
- **THEN** the notification SHALL be presented with iOS `interruptionLevel = .timeSensitive` (Android channel `zmn_high`)

#### Scenario: Monitor priority is silent
- **WHEN** a push arrives, suppression does not match, and the monitor's priority is `silent`
- **THEN** no system notification SHALL be shown; the event SHALL still be recorded in notification history and the event-snapshot SHALL still be updated for widgets/tray/dock

#### Scenario: Priority not configured
- **WHEN** a monitor has no explicit priority set
- **THEN** the system SHALL treat it as `normal` (iOS `interruptionLevel = .active`, Android channel `zmn_normal`)

### Requirement: Event-Snapshot Update on Delivery

After a notification is presented (or recorded as silent), the system SHALL update the platform-specific event-snapshot source consumed by the quick-look surface (see capability `quick-look-surfaces`). The snapshot SHALL contain the most recent 5 events with `event_id, monitor_id, monitor_name, started_at, image_url, top_label, alarm_score`. Suppressed pushes (mute / quiet-hours / noise-filter hide) SHALL NOT update the snapshot.

#### Scenario: Notification delivered, snapshot updated
- **WHEN** a push is presented or recorded as `silent`
- **THEN** the event-snapshot SHALL be updated with the new event prepended to the list, oldest entries dropped beyond 5

#### Scenario: Push suppressed, snapshot unchanged
- **WHEN** a push is suppressed by mute / quiet-hours / noise-filter (hide)
- **THEN** the event-snapshot SHALL NOT be updated

### Requirement: Graceful Degradation for ZM Direct Mode

The system SHALL present whatever payload ZoneMinder's Direct-mode Notifications API sends, formatted using only the fields present. No new behavior beyond Tier-1 fallback (legacy title and single-image attachment) is required for Direct mode.

#### Scenario: Direct-mode push arrives
- **WHEN** an FCM message arrives from ZoneMinder Direct mode (without ES-only fields like `object_labels` or `category_id`)
- **THEN** the system SHALL present a legacy-format notification with whatever monitor name and image are available, and SHALL NOT attach action buttons
