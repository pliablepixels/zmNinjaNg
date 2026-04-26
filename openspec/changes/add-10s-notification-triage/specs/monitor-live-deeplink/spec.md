## ADDED Requirements

### Requirement: PiP-Auto Deep Link to MonitorDetail

The system SHALL accept a deep link of the form `MonitorDetail?monitor_id=<id>&profile_id=<id>&pip=auto`. When this route is mounted with `pip=auto`, the existing PiP plugin SHALL engage automatically once the live stream is ready, without requiring a user gesture.

#### Scenario: Live action launches into PiP
- **WHEN** the user taps the Live notification action and the app launches into `MonitorDetail?monitor_id=m1&profile_id=p1&pip=auto`
- **THEN** the live stream for monitor `m1` under profile `p1` SHALL begin loading and PiP SHALL engage when the stream is ready

#### Scenario: Stream fails to start
- **WHEN** the stream fails to load (network error, monitor offline)
- **THEN** the page SHALL surface the existing error UI for `MonitorDetail` and SHALL NOT attempt to engage PiP

#### Scenario: Profile mismatch
- **WHEN** the deep link references a `profile_id` that is not the currently active profile
- **THEN** the system SHALL switch to the referenced profile before mounting `MonitorDetail`

#### Scenario: PiP unsupported on platform
- **WHEN** the deep link is followed on a platform where PiP is not supported (e.g., Tauri desktop without PiP capability)
- **THEN** `MonitorDetail` SHALL load normally and the `pip=auto` parameter SHALL be ignored

### Requirement: Deep Link is Reusable

The `pip=auto` query parameter SHALL be a public part of the deep-link contract — usable from sources other than notification actions (e.g., a future home-screen widget, a future shortcut). The parameter SHALL be the only contract; no notification-specific coupling SHALL leak into `MonitorDetail`.

#### Scenario: Same deep link from different source
- **WHEN** the same deep link is invoked from a non-notification source (e.g., a Capacitor URL handler test)
- **THEN** the behavior SHALL be identical to invocation from the Live action

### Requirement: PiP Plugin Auto-Engage Entry Point

The existing `app/src/plugins/pip` plugin SHALL expose an entry point that engages PiP on a video element provided by `MonitorDetail`, callable once the stream is ready. The entry point SHALL be safe to call when PiP is unsupported (no-op + log).

#### Scenario: Entry point called when PiP supported
- **WHEN** `MonitorDetail` mounts with `pip=auto`, the stream becomes ready, and the platform supports PiP
- **THEN** the plugin SHALL engage PiP on the stream's video element

#### Scenario: Entry point called when PiP unsupported
- **WHEN** the same conditions apply but the platform does not support PiP
- **THEN** the plugin SHALL log via `log.notifications` (or appropriate component logger) and return without error
