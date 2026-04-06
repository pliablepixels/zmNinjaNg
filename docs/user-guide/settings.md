# Settings

Settings are stored per profile. Each ZoneMinder server profile has its own independent settings.

## Appearance

| Setting | Description |
|---------|-------------|
| **Language** | Interface language (English, German, Spanish, French, Chinese) |
| **Theme** | Light, Cream, Dark, Slate, Amber, or System (follows system setting by default) |
| **Date format** | How dates are displayed throughout the app |
| **Time format** | 12-hour or 24-hour clock |

## Bandwidth Settings

Control how frequently the app fetches data from your server. Useful for mobile data or slow connections.

| Mode | Description |
|------|-------------|
| **Normal** | Standard refresh intervals (10–30s depending on the data type) |
| **Low** | Reduced refresh rates (2x slower) and lower image quality |

Low bandwidth mode affects:

- Monitor snapshot refresh rate
- Dashboard widget refresh intervals
- Event list polling
- Timeline/heatmap data loading
- Image quality and scale

:::{tip}
Switch to **Low bandwidth mode** when on mobile data or a slow connection. You can switch back to Normal when on WiFi.
:::

## Live Streaming

Settings that control live camera feeds in the Monitor Detail view:

| Setting | Description |
|---------|-------------|
| **Streaming protocol** | WebRTC (lowest latency), MSE, or HLS — tried in order if go2rtc is configured |
| **Snapshot interval** | How often to refresh snapshot images |
| **Protocol Label** | Shows or hides the streaming protocol indicator (MJPEG/MSE/WebRTC) on video feeds across all pages |

### Streaming Protocols

When Go2RTC is enabled, zmNinjaNg tries WebRTC, MSE, and HLS in parallel. The first protocol to produce video wins and is used for the stream. If all Go2RTC protocols fail, the app falls back to MJPEG via ZoneMinder's ZMS. The protocol label (when enabled) shows which protocol is active on each feed.

You can configure which protocols to try in the Go2RTC protocol settings.

### Per-Monitor Streaming Override

The global Go2RTC setting acts as the default for all monitors. To override it for a single monitor, open the monitor's Settings dialog (Video tab). When a monitor has Go2RTC enabled, a Go2RTC toggle appears. Turning it off forces MJPEG for that monitor only, leaving other monitors unaffected.

## Playback

Settings that affect event video playback:

| Setting | Description |
|---------|-------------|
| **Dashboard refresh interval** | How often the dashboard widgets reload data (5–300 seconds) |

## Notification Settings

Configure how zmNinjaNg handles event notifications. See {doc}`notifications` for details.

## Advanced

### Connection

| Setting | Description |
|---------|-------------|
| **Allow self-signed certificates** | Enable when your ZoneMinder server uses a self-signed HTTPS certificate (iOS/Android only) |

### Log Redaction

Redact sensitive values (URLs, credentials) from logs. Disable only when sharing logs for troubleshooting.

### Kiosk PIN

Manage the PIN used to lock and unlock kiosk mode. See {doc}`kiosk` for full details on kiosk mode.

| Action | Description |
|--------|-------------|
| **Set PIN** | Appears when no PIN is stored. Sets a new 4-digit PIN. |
| **Change PIN** | Requires verifying your current PIN or biometrics before setting a new one. |
| **Clear PIN** | Removes the PIN. Requires verifying the current PIN or biometrics first. |

## Multi-Server

zmNinjaNg automatically detects multi-server ZoneMinder setups via the `/servers.json` API endpoint. Single-server setups are unaffected — no behavior change occurs.

In a multi-server setup:

- Each monitor's ServerId is mapped to the correct server for streaming, daemon checks, and event images
- All API calls, ZMS streams, and portal URLs route to the appropriate server
- Multi-port streaming (`ZM_MIN_STREAMING_PORT`) is automatically applied to per-monitor URLs

### Server Page

The Server page (accessible from the sidebar) shows all servers in the cluster with per-server status including CPU, memory, and disk usage. Storage areas are displayed with disk usage and their server association.

## Server Information

For single-server setups, the Server screen shows:

- Server version
- API version
- Daemon status

## Resetting Settings

Settings can be reset to defaults from the Settings screen. This affects only the current profile's settings, not your connection details or other profiles.
