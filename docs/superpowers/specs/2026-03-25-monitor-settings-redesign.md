# Monitor Settings Dialog Redesign

## Summary

Redesign the MonitorSettingsDialog from a read-only info popup to an interactive, tabbed settings panel. Replace legacy `Function` dropdown (Mocord/Modect/etc.) with the new ZoneMinder 1.38+ fields (`Capturing`, `Analysing`, `Recording`), with version-based fallback to the old API for servers < 1.38.

## Motivation

1. The current dialog is a wall of read-only text in nested cards — not useful or professional
2. ZoneMinder 1.38.0 replaced the single `Function` enum with independent `Capturing`, `Analysing`, and `Recording` fields. The old values (Mocord, Modect, Nodect) are confusing abbreviations that no longer appear in the ZM UI
3. Users expect inline editing of monitor settings without leaving the page

## Design

### Dialog Layout

Tabbed dialog with 3 tabs. Dialog header shows the monitor name as the title (dynamic, e.g. "Front Porch") and "Monitor #5 · Ffmpeg" as the description (ID + Type).

**Tab 1: Capture & Recording** (default)

For ZM >= 1.38.0:
| Row | Type | Options | data-testid |
|-----|------|---------|-------------|
| Capturing | dropdown | None, Ondemand, Always | `settings-capturing-select` |
| Analysing | dropdown | None, Always | `settings-analysing-select` |
| Recording | dropdown | None, OnMotion, Always | `settings-recording-select` |
| Enabled | toggle | on/off | `settings-enabled-toggle` |
| Auto-cycle | dropdown | Off, 5s, 10s, 15s, 30s, 60s | `monitor-detail-cycle-select` (existing) |

For ZM < 1.38.0:
| Row | Type | Options | data-testid |
|-----|------|---------|-------------|
| Function | dropdown | None, Monitor, Modect, Record, Mocord, Nodect | `settings-function-select` |
| Enabled | toggle | on/off | `settings-enabled-toggle` |
| Auto-cycle | dropdown | Off, 5s, 10s, 15s, 30s, 60s | `monitor-detail-cycle-select` (existing) |

**Tab 2: Video** (read-only)
| Row | Value |
|-----|-------|
| Resolution | e.g. 1920x1080 |
| Colors | e.g. 4 |
| Max FPS | value or "Unlimited" |
| Alarm Max FPS | value or "Same as Max FPS" |
| Controllable | Yes/No badge |

**Tab 3: Display** (read-only)
| Row | Value |
|-----|-------|
| Rotation | e.g. "None" or "90 CW" |
| Feed fit | e.g. "Contain" |

Tab trigger test IDs: `settings-tab-capture`, `settings-tab-video`, `settings-tab-display`.

### Visual Treatment

- No nested Cards inside the dialog. Each tab is a flat list of label/value rows
- Editable rows: label on left, inline control (dropdown or toggle) on right
- Read-only rows: label on left, text value on right
- Rows separated by subtle border-bottom
- Tabs use the existing shadcn/ui `Tabs` component
- Dialog header: monitor name as title (dynamic), "Monitor #ID · Type" as description
- Tab content has consistent vertical padding, no CardHeader/CardContent nesting

### Mutation Behavior

All editable controls follow the same pattern (matching existing `useModeControl` behavior):
- Control is disabled while the update is in-flight
- On success: toast notification, refetch monitor data
- On error: toast error, no optimistic update (value stays at server state)
- Each field sends its own API call (no batching)

### Version Detection

Add `isZmVersionAtLeast(version: string | null, target: string): boolean` to a new file `lib/zm-version.ts` (version comparison is not a protocol constant).

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
```

These are `.optional()` because ZM < 1.38 servers won't return them. `Decoding` is not included — it's a low-level setting users don't need to control from the app.

#### New API Function (api/monitors.ts)

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

#### Enabled Toggle

`setMonitorEnabled()` already exists in `api/monitors.ts` — reuse it.

### Component Changes

#### MonitorSettingsDialog.tsx — rewrite

- Replace 4-card grid with `Tabs` / `TabsList` / `TabsContent`
- Accept new props: `hasNewApi`, capture/recording handlers, `onEnabledChange`, `onFunctionChange`
- Retain existing props: `monitor`, `cycleSeconds`, `onCycleSecondsChange`, `feedFit`, `orientedResolution`, `rotationStatus`
- For ZM < 1.38: render single `Function` dropdown in first tab
- For ZM >= 1.38: render Capturing/Analysing/Recording dropdowns
- Dialog title = `monitor.Name`, description = `Monitor #${monitor.Id} · ${monitor.Type}`

#### MonitorDetail.tsx — updates

- Compute `hasNewApi` from auth store version
- Pass `hasNewApi` and new handler props to the dialog
- Add mutation handlers for the new API fields (follow `useModeControl` pattern)
- Refetch monitor data on successful update

#### MonitorControlsCard.tsx — version-aware update

- Accept `hasNewApi` prop
- When `hasNewApi` is true: hide the mode dropdown (the legacy Function selector is not meaningful on 1.38+). Keep only the alarm status/toggle
- When `hasNewApi` is false: show mode dropdown as-is (existing behavior)

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
monitor_detail.analysing_label: "Analysis"
monitor_detail.analysing_none: "None"
monitor_detail.analysing_always: "Always"
monitor_detail.recording_label: "Recording"
monitor_detail.recording_none: "None"
monitor_detail.recording_onmotion: "On Motion"
monitor_detail.recording_always: "Always"
monitor_detail.enabled_label: "Enabled"
monitor_detail.capture_updated: "Capture settings updated"
monitor_detail.capture_failed: "Failed to update capture settings"
monitor_detail.enabled_updated: "Monitor enabled status updated"
monitor_detail.enabled_failed: "Failed to update enabled status"
```

Existing keys reused: `monitors.function` (for legacy dropdown label), `common.enabled`, `common.yes`, `common.no`, `monitors.controllable`, `monitor_detail.cycle_*` keys.

### What Does Not Change

- Dialog trigger (settings gear icon) stays the same
- Auto-cycle functionality stays the same, just moves into Tab 1

## Files to Modify

| File | Change |
|------|--------|
| `lib/zm-version.ts` (new) | Add `isZmVersionAtLeast()` |
| `api/types.ts` | Add Capturing/Analysing/Recording to Monitor schema |
| `api/monitors.ts` | Add `updateMonitorCapture()` |
| `components/monitor-detail/MonitorSettingsDialog.tsx` | Rewrite: tabbed layout, editable controls, version-aware |
| `components/monitor-detail/MonitorControlsCard.tsx` | Hide mode dropdown when `hasNewApi` is true |
| `pages/MonitorDetail.tsx` | Compute `hasNewApi`, pass new props, add mutation handlers |
| `locales/{en,de,es,fr,zh}/translation.json` | Add new i18n keys |
| `lib/__tests__/zm-version.test.ts` (new) | Tests for `isZmVersionAtLeast()` |

## Testing

### Unit Tests

- `isZmVersionAtLeast()`: null version, versions below/at/above target, multi-digit segments, missing patch versions
- `updateMonitorCapture()`: sends correct API params for each field combination

### E2E Tests

File: `app/tests/features/monitor-settings.feature`

```gherkin
@all
Scenario: Open settings dialog and verify tabs
  Given I am logged into zmNinjaNG
  When I navigate to a monitor detail page
  And I open the settings dialog
  Then I should see tabs "Capture & Recording", "Video", "Display"
  And the "Capture & Recording" tab should be selected by default

@all
Scenario: Change capturing mode on ZM 1.38+ server
  Given I am logged into zmNinjaNG
  And the server is running ZoneMinder >= 1.38
  When I navigate to a monitor detail page
  And I open the settings dialog
  And I change "Capturing" to "On Demand"
  Then I should see a success toast
  When I close and reopen the settings dialog
  Then "Capturing" should show "On Demand"

@all
Scenario: Toggle monitor enabled state
  Given I am logged into zmNinjaNG
  When I navigate to a monitor detail page
  And I open the settings dialog
  And I toggle the enabled switch
  Then I should see a success toast

@all @visual
Scenario: Settings dialog layout
  Given I am logged into zmNinjaNG
  When I navigate to a monitor detail page
  And I open the settings dialog
  Then the page should match the visual baseline

@ios-phone @android
Scenario: Settings dialog fits phone screen
  Given I am logged into zmNinjaNG
  When I navigate to a monitor detail page
  And I open the settings dialog
  Then the dialog should not overflow the screen width
  And all tab content should be scrollable
```

Step definitions: `app/tests/steps/monitor-settings.steps.ts`
