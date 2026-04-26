# Events

The Events screen lets you browse and play back recorded events from your ZoneMinder server.

## Event List

Events are displayed as cards showing:

- **Thumbnail** - A snapshot from the event
- **Monitor name** - Which camera captured the event
- **Date and time** - When the event occurred
- **Duration** - Length of the event
- **Frames** - Number of frames in the event
- **Tags** - Any tags applied to the event in ZoneMinder

The list supports infinite scrolling - older events load automatically as you scroll down.

On desktop, hovering over a thumbnail for a moment shows a 400px-wide preview anchored next to the row. The preview loads a higher-resolution image from the server. The underlying card remains clickable while the preview is visible, so you can still click to open the event.

## Filtering Events

Filter events using the controls at the top:

- **Date range** - Select a start and end date, or use the quick-range buttons (Today, 24h, 7d, etc.)
- **Monitor** - Show events from a specific camera only
- **Groups** - Filter by monitor group
- **Cause / notes search** - Type any term to find matching events (the inline bar searches across cause text, notes, and monitor name)
- **Minimum alarm score** - Drag the score slider to filter out low-score noise
- **Today's high-score** - One-tap preset that sets the date range to today and the minimum score to 50

### Reviewed events

Each event card has a green checkmark button. Tap it to mark the event reviewed; tap again to unmark.

- **Reviewed events are hidden by default**, so the list stays focused on what still needs your attention.
- A **Show reviewed** toggle in the filter popover brings them back into view, rendered at 50% opacity with the checkmark icon so they're easy to distinguish.
- The **Mark all reviewed** button (next to Refresh) acts on every event currently visible in the filtered list, capped at 500 per click. A toast confirms how many were marked.

Reviewed state is profile-scoped and persists across app restarts.

### Noise filter rules

Noise-filter rules let you suppress low-value events at the source. Configure them in **Triage Center** (see {doc}`notifications`). Rules can either:

- **Hide** matching events from the list and notifications, or
- **Dim** them in the list while still letting notifications through.

Hide-mode events can be temporarily revealed by enabling **Show filtered** in the filter popover; they appear with a small filter icon so you know why they were normally suppressed.

## Event Playback

Tap an event to open the event detail view, which includes:

### Video Player

The event player selects the playback mode based on the event's format:

- **HLS events** - Events with an `.m3u8` DefaultVideo use HLS playback via video.js
- **MP4 events** - Events with MP4 recordings use standard video playback

If video.js playback fails (network error, unsupported codec, etc.), the player automatically falls back to ZMS playback, which streams JPEG frames from ZoneMinder.

#### ZMS Fallback

ZMS playback renders frames one at a time from ZoneMinder's streaming server. Controls include:

- **Play/Pause** - Start or stop frame-by-frame playback
- **Seek** - Jump to any point in the event
- **Playback speed** - Adjust speed

#### Standard Controls

For video-based playback (HLS or MP4), the player provides:

- **Play/Pause** - Start or stop playback
- **Scrub bar** - Jump to any point in the event
- **Playback speed** - Adjust speed (1x, 2x, etc.)

### Event Info

Details about the event:

- Start and end time
- Duration
- Number of alarm and total frames
- Monitor name and ID

### Navigation

- **Previous/Next** buttons to move between events without going back to the list

## Event Montage

View events from multiple cameras at the same time. This is useful for reviewing an incident across multiple camera angles simultaneously.

## Downloads

You can download event recordings:

1. Open an event
2. Tap the download button
3. The video file is saved to your device

On mobile, downloads go to the device's Documents or Downloads folder. A progress indicator shows download status.

:::{note}
Large event downloads may take time on mobile networks. The download runs in the background - you can continue using the app.
:::
