## ADDED Requirements

### Requirement: Noise-Filter Rule Application to Events List

The Events list SHALL evaluate every noise-filter rule from the suppression store (capability `notification-mute-store` kind `"noise_filter"`) against each rendered event. When ANY rule matches an event, the event SHALL be either hidden or dimmed depending on the rule's `mode`.

Match definition (mirrors push pipeline):
- `min_alarm_score > event.score` (rule's threshold strictly exceeds event's score), OR
- ANY string in `exclude_cause_patterns` is found as a case-insensitive substring of `event.cause`.

If multiple rules match, the strictest mode wins (`hide` > `dim`).

#### Scenario: Event below score threshold (hide mode)
- **WHEN** a rule has `min_alarm_score = 30, mode = hide` and an event has `score = 12`
- **THEN** the event is excluded from the rendered list

#### Scenario: Event below score threshold (dim mode)
- **WHEN** a rule has `min_alarm_score = 30, mode = dim` and an event has `score = 12`
- **THEN** the event is rendered with the dimmed-by-noise visual treatment

#### Scenario: Cause-exclude match
- **WHEN** a rule has `exclude_cause_patterns = ["Continuous"]` and an event has `cause = "Continuous Recording"`
- **THEN** the rule matches and `mode` decides hide vs. dim

#### Scenario: Multiple rules — hide wins over dim
- **WHEN** two rules both match an event, one in `mode: dim` and the other in `mode: hide`
- **THEN** the event is hidden

#### Scenario: No `cause` text on event
- **WHEN** an event has no `cause` text
- **THEN** cause-exclude patterns SHALL NOT match; only the score check applies

### Requirement: Single Source of Truth with Push Pipeline

The Events list SHALL consume the SAME store entries that the push pipeline consumes. Adding, editing, or deleting a noise-filter rule via Triage Center SHALL affect both surfaces immediately (or on next focus, whichever is sooner). There SHALL NOT be a separate "list filter" rule set.

#### Scenario: Rule added in Triage Center reflects in Events list
- **WHEN** the user adds a hide-mode rule and the Events list is open
- **THEN** matching events SHALL be removed from the list on next refresh / focus

#### Scenario: Rule deleted in Triage Center un-hides events
- **WHEN** the user deletes a hide-mode rule
- **THEN** previously hidden events SHALL reappear in the list on next refresh / focus

### Requirement: Visual Treatment Distinct From Reviewed-Dim

The "dimmed by noise filter" treatment SHALL be visually distinguishable from the "dimmed because reviewed" treatment so the user can tell at a glance which suppression caused which fade. Suggested treatment: noise-dimmed events use a small "low-score" iconography in addition to opacity, while reviewed-dimmed events use a checkmark.

#### Scenario: Noise-dimmed event shows distinct icon
- **WHEN** an event is rendered as noise-dimmed (rule `mode: dim` matched)
- **THEN** a localized "low-score" / "filtered" icon SHALL be visible on the card alongside the dim treatment

#### Scenario: Event matches both noise-dim and reviewed
- **WHEN** an event is both reviewed AND matches a noise-dim rule
- **THEN** both icons SHALL be visible; opacity SHALL not stack lower than 50% (single dim)

### Requirement: One-Tap Bypass

The user SHALL be able to temporarily show all noise-filtered events in the Events list via a "Show filtered" toggle exposed inline in the quick-search filter bar (capability `event-quick-search`). The toggle SHALL be session-scoped (not persisted) so the next session starts in the user's configured-filter state.

#### Scenario: Show filtered toggled on
- **WHEN** the user taps "Show filtered" with active hide-mode rules
- **THEN** previously hidden events appear (rendered with the noise-dim treatment to indicate they would normally be filtered) for the duration of the session

#### Scenario: Session ends
- **WHEN** the user closes and reopens the app
- **THEN** the "Show filtered" toggle SHALL reset to off

### Requirement: First-Run Default Rule Offer

When the Events list first detects more than 50 events with `score < 30` in the user's history, the app SHALL offer (one-time, dismissable) to add a default noise-filter rule (`min_alarm_score = 30, mode = dim, monitor_id_or_all = "*"`). The user SHALL be able to accept, decline, or "ask me later." Once dismissed (accept or decline), the offer SHALL not reappear.

#### Scenario: Threshold reached, user accepts
- **WHEN** the threshold of 50 low-score events is reached and the user accepts the offer
- **THEN** a noise-filter rule SHALL be written to the suppression store and the list SHALL re-evaluate

#### Scenario: User declines
- **WHEN** the user declines
- **THEN** no rule SHALL be written; the offer SHALL not reappear

#### Scenario: User dismisses with "ask later"
- **WHEN** the user picks "ask later"
- **THEN** the offer SHALL re-appear at the next session that meets the threshold

### Requirement: Localization in 5 Languages

All user-facing strings (icon tooltips, "Show filtered" toggle label, first-run offer copy and buttons, dimmed-card iconography accessibility labels) SHALL be localized in en, de, es, fr, zh per rule #5.

#### Scenario: Each supported locale renders without missing keys
- **WHEN** the user switches locale and interacts with noise-filter UI
- **THEN** all visible strings SHALL be localized
