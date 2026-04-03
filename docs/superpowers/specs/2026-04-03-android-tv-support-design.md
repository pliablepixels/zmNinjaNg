# Android TV / Fire Stick D-pad Support

**Date:** 2026-04-03
**Issue:** #96
**Branch:** `feature/android-tv-support`

## Goal

Make zmNinjaNG fully usable on Android TV and Fire Stick devices with a D-pad remote. Same APK for phone, tablet, and TV. No degradation to existing platforms.

## TV Detection & Mode Toggle

### Auto-detection
Add `isTVDevice()` to `lib/platform.ts`:
- Check `navigator.userAgent` for "TV", "AFT" (Amazon Fire TV), "STB" (set-top box)
- Query Android `UiModeManager` via a lightweight Capacitor plugin bridge call

### Manual toggle
- Add `tvMode: boolean` to `ProfileSettings` (default: auto-detected value)
- Toggle in Settings > Appearance section
- When `tvMode` is active:
  - `<html>` element gets a `tv-mode` CSS class
  - Base font size scales to ~20px (1.3x default)
  - All `rem`-based spacing scales proportionally
  - Focus rings thicken to `ring-4` with higher contrast
  - Sidebar defaults to collapsed

No per-screen layout changes. Existing responsive design handles the 1080p TV viewport.

## Navigation Architecture

### Layer 1: Spatial Navigation (default)
Enable Android WebView's `spatialNavigationEnabled` when TV mode is active. This gives free D-pad focus movement across standard DOM elements: buttons, inputs, links, cards.

**Limitation:** Spatial navigation is blind to custom components built with `div` + `role` + click handlers. These need explicit keyboard support (see Custom Component Accessibility below).

### Layer 2: Custom Key Event Router (complex screens)
A `useTvKeyHandler` hook that:
- Captures `keydown` events at the screen level
- Accepts a handler map: `{ ArrowLeft: fn, ArrowRight: fn, ArrowUp: fn, ArrowDown: fn, Enter: fn }`
- Auto-cleans up on unmount so spatial nav resumes
- Supports long-press detection for continuous actions (pan, seek)

When no custom handler is registered for a key, the event passes through to spatial navigation.

### Layer 3: Enter/Click Fallback
For any focused element that doesn't natively handle `Enter`/`Space`:
- The key router synthesizes a `click` event on the focused element
- This catches custom `div`-based controls that spatial nav can focus but not activate

## Custom Component Accessibility

Audit and fix all custom interactive components to work with keyboard/D-pad:

### Requirements per component
- Must have `tabindex="0"` if not natively focusable
- Must respond to `Enter` and/or `Space` for activation
- Must show visible focus indicator

### Components to audit
| Component | Base | Expected Status |
|---|---|---|
| `Button` | `<button>` | Works natively |
| `Input` | `<input>` | Works natively |
| `Switch` | Radix Switch | Should work (Radix handles keyboard) — verify |
| `Select` | Radix Select | Should work — verify arrow keys open/navigate |
| `Slider` | Radix Slider | Should work — verify arrow keys adjust value |
| `Checkbox` | Radix Checkbox | Should work — verify Space toggles |
| `Dialog/Modal` | Radix Dialog | Should trap focus — verify D-pad stays in modal |
| `Popover` | Radix Popover | Should work — verify Enter opens, Escape closes |
| `Tabs` | Radix Tabs | Should work — verify arrow keys switch tabs |
| Custom `div` onClick | none | Needs `tabindex="0"` + `onKeyDown` Enter handler |
| `MonitorCard` | `div` | Needs `tabindex` + Enter to open |
| `EventCard` | `div` | Needs `tabindex` + Enter to open |
| `DashboardWidget` | `div` | Needs `tabindex` + Enter to interact |

Any `div` or `span` with an `onClick` but no `tabindex` or `onKeyDown` is a D-pad dead zone. These must be found and fixed.

## Screen-by-Screen D-pad Mapping

| Screen | D-pad Arrows | Enter/Select | Back |
|---|---|---|---|
| Dashboard | Spatial nav between widgets | Open widget | Browser back |
| Montage | Move focus between monitor cells | Toggle fullscreen | Exit fullscreen or browser back |
| Monitor Detail | Left/right = prev/next monitor | Play/pause stream | Browser back |
| Events List | Spatial nav between event cards | Open event detail | Browser back |
| Event Detail | Left/right = prev/next event, up/down = seek 10s | Play/pause video | Browser back |
| Timeline | Left/right = pan, up/down = zoom in/out | Click event at playhead | Browser back |
| Settings | Spatial nav between fields | Activate control | Browser back |
| Modals/Popovers | Spatial nav within overlay | Activate button | Close overlay |

**Long-press:** On timeline, continuous pan/zoom while arrow key is held. On event detail, fast seek.

## Android Native Changes

### AndroidManifest.xml
- Add `android.intent.category.LEANBACK_LAUNCHER` to MainActivity intent filter
- Add `<uses-feature android:name="android.software.leanback" android:required="false" />` — required=false so same APK installs on phones
- Add TV banner icon (320x180px) as `android:banner` on the application element

### MainActivity.java
After WebView loads, if device is TV:
- Enable `spatialNavigationEnabled` on WebView settings
- Set `setFocusableInTouchMode(true)` on WebView
- Ensure soft keyboard triggers on input focus (may need `setRequestFocus` configuration)

TV detection via:
```java
UiModeManager uiModeManager = (UiModeManager) getSystemService(UI_MODE_SERVICE);
boolean isTV = uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
```

### build.gradle
No new dependencies. No leanback library needed.

### Capacitor Bridge
Expose `isTV()` method via a small plugin or by injecting a JS variable on WebView load so the web layer can detect TV without user agent sniffing alone.

## Text Input on TV

Rely on Android TV's built-in system keyboard. Fix WebView configuration to ensure it triggers:
- `WebSettings.setJavaScriptEnabled(true)` (already set by Capacitor)
- Ensure input elements use appropriate `inputMode` attributes (`text`, `url`, `numeric`)
- If system keyboard still doesn't trigger, try `webView.requestFocus()` on input focus events

No custom on-screen keyboard.

## What We Are NOT Doing

- No leanback library or native TV UI components
- No separate APK or build variant
- No custom on-screen keyboard
- No TV-specific layouts or component variants
- No changes to non-TV rendering paths

## Testing

### Unit tests
- `useTvKeyHandler` hook: simulated keydown events, handler registration/cleanup
- TV detection logic: mocked user agents and UiModeManager responses
- Custom component keyboard activation: verify Enter/Space triggers click

### E2E
- New `@tv` platform tag
- `tv-navigation.feature`: D-pad through main screens, enter to select, back to dismiss, text input in settings, montage grid navigation
- Run on `android_tv_test` AVD (Android TV emulator, API 30, x86)

### Regression
- All existing phone/web/tablet e2e tests must pass unchanged
- TV code paths gated behind `tvMode` detection
- No changes to non-TV rendering

### Manual verification
- Android TV emulator for D-pad behavior
- Fire Stick sideload if hardware available
- Verify system keyboard works for input fields
- Verify all Radix components respond to keyboard
