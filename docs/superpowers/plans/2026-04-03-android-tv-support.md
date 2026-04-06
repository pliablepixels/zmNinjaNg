# Android TV / Fire Stick D-pad Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make zmNinjaNg fully usable on Android TV and Fire Stick with D-pad remote navigation, while preserving existing phone/tablet/web behavior.

**Architecture:** Hybrid approach — WebView spatial navigation handles standard screens, a custom `useTvKeyHandler` hook intercepts keys on complex screens (timeline, montage, event detail). TV mode auto-detected on TV devices, manually toggleable in settings. CSS scaling via root font size, no per-component layout changes.

**Tech Stack:** Capacitor Android (native WebView config), React hooks (key handler), Tailwind CSS (TV mode scaling), Android UiModeManager (detection)

**Spec:** `docs/superpowers/specs/2026-04-03-android-tv-support-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `app/src/lib/platform.ts` | Modify | Add `isTVDevice` detection |
| `app/src/stores/settings.ts` | Modify | Add `tvMode` to ProfileSettings |
| `app/src/hooks/useTvMode.ts` | Create | Hook to check if TV mode is active |
| `app/src/hooks/useTvKeyHandler.ts` | Create | D-pad key event router |
| `app/src/index.css` | Modify | TV mode CSS (font scaling, focus rings) |
| `app/src/components/layout/AppLayout.tsx` | Modify | Apply `tv-mode` class to root |
| `app/src/components/settings/AppearanceSection.tsx` | Modify | Add TV mode toggle |
| `app/android/app/src/main/AndroidManifest.xml` | Modify | TV leanback intent, features |
| `app/android/app/src/main/java/com/zoneminder/zmNinjaNG/MainActivity.java` | Modify | WebView spatial nav config |
| `app/android/app/src/main/java/com/zoneminder/zmNinjaNG/TvDetectorPlugin.java` | Create | Expose isTV to JS |
| `app/src/hooks/__tests__/useTvKeyHandler.test.ts` | Create | Unit tests for key handler |
| `app/src/hooks/__tests__/useTvMode.test.ts` | Create | Unit tests for TV mode |
| `app/src/pages/Timeline.tsx` | Modify | Register D-pad handlers |
| `app/src/pages/Montage.tsx` | Modify | Register D-pad handlers |
| `app/src/pages/EventDetail.tsx` | Modify | Register D-pad handlers |
| `app/src/pages/MonitorDetail.tsx` | Modify | Register D-pad handlers |
| `app/src/locales/{en,de,es,fr,zh}/translation.json` | Modify | TV mode i18n keys |

---

### Task 1: Android Native — TV Detection Plugin + Manifest

**Files:**
- Create: `app/android/app/src/main/java/com/zoneminder/zmNinjaNG/TvDetectorPlugin.java`
- Modify: `app/android/app/src/main/java/com/zoneminder/zmNinjaNG/MainActivity.java`
- Modify: `app/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Create TvDetectorPlugin.java**

```java
package com.zoneminder.zmNinjaNG;

import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

@CapacitorPlugin(name = "TvDetector")
public class TvDetectorPlugin extends Plugin {

    @PluginMethod()
    public void isTV(PluginCall call) {
        UiModeManager uiModeManager = (UiModeManager) getContext().getSystemService(Context.UI_MODE_SERVICE);
        boolean isTV = uiModeManager != null
            && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
        JSObject ret = new JSObject();
        ret.put("isTV", isTV);
        call.resolve(ret);
    }

    @PluginMethod()
    public void enableSpatialNavigation(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                settings.setSpatialNavigationEnabled(true);
                webView.setFocusableInTouchMode(true);
                webView.requestFocus();
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to enable spatial navigation", e);
            }
        });
    }
}
```

- [ ] **Step 2: Register plugin in MainActivity.java**

Replace the full file:

```java
package com.zoneminder.zmNinjaNG;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SSLTrustPlugin.class);
        registerPlugin(PipPlugin.class);
        registerPlugin(TvDetectorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

- [ ] **Step 3: Update AndroidManifest.xml**

Add TV features and leanback launcher. Add after line 21 (inside the existing intent-filter):

```xml
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
```

Add before the closing `</application>` tag (after line 40):

```xml
        <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
        <uses-feature android:name="android.software.leanback" android:required="false" />
```

- [ ] **Step 4: Verify Android project compiles**

Run: `cd app/android && ./gradlew assembleDebug 2>&1 | tail -5`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add app/android/
git commit -m "feat: add Android TV detection plugin and manifest config

refs #96"
```

---

### Task 2: TV Detection in Web Layer + Settings

**Files:**
- Modify: `app/src/lib/platform.ts`
- Modify: `app/src/stores/settings.ts`
- Create: `app/src/hooks/useTvMode.ts`
- Create: `app/src/hooks/__tests__/useTvMode.test.ts`

- [ ] **Step 1: Write test for useTvMode**

Create `app/src/hooks/__tests__/useTvMode.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the settings store
const mockSettings = { tvMode: false };
vi.mock('../../hooks/useCurrentProfile', () => ({
  useCurrentProfile: () => ({
    settings: mockSettings,
    currentProfile: { id: 'test' },
  }),
}));

// Mock platform
vi.mock('../../lib/platform', () => ({
  Platform: { isNative: false, isTauri: false },
}));

describe('useTvMode', () => {
  beforeEach(() => {
    mockSettings.tvMode = false;
  });

  it('returns false when tvMode setting is off', async () => {
    const { useTvMode } = await import('../useTvMode');
    // useTvMode reads from settings
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useTvMode());
    expect(result.current.isTvMode).toBe(false);
  });

  it('returns true when tvMode setting is on', async () => {
    mockSettings.tvMode = true;
    const { useTvMode } = await import('../useTvMode');
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useTvMode());
    expect(result.current.isTvMode).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- --run useTvMode`
Expected: FAIL — module not found

- [ ] **Step 3: Add isTVDevice to platform.ts**

In `app/src/lib/platform.ts`, add inside the Platform object before the closing `};`:

```typescript
  /**
   * True if running on an Android TV or Fire Stick device.
   * Checks user agent for TV indicators. Use TvDetector plugin for definitive check.
   */
  get isTVDevice() {
    const ua = navigator.userAgent.toLowerCase();
    return /\b(tv|aft|stb|android tv|fire tv|bravia|smart-tv|smarttv|googletv)\b/.test(ua);
  },
```

- [ ] **Step 4: Add tvMode to ProfileSettings**

In `app/src/stores/settings.ts`, add to the `ProfileSettings` interface after `sidebarWidth: number;` (line 98):

```typescript
  // TV mode — enables D-pad navigation and larger UI
  tvMode: boolean;
```

Add to `DEFAULT_SETTINGS` after `sidebarWidth: 256,` (line 200):

```typescript
  tvMode: false,
```

- [ ] **Step 5: Create useTvMode hook**

Create `app/src/hooks/useTvMode.ts`:

```typescript
/**
 * Hook that returns whether TV mode is active.
 * TV mode is either auto-detected or manually toggled in settings.
 */

import { useCurrentProfile } from './useCurrentProfile';

export function useTvMode() {
  const { settings } = useCurrentProfile();
  return { isTvMode: settings.tvMode };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd app && npm test -- --run useTvMode`
Expected: PASS

- [ ] **Step 7: Run full test suite + type check**

Run: `cd app && npm test && npx tsc --noEmit`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/platform.ts app/src/stores/settings.ts app/src/hooks/useTvMode.ts app/src/hooks/__tests__/useTvMode.test.ts
git commit -m "feat: add TV mode detection and settings

refs #96"
```

---

### Task 3: TV Mode CSS — Font Scaling + Focus Rings

**Files:**
- Modify: `app/src/index.css`
- Modify: `app/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Add TV mode CSS to index.css**

Add after the `html` rule in `@layer base` (after line 270):

```css
  /* TV mode — larger text and focus indicators for 10-foot viewing */
  html.tv-mode {
    font-size: 20px;
  }

  html.tv-mode *:focus-visible {
    outline: none;
    box-shadow: 0 0 0 4px hsl(var(--ring));
    border-radius: 4px;
  }
```

- [ ] **Step 2: Apply tv-mode class in AppLayout**

In `app/src/components/layout/AppLayout.tsx`, the root div is at line 135. Add the `useTvMode` import and apply the class.

Add import at the top with other hooks:

```typescript
import { useTvMode } from '../../hooks/useTvMode';
```

Inside the component, after existing hook calls (around line 40):

```typescript
  const { isTvMode } = useTvMode();
```

Modify the root div at line 135:

```tsx
    <div className={`flex h-[100dvh] bg-background overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]${isTvMode ? ' tv-mode' : ''}`}>
```

Wait — the `tv-mode` class needs to be on `<html>`, not on a div, since the CSS targets `html.tv-mode`. Use an effect instead:

```typescript
  // Apply tv-mode class to html element
  useEffect(() => {
    document.documentElement.classList.toggle('tv-mode', isTvMode);
    return () => document.documentElement.classList.remove('tv-mode');
  }, [isTvMode]);
```

Remove the className change on the div — keep it as-is.

- [ ] **Step 3: Run type check + build**

Run: `cd app && npx tsc --noEmit && npm run build 2>&1 | tail -3`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add app/src/index.css app/src/components/layout/AppLayout.tsx
git commit -m "feat: add TV mode CSS scaling and focus rings

refs #96"
```

---

### Task 4: TV Mode Settings Toggle + i18n

**Files:**
- Modify: `app/src/components/settings/AppearanceSection.tsx`
- Modify: `app/src/locales/{en,de,es,fr,zh}/translation.json`

- [ ] **Step 1: Add i18n keys to all 5 languages**

In each `translation.json`, inside the `settings.appearance` object, add:

**en:** `"tv_mode": "TV mode", "tv_mode_desc": "D-pad navigation and larger UI"`
**de:** `"tv_mode": "TV-Modus", "tv_mode_desc": "D-Pad-Navigation und Anzeige"`
**es:** `"tv_mode": "Modo TV", "tv_mode_desc": "Navegacion D-pad y pantalla"`
**fr:** `"tv_mode": "Mode TV", "tv_mode_desc": "Navigation D-pad et affichage"`
**zh:** `"tv_mode": "TV模式", "tv_mode_desc": "D-pad导航和显示"`

- [ ] **Step 2: Add TV mode toggle to AppearanceSection**

In `app/src/components/settings/AppearanceSection.tsx`, add `Switch` import:

```typescript
import { Switch } from '../ui/switch';
```

Add before the closing `</section>` (before line 194):

```tsx
      <SettingsCard>
        <SettingsRow>
          <div>
            <RowLabel>{t('settings.appearance.tv_mode')}</RowLabel>
            <p className="text-xs text-muted-foreground">{t('settings.appearance.tv_mode_desc')}</p>
          </div>
          <Switch
            checked={settings.tvMode}
            onCheckedChange={(checked) => update('tvMode', checked)}
            data-testid="settings-tv-mode"
          />
        </SettingsRow>
      </SettingsCard>
```

- [ ] **Step 3: Run type check**

Run: `cd app && npx tsc --noEmit`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add app/src/components/settings/AppearanceSection.tsx app/src/locales/
git commit -m "feat: add TV mode toggle in appearance settings

refs #96"
```

---

### Task 5: D-pad Key Event Router Hook

**Files:**
- Create: `app/src/hooks/useTvKeyHandler.ts`
- Create: `app/src/hooks/__tests__/useTvKeyHandler.test.ts`

- [ ] **Step 1: Write tests for useTvKeyHandler**

Create `app/src/hooks/__tests__/useTvKeyHandler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock useTvMode
let mockTvMode = true;
vi.mock('../useTvMode', () => ({
  useTvMode: () => ({ isTvMode: mockTvMode }),
}));

describe('useTvKeyHandler', () => {
  beforeEach(() => {
    mockTvMode = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls handler when matching key is pressed in TV mode', async () => {
    const { useTvKeyHandler } = await import('../useTvKeyHandler');
    const leftHandler = vi.fn();
    renderHook(() => useTvKeyHandler({ ArrowLeft: leftHandler }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(leftHandler).toHaveBeenCalledTimes(1);
  });

  it('does not call handler when TV mode is off', async () => {
    mockTvMode = false;
    const { useTvKeyHandler } = await import('../useTvKeyHandler');
    const leftHandler = vi.fn();
    renderHook(() => useTvKeyHandler({ ArrowLeft: leftHandler }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(leftHandler).not.toHaveBeenCalled();
  });

  it('does not intercept keys without a handler', async () => {
    const { useTvKeyHandler } = await import('../useTvKeyHandler');
    const leftHandler = vi.fn();
    renderHook(() => useTvKeyHandler({ ArrowLeft: leftHandler }));

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    window.dispatchEvent(event);
    expect(leftHandler).not.toHaveBeenCalled();
    // ArrowRight was not prevented — it passes through to spatial nav
  });

  it('synthesizes click on Enter when focused element has no native handler', async () => {
    const { useTvKeyHandler } = await import('../useTvKeyHandler');
    renderHook(() => useTvKeyHandler({}));

    const div = document.createElement('div');
    const clickHandler = vi.fn();
    div.addEventListener('click', clickHandler);
    div.setAttribute('tabindex', '0');
    document.body.appendChild(div);
    div.focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(clickHandler).toHaveBeenCalledTimes(1);

    document.body.removeChild(div);
  });

  it('does not synthesize click on Enter for native button/input/a elements', async () => {
    const { useTvKeyHandler } = await import('../useTvKeyHandler');
    renderHook(() => useTvKeyHandler({}));

    const button = document.createElement('button');
    const clickHandler = vi.fn();
    button.addEventListener('click', clickHandler);
    document.body.appendChild(button);
    button.focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    // Native button handles Enter on its own — no synthetic click
    expect(clickHandler).not.toHaveBeenCalled();

    document.body.removeChild(button);
  });

  it('cleans up listener on unmount', async () => {
    const { useTvKeyHandler } = await import('../useTvKeyHandler');
    const handler = vi.fn();
    const { unmount } = renderHook(() => useTvKeyHandler({ ArrowLeft: handler }));

    unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- --run useTvKeyHandler`
Expected: FAIL — module not found

- [ ] **Step 3: Implement useTvKeyHandler**

Create `app/src/hooks/useTvKeyHandler.ts`:

```typescript
/**
 * D-pad key event router for TV mode.
 *
 * Screens register a map of key → handler. Unhandled keys pass through
 * to WebView spatial navigation. Enter on non-native elements synthesizes a click.
 */

import { useEffect, useRef } from 'react';
import { useTvMode } from './useTvMode';

type DpadKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Enter';

export type TvKeyMap = Partial<Record<DpadKey, () => void>>;

/** Elements that natively handle Enter — don't synthesize a click on these. */
const NATIVE_ENTER_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);

export function useTvKeyHandler(keyMap: TvKeyMap) {
  const { isTvMode } = useTvMode();
  const keyMapRef = useRef(keyMap);
  keyMapRef.current = keyMap;

  useEffect(() => {
    if (!isTvMode) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key as DpadKey;
      const handler = keyMapRef.current[key];

      if (handler) {
        e.preventDefault();
        handler();
        return;
      }

      // Enter fallback: synthesize click on focused non-native elements
      if (key === 'Enter') {
        const el = document.activeElement;
        if (el && !NATIVE_ENTER_TAGS.has(el.tagName)) {
          e.preventDefault();
          (el as HTMLElement).click();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTvMode]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- --run useTvKeyHandler`
Expected: PASS

- [ ] **Step 5: Run full test suite + type check**

Run: `cd app && npm test && npx tsc --noEmit`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add app/src/hooks/useTvKeyHandler.ts app/src/hooks/__tests__/useTvKeyHandler.test.ts
git commit -m "feat: add D-pad key event router hook for TV mode

refs #96"
```

---

### Task 6: Enable Spatial Navigation on TV

**Files:**
- Create: `app/src/lib/tv-spatial-nav.ts`
- Modify: `app/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Create spatial navigation bridge**

Create `app/src/lib/tv-spatial-nav.ts`:

```typescript
/**
 * Enables WebView spatial navigation on Android TV devices.
 * Called once on app startup when TV mode is active.
 */

import { Platform } from './platform';

export async function enableSpatialNavigation(): Promise<void> {
  if (!Platform.isNative) return;

  try {
    const { registerPlugin } = await import('@capacitor/core');
    const TvDetector = registerPlugin('TvDetector');
    await TvDetector['enableSpatialNavigation']();
  } catch {
    // Not on Android TV or plugin not available — ignore
  }
}

export async function checkIsTV(): Promise<boolean> {
  // First check user agent (works on all platforms)
  if (Platform.isTVDevice) return true;

  // Then try native plugin (definitive on Android)
  if (!Platform.isNative) return false;

  try {
    const { registerPlugin } = await import('@capacitor/core');
    const TvDetector = registerPlugin('TvDetector');
    const result = await TvDetector['isTV']();
    return (result as { isTV: boolean }).isTV;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Call spatial nav enablement in AppLayout when TV mode activates**

In `app/src/components/layout/AppLayout.tsx`, add import:

```typescript
import { enableSpatialNavigation } from '../../lib/tv-spatial-nav';
```

Add effect after the existing `tv-mode` class toggle effect:

```typescript
  // Enable WebView spatial navigation when TV mode is active
  useEffect(() => {
    if (isTvMode) {
      enableSpatialNavigation();
    }
  }, [isTvMode]);
```

- [ ] **Step 3: Run type check + build**

Run: `cd app && npx tsc --noEmit && npm run build 2>&1 | tail -3`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/tv-spatial-nav.ts app/src/components/layout/AppLayout.tsx
git commit -m "feat: enable WebView spatial navigation on Android TV

refs #96"
```

---

### Task 7: Custom Component Keyboard Accessibility Audit

**Files:**
- Modify: Various component files with `div` onClick without tabindex/keyboard support

- [ ] **Step 1: Find all div/span onClick without keyboard support**

Run: `cd app && grep -rn 'onClick=' src/components/ src/pages/ --include='*.tsx' | grep -v 'button\|Button\|<a ' | grep -v '__tests__' | head -40`

Review the output. For each match, check if the element has `tabindex` and `onKeyDown`/`role="button"`.

- [ ] **Step 2: Create a reusable keyboard click handler utility**

Create `app/src/lib/tv-a11y.ts`:

```typescript
/**
 * Accessibility utilities for TV/keyboard navigation.
 */

import type { KeyboardEvent } from 'react';

/**
 * onKeyDown handler that triggers onClick on Enter or Space.
 * Use on any non-button element that has an onClick handler.
 *
 * Usage: <div onClick={handleClick} onKeyDown={handleKeyClick} tabIndex={0} role="button">
 */
export function handleKeyClick(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    (e.currentTarget as HTMLElement).click();
  }
}

/**
 * Props to spread on any div/span that acts as a button.
 * Adds tabindex, role, and keyboard handler.
 */
export function clickableProps() {
  return {
    tabIndex: 0,
    role: 'button' as const,
    onKeyDown: handleKeyClick,
  };
}
```

- [ ] **Step 3: Apply to components found in the audit**

For each component with a `div onClick` that lacks keyboard support, add `{...clickableProps()}` or manually add `tabIndex={0} role="button" onKeyDown={handleKeyClick}`.

Common candidates:
- Dashboard widget cards
- Monitor grid cells in Montage
- Any custom card/tile with onClick

Import in each file:

```typescript
import { handleKeyClick } from '../../lib/tv-a11y';
```

Add to the clickable div:

```tsx
<div
  onClick={handleClick}
  onKeyDown={handleKeyClick}
  tabIndex={0}
  role="button"
>
```

- [ ] **Step 4: Verify Radix components work with keyboard**

Manually check in browser: tab through Switch, Select, Slider, Dialog, Popover components. Verify Enter/Space activates them. Radix should handle this — document any that don't work.

- [ ] **Step 5: Run full test suite + type check**

Run: `cd app && npm test && npx tsc --noEmit`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/tv-a11y.ts app/src/components/ app/src/pages/
git commit -m "feat: add keyboard accessibility to custom interactive elements

refs #96"
```

---

### Task 8: D-pad Handlers for Timeline

**Files:**
- Modify: `app/src/pages/Timeline.tsx`

- [ ] **Step 1: Add D-pad key handler to Timeline**

In `app/src/pages/Timeline.tsx`, add import:

```typescript
import { useTvKeyHandler } from '../hooks/useTvKeyHandler';
```

Add inside the component, after the existing state declarations:

```typescript
  // TV D-pad: left/right pan, up/down zoom
  useTvKeyHandler({
    ArrowLeft: () => setResetKey(k => k), // We need a pan function — use viewport directly
    ArrowRight: () => setResetKey(k => k),
    ArrowUp: () => setZoomInKey((k) => k + 1),
    ArrowDown: () => setZoomOutKey((k) => k + 1),
  });
```

Wait — the Timeline page doesn't have direct access to the viewport pan function. The pan happens via `TimelineCanvas` gestures. We need to expose pan controls similar to how zoomInKey/zoomOutKey work.

Add new state keys:

```typescript
  const [panLeftKey, setPanLeftKey] = useState(0);
  const [panRightKey, setPanRightKey] = useState(0);
```

Add the D-pad handler:

```typescript
  useTvKeyHandler({
    ArrowLeft: () => setPanLeftKey((k) => k + 1),
    ArrowRight: () => setPanRightKey((k) => k + 1),
    ArrowUp: () => setZoomInKey((k) => k + 1),
    ArrowDown: () => setZoomOutKey((k) => k + 1),
  });
```

Pass to TimelineCanvas:

```tsx
  <TimelineCanvas
    ...
    panLeftKey={panLeftKey}
    panRightKey={panRightKey}
  />
```

- [ ] **Step 2: Add panLeftKey/panRightKey support to TimelineCanvas**

In `app/src/components/timeline/TimelineCanvas.tsx`, add props:

```typescript
  /** Increment to pan left */
  panLeftKey?: number;
  /** Increment to pan right */
  panRightKey?: number;
```

Add effects (following the existing zoomInKey pattern):

```typescript
  const prevPanLeftRef = useRef(panLeftKey);
  useEffect(() => {
    if (panLeftKey !== undefined && panLeftKey !== prevPanLeftRef.current) {
      prevPanLeftRef.current = panLeftKey;
      const dur = viewport.durationMs;
      viewport.animateToRange(viewport.startMs - dur * 0.2, viewport.endMs - dur * 0.2);
    }
  }, [panLeftKey, viewport]);

  const prevPanRightRef = useRef(panRightKey);
  useEffect(() => {
    if (panRightKey !== undefined && panRightKey !== prevPanRightRef.current) {
      prevPanRightRef.current = panRightKey;
      const dur = viewport.durationMs;
      viewport.animateToRange(viewport.startMs + dur * 0.2, viewport.endMs + dur * 0.2);
    }
  }, [panRightKey, viewport]);
```

- [ ] **Step 3: Run type check**

Run: `cd app && npx tsc --noEmit`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add app/src/pages/Timeline.tsx app/src/components/timeline/TimelineCanvas.tsx
git commit -m "feat: add D-pad pan/zoom controls to timeline

refs #96"
```

---

### Task 9: D-pad Handlers for Montage

**Files:**
- Modify: `app/src/pages/Montage.tsx`

- [ ] **Step 1: Add D-pad navigation to Montage**

In `app/src/pages/Montage.tsx`, add imports:

```typescript
import { useTvKeyHandler } from '../hooks/useTvKeyHandler';
import { useTvMode } from '../hooks/useTvMode';
```

Add state for focused monitor index and D-pad handler:

```typescript
  const { isTvMode } = useTvMode();
  const [focusedMonitorIndex, setFocusedMonitorIndex] = useState(0);
  const monitorCount = monitors?.length ?? 0;

  // Calculate grid columns from current layout to navigate correctly
  useTvKeyHandler({
    ArrowRight: () => setFocusedMonitorIndex((i) => Math.min(i + 1, monitorCount - 1)),
    ArrowLeft: () => setFocusedMonitorIndex((i) => Math.max(i - 1, 0)),
    ArrowDown: () => setFocusedMonitorIndex((i) => {
      // Move down one row — estimate columns from container width
      const cols = Math.max(1, Math.floor((window.innerWidth) / 320));
      return Math.min(i + cols, monitorCount - 1);
    }),
    ArrowUp: () => setFocusedMonitorIndex((i) => {
      const cols = Math.max(1, Math.floor((window.innerWidth) / 320));
      return Math.max(i - cols, 0);
    }),
  });
```

Add an effect to focus the monitor element:

```typescript
  useEffect(() => {
    if (!isTvMode) return;
    const el = document.querySelector(`[data-testid="montage-monitor-${focusedMonitorIndex}"]`);
    if (el instanceof HTMLElement) el.focus();
  }, [focusedMonitorIndex, isTvMode]);
```

Ensure each monitor cell has the `data-testid` with its index. Check if `MontageMonitor` already has this — if not, add `data-testid={`montage-monitor-${index}`}` to the grid item wrapper.

- [ ] **Step 2: Run type check**

Run: `cd app && npx tsc --noEmit`
Expected: Pass

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/Montage.tsx
git commit -m "feat: add D-pad grid navigation to montage view

refs #96"
```

---

### Task 10: D-pad Handlers for Event Detail + Monitor Detail

**Files:**
- Modify: `app/src/pages/EventDetail.tsx`
- Modify: `app/src/pages/MonitorDetail.tsx`

- [ ] **Step 1: Add D-pad to EventDetail**

In `app/src/pages/EventDetail.tsx`, add import:

```typescript
import { useTvKeyHandler } from '../hooks/useTvKeyHandler';
```

Find existing prev/next navigation functions (they should already exist for swipe). Wire them to D-pad:

```typescript
  useTvKeyHandler({
    ArrowLeft: () => navigateToPrevEvent?.(),
    ArrowRight: () => navigateToNextEvent?.(),
    Enter: () => togglePlayPause?.(),
  });
```

Adapt to match the actual function names in EventDetail. The existing `useEventNavigation` hook likely provides `goToPrev` and `goToNext`.

- [ ] **Step 2: Add D-pad to MonitorDetail**

In `app/src/pages/MonitorDetail.tsx`, add import:

```typescript
import { useTvKeyHandler } from '../hooks/useTvKeyHandler';
```

Wire to prev/next monitor navigation:

```typescript
  useTvKeyHandler({
    ArrowLeft: () => navigateToPrevMonitor?.(),
    ArrowRight: () => navigateToNextMonitor?.(),
  });
```

Adapt to match actual function names.

- [ ] **Step 3: Run type check**

Run: `cd app && npx tsc --noEmit`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add app/src/pages/EventDetail.tsx app/src/pages/MonitorDetail.tsx
git commit -m "feat: add D-pad navigation to event and monitor detail views

refs #96"
```

---

### Task 11: Auto-detect TV on First Launch

**Files:**
- Modify: `app/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Add auto-detection on first launch**

In `app/src/components/layout/AppLayout.tsx`, add import:

```typescript
import { checkIsTV } from '../../lib/tv-spatial-nav';
import { useSettingsStore } from '../../stores/settings';
```

Add effect that runs once to auto-detect TV and enable tvMode:

```typescript
  // Auto-detect TV device on first launch
  const profileId = currentProfile?.id;
  const updateSettings = useSettingsStore((s) => s.updateProfileSettings);
  const tvAutoDetectedRef = useRef(false);

  useEffect(() => {
    if (!profileId || tvAutoDetectedRef.current) return;
    tvAutoDetectedRef.current = true;

    checkIsTV().then((isTV) => {
      if (isTV && !settings.tvMode) {
        updateSettings(profileId, { tvMode: true });
      }
    });
  }, [profileId, settings.tvMode, updateSettings]);
```

- [ ] **Step 2: Run type check**

Run: `cd app && npx tsc --noEmit`
Expected: Pass

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/AppLayout.tsx
git commit -m "feat: auto-detect TV device and enable TV mode on first launch

refs #96"
```

---

### Task 12: Final Integration Test + Build Verification

**Files:** None new — verification only.

- [ ] **Step 1: Run full test suite**

Run: `cd app && npm test`
Expected: All pass

- [ ] **Step 2: Run type check**

Run: `cd app && npx tsc --noEmit`
Expected: Pass

- [ ] **Step 3: Run build**

Run: `cd app && npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Run web e2e tests to verify no regression**

Run: `cd app && npm run test:e2e`
Expected: All existing tests pass — TV mode is off by default

- [ ] **Step 5: Verify Android build**

Run: `cd app/android && ./gradlew assembleDebug 2>&1 | tail -5`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Manual smoke test on TV emulator**

```bash
emulator -avd android_tv_test &
# Wait for boot, then install APK
adb install app/android/app/build/outputs/apk/debug/app-debug.apk
```

Verify:
- App launches on TV
- D-pad navigates between UI elements
- Focus ring is visible and thick
- Text is readable (scaled up)
- System keyboard appears on input focus
- Back button navigates back
- Settings shows TV mode toggle (should be auto-enabled)
- Montage view: arrows move between monitors
- Timeline: arrows pan/zoom

- [ ] **Step 7: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during TV emulator testing

refs #96"
```
