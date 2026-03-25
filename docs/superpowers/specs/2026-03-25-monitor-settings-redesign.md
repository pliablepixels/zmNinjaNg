# Monitor Settings Dialog Redesign

## Summary

Redesign the MonitorSettingsDialog from a read-only info popup to an interactive, tabbed settings panel. Replace legacy `Function` dropdown (Mocord/Modect/etc.) with the new ZoneMinder 1.38+ fields (`Capturing`, `Analysing`, `Recording`), with version-based fallback to the old API for servers < 1.38.

## Motivation

1. The current dialog is a wall of read-only text in nested cards — not useful or professional
2. ZoneMinder 1.38.0 replaced the single `Function` enum with independent `Capturing`, `Analysing`, and `Recording` fields. The old values (Mocord, Modect, Nodect) are confusing abbreviations that no longer appear in the ZM UI
3. Users expect inline editing of monitor settings without leaving the page

## Design

### Dialog Layout

Tabbed dialog with 3 tabs. Monitor name and ID shown in the dialog header.

**Tab 1: Capture & Recording** (default)

For ZM >= 1.38.0:
| Row | Type | Options |
|-----|------|---------|
| Capturing | dropdown | None, Ondemand, Always |
| Analysing | dropdown | None, Always |
| Recording | dropdown | None, OnMotion, Always |
| Enabled | toggle | on/off |
| Auto-cycle | dropdown | Off, 5s, 10s, 15s, 30s, 60s |

For ZM < 1.38.0:
| Row | Type | Options |
|-----|------|---------|
| Function | dropdown | None, Monitor, Modect, Record, Mocord, Nodect |
| Enabled | toggle | on/off |
| Auto-cycle | dropdown | Off, 5s, 10s, 15s, 30s, 60s |

**Tab 2: Video** (read-only)
| Row | Value |
|-----|-------|
| Resolution | e.g. 1920x1080 |
| Colors | e.g. 4 |
| Max FPS | value or "Unlimited" |
| Alarm Max FPS | value or "Same as Max FPS" |

**Tab 3: Display** (read-only)
| Row | Value |
|-----|-------|
| Rotation | e.g. "None" or "90 CW" |
| Feed fit | e.g. "Contain" |

### Visual Treatment

- No nested Cards inside the dialog. Each tab is a flat list of label/value rows
- Editable rows: label on left, inline control (dropdown or toggle) on right
- Read-only rows: label on left, text value on right
- Rows separated by subtle border-bottom
- Tabs use the existing shadcn/ui `Tabs` component
- Dialog header: monitor name as title, "Monitor #ID" as description
- Tab content has consistent vertical padding, no CardHeader/CardContent nesting

### Version Detection

Add `isZmVersionAtLeast(version: string | null, target: string): boolean` to `lib/zm-constants.ts`.

```typescript
export function isZmVersionAtLeast(version: string | null, target: string): boolean {
  if (!version) return false;
  const parse = (v: string) => v.split('.').map(Number);
  const [aMaj, aMin = 0, aPat = 0] = parse(version);
  const [bMaj, bMin = 0, bPat = 0] = parse(target);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat >= bPat;
}
```

Usage in the dialog:
```typescript
const { version } = useAuthStore();
const hasNewApi = isZmVersionAtLeast(version, '1.38.0');
```

### API Changes

#### New Type Definitions (api/types.ts)

Add to the Monitor Zod schema:
```typescript
Capturing: z.enum(['None', 'Ondemand', 'Always']).optional(),
Analysing: z.enum(['None', 'Always']).optional(),
Recording: z.enum(['None', 'OnMotion', 'Always']).optional(),
Decoding: z.enum(['None', 'Ondemand', 'KeyFrames', 'KeyFrames+Ondemand', 'Always']).optional(),
```

These are `.optional()` because ZM < 1.38 servers won't return them.

#### New API Functions (api/monitors.ts)

```typescript
export async function updateMonitorCapture(
  monitorId: string,
  settings: {
    Capturing?: 'None' | 'Ondemand' | 'Always';
    Analysing?: 'None' | 'Always';
    Recording?: 'None' | 'OnMotion' | 'Always';
  }
): Promise<MonitorData> {
  const params: Record<string, string> = {};
  if (settings.Capturing) params['Monitor[Capturing]'] = settings.Capturing;
  if (settings.Analysing) params['Monitor[Analysing]'] = settings.Analysing;
  if (settings.Recording) params['Monitor[Recording]'] = settings.Recording;
  return updateMonitor(monitorId, params);
}
```

The existing `changeMonitorFunction()` stays for ZM < 1.38 servers.

#### Enabled Toggle API

```typescript
export async function setMonitorEnabled(
  monitorId: string,
  enabled: boolean
): Promise<MonitorData> {
  return updateMonitor(monitorId, {
    'Monitor[Enabled]': enabled ? '1' : '0',
  });
}
```

### Component Changes

#### MonitorSettingsDialog.tsx — rewrite

- Replace 4-card grid with `Tabs` / `TabsList` / `TabsContent`
- Accept new props: `hasNewApi`, `onCapturingChange`, `onAnalysingChange`, `onRecordingChange`, `onEnabledChange`
- Keep existing `cycleSeconds` / `onCycleSecondsChange` props
- For ZM < 1.38: render single `Function` dropdown in first tab (keep existing mode change logic)
- For ZM >= 1.38: render three separate dropdowns

#### MonitorDetail.tsx — updates

- Pass `hasNewApi` and new handler props to the dialog
- Add mutation handlers for the new API fields
- Refetch monitor data on successful update

#### MonitorControlsCard.tsx — no changes

Stays as-is below the video for quick alarm/mode access.

### Internationalization

New keys needed in all 5 language files:

```
monitor_detail.tab_capture: "Capture & Recording"
monitor_detail.tab_video: "Video"
monitor_detail.tab_display: "Display"
monitor_detail.capturing_label: "Capturing"
monitor_detail.capturing_none: "None"
monitor_detail.capturing_ondemand: "On Demand"
monitor_detail.capturing_always: "Always"
monitor_detail.analysing_label: "Analysing"
monitor_detail.analysing_none: "None"
monitor_detail.analysing_always: "Always"
monitor_detail.recording_label: "Recording"
monitor_detail.recording_none: "None"
monitor_detail.recording_onmotion: "On Motion"
monitor_detail.recording_always: "Always"
monitor_detail.enabled_label: "Enabled"
```

### What Does Not Change

- MonitorControlsCard stays below the video (alarm toggle + mode selector)
- Dialog trigger (settings gear icon) stays the same
- Auto-cycle functionality stays the same, just moves into Tab 1

## Files to Modify

| File | Change |
|------|--------|
| `lib/zm-constants.ts` | Add `isZmVersionAtLeast()` |
| `api/types.ts` | Add Capturing/Analysing/Recording to Monitor schema |
| `api/monitors.ts` | Add `updateMonitorCapture()`, `setMonitorEnabled()` |
| `components/monitor-detail/MonitorSettingsDialog.tsx` | Rewrite: tabbed layout, editable controls |
| `pages/MonitorDetail.tsx` | Pass new props, add mutation handlers |
| `locales/{en,de,es,fr,zh}/translation.json` | Add new i18n keys |
| `lib/__tests__/zm-constants.test.ts` | Tests for `isZmVersionAtLeast()` |

## Testing

- Unit test for `isZmVersionAtLeast()` with various version strings
- Unit test for `updateMonitorCapture()` API call
- Verify dialog renders tabs, editable controls appear on correct tab
- Verify version < 1.38 shows legacy Function dropdown
- Verify version >= 1.38 shows Capturing/Analysing/Recording dropdowns
