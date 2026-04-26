# Notifications

zmNinjaNg can notify you when ZoneMinder detects events. There are two notification modes, plus in-app toast notifications.

## Notification Modes

zmNinjaNg supports two notification modes. You choose the mode in **Notification Settings** based on your ZoneMinder setup.

### Event Server (ES) Mode

Uses a WebSocket connection to the [ZoneMinder Event Notification Server](https://github.com/pliablepixels/zmeventnotificationNg) (zmeventnotification). Choose this mode if you run ES.

- **Desktop/Web**: WebSocket delivers events in real time while the app is open; toast notifications shown in-app.
- **Mobile (iOS/Android)**: ES sends FCM push notifications for background delivery. When the app is in the foreground, events arrive via WebSocket and are shown as in-app toasts; FCM duplicates are suppressed automatically.

### Direct Mode

Uses ZoneMinder's built-in Notifications REST API (no Event Server required). Choose this mode if you do not run ES but still want notifications. Requires ZoneMinder with the Notifications API (see ZM PR #4685).

- **Desktop/Web**: zmNinjaNg polls the ZM events API at a configurable interval (10s–120s). Events appear as in-app toasts while the app is open.
- **Mobile (iOS/Android)**: ZoneMinder sends FCM push notifications directly. Notifications work even when the app is closed or in the background. When the app is in the foreground, push events are shown as in-app toasts.

## Push Notifications (Mobile)

Both modes support native push notifications on iOS and Android via Firebase Cloud Messaging (FCM). Push works out of the box with the App Store and Google Play builds — no Firebase setup required on your end.

### Requirements

1. **ES mode**: The [Event Notification Server](https://github.com/pliablepixels/zmeventnotificationNg) with FCM support
2. **Direct mode**: ZoneMinder with the Notifications REST API

:::{tip}
If you build the app from source and want push notifications, you will need to provide your own Firebase credentials. See the {doc}`../building/ANDROID` and {doc}`../building/IOS` build guides.
:::

### Setup

1. In zmNinjaNg **Notification Settings**, enable notifications and select your mode (ES or Direct)
2. The app registers its FCM token with the appropriate backend (ES via WebSocket, or ZM via REST API)

For custom-built mobile apps, add your own Firebase project first: create a Firebase project, enable Cloud Messaging, and drop `google-services.json` (Android) or `GoogleService-Info.plist` (iOS) into the appropriate directory before building. See the {doc}`../building/ANDROID` and {doc}`../building/IOS` guides.

### Per-Monitor Configuration

You can configure notifications per monitor:

- Enable or disable notifications for individual cameras
- Useful for ignoring high-traffic cameras that would generate too many alerts

### Direct Mode Options

When using Direct mode, additional settings are available:

- **Polling interval** (desktop only): How often to check for new events (10s–120s)
- **Only detected events**: Filter to only notify for events processed by object detection (zm_detect)

## Notification History

zmNinjaNg keeps a history of the last 100 notifications received. Access it from the **View History** button on the Notification Settings page.

Each history entry shows:

- Monitor name
- Event cause and timestamp
- Event thumbnail (if available)

Tap a notification entry to jump to the corresponding event.

## Triage Center

The **Triage Center** (Notification Settings → "Triage Center") is the single place to manage how notifications are silenced and filtered for the active profile. It has four tabs:

### Mutes

Lists ad-hoc mutes — currently silenced monitors and when they expire. Use **+1h** to extend or the trash icon to clear. Mutes are typically created by tapping the "Mute monitor 1h" action on a notification (this action ships with the native release).

### Quiet Hours

Recurring time-of-day windows during which notifications are suppressed for the active profile.

- Pick a label (e.g. "Sleep"), start and end time, and which weekdays the window applies to.
- Windows that cross midnight (e.g. 22:00–07:00) are handled correctly — the active range belongs to the day the window starts.
- Empty weekday selection is rejected at save time.

### Noise Filter

Rules that suppress events with a low alarm score or matching cause text. Each rule has:

- A **minimum alarm score** — events below this are matched.
- An optional **comma-separated list of cause patterns** — case-insensitive substring match against the event's cause text.
- A **mode**: *Dim in list* (event still appears, dimmed) or *Hide from list and notifications*.

The same rules apply to both the Events list (see {doc}`events`) and the notification pipeline once the native release lands — you only configure them once.

### Priority

Per-monitor priority (high / normal / low / silent) ships with the native release; the tab shows a placeholder for now.

### How suppression works together

When a push arrives, suppression is evaluated in this order:

1. **Ad-hoc mute** wins first — silenced explicitly.
2. **Quiet hours** wins next — silenced on schedule, even when priority is high.
3. **Noise filter (hide mode)** wins last — silenced for being below threshold or matching cause-exclude.

Anything that survives all three is presented at the priority configured for that monitor.

## In-tab Quick-Look (web)

On web, a slim strip at the bottom of the viewport shows the five most recent events with timestamps. Click any chip to jump to its detail page. The strip is hidden on phone-portrait viewports below 480px and can be dismissed for the session via the × button (it returns next time you open the tab). The functional equivalent on iOS and Android is a home-screen widget; on Tauri desktop it will be a system-tray popover (both ship with the native release).

## Troubleshooting

**No in-app notifications (ES mode)**
- Verify the Event Notification Server is running and accessible
- Check the connection status badge in Notification Settings
- Ensure the server hostname is correct
- Check app logs for WebSocket connection errors

**No in-app notifications (Direct mode, desktop)**
- Verify ZoneMinder's Notifications API is available (the Direct option will be greyed out if not detected)
- Check that the polling interval is configured
- Check app logs for polling errors

**No push notifications (mobile)**
- Check that FCM token registration succeeded (check app logs)
- ES mode: Verify the Event Notification Server has FCM support and is configured to send to zmNinjaNg
- Direct mode: Verify ZoneMinder's Notifications API is available
- On Android, check that battery optimization isn't killing the app in the background
- Custom builds only: verify you embedded your own Firebase credentials before building
