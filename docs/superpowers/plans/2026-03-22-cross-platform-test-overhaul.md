# Cross-Platform Test Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser-emulation E2E tests with real cross-platform testing across Android Emulator, iOS Simulator (iPhone + iPad), Tauri desktop, and web browser, using behavioral human-tester scenarios.

**Architecture:** Dual-driver design — Playwright via CDP for Chromium platforms (web, Android), WebDriverIO + Appium XCUITest for WebKit platforms (iOS, Tauri). A shared `TestActions` abstraction keeps one set of Gherkin feature files and step definitions across all drivers. Visual regression via per-platform screenshot baselines.

**Tech Stack:** Playwright, playwright-bdd, WebDriverIO, @wdio/cucumber-framework, @wdio/appium-service, Appium 2.x (XCUITest + UiAutomator2 drivers), tauri-driver, pixelmatch, Vitest

**Key Architecture Notes:**
- **Android CDP**: Playwright's `connectOverCDP()` is a programmatic API, not a config option. Android tests use a custom Playwright fixture that calls `chromium.connectOverCDP()` to get a `page` object.
- **WDIO BDD**: WebDriverIO runs Gherkin `.feature` files natively via `@wdio/cucumber-framework` — NOT via playwright-bdd's generated specs. Same `.feature` files, but WDIO-compatible step definitions.
- **Two Step Definition Sets**: Playwright BDD steps (web, Android) and WDIO Cucumber steps (iOS, Tauri). Both use `TestActions` interface — step logic is identical, only the driver injection differs.
- **ESM**: The project uses ESM (`"type": "module"` in package.json). All imports use `import`, never `require()`.

**Spec:** `docs/superpowers/specs/2026-03-22-cross-platform-test-overhaul-design.md`

---

## Phase 1: Foundation — Config, Dependencies, TestActions

### Task 1: Create GitHub Issue and Feature Branch

**Files:**
- None (git operations only)

- [ ] **Step 1: Create GitHub issue**

```bash
cd /Users/arjun/fiddle/zmNinjaNG
gh issue create \
  --title "feat: cross-platform E2E test overhaul with real device testing" \
  --body "Replace browser-emulation E2E tests with real cross-platform testing.

Platforms: Android Emulator, iOS Simulator (iPhone + iPad), Tauri desktop, web browser.
Architecture: Playwright (web/Android via CDP) + WebDriverIO/Appium (iOS/Tauri via XCUITest).
Shared TestActions abstraction for driver-agnostic step definitions.
Visual regression via per-platform screenshot baselines.

See: docs/superpowers/specs/2026-03-22-cross-platform-test-overhaul-design.md" \
  --label "enhancement"
```

Note the issue number from the output (e.g., `#42`). Use it in all commits as `refs #42`.

- [ ] **Step 2: Create feature branch**

```bash
git checkout -b feature/cross-platform-e2e
```

---

### Task 2: Install WebDriverIO and Appium Dependencies

**Files:**
- Modify: `app/package.json` (devDependencies)

- [ ] **Step 1: Install WebDriverIO core + Appium + Cucumber framework**

```bash
cd /Users/arjun/fiddle/zmNinjaNG/app
npm install --save-dev @wdio/cli @wdio/local-runner @wdio/cucumber-framework @wdio/spec-reporter @wdio/appium-service @wdio/types webdriverio
```

Note: `@wdio/cucumber-framework` (not mocha) because WDIO runs Gherkin `.feature` files natively.

- [ ] **Step 2: Install pixelmatch + types for visual regression on WDIO platforms**

```bash
cd /Users/arjun/fiddle/zmNinjaNG/app
npm install --save-dev pixelmatch pngjs @types/pngjs
```

- [ ] **Step 3: Verify install and existing tests still pass**

```bash
cd /Users/arjun/fiddle/zmNinjaNG/app
npm test
npx tsc --noEmit
```

Expected: all unit tests pass, no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore: add WebDriverIO, Appium service, and pixelmatch dependencies

refs #<issue-number>"
```

---

### Task 3: Create Platform Configuration

**Files:**
- Create: `app/tests/platforms.config.defaults.ts`
- Create: `app/tests/platforms.config.ts`

- [ ] **Step 1: Create the PlatformTestConfig type and defaults**

Create `app/tests/platforms.config.defaults.ts`:

```typescript
export interface PlatformTestConfig {
  android: {
    avdName: string;
    apiLevel: number;
    systemImage: string;
    cdpPort: number;
    appId: string;
    apkPath: string;
  };
  ios: {
    phone: {
      simulator: string;
      runtime: string;
    };
    tablet: {
      simulator: string;
      runtime: string;
    };
    appBundleId: string;
    appPath: string;
    appiumPort: number;
  };
  tauri: {
    driverPort: number;
    binaryPath?: string;
  };
  web: {
    baseUrl: string;
  };
  timeouts: {
    appLaunch: number;
    navigation: number;
    element: number;
    screenshot: number;
    webviewSwitch: number;
  };
}

export type PlatformProfile =
  | 'web-chromium'
  | 'android-phone'
  | 'ios-phone'
  | 'ios-tablet'
  | 'desktop-tauri';

export const defaults: PlatformTestConfig = {
  android: {
    avdName: 'Pixel_7_API_34',
    apiLevel: 34,
    systemImage: 'google_apis;arm64-v8a',
    cdpPort: 9222,
    appId: 'com.zoneminder.zmNinjaNG',
    apkPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
  },
  ios: {
    phone: {
      simulator: 'iPhone 15',
      runtime: 'iOS-17-5',
    },
    tablet: {
      simulator: 'iPad Air 11-inch (M2)',
      runtime: 'iOS-17-5',
    },
    appBundleId: 'com.zoneminder.zmNinjaNG',
    appPath: 'ios/App/DerivedData/Build/Products/Debug-iphonesimulator/App.app',
    appiumPort: 4723,
  },
  tauri: {
    driverPort: 4444,
  },
  web: {
    baseUrl: 'http://localhost:5173',
  },
  timeouts: {
    appLaunch: 30000,
    navigation: 10000,
    element: 5000,
    screenshot: 1000,
    webviewSwitch: 10000,
  },
};
```

- [ ] **Step 2: Create the config loader**

Create `app/tests/platforms.config.ts`:

```typescript
import { defaults, type PlatformTestConfig } from './platforms.config.defaults';

function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const val = override[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = deepMerge(
        base[key] as Record<string, unknown>,
        val as Record<string, unknown>,
      ) as T[keyof T];
    } else if (val !== undefined) {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}

// ESM: use dynamic import() for optional local config file
// platforms.config.local.ts is gitignored (*.local pattern)
async function loadConfig(): Promise<PlatformTestConfig> {
  try {
    const local = await import('./platforms.config.local');
    return deepMerge(defaults, local.default ?? local);
  } catch {
    return defaults;
  }
}

export const platformConfig: PlatformTestConfig = await loadConfig();
```

Note: Uses top-level `await` which is valid in ESM modules (`"type": "module"` in package.json). If the TypeScript target doesn't support top-level await, wrap exports in an init function instead.

- [ ] **Step 3: Commit**

```bash
git add app/tests/platforms.config.defaults.ts app/tests/platforms.config.ts
git commit -m "feat: add platform test configuration with local override support

Defines simulator names, ports, timeouts, and paths for all 5 platforms.
Developers override via platforms.config.local.ts (gitignored by *.local pattern).

refs #<issue-number>"
```

---

### Task 4: Create TestActions Abstraction

**Files:**
- Create: `app/tests/actions/types.ts`
- Create: `app/tests/actions/playwright-actions.ts`
- Create: `app/tests/actions/wdio-actions.ts`

- [ ] **Step 1: Create the TestActions interface**

Create `app/tests/actions/types.ts`:

```typescript
import type { PlatformProfile } from '../platforms.config.defaults';

export interface TestActions {
  /** Navigate to a path (relative to app root, e.g., '/dashboard') */
  goto(path: string): Promise<void>;

  /** Click element by data-testid */
  click(testId: string): Promise<void>;

  /** Click element by role and name */
  clickByRole(role: string, name: string): Promise<void>;

  /** Click element by visible text */
  clickByText(text: string): Promise<void>;

  /** Fill input by data-testid */
  fill(testId: string, value: string): Promise<void>;

  /** Get text content by data-testid */
  getText(testId: string): Promise<string>;

  /** Get all matching text contents by data-testid */
  getAllTexts(testId: string): Promise<string[]>;

  /** Check if element with data-testid is visible */
  isVisible(testId: string, timeout?: number): Promise<boolean>;

  /** Wait for element to become visible */
  waitForVisible(testId: string, timeout?: number): Promise<void>;

  /** Wait for element to disappear */
  waitForHidden(testId: string, timeout?: number): Promise<void>;

  /** Count elements matching data-testid */
  getCount(testId: string): Promise<number>;

  /** Get attribute value by data-testid */
  getAttribute(testId: string, attr: string): Promise<string | null>;

  /** Check if element has a CSS class */
  hasClass(testId: string, className: string): Promise<boolean>;

  /** Get computed CSS property */
  getCssValue(testId: string, property: string): Promise<string>;

  /** Get bounding box (x, y, width, height) */
  getBoundingBox(testId: string): Promise<{ x: number; y: number; width: number; height: number } | null>;

  /** Get viewport dimensions */
  getViewportSize(): Promise<{ width: number; height: number }>;

  /** Scroll element into view by data-testid */
  scrollTo(testId: string): Promise<void>;

  /** Take a screenshot and return the buffer */
  screenshot(name: string): Promise<Buffer>;

  /** Compare screenshot against baseline, throw on mismatch */
  compareScreenshot(name: string, threshold?: number): Promise<void>;

  /** Get the current URL path */
  currentPath(): Promise<string>;

  /** Wait for navigation to complete */
  waitForNavigation(timeout?: number): Promise<void>;

  /** Reload the current page */
  reload(): Promise<void>;

  /** Wait a fixed number of ms (use sparingly) */
  wait(ms: number): Promise<void>;

  /** Get the current platform profile name */
  platform(): PlatformProfile;
}
```

- [ ] **Step 2: Create Playwright implementation**

Create `app/tests/actions/playwright-actions.ts`:

```typescript
import { type Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import type { PlatformProfile } from '../platforms.config.defaults';
import { platformConfig } from '../platforms.config';
import type { TestActions } from './types';

export class PlaywrightActions implements TestActions {
  constructor(
    private page: Page,
    private platformName: PlatformProfile,
    private screenshotDir: string,
  ) {}

  async goto(urlPath: string): Promise<void> {
    await this.page.goto(urlPath, { waitUntil: 'networkidle' });
  }

  async click(testId: string): Promise<void> {
    await this.page.getByTestId(testId).click();
  }

  async clickByRole(role: string, name: string): Promise<void> {
    await this.page.getByRole(role as Parameters<Page['getByRole']>[0], { name }).click();
  }

  async clickByText(text: string): Promise<void> {
    await this.page.getByText(text, { exact: false }).first().click();
  }

  async fill(testId: string, value: string): Promise<void> {
    await this.page.getByTestId(testId).fill(value);
  }

  async getText(testId: string): Promise<string> {
    return (await this.page.getByTestId(testId).textContent()) ?? '';
  }

  async getAllTexts(testId: string): Promise<string[]> {
    return this.page.getByTestId(testId).allTextContents();
  }

  async isVisible(testId: string, timeout?: number): Promise<boolean> {
    try {
      await this.page.getByTestId(testId).waitFor({
        state: 'visible',
        timeout: timeout ?? platformConfig.timeouts.element,
      });
      return true;
    } catch {
      return false;
    }
  }

  async waitForVisible(testId: string, timeout?: number): Promise<void> {
    await this.page.getByTestId(testId).waitFor({
      state: 'visible',
      timeout: timeout ?? platformConfig.timeouts.element,
    });
  }

  async waitForHidden(testId: string, timeout?: number): Promise<void> {
    await this.page.getByTestId(testId).waitFor({
      state: 'hidden',
      timeout: timeout ?? platformConfig.timeouts.element,
    });
  }

  async getCount(testId: string): Promise<number> {
    return this.page.getByTestId(testId).count();
  }

  async getAttribute(testId: string, attr: string): Promise<string | null> {
    return this.page.getByTestId(testId).getAttribute(attr);
  }

  async hasClass(testId: string, className: string): Promise<boolean> {
    const cls = await this.page.getByTestId(testId).getAttribute('class');
    return cls?.includes(className) ?? false;
  }

  async getCssValue(testId: string, property: string): Promise<string> {
    return this.page.getByTestId(testId).evaluate(
      (el, prop) => getComputedStyle(el).getPropertyValue(prop),
      property,
    );
  }

  async getBoundingBox(testId: string) {
    return this.page.getByTestId(testId).boundingBox();
  }

  async getViewportSize(): Promise<{ width: number; height: number }> {
    const size = this.page.viewportSize();
    return size ?? { width: 0, height: 0 };
  }

  async scrollTo(testId: string): Promise<void> {
    await this.page.getByTestId(testId).scrollIntoViewIfNeeded();
  }

  async screenshot(name: string): Promise<Buffer> {
    const buffer = await this.page.screenshot({ fullPage: false });
    const dir = path.join(this.screenshotDir, this.platformName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.png`), buffer);
    return buffer;
  }

  async compareScreenshot(name: string, threshold?: number): Promise<void> {
    const dir = path.join(this.screenshotDir, this.platformName);
    await this.page.waitForTimeout(platformConfig.timeouts.screenshot);
    // Playwright's built-in visual comparison
    const snapshotName = `${name}.png`;
    const snapshotPath = path.join(dir, snapshotName);
    // Use toHaveScreenshot if baseline exists, otherwise save it
    if (fs.existsSync(snapshotPath)) {
      await expect(this.page).toHaveScreenshot(snapshotName, {
        maxDiffPixelRatio: threshold ?? 0.002,
        snapshotPathTemplate: path.join(dir, '{arg}'),
      });
    } else {
      await this.screenshot(name);
    }
  }

  async currentPath(): Promise<string> {
    return new URL(this.page.url()).pathname;
  }

  async waitForNavigation(timeout?: number): Promise<void> {
    await this.page.waitForLoadState('networkidle', {
      timeout: timeout ?? platformConfig.timeouts.navigation,
    });
  }

  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'networkidle' });
  }

  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  platform(): PlatformProfile {
    return this.platformName;
  }
}
```

- [ ] **Step 3: Create WebDriverIO implementation**

Create `app/tests/actions/wdio-actions.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { PlatformProfile } from '../platforms.config.defaults';
import { platformConfig } from '../platforms.config';
import type { TestActions } from './types';

/**
 * WebDriverIO implementation of TestActions.
 * Used for iOS (Appium XCUITest) and Tauri (tauri-driver) platforms.
 *
 * `browser` is the global WebDriverIO browser object, available in WDIO test context.
 */
export class WdioActions implements TestActions {
  constructor(
    private platformName: PlatformProfile,
    private screenshotDir: string,
  ) {}

  private selector(testId: string): string {
    return `[data-testid="${testId}"]`;
  }

  async goto(urlPath: string): Promise<void> {
    await browser.url(urlPath);
    await browser.pause(500); // Allow initial render
  }

  async click(testId: string): Promise<void> {
    const el = await $(this.selector(testId));
    await el.waitForDisplayed({ timeout: platformConfig.timeouts.element });
    await el.click();
  }

  async clickByRole(role: string, name: string): Promise<void> {
    // Use XPath for text matching (CSS :has-text() is Playwright-only)
    const el = await $(`[role="${role}"][aria-label="${name}"]`);
    await el.waitForDisplayed({ timeout: platformConfig.timeouts.element });
    await el.click();
  }

  async clickByText(text: string): Promise<void> {
    const el = await $(`//*[contains(text(), "${text}")]`);
    await el.waitForDisplayed({ timeout: platformConfig.timeouts.element });
    await el.click();
  }

  async fill(testId: string, value: string): Promise<void> {
    const el = await $(this.selector(testId));
    await el.waitForDisplayed({ timeout: platformConfig.timeouts.element });
    await el.clearValue();
    await el.setValue(value);
  }

  async getText(testId: string): Promise<string> {
    const el = await $(this.selector(testId));
    await el.waitForDisplayed({ timeout: platformConfig.timeouts.element });
    return el.getText();
  }

  async getAllTexts(testId: string): Promise<string[]> {
    const els = await $$(this.selector(testId));
    return Promise.all(els.map((el) => el.getText()));
  }

  async isVisible(testId: string, timeout?: number): Promise<boolean> {
    try {
      const el = await $(this.selector(testId));
      await el.waitForDisplayed({ timeout: timeout ?? platformConfig.timeouts.element });
      return true;
    } catch {
      return false;
    }
  }

  async waitForVisible(testId: string, timeout?: number): Promise<void> {
    const el = await $(this.selector(testId));
    await el.waitForDisplayed({ timeout: timeout ?? platformConfig.timeouts.element });
  }

  async waitForHidden(testId: string, timeout?: number): Promise<void> {
    const el = await $(this.selector(testId));
    await el.waitForDisplayed({
      timeout: timeout ?? platformConfig.timeouts.element,
      reverse: true,
    });
  }

  async getCount(testId: string): Promise<number> {
    const els = await $$(this.selector(testId));
    return els.length;
  }

  async getAttribute(testId: string, attr: string): Promise<string | null> {
    const el = await $(this.selector(testId));
    return el.getAttribute(attr);
  }

  async hasClass(testId: string, className: string): Promise<boolean> {
    const cls = await this.getAttribute(testId, 'class');
    return cls?.includes(className) ?? false;
  }

  async getCssValue(testId: string, property: string): Promise<string> {
    const el = await $(this.selector(testId));
    return el.getCSSProperty(property).then((v) => v.value.toString());
  }

  async getBoundingBox(testId: string) {
    const el = await $(this.selector(testId));
    const size = await el.getSize();
    const loc = await el.getLocation();
    return { x: loc.x, y: loc.y, width: size.width, height: size.height };
  }

  async getViewportSize(): Promise<{ width: number; height: number }> {
    const size = await browser.getWindowSize();
    return { width: size.width, height: size.height };
  }

  async scrollTo(testId: string): Promise<void> {
    const el = await $(this.selector(testId));
    await el.scrollIntoView();
  }

  async screenshot(name: string): Promise<Buffer> {
    const buffer = Buffer.from(await browser.takeScreenshot(), 'base64');
    const dir = path.join(this.screenshotDir, this.platformName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.png`), buffer);
    return buffer;
  }

  async compareScreenshot(name: string, threshold?: number): Promise<void> {
    await browser.pause(platformConfig.timeouts.screenshot);
    const dir = path.join(this.screenshotDir, this.platformName);
    const baselinePath = path.join(dir, `${name}.png`);

    const currentBuffer = Buffer.from(await browser.takeScreenshot(), 'base64');

    if (!fs.existsSync(baselinePath)) {
      // No baseline — save current as baseline
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(baselinePath, currentBuffer);
      return;
    }

    const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
    const current = PNG.sync.read(currentBuffer);
    const { width, height } = baseline;
    const diff = new PNG({ width, height });

    const numDiff = pixelmatch(baseline.data, current.data, diff.data, width, height, {
      threshold: 0.1,
    });

    const totalPixels = width * height;
    const diffRatio = numDiff / totalPixels;
    const maxRatio = threshold ?? 0.002;

    if (diffRatio > maxRatio) {
      const diffPath = path.join(dir, `${name}-diff.png`);
      fs.writeFileSync(diffPath, PNG.sync.write(diff));
      throw new Error(
        `Screenshot "${name}" differs by ${(diffRatio * 100).toFixed(3)}% (max ${maxRatio * 100}%). Diff saved to ${diffPath}`,
      );
    }
  }

  async currentPath(): Promise<string> {
    const url = await browser.getUrl();
    return new URL(url).pathname;
  }

  async waitForNavigation(timeout?: number): Promise<void> {
    const maxWait = timeout ?? platformConfig.timeouts.navigation;
    const startUrl = await browser.getUrl();
    await browser.waitUntil(
      async () => (await browser.getUrl()) !== startUrl,
      { timeout: maxWait, timeoutMsg: `Navigation did not complete within ${maxWait}ms` },
    );
  }

  async reload(): Promise<void> {
    await browser.refresh();
    await browser.pause(1000);
  }

  async wait(ms: number): Promise<void> {
    await browser.pause(ms);
  }

  platform(): PlatformProfile {
    return this.platformName;
  }
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd /Users/arjun/fiddle/zmNinjaNG/app
npx tsc --noEmit
```

Expected: no type errors. If there are import issues with pixelmatch/pngjs, add type declarations or use `// @ts-expect-error` pragmatically.

- [ ] **Step 5: Commit**

```bash
git add app/tests/actions/
git commit -m "feat: add TestActions abstraction with Playwright and WebDriverIO implementations

Shared interface for all step definitions. PlaywrightActions for web/Android,
WdioActions for iOS/Tauri. Visual regression via toHaveScreenshot (Playwright)
and pixelmatch (WDIO).

refs #<issue-number>"
```

---

## Phase 2: Platform Configs — Web and Android

### Task 5: Simplify Existing Playwright Config (Web-Only)

**Files:**
- Modify: `app/playwright.config.ts`

- [ ] **Step 1: Read current playwright.config.ts**

Read the full file to understand the current structure before modifying.

- [ ] **Step 2: Simplify to web-chromium only**

Update `app/playwright.config.ts` to remove the mobile-chrome and mobile-safari projects. Keep only the `chromium` project. Mobile testing now happens on real devices via separate configs.

Key changes:
- Remove `mobile-chrome` project
- Remove `mobile-safari` project
- Remove `@mobile` tag filtering logic
- Keep `chromium` project with desktop viewport
- Keep BDD generation, timeouts, tracing, web server config unchanged
- Update step definitions path from `tests/steps.ts` to `tests/steps/**/*.steps.ts` (plural, glob pattern for the new split files)

- [ ] **Step 3: Run existing web e2e tests to verify nothing broke**

```bash
cd /Users/arjun/fiddle/zmNinjaNG/app
npm run test:e2e
```

Expected: existing tests pass (they currently run on chromium project only for non-@mobile tests). This will initially fail because the step files haven't been split yet — so defer this verification until after Task 8.

- [ ] **Step 4: Commit**

```bash
git add app/playwright.config.ts
git commit -m "refactor: simplify playwright config to web-chromium only

Mobile testing moves to real simulators via WebDriverIO configs.
Step definitions path updated for per-screen file split.

refs #<issue-number>"
```

---

### Task 6: Create Android Playwright Config

**Files:**
- Create: `app/playwright.config.android.ts`
- Create: `app/tests/helpers/android-launcher.ts`

- [ ] **Step 1: Create Android launcher helper**

Create `app/tests/helpers/android-launcher.ts`:

```typescript
import { execSync, spawn, type ChildProcess } from 'child_process';
import { platformConfig } from '../platforms.config';

let emulatorProcess: ChildProcess | null = null;

export async function launchAndroidEmulator(): Promise<void> {
  const { avdName, appId, apkPath, cdpPort } = platformConfig.android;

  // Check if emulator is already running
  const devices = execSync('adb devices').toString();
  const emulatorRunning = devices.includes('emulator-');

  if (!emulatorRunning) {
    process.stdout.write(`[android] Booting emulator: ${avdName}\n`);
    emulatorProcess = spawn('emulator', ['-avd', avdName, '-no-audio', '-no-window'], {
      stdio: 'ignore',
      detached: true,
    });
    emulatorProcess.unref();

    // Wait for boot
    execSync('adb wait-for-device', { timeout: 60000 });
    let booted = false;
    for (let i = 0; i < 30; i++) {
      const prop = execSync('adb shell getprop sys.boot_completed').toString().trim();
      if (prop === '1') {
        booted = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!booted) throw new Error('Emulator failed to boot within 60s');
  }

  // Install APK
  process.stdout.write('[android] Installing APK...\n');
  execSync(`adb install -r ${apkPath}`, { timeout: 60000 });

  // Launch app
  process.stdout.write('[android] Launching app...\n');
  execSync(`adb shell am start -n ${appId}/.MainActivity`);
  await new Promise((r) => setTimeout(r, 5000)); // Wait for app to initialize

  // Find WebView debug socket and forward port
  const sockets = execSync('adb shell cat /proc/net/unix 2>/dev/null || true').toString();
  const match = sockets.match(/webview_devtools_remote_(\d+)/);
  if (!match) throw new Error('WebView debug socket not found. Is the app running?');

  const pid = match[1];
  process.stdout.write(`[android] Found WebView debug socket for PID ${pid}\n`);

  // Forward the debug port
  execSync(`adb forward tcp:${cdpPort} localabstract:webview_devtools_remote_${pid}`);
  process.stdout.write(`[android] CDP forwarded to localhost:${cdpPort}\n`);
}

export async function stopAndroidEmulator(): Promise<void> {
  try {
    execSync('adb emu kill', { timeout: 10000 });
  } catch {
    // Emulator may not be running
  }
  if (emulatorProcess) {
    emulatorProcess.kill();
    emulatorProcess = null;
  }
}
```

- [ ] **Step 2: Create Android CDP fixture**

Create `app/tests/helpers/android-fixture.ts`:

Playwright's `connectOverCDP()` is a programmatic API, not a config option. We create a custom test fixture that calls `chromium.connectOverCDP()` and provides the resulting `page` to tests.

```typescript
import { test as base, chromium, type Page } from '@playwright/test';
import { platformConfig } from '../platforms.config';

// Custom fixture that connects to Android WebView via CDP
export const test = base.extend<{ androidPage: Page }>({
  androidPage: async ({}, use) => {
    const cdpUrl = `http://localhost:${platformConfig.android.cdpPort}`;
    const browser = await chromium.connectOverCDP(cdpUrl);
    const defaultContext = browser.contexts()[0];
    const page = defaultContext?.pages()[0] ?? await defaultContext.newPage();
    await use(page);
    await browser.close();
  },
});
```

- [ ] **Step 3: Create Android Playwright config**

Create `app/playwright.config.android.ts`:

```typescript
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'tests/features/**/*.feature',
  steps: 'tests/steps/**/*.steps.ts',
  featuresRoot: 'tests/features',
  // Exclude iOS-only, Tauri-only, web-only, and native scenarios
  tags: 'not @native and not @ios and not @ios-phone and not @ios-tablet and not @tauri and not @web',
});

export default defineConfig({
  testDir,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    trace: 'on',
    screenshot: 'on',
    viewport: { width: 412, height: 915 },
  },
  projects: [
    {
      name: 'android-phone',
    },
  ],
  reporter: [['html', { open: 'never' }]],
});
```

Note: The `androidPage` fixture from `android-fixture.ts` is injected into step definitions via the TestActions abstraction. Steps never access the fixture directly — they call `TestActions.click()` etc., and `PlaywrightActions` wraps the `androidPage`.

- [ ] **Step 3: Commit**

```bash
git add app/playwright.config.android.ts app/tests/helpers/android-launcher.ts
git commit -m "feat: add Android emulator Playwright config and launcher

Connects to Android WebView via ADB port-forwarding and CDP.
Launcher handles emulator boot, APK install, WebView PID discovery.

refs #<issue-number>"
```

---

### Task 7: Create iOS and Tauri WebDriverIO Configs

**Files:**
- Create: `app/wdio.config.ios-phone.ts`
- Create: `app/wdio.config.ios-tablet.ts`
- Create: `app/wdio.config.tauri.ts`
- Create: `app/tests/helpers/ios-launcher.ts`
- Create: `app/tests/helpers/tauri-launcher.ts`

- [ ] **Step 1: Create iOS launcher helper**

Create `app/tests/helpers/ios-launcher.ts`:

```typescript
import { execSync } from 'child_process';
import { platformConfig } from '../platforms.config';

export function buildIosApp(): void {
  process.stdout.write('[ios] Building app for simulator...\n');
  execSync(
    `xcodebuild -workspace ../ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -configuration Debug -derivedDataPath ../ios/App/DerivedData build`,
    { cwd: __dirname, stdio: 'inherit', timeout: 300000 },
  );
}

export function bootSimulator(deviceName: string): string {
  // Check if already booted
  const list = execSync('xcrun simctl list devices booted --json').toString();
  const booted = JSON.parse(list);
  const allDevices = Object.values(booted.devices).flat() as Array<{ name: string; udid: string; state: string }>;
  const existing = allDevices.find((d) => d.name === deviceName && d.state === 'Booted');

  if (existing) {
    process.stdout.write(`[ios] Simulator "${deviceName}" already booted: ${existing.udid}\n`);
    return existing.udid;
  }

  process.stdout.write(`[ios] Booting simulator: ${deviceName}\n`);
  execSync(`xcrun simctl boot "${deviceName}"`, { timeout: 60000 });

  // Get UDID
  const listAll = execSync('xcrun simctl list devices --json').toString();
  const all = JSON.parse(listAll);
  const allDevicesAfter = Object.values(all.devices).flat() as Array<{ name: string; udid: string }>;
  const device = allDevicesAfter.find((d) => d.name === deviceName);
  if (!device) throw new Error(`Simulator "${deviceName}" not found`);

  return device.udid;
}

export function getAppiumCapabilities(deviceName: string) {
  return {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': deviceName,
    'appium:app': platformConfig.ios.appPath,
    'appium:bundleId': platformConfig.ios.appBundleId,
    'appium:autoWebview': true,
    'appium:webviewConnectTimeout': platformConfig.timeouts.webviewSwitch,
    'appium:noReset': true,
  };
}
```

- [ ] **Step 2: Create Tauri launcher helper**

Create `app/tests/helpers/tauri-launcher.ts`:

```typescript
import { spawn, type ChildProcess } from 'child_process';
import { platformConfig } from '../platforms.config';

let driverProcess: ChildProcess | null = null;
let appProcess: ChildProcess | null = null;

export async function launchTauriWithDriver(): Promise<void> {
  const { driverPort, binaryPath } = platformConfig.tauri;

  // Start tauri-driver
  process.stdout.write(`[tauri] Starting tauri-driver on port ${driverPort}...\n`);
  driverProcess = spawn('tauri-driver', ['--port', String(driverPort)], {
    stdio: 'pipe',
    env: { ...process.env },
  });

  // Wait for driver to be ready
  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch(`http://localhost:${driverPort}/status`);
      if (response.ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Start app if binary path provided, otherwise assume it's already running
  if (binaryPath) {
    process.stdout.write(`[tauri] Launching Tauri app: ${binaryPath}\n`);
    appProcess = spawn(binaryPath, [], { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 3000));
  }
}

export async function stopTauri(): Promise<void> {
  if (appProcess) {
    appProcess.kill();
    appProcess = null;
  }
  if (driverProcess) {
    driverProcess.kill();
    driverProcess = null;
  }
}
```

- [ ] **Step 3: Create WDIO step definitions adapter**

WDIO uses `@wdio/cucumber-framework` to run the same `.feature` files natively. The step definitions use `TestActions` (via `WdioActions`) so logic is identical to Playwright steps. Create `app/tests/steps-wdio/common.steps.ts`:

```typescript
import { Given, When, Then } from '@wdio/cucumber-framework';
import { WdioActions } from '../actions/wdio-actions';
import { testConfig } from '../helpers/config';

// Platform is injected via WDIO config beforeScenario hook
let actions: WdioActions;

Given('I am logged into zmNinjaNG', async () => {
  // Login uses the same TestActions interface as Playwright steps
  actions = new WdioActions(
    (browser.capabilities as Record<string, string>)['platformProfile'] as any,
    'tests/screenshots',
  );
  await actions.goto('/');
  // ... login logic using actions.fill(), actions.click() etc.
});

When('I navigate to the {string} page', async (pageName: string) => {
  // ... navigation logic using actions
});

Then('the page should match the visual baseline', async () => {
  const scenarioName = (browser.capabilities as Record<string, string>)['scenarioName'] ?? 'unnamed';
  await actions.compareScreenshot(scenarioName);
});
```

Each screen gets a corresponding `steps-wdio/<screen>.steps.ts` file. The step text is identical to the Playwright BDD steps — only the driver injection differs.

- [ ] **Step 4: Create iOS phone WDIO config**

Create `app/wdio.config.ios-phone.ts`:

```typescript
import { platformConfig } from './tests/platforms.config';
import { getAppiumCapabilities } from './tests/helpers/ios-launcher';

export const config: WebdriverIO.Config = {
  runner: 'local',
  port: platformConfig.ios.appiumPort,
  // Run same Gherkin feature files directly (not playwright-bdd output)
  specs: ['tests/features/**/*.feature'],
  capabilities: [{
    ...getAppiumCapabilities(platformConfig.ios.phone.simulator),
    'custom:platformProfile': 'ios-phone',
  }],
  services: [
    ['appium', {
      args: { port: platformConfig.ios.appiumPort },
    }],
  ],
  framework: 'cucumber',
  cucumberOpts: {
    require: ['tests/steps-wdio/**/*.steps.ts'],
    // Exclude scenarios tagged for other platforms
    tagExpression: 'not @native and not @android and not @tauri and not @web',
    timeout: platformConfig.timeouts.appLaunch + 60000,
  },
  reporters: ['spec'],
  baseUrl: platformConfig.web.baseUrl,
};
```

- [ ] **Step 5: Create iOS tablet WDIO config**

Create `app/wdio.config.ios-tablet.ts`:

```typescript
import { platformConfig } from './tests/platforms.config';
import { getAppiumCapabilities } from './tests/helpers/ios-launcher';

export const config: WebdriverIO.Config = {
  runner: 'local',
  port: platformConfig.ios.appiumPort,
  specs: ['tests/features/**/*.feature'],
  capabilities: [{
    ...getAppiumCapabilities(platformConfig.ios.tablet.simulator),
    'custom:platformProfile': 'ios-tablet',
  }],
  services: [
    ['appium', {
      args: { port: platformConfig.ios.appiumPort },
    }],
  ],
  framework: 'cucumber',
  cucumberOpts: {
    require: ['tests/steps-wdio/**/*.steps.ts'],
    tagExpression: 'not @native and not @android and not @tauri and not @web and not @ios-phone',
    timeout: platformConfig.timeouts.appLaunch + 60000,
  },
  reporters: ['spec'],
  baseUrl: platformConfig.web.baseUrl,
};
```

- [ ] **Step 6: Create Tauri WDIO config**

Create `app/wdio.config.tauri.ts`:

```typescript
import { platformConfig } from './tests/platforms.config';

export const config: WebdriverIO.Config = {
  runner: 'local',
  hostname: 'localhost',
  port: platformConfig.tauri.driverPort,
  specs: ['tests/features/**/*.feature'],
  capabilities: [{
    browserName: 'wry',
    'custom:platformProfile': 'desktop-tauri',
  }],
  framework: 'cucumber',
  cucumberOpts: {
    require: ['tests/steps-wdio/**/*.steps.ts'],
    tagExpression: 'not @native and not @android and not @ios and not @ios-phone and not @ios-tablet and not @web',
    timeout: platformConfig.timeouts.appLaunch + 60000,
  },
  reporters: ['spec'],
  baseUrl: platformConfig.web.baseUrl,
};
```

- [ ] **Step 7: Commit**

```bash
git add app/wdio.config.*.ts app/tests/helpers/ios-launcher.ts app/tests/helpers/tauri-launcher.ts app/tests/steps-wdio/
git commit -m "feat: add WebDriverIO configs for iOS (phone + tablet) and Tauri

iOS uses Appium XCUITest driver with Cucumber framework for Gherkin support.
Tauri uses tauri-driver via WebDriver protocol with Cucumber framework.
WDIO step definitions adapter mirrors Playwright steps via TestActions.
Launcher helpers handle simulator boot and driver lifecycle.

refs #<issue-number>"
```

---

## Phase 3: Step Definition Split and Common Steps

### Task 8: Split Monolith steps.ts into Per-Screen Files

**Files:**
- Read: `app/tests/steps.ts` (1669 lines — the monolith to split)
- Create: `app/tests/steps/common.steps.ts`
- Create: `app/tests/steps/dashboard.steps.ts`
- Create: `app/tests/steps/monitors.steps.ts`
- Create: `app/tests/steps/monitor-detail.steps.ts`
- Create: `app/tests/steps/montage.steps.ts`
- Create: `app/tests/steps/events.steps.ts`
- Create: `app/tests/steps/timeline.steps.ts`
- Create: `app/tests/steps/profiles.steps.ts`
- Create: `app/tests/steps/settings.steps.ts`
- Create: `app/tests/steps/kiosk.steps.ts`
- Create: `app/tests/steps/group-filter.steps.ts`
- Create: `app/tests/steps/platform.steps.ts`
- Create: `app/tests/steps-wdio/common.steps.ts` (mirrors common.steps.ts for WDIO Cucumber)
- Create: `app/tests/steps-wdio/<screen>.steps.ts` (one per screen, mirrors Playwright steps)
- Archive: `app/tests/steps.ts` → delete after split

This is a large task. The approach:

1. Read the full `steps.ts` file
2. Identify which steps belong to which screen based on the step text and the feature files that use them
3. Extract shared steps (login, navigation, generic assertions) into `common.steps.ts`
4. Move screen-specific steps into their respective files
5. Each file imports `createBdd` and `TestActions` — steps use `TestActions` instead of raw `page` object
6. Add `platform.steps.ts` for platform-conditional assertions (layout checks, viewport-specific steps)

- [ ] **Step 1: Read the full steps.ts and categorize every step**

Read `app/tests/steps.ts` completely. For each `Given/When/Then` block, note:
- The step text (e.g., `'I am logged into zmNinjaNG'`)
- Which feature file(s) use it
- Which target file it belongs in

Shared steps (used by 3+ features): → `common.steps.ts`
Dashboard-specific: → `dashboard.steps.ts`
etc.

- [ ] **Step 2: Create common.steps.ts with shared steps**

Includes: login, navigation, page heading checks, generic element assertions, visual baseline step.
Import pattern:

```typescript
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { testConfig } from '../helpers/config';

const { Given, When, Then } = createBdd();

Given('I am logged into zmNinjaNG', async ({ page }) => {
  // ... existing login logic
});

When('I navigate to the {string} page', async ({ page }, pageName: string) => {
  // ... existing navigation logic
});

Then('the page should match the visual baseline', async ({ page }) => {
  // Visual regression step — will be implemented per-platform later
  // For now, just take a screenshot
});
```

- [ ] **Step 3: Create each screen-specific steps file**

Move the relevant steps from `steps.ts` into each per-screen file. Each file follows the same import pattern as common.steps.ts.

- [ ] **Step 4: Create platform.steps.ts with layout assertion steps**

New steps for cross-platform layout testing:

```typescript
Then('no element should overflow the viewport horizontally', async ({ page }) => {
  const overflows = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    return Array.from(document.querySelectorAll('*'))
      .filter((el) => el.getBoundingClientRect().right > viewportWidth)
      .map((el) => el.tagName + '.' + el.className);
  });
  expect(overflows).toHaveLength(0);
});

Then('the grid should display {int} or more columns', async ({ page }, minCols: number) => {
  // Count distinct x-positions of grid children
  // Implementation depends on grid data-testid
});
```

- [ ] **Step 5: Delete the old monolith steps.ts**

```bash
rm app/tests/steps.ts
```

- [ ] **Step 6: Verify web e2e tests still pass**

```bash
cd /Users/arjun/fiddle/zmNinjaNG/app
npm run test:e2e
```

Expected: all existing web tests pass with the split step files.

- [ ] **Step 7: Commit**

```bash
git add app/tests/steps/ -A
git rm app/tests/steps.ts
git commit -m "refactor: split monolith steps.ts into per-screen step definition files

Split 1669-line steps.ts into 12 focused files:
- common.steps.ts: login, navigation, generic assertions
- One file per screen: dashboard, monitors, montage, etc.
- platform.steps.ts: cross-platform layout assertions
- Removed old monolith steps.ts

refs #<issue-number>"
```

---

## Phase 4: Feature File Rewrites

### Task 9: Delete Redundant Feature Files

**Files:**
- Delete: `app/tests/features/full-app-walkthrough.feature`
- Modify: `app/tests/features/go2rtc-streaming.feature` → delete (merge snapshot scenario into monitor-detail.feature)

- [ ] **Step 1: Delete full-app-walkthrough.feature**

```bash
git rm app/tests/features/full-app-walkthrough.feature
```

- [ ] **Step 2: Move the snapshot scenario from go2rtc-streaming.feature into monitor-detail.feature, then delete go2rtc-streaming.feature**

Read `go2rtc-streaming.feature`, identify the "Download snapshot from monitor detail" scenario, append it to `monitor-detail.feature`, then delete the file.

```bash
git rm app/tests/features/go2rtc-streaming.feature
```

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: remove redundant feature files

Delete full-app-walkthrough.feature (14 scenarios duplicated elsewhere).
Merge go2rtc-streaming snapshot scenario into monitor-detail.feature.
Delete go2rtc-streaming.feature (remaining 2 scenarios were render-only).

refs #<issue-number>"
```

---

### Task 10: Rewrite Feature Files as Human-Tester Scenarios

**Files:**
- Rewrite: `app/tests/features/dashboard.feature`
- Rewrite: `app/tests/features/monitors.feature`
- Create: `app/tests/features/montage.feature` (split from monitors.feature)
- Rewrite: `app/tests/features/monitor-detail.feature`
- Rewrite: `app/tests/features/events.feature`
- Rewrite: `app/tests/features/timeline.feature`
- Rewrite: `app/tests/features/profiles.feature`
- Rewrite: `app/tests/features/settings.feature`
- Rewrite: `app/tests/features/kiosk.feature`
- Rewrite: `app/tests/features/group-filter.feature`

This is the largest task. For each feature file:

1. Read the current file
2. Read the corresponding test plan from the spec ("Test Plan by Screen" section)
3. Rewrite scenarios following the human-tester approach
4. Add platform tags (`@all`, `@ios-phone`, `@android`, etc.)
5. Add `@visual` tags where layout verification is needed

Each rewritten `.feature` file must follow the pattern shown in the spec. Example for one screen:

```gherkin
@all
Feature: Dashboard Widgets

  Background:
    Given I am logged into zmNinjaNG
    And I navigate to the "Dashboard" page

  @visual
  Scenario: Add a timeline widget and verify it displays data
    When I open the Add Widget dialog
    And I select widget type "Timeline"
    And I enter the title "Test Timeline"
    And I save the widget
    Then the widget "Test Timeline" should appear on the dashboard
    And the widget should display non-empty content
    When I refresh the page
    Then the widget "Test Timeline" should still be present
    And the page should match the visual baseline

  @visual
  Scenario: Edit a widget title
    Given I have at least one widget on the dashboard
    When I enter edit mode
    And I change the first widget title to "Renamed Widget"
    And I save changes
    Then the widget "Renamed Widget" should appear on the dashboard

  # ... etc for all dashboard scenarios

  @ios-phone @android @visual
  Scenario: Dashboard widgets stack on phone viewport
    Then widgets should be displayed in a single column
    And no widget should overflow the screen width
    And all widget content should be readable
    And the page should match the visual baseline

  @ios-tablet @visual
  Scenario: Dashboard uses multi-column layout on tablet
    Then widgets should be displayed in 2 or more columns
    And no widgets should overlap
    And the page should match the visual baseline
```

- [ ] **Step 1: Rewrite dashboard.feature** — 8 scenarios per spec

- [ ] **Step 2: Rewrite monitors.feature** — 6 scenarios, remove montage scenarios (moved to montage.feature)

- [ ] **Step 3: Create montage.feature** — 5 scenarios (split from monitors.feature)

- [ ] **Step 4: Rewrite monitor-detail.feature** — 8 scenarios (include merged go2rtc snapshot scenario)

- [ ] **Step 5: Rewrite events.feature** — 10 scenarios

- [ ] **Step 6: Rewrite timeline.feature** — 6 scenarios

- [ ] **Step 7: Rewrite profiles.feature** — 6 scenarios

- [ ] **Step 8: Rewrite settings.feature** — 7 scenarios

- [ ] **Step 9: Rewrite kiosk.feature** — 5 scenarios

- [ ] **Step 10: Rewrite group-filter.feature** — 4 scenarios

- [ ] **Step 11: Update step definitions to match new scenario text**

For each new step text that doesn't have a matching step definition yet, add it to the appropriate steps file.

- [ ] **Step 12: Run web e2e tests**

```bash
cd /Users/arjun/fiddle/zmNinjaNG/app
npm run test:e2e
```

Expected: all rewritten scenarios pass on web-chromium.

- [ ] **Step 13: Commit**

```bash
git add app/tests/features/ app/tests/steps/
git commit -m "feat: rewrite all feature files with human-tester behavioral scenarios

Replace ~45 render-only scenarios with ~65 behavioral tests.
Every scenario tests user interaction and verifies outcomes.
Platform tags added for device-specific layout tests.
Visual regression tags on layout-sensitive scenarios.
Split montage into own feature file from monitors.

refs #<issue-number>"
```

---

## Phase 5: Platform Launch Scripts

### Task 11: Create Platform Launch and Orchestration Scripts

**Files:**
- Create: `scripts/test-android.sh`
- Create: `scripts/test-ios.sh`
- Create: `scripts/test-tauri.sh`
- Create: `scripts/test-all-platforms.sh`
- Create: `scripts/verify-platform-setup.ts`

- [ ] **Step 1: Create test-android.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../app"

echo "=== Android E2E Tests ==="
echo "Building debug APK..."
npm run android:sync

echo "Launching emulator and forwarding CDP..."
npx tsx tests/helpers/android-launcher.ts

echo "Running Playwright tests against Android WebView..."
npx bddgen && npx playwright test --config playwright.config.android.ts "$@"
```

- [ ] **Step 2: Create test-ios.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../app"

DEVICE="${1:-phone}"  # 'phone' or 'tablet'

echo "=== iOS E2E Tests ($DEVICE) ==="
echo "Building iOS app for simulator..."
npm run ios:sync

echo "Running WebDriverIO tests via Appium..."
npx wdio run "wdio.config.ios-${DEVICE}.ts" "${@:2}"
```

- [ ] **Step 3: Create test-tauri.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../app"

echo "=== Tauri E2E Tests ==="
echo "Building Tauri app..."
npm run tauri:build 2>/dev/null || echo "Using existing build"

echo "Running WebDriverIO tests via tauri-driver..."
npx wdio run wdio.config.tauri.ts "$@"
```

- [ ] **Step 4: Create test-all-platforms.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(dirname "$0")"

echo "=== Running All Platform Tests ==="
echo ""

echo "--- Web (Chromium) ---"
cd "$SCRIPT_DIR/../app" && npm run test:e2e
echo ""

echo "--- Android ---"
"$SCRIPT_DIR/test-android.sh"
echo ""

echo "--- iOS Phone ---"
"$SCRIPT_DIR/test-ios.sh" phone
echo ""

echo "--- iOS Tablet ---"
"$SCRIPT_DIR/test-ios.sh" tablet
echo ""

echo "--- Tauri Desktop ---"
"$SCRIPT_DIR/test-tauri.sh"
echo ""

echo "=== All Platform Tests Complete ==="
```

- [ ] **Step 5: Create verify-platform-setup.ts**

Create `scripts/verify-platform-setup.ts` — a TypeScript script that checks each tool, simulator, and port. Uses `execSync` to run verification commands and prints pass/fail with fix instructions. See spec "Setup Verification" section for the full checklist.

- [ ] **Step 6: Make scripts executable**

```bash
chmod +x scripts/test-android.sh scripts/test-ios.sh scripts/test-tauri.sh scripts/test-all-platforms.sh
```

- [ ] **Step 7: Commit**

```bash
git add scripts/test-*.sh scripts/verify-platform-setup.ts
git commit -m "feat: add platform launch scripts and setup verification

Shell scripts to orchestrate emulator/simulator lifecycle and test runs.
verify-platform-setup.ts checks all required tools and prints fix instructions.

refs #<issue-number>"
```

---

## Phase 6: npm Scripts and Package.json Updates

### Task 12: Add npm Scripts for All Platforms

**Files:**
- Modify: `app/package.json` (scripts section)

- [ ] **Step 1: Add new test scripts to package.json**

Add these scripts to `app/package.json`:

```json
"test:e2e:android": "bddgen && playwright test --config playwright.config.android.ts",
"test:e2e:ios-phone": "wdio run wdio.config.ios-phone.ts",
"test:e2e:ios-tablet": "wdio run wdio.config.ios-tablet.ts",
"test:e2e:tauri": "wdio run wdio.config.tauri.ts",
"test:e2e:all-platforms": "npm run test:e2e && npm run test:e2e:android && npm run test:e2e:ios-phone && npm run test:e2e:ios-tablet && npm run test:e2e:tauri",
"test:e2e:visual-update": "bddgen && playwright test --update-snapshots",
"test:native": "wdio run tests/native/wdio.conf.ts",
"test:platform:setup": "tsx ../scripts/verify-platform-setup.ts"
```

- [ ] **Step 2: Verify existing scripts still work**

```bash
cd /Users/arjun/fiddle/zmNinjaNG/app
npm run test:e2e
```

- [ ] **Step 3: Commit**

```bash
git add app/package.json
git commit -m "feat: add npm scripts for cross-platform test commands

New scripts: test:e2e:android, test:e2e:ios-phone, test:e2e:ios-tablet,
test:e2e:tauri, test:e2e:all-platforms, test:native, test:platform:setup.

refs #<issue-number>"
```

---

## Phase 7: Visual Regression Setup

### Task 13: Create Screenshot Baseline Directories and Visual Regression Helper

**Files:**
- Create: `app/tests/screenshots/.gitkeep` (one per platform subdirectory)
- Create: `app/tests/helpers/visual-regression.ts`

- [ ] **Step 1: Create screenshot directories**

```bash
mkdir -p app/tests/screenshots/{web-chromium,android-phone,ios-phone,ios-tablet,desktop-tauri}
touch app/tests/screenshots/{web-chromium,android-phone,ios-phone,ios-tablet,desktop-tauri}/.gitkeep
```

- [ ] **Step 2: Create visual regression helper**

Create `app/tests/helpers/visual-regression.ts` with shared constants and utilities:

```typescript
import * as path from 'path';

export const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');
export const DEFAULT_THRESHOLD = 0.002; // 0.2% pixel diff

export function screenshotPath(platform: string, name: string): string {
  return path.join(SCREENSHOT_DIR, platform, `${name}.png`);
}

export function diffPath(platform: string, name: string): string {
  return path.join(SCREENSHOT_DIR, platform, `${name}-diff.png`);
}
```

- [ ] **Step 3: Commit**

```bash
git add app/tests/screenshots/ app/tests/helpers/visual-regression.ts
git commit -m "feat: add visual regression baseline directories and helpers

Per-platform screenshot directories for web, android, ios-phone, ios-tablet, tauri.
Baselines checked into git. Threshold: 0.2% pixel diff.

refs #<issue-number>"
```

---

## Phase 8: Native Appium Suite (Skeleton)

### Task 14: Create Native Test Suite Structure

**Files:**
- Create: `app/tests/native/wdio.conf.ts`
- Create: `app/tests/native/specs/app-lifecycle.spec.ts`
- Create: `app/tests/native/helpers/appium-setup.ts`
- Create: `app/tests/native/helpers/device-utils.ts`

- [ ] **Step 1: Create native WDIO config**

Create `app/tests/native/wdio.conf.ts`:

```typescript
import { platformConfig } from '../platforms.config';

export const config: WebdriverIO.Config = {
  runner: 'local',
  port: platformConfig.ios.appiumPort,
  specs: ['./specs/**/*.spec.ts'],
  services: [
    ['appium', {
      args: { port: platformConfig.ios.appiumPort },
    }],
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    timeout: 120000,
  },
  // Capabilities set per-spec via describe blocks
  capabilities: [{
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': platformConfig.ios.phone.simulator,
    'appium:app': platformConfig.ios.appPath,
    'appium:bundleId': platformConfig.ios.appBundleId,
    'appium:noReset': true,
  }],
};
```

- [ ] **Step 2: Create app-lifecycle.spec.ts as a starter native test**

Create `app/tests/native/specs/app-lifecycle.spec.ts`:

```typescript
import { expect } from '@wdio/globals';

describe('App Lifecycle', () => {
  it('should preserve state after backgrounding and foregrounding', async () => {
    // Navigate to a specific page
    await browser.switchContext('WEBVIEW_com.zoneminder.zmNinjaNG');
    await browser.url('/dashboard');
    await browser.pause(2000);

    // Switch to native context and background
    await browser.switchContext('NATIVE_APP');
    await driver.background(10); // Background for 10 seconds

    // Foreground and verify state
    await browser.switchContext('WEBVIEW_com.zoneminder.zmNinjaNG');
    const url = await browser.getUrl();
    expect(url).toContain('/dashboard');
  });
});
```

- [ ] **Step 3: Create native helper stubs**

Create `app/tests/native/helpers/appium-setup.ts` and `app/tests/native/helpers/device-utils.ts` with placeholder exports.

- [ ] **Step 4: Commit**

```bash
git add app/tests/native/
git commit -m "feat: add native Appium test suite skeleton

WDIO config for native-only flows (PiP, biometrics, push, lifecycle).
Starter app-lifecycle spec tests background/foreground state preservation.

refs #<issue-number>"
```

---

## Phase 9: Documentation

### Task 15: Create Tests README

**Files:**
- Create: `app/tests/README.md`

- [ ] **Step 1: Write README covering all sections from the spec**

See spec "README Structure" section. Must cover:
1. Prerequisites (Xcode, Android Studio, Rust/Cargo versions)
2. First-time setup per platform
3. Platform config customization
4. Running tests (command reference)
5. Visual baselines
6. Adding tests (pointer to AGENTS.md)
7. Troubleshooting

- [ ] **Step 2: Commit**

```bash
git add app/tests/README.md
git commit -m "docs: add cross-platform test setup and usage guide

Covers prerequisites, first-time setup for all platforms,
config customization, running tests, visual baselines, and troubleshooting.

refs #<issue-number>"
```

---

## Phase 10: Verification and Cleanup

### Task 16: End-to-End Verification

- [ ] **Step 1: Run unit tests**

```bash
cd /Users/arjun/fiddle/zmNinjaNG/app
npm test
```

Expected: all unit tests pass.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Run web e2e tests**

```bash
npm run test:e2e
```

Expected: all rewritten scenarios pass on web-chromium.

- [ ] **Step 5: Run platform setup verification**

```bash
npm run test:platform:setup
```

Review output for any missing tools or simulators.

- [ ] **Step 6: Run Android e2e tests (if emulator available)**

```bash
npm run test:e2e:android
```

- [ ] **Step 7: Run iOS phone tests (if simulator available)**

```bash
npm run test:e2e:ios-phone
```

- [ ] **Step 8: Generate initial visual baselines for web**

```bash
npm run test:e2e:visual-update
```

- [ ] **Step 9: Final commit with baselines**

```bash
git add app/tests/screenshots/
git commit -m "feat: add initial visual regression baselines for web-chromium

refs #<issue-number>"
```

---

### Task 17: Request User Review

- [ ] **Step 1: Create summary of all changes**

List all files created, modified, and deleted. State which tests pass.

- [ ] **Step 2: Ask user to review before merging**

Do NOT merge to main without user approval. Present the feature branch for review.
