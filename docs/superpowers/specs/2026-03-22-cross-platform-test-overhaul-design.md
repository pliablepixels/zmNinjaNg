# Cross-Platform Test Overhaul

## Summary

Replace the current browser-emulation-only Playwright E2E suite with real cross-platform testing that drives the actual app on Android Emulator, iOS Simulator (iPhone + iPad), Tauri desktop, and web browser. Rewrite shallow render-only tests into behavioral human-tester scenarios. Add visual regression across all platforms. Add a small Appium suite for native-plugin-only flows.

## Problem

The current test suite has two problems:

1. **"Mobile" tests are fake.** Playwright's Mobile Chrome and Mobile Safari profiles are just desktop Chromium with phone-sized viewports. They don't test Android WebView rendering, iOS WKWebView quirks, Capacitor plugin behavior, safe area insets, or native navigation.

2. **~45 of ~91 E2E scenarios test nothing useful.** They check that headings exist or elements are visible without any user interaction. A human tester would never write "open page, see heading, done" as a test case.

## Architecture

### Dual-Driver Design

Playwright's `connectOverCDP()` only works with Chromium-based browsers. Android WebView is Chromium-based, so Playwright connects directly. iOS WKWebView and Tauri's WKWebView use WebKit, which does not expose Chrome DevTools Protocol. For these platforms, we use WebDriverIO + Appium, which can drive WKWebView contexts natively via XCUITest.

A shared `TestActions` abstraction layer lets us keep one set of Gherkin feature files and one set of step definitions that work across both drivers.

| Platform | Rendering Engine | Driver | Connection |
|---|---|---|---|
| `web-chromium` | Chromium | Playwright (direct) | Native Playwright launch |
| `android-phone` | Chromium (WebView) | Playwright via CDP | ADB port-forward → `connectOverCDP()` |
| `ios-phone` | WebKit (WKWebView) | WebDriverIO + Appium XCUITest | Appium → WebView context switch |
| `ios-tablet` | WebKit (WKWebView) | WebDriverIO + Appium XCUITest | Appium → WebView context switch |
| `desktop-tauri` | WebKit (WKWebView) | WebDriverIO + `tauri-driver` | WebDriver protocol |

### Why Two Drivers

- `connectOverCDP()` is Chromium-only. iOS WebKit and Tauri WKWebView do not expose CDP.
- `ios-webkit-debug-proxy` exposes only a partial CDP translation — not enough for Playwright to drive page interactions, input events, or take screenshots.
- `WEBKIT_INSPECTOR_SERVER` on macOS exposes WebKit's Inspector protocol, not CDP. Playwright cannot connect to it.
- Appium's XCUITest driver can natively switch into WKWebView contexts and drive web content inside the app. This is the standard approach for testing Capacitor apps on iOS.
- `tauri-driver` implements the WebDriver protocol for Tauri apps and can drive the WKWebView content.

### Layer Diagram

```
┌─────────────────────────────────────────────────────┐
│              Gherkin Feature Files                   │
│         (single source of truth for all)             │
├─────────────────────────────────────────────────────┤
│              TestActions Abstraction                 │
│   click() · fill() · getText() · screenshot() · …   │
├────────────────────────┬────────────────────────────┤
│   PlaywrightActions    │   WebDriverIOActions        │
│   (web, android)       │   (ios-phone, ios-tablet,   │
│                        │    desktop-tauri)            │
├────────────────────────┼────────────────────────────┤
│  Playwright            │  WebDriverIO + Appium       │
│  connectOverCDP (CDP)  │  XCUITest (iOS WebView)     │
│                        │  tauri-driver (Tauri)        │
├────────────────────────┴────────────────────────────┤
│          Visual Regression (screenshots)             │
│   Playwright toHaveScreenshot / WDIO saveScreenshot  │
│     per-platform baseline snapshots in git           │
├─────────────────────────────────────────────────────┤
│     Appium Native Suite (native-only flows)          │
│   PiP · Biometrics · Push · Filesystem · Haptics    │
└─────────────────────────────────────────────────────┘
```

### TestActions Abstraction

Step definitions never call Playwright or WebDriverIO APIs directly. They use `TestActions`:

```typescript
export interface TestActions {
  goto(path: string): Promise<void>;
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  getText(selector: string): Promise<string>;
  isVisible(selector: string, timeout?: number): Promise<boolean>;
  waitForVisible(selector: string, timeout?: number): Promise<void>;
  waitForHidden(selector: string, timeout?: number): Promise<void>;
  getCount(selector: string): Promise<number>;
  getAttribute(selector: string, attr: string): Promise<string | null>;
  screenshot(name: string): Promise<Buffer>;
  compareScreenshot(name: string, threshold?: number): Promise<void>;
  platform(): PlatformProfile;
}

// Selector convention: data-testid selectors map to both:
// - Playwright: page.getByTestId('foo')
// - WebDriverIO: $('[data-testid="foo"]')
```

The platform config determines which implementation gets injected at test startup. Step definitions are written once.

## Platform Connection Details

### Android Emulator → Playwright (CDP)

Capacitor's Android WebView runs on Chromium and exposes Chrome DevTools Protocol. ADB forwards the debug port to localhost, and Playwright connects via `browser.connectOverCDP()`.

```
Android Emulator (Pixel 7 API 34)
  └─ zmNinjaNG.apk (debug build, WebView debuggable)
       └─ WebView devtools socket
            └─ adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>
                 └─ Playwright connectOverCDP('http://localhost:9222')
```

Requirements:
- Android Emulator image: `system-images;android-34;google_apis;arm64-v8a` (Apple Silicon native)
- Debug APK built with `android:debuggable="true"` (default for Capacitor debug builds)
- `WebView.setWebContentsDebuggingEnabled(true)` (already set in Capacitor's default BridgeActivity)

PID discovery: The abstract socket name includes the app PID, which changes every launch. The setup script parses `adb shell cat /proc/net/unix | grep webview_devtools` to find the active socket, then forwards it.

Setup script (`scripts/test-android.sh`):
1. Boot emulator (`emulator -avd <avdName> -no-audio -no-window`)
2. Wait for boot (`adb wait-for-device && adb shell getprop sys.boot_completed`)
3. Install APK (`adb install -r app/android/app/build/outputs/apk/debug/app-debug.apk`)
4. Launch app (`adb shell am start -n com.zoneminder.zmNinjaNG/.MainActivity`)
5. Wait for WebView socket to appear, parse PID, forward debug port
6. Run Playwright against `localhost:9222`

### iOS Simulator → WebDriverIO + Appium (XCUITest)

iOS WKWebView does not expose CDP. Appium's XCUITest driver launches the app on the simulator, then switches to the WebView context to drive web content.

```
iOS Simulator (iPhone 15 / iPad Air, iOS 17)
  └─ zmNinjaNG.app (debug build)
       └─ WKWebView
            └─ Appium XCUITest driver
                 └─ driver.switchContext('WEBVIEW_com.zoneminder.zmNinjaNG')
                      └─ WebDriverIO drives web content
```

Requirements:
- Xcode 15+ with iOS 17.x Simulator runtime
- Appium 2.x with XCUITest driver (`appium driver install xcuitest`)
- App built for simulator: `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15'`

Setup script (`scripts/test-ios.sh`):
1. Build app for simulator (`xcodebuild ...`)
2. Boot simulator (`xcrun simctl boot "<device>"`)
3. Start Appium server, wait for readiness (poll `http://localhost:4723/status`)
4. WebDriverIO connects to Appium, which installs and launches the app
5. Switch to WebView context
6. Run test suite via WebDriverIO

iPad variant: same flow with a different `deviceName` in Appium capabilities.

### Tauri Desktop → WebDriverIO + tauri-driver

Tauri on macOS uses WKWebView. The `tauri-driver` crate implements the WebDriver protocol and can drive the app's WebView content.

```
Tauri App (macOS, WKWebView)
  └─ tauri-driver (WebDriver server on port 4444)
       └─ WebDriverIO connects via WebDriver protocol
            └─ Drives WKWebView content
```

Requirements:
- `tauri-driver` installed: `cargo install tauri-driver`
- Tauri app built or running in dev mode

Setup script (`scripts/test-tauri.sh`):
1. Build Tauri binary or start `cargo tauri dev` in background
2. Start `tauri-driver` on port 4444
3. WebDriverIO connects and drives the WebView
4. Run test suite

## Platform Configuration

A single `app/tests/platforms.config.defaults.ts` ships with the repo. Developers create `platforms.config.local.ts` to override simulator names, ports, or paths for their machine. The `*.local` gitignore pattern already covers this file. The config loader merges local over defaults.

```typescript
export interface PlatformTestConfig {
  android: {
    avdName: string;           // AVD name from Android Studio
    apiLevel: number;          // e.g. 34
    systemImage: string;       // e.g. 'google_apis;arm64-v8a'
    cdpPort: number;           // localhost port for CDP forwarding
    appId: string;             // package name
    apkPath: string;           // path to debug APK
  };
  ios: {
    phone: {
      simulator: string;      // e.g. 'iPhone 15'
      runtime: string;        // e.g. 'iOS-17-5'
    };
    tablet: {
      simulator: string;      // e.g. 'iPad Air 11-inch (M2)'
      runtime: string;        // e.g. 'iOS-17-5'
    };
    appBundleId: string;       // e.g. 'com.zoneminder.zmNinjaNG'
    appPath: string;           // path to built .app for simulator
    appiumPort: number;        // Appium server port for iOS
  };
  tauri: {
    driverPort: number;        // tauri-driver WebDriver port
    binaryPath?: string;       // optional: path to pre-built binary
  };
  web: {
    baseUrl: string;           // e.g. 'http://localhost:5173'
  };
  timeouts: {
    appLaunch: number;         // ms to wait for app ready
    navigation: number;        // ms for page transitions
    element: number;           // ms for element visibility
    screenshot: number;        // ms stabilization before screenshot
    webviewSwitch: number;     // ms to wait for WebView context (iOS)
  };
}
```

Default values (shipped in repo):
- `android.avdName`: `'Pixel_7_API_34'`
- `android.apiLevel`: `34`
- `android.systemImage`: `'google_apis;arm64-v8a'`
- `android.cdpPort`: `9222`
- `android.appId`: `'com.zoneminder.zmNinjaNG'`
- `android.apkPath`: `'android/app/build/outputs/apk/debug/app-debug.apk'`
- `ios.phone.simulator`: `'iPhone 15'`
- `ios.phone.runtime`: `'iOS-17-5'`
- `ios.tablet.simulator`: `'iPad Air 11-inch (M2)'`
- `ios.tablet.runtime`: `'iOS-17-5'`
- `ios.appBundleId`: `'com.zoneminder.zmNinjaNG'`
- `ios.appPath`: `'ios/App/DerivedData/Build/Products/Debug-iphonesimulator/App.app'`
- `ios.appiumPort`: `4723`
- `tauri.driverPort`: `4444`
- `web.baseUrl`: `'http://localhost:5173'`
- `timeouts.appLaunch`: `30000`
- `timeouts.navigation`: `10000`
- `timeouts.element`: `5000`
- `timeouts.screenshot`: `1000`
- `timeouts.webviewSwitch`: `10000`

## Software Dependencies

| Tool | Install | Purpose |
|---|---|---|
| Android Emulator | Via Android Studio / `sdkmanager` | Run Android AVD |
| `adb` | Via Android Studio / platform-tools | Forward WebView debug port |
| Xcode 15+ | App Store | iOS Simulator + build toolchain |
| Xcode CLI Tools | `xcode-select --install` | `xcrun simctl` |
| Playwright | Already installed | Test runner (web + Android) |
| WebDriverIO | `npm install --save-dev @wdio/cli` | Test runner (iOS + Tauri) |
| `@wdio/appium-service` | `npm install --save-dev @wdio/appium-service` | Auto-start Appium from WDIO |
| Appium 2.x | `npm install -g appium` | Mobile app driver server |
| `appium-uiautomator2-driver` | `appium driver install uiautomator2` | Android native driver |
| `appium-xcuitest-driver` | `appium driver install xcuitest` | iOS native + WebView driver |
| `tauri-driver` | `cargo install tauri-driver` | Tauri WebDriver server |
| `@appium/doctor` | `npm install -g @appium/doctor` | Verify environment setup |

## Test Restructuring

### What Changes

- Current `playwright.config.ts` (3 browser-emulation profiles) replaced by per-platform configs
- `full-app-walkthrough.feature` deleted entirely (all 14 scenarios duplicate other feature files)
- `go2rtc-streaming.feature` merged into `monitor-detail.feature` (only the snapshot scenario is kept; the other 2 were render-only checks)
- Existing `.feature` files rewritten — same screens, but scenarios now test like a human
- New `montage.feature` created (montage scenarios currently live inside `monitors.feature`, split out since montage is a distinct screen)
- Existing step definitions split from one 1669-line `steps.ts` into per-screen files
- Platform tags (`@all`, `@android`, `@ios`, `@ios-phone`, `@ios-tablet`, `@tauri`, `@web`) control which scenarios run where
- `@visual` tag triggers screenshot comparison
- `@native` tag marks Appium-only scenarios
- Visual baselines stored per-platform in `app/tests/screenshots/`

### Test Philosophy: Be a Human Tester

Every E2E scenario must test what a human would actually verify. Ask:
- "Can I accomplish the task I came here to do?"
- "Does this look right on this device?"
- "Does the data I see make sense?"

Never write a scenario that only checks element presence. Every scenario must include interaction and verification of outcomes.

### Test Plan by Screen

#### Dashboard
- Add each widget type, verify it displays real data (widget content has non-empty text or visible child elements with data-testid)
- Drag/reorder widgets, verify order persists after refresh
- Edit widget title, verify it saves
- Delete widget, verify it's gone
- Phone: widgets stack single-column, no horizontal overflow, all content readable
- Tablet: 2-column layout, widgets don't overlap
- Tauri desktop: resize window to phone-width, widgets reflow
- Visual baseline on each device after adding widgets

#### Monitors List
- All monitors from server appear with correct names and status indicators
- Tap monitor card → detail page with live feed
- Back button returns to list with scroll position preserved
- Phone: single column cards, thumbnails sized correctly, no truncated names
- Tablet: grid layout 2-3 columns, adequate spacing
- Filter by group → only matching monitors → clear → all return
- Visual baseline of grid on each device

#### Monitor Detail
- Video player element is present with non-zero dimensions and `src` or `srcObject` set (verifies feed is connected, not just an empty container)
- Snapshot button → image downloads (verify download task completes with non-zero bytes)
- Zone overlay toggle → zones visible (zone overlay elements appear) → toggle off → zones gone
- Navigation arrows → cycle monitors → loop to first
- Phone: controls stack below video, scrollable
- Tablet: controls beside video (landscape) or below (portrait)
- Mode dropdown tappable and functional on all platforms
- Settings dialog opens, scrollable, closes on backdrop tap and X button

#### Montage
- Grid contains monitor feed elements with non-zero dimensions and visible monitor name labels (verifies feeds are connected, not placeholders)
- Grid columns adjust per device width (count grid children per row)
- Tap monitor in montage → navigates to detail
- Snapshot from montage → downloads
- Phone portrait: 1-2 columns, feeds not squished (minimum width check)
- Visual baseline of montage grid on each device

#### Events
- Event list loads with real events (dates, thumbnails, monitor names)
- Tap event → detail page with video player that plays the event
- Filter by date range → results change → clear → full list
- Filter by monitor → only that monitor's events
- Switch list/montage view → both show events
- Favorite → star fills → unfavorite → star empties
- Filter favorites only → only starred events shown
- Download video → background task → completes → file exists
- Phone: cards readable, thumbnails not cropped, dates visible
- Tablet: list uses horizontal space, detail shows video larger
- Pagination/scroll works (scroll to bottom → additional events load or "no more" indicator appears)
- Visual baseline on each device

#### Timeline
- Timeline container has visible data elements (axis labels, data points, or event markers — not empty)
- Quick date range buttons change range (verify displayed date label updates after clicking)
- Click event on timeline → navigates to detail
- Filter by monitor → only that monitor's events shown (verify event count changes)
- Refresh button → loading indicator appears then disappears → data is present
- Phone: timeline container is horizontally scrollable (scrollWidth > clientWidth)
- Tablet: full width, more data visible
- Visual baseline on each device

#### Profiles
- Profile list shows all profiles with correct names
- Active profile has visible indicator
- Edit profile → form with current values → change field → save → persists
- Add profile → connection details → test connection → save → appears in list
- Delete profile → confirm → removed from list
- Switch profile → reconnects → monitors update
- Phone: cards stack, form scrollable, keyboard doesn't cover inputs
- Tablet: cards in grid, form has more room

#### Settings
- Theme toggle → app background color changes (verify computed style) → persists after navigation
- Language selector → a known visible string (e.g., page heading, menu item) changes to the selected language
- Notification toggle → persists (navigate away and back, toggle state preserved)
- Server info → shows non-empty version string, OS info, storage data
- Logs → change level → new log entries respect level → clear → log list empty
- Bandwidth mode → observable UI effect: switch to low mode → verify the bandwidth mode label updates; polling behavior tested via unit tests
- Phone: all settings reachable via scroll, no controls hidden
- Tablet: wider layout, nothing stretched

#### Kiosk Mode
- Set PIN → overlay appears → navigation blocked
- Correct PIN → overlay dismissed → navigation works
- Wrong PIN → error → overlay stays
- PIN mismatch during setup → validation error → retry
- All devices: overlay covers full screen, PIN input centered

#### Group Filter
- Select group → monitors/events/montage filter to that group
- Clear group → everything returns
- Group filter persists across page navigation
- Phone: dropdown tappable, doesn't overflow

### Estimated Scenario Count

| Screen | Scenarios | Platforms |
|---|---|---|
| Dashboard | 8 | all + phone + tablet variants |
| Monitors List | 6 | all + phone + tablet variants |
| Monitor Detail | 8 | all + phone + tablet variants |
| Montage | 5 | all + phone + tablet variants |
| Events | 10 | all + phone + tablet variants |
| Timeline | 6 | all + phone + tablet variants |
| Profiles | 6 | all + phone variant |
| Settings | 7 | all + phone variant |
| Kiosk | 5 | all |
| Group Filter | 4 | all + phone variant |
| **Total** | **~65** | **x5 profiles = ~325 executions** |

### Native-Only Scenarios (Appium)

| Feature | Platform | What to Verify |
|---|---|---|
| Picture-in-Picture | Android, iOS (iPad) | PiP player appears, play/pause work, return to app |
| Biometric Auth | iOS, Android | Prompt appears on app resume, auth unlocks |
| Push Notifications | iOS, Android | Notification in tray, tap opens correct event |
| File Downloads | iOS, Android | File exists in device storage, correct size, playable |
| Haptic Feedback | iOS, Android | Haptic API called on button tap |
| Share Sheet | iOS, Android | System share sheet appears, dismisses |
| App Lifecycle | iOS, Android | Background 30s → foreground → state preserved, no re-login |

~15-20 native test cases total.

## Directory Structure

All test infrastructure lives under `app/tests/`. Platform launch scripts live at the repo root `scripts/` directory (matching existing script location convention).

```
scripts/                                 ← repo root (matches existing scripts/)
├── test-android.sh                      ← boot emulator, install APK, run tests
├── test-ios.sh                          ← boot simulator, build app, run tests
├── test-tauri.sh                        ← build/launch Tauri, run tests
├── test-all-platforms.sh                ← orchestrate all platforms
└── verify-platform-setup.ts             ← check tools, simulators, ports

app/
├── playwright.config.ts                 ← web-only (simplified)
├── playwright.config.android.ts         ← Android via CDP
├── wdio.config.ios-phone.ts             ← iPhone via Appium
├── wdio.config.ios-tablet.ts            ← iPad via Appium
├── wdio.config.tauri.ts                 ← Tauri via tauri-driver
│
├── tests/
│   ├── platforms.config.defaults.ts     ← shipped defaults (simulator names, ports, timeouts)
│   ├── platforms.config.local.ts        ← per-developer overrides (covered by *.local gitignore)
│   ├── platforms.config.ts              ← loader (merges local over defaults)
│   │
│   ├── actions/                         ← TestActions abstraction
│   │   ├── types.ts                     ← TestActions interface
│   │   ├── playwright-actions.ts        ← Playwright implementation (web, android)
│   │   └── wdio-actions.ts              ← WebDriverIO implementation (ios, tauri)
│   │
│   ├── features/                        ← rewritten Gherkin scenarios
│   │   ├── dashboard.feature
│   │   ├── monitors.feature
│   │   ├── monitor-detail.feature
│   │   ├── montage.feature
│   │   ├── events.feature
│   │   ├── timeline.feature
│   │   ├── profiles.feature
│   │   ├── settings.feature
│   │   ├── kiosk.feature
│   │   └── group-filter.feature
│   │
│   ├── steps/                           ← step definitions (one per screen)
│   │   ├── common.steps.ts              ← login, navigation, visual baseline
│   │   ├── dashboard.steps.ts
│   │   ├── monitors.steps.ts
│   │   ├── monitor-detail.steps.ts
│   │   ├── montage.steps.ts
│   │   ├── events.steps.ts
│   │   ├── timeline.steps.ts
│   │   ├── profiles.steps.ts
│   │   ├── settings.steps.ts
│   │   ├── kiosk.steps.ts
│   │   ├── group-filter.steps.ts
│   │   └── platform.steps.ts           ← platform-conditional layout assertions
│   │
│   ├── helpers/
│   │   ├── config.ts                    ← ZM server config (existing)
│   │   ├── android-launcher.ts          ← boot emulator, install APK, forward CDP port
│   │   ├── ios-launcher.ts              ← boot simulator, build app, start Appium
│   │   ├── tauri-launcher.ts            ← launch Tauri + tauri-driver
│   │   └── visual-regression.ts         ← screenshot helpers, threshold config
│   │
│   ├── screenshots/                     ← visual baselines (checked into git)
│   │   ├── web-chromium/
│   │   ├── android-phone/
│   │   ├── ios-phone/
│   │   ├── ios-tablet/
│   │   └── desktop-tauri/
│   │
│   ├── native/                          ← Appium suite (native-only flows)
│   │   ├── wdio.conf.ts
│   │   ├── specs/
│   │   │   ├── pip.spec.ts
│   │   │   ├── biometric.spec.ts
│   │   │   ├── push-notification.spec.ts
│   │   │   ├── file-download.spec.ts
│   │   │   ├── haptics.spec.ts
│   │   │   ├── share-sheet.spec.ts
│   │   │   └── app-lifecycle.spec.ts
│   │   └── helpers/
│   │       ├── appium-setup.ts
│   │       └── device-utils.ts
│   │
│   └── README.md                        ← setup guide (see README Structure below)
```

## npm Scripts

```json
{
  "test:e2e": "playwright-bdd && playwright test",
  "test:e2e:android": "playwright-bdd && playwright test --config playwright.config.android.ts",
  "test:e2e:ios-phone": "npx wdio run wdio.config.ios-phone.ts",
  "test:e2e:ios-tablet": "npx wdio run wdio.config.ios-tablet.ts",
  "test:e2e:tauri": "npx wdio run wdio.config.tauri.ts",
  "test:e2e:all-platforms": "npm run test:e2e && npm run test:e2e:android && npm run test:e2e:ios-phone && npm run test:e2e:ios-tablet && npm run test:e2e:tauri",
  "test:e2e:visual-update": "playwright-bdd && playwright test --update-snapshots",
  "test:native": "npx wdio run tests/native/wdio.conf.ts",
  "test:platform:setup": "tsx ../../scripts/verify-platform-setup.ts"
}
```

Notes:
- iOS and Tauri tests use WebDriverIO (`npx wdio run`) instead of Playwright
- The `@wdio/appium-service` auto-starts Appium, no manual `appium &` or `sleep` needed
- `test:native` also uses WDIO, which manages Appium lifecycle via the appium service
- `test:e2e:all-platforms` runs sequentially since simulators share resources

## Visual Regression

Both Playwright and WebDriverIO capture screenshots, stored in per-platform baseline directories.

- **Playwright platforms** (web, android): use `toHaveScreenshot()` with per-platform snapshot path
- **WebDriverIO platforms** (ios, tauri): use `browser.saveScreenshot()` + custom pixel-diff comparison (e.g., `pixelmatch` or `resemblejs`)
- Baselines checked into git under `app/tests/screenshots/<platform>/`
- Threshold: 0.2% pixel diff (configurable in platform config)
- On failure: generates diff image showing the change
- First run: generate baselines with a dedicated script flag
- The `TestActions.compareScreenshot(name, threshold)` method abstracts the driver difference

## Setup Verification

`npm run test:platform:setup` runs `scripts/verify-platform-setup.ts`, which checks:

```
✓ Xcode 15+ installed (found 15.4)
✓ iOS 17 runtime available
✓ iPhone 15 simulator exists
✓ iPad Air simulator exists
✓ Android SDK found at /Users/you/Library/Android/sdk
✓ Pixel_7_API_34 AVD exists
✓ adb accessible
✓ Appium 2.x installed (found 2.5.1)
✓ XCUITest driver installed
✓ UiAutomator2 driver installed
✓ tauri-driver installed
✓ Port 4723 available (Appium)
✓ Port 4444 available (tauri-driver)
✓ Port 9222 available (Android CDP)
✗ platforms.config.local.ts not found — using defaults
  → Copy platforms.config.defaults.ts to platforms.config.local.ts to customize
```

Any `✗` gets a clear fix instruction.

## README Structure

The `app/tests/README.md` must cover:

1. **Prerequisites** — Xcode, Android Studio, Rust/Cargo versions needed
2. **First-Time Setup** — step-by-step for each platform (install simulators, create AVD, install Appium drivers, install tauri-driver)
3. **Platform Config** — how to create `platforms.config.local.ts`, what each field means, how to find your simulator names (`xcrun simctl list devices`, `emulator -list-avds`)
4. **Running Tests** — command reference for each platform, how to run a single feature, how to run headed/visible
5. **Visual Baselines** — how to generate, update, and review screenshot diffs
6. **Adding Tests** — pointer to AGENTS.md "Extending Tests for New Features" section
7. **Troubleshooting** — common issues (Appium can't find app, WebView context not available, simulator won't boot, port conflicts)

## CI Graduation Path (Future)

This design is local-first. When ready for CI:
- Web tests: run as-is on GitHub Actions (already working)
- Android: GitHub Actions macOS runners support Android Emulator
- iOS: GitHub Actions macOS runners support iOS Simulator + Appium
- Tauri: macOS runners with Rust toolchain + tauri-driver
- Alternative: BrowserStack App Automate for device farm testing (supports Appium natively)
- Visual regression: Argos CI or Percy for cross-platform screenshot comparison
