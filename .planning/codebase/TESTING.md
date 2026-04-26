# Testing Patterns

**Analysis Date:** 2026-04-26

## Test Frameworks

**Unit tests:**
- Vitest `^3.2.4` — config at `app/vitest.config.ts`
- React Testing Library (`@testing-library/react ^16.3.0`, `@testing-library/jest-dom ^6.9.1`, `@testing-library/user-event ^14.6.1`)
- Environment: `jsdom`, globals enabled
- Coverage provider: `v8`, thresholds 60% for lines/functions/branches/statements

**E2E (web + Android via CDP):**
- Playwright `^1.57.0` — config at `app/playwright.config.ts`
- playwright-bdd `^8.4.2` — Gherkin `.feature` → generated test files via `bddgen`

**E2E (iOS + Tauri via WebDriver):**
- WebdriverIO `^9.26.1` (`@wdio/cli`, `@wdio/local-runner`, `@wdio/mocha-framework`)
- Appium `2.x` (global install) with `xcuitest` and `uiautomator2` drivers
- `tauri-driver` (Rust) for Tauri desktop tests

**Driver abstraction:**
- `TestActions` interface in `app/tests/actions/types.ts`
- Playwright implementation: `app/tests/actions/playwright-actions.ts`
- Step definitions call `TestActions` methods, not raw Playwright/WebDriverIO APIs — this keeps steps driver-agnostic across the 5 platforms.

## Run Commands

All commands run from `app/`:

```bash
# Unit tests
npm test                                # Vitest watch
npm run test:unit                       # Vitest run (single shot)
npm run test:coverage                   # With coverage
npm run test:ui                         # Vitest UI
npm run test:watch                      # Watch mode

# E2E — web (fast, default in CI)
npm run test:e2e                        # All web e2e tests
npm run test:e2e -- <feature>.feature   # Specific feature
npm run test:e2e:ui                     # Playwright UI
npm run test:e2e -- --headed            # See browser

# E2E — device platforms (manual-invoke only, never auto-run)
npm run test:e2e:android                # Android emulator
npm run test:e2e:ios-phone              # iPhone simulator
npm run test:e2e:ios-tablet             # iPad simulator
npm run test:e2e:tauri                  # Tauri desktop
npm run test:e2e:all-platforms          # All sequentially

# Visual regression
npm run test:e2e:visual-update          # Regenerate web baselines
npm run test:e2e:android -- --update-snapshots
npm run test:screenshots:ios-phone      # WebdriverIO device-screenshot harness
npm run test:screenshots:ios-tablet
npm run test:screenshots:android

# Setup verification
npm run test:platform:setup             # Check tools, simulators, ports

# Combined
npm run test:all                        # test:unit + test:e2e
```

The `test:e2e` script wraps `bddgen && playwright test` so Gherkin features are converted to spec files at runtime.

## Cross-Platform Test Profiles

Five profiles drive the same step definitions:

| Profile | Device | Driver | Connection |
|---|---|---|---|
| `web-chromium` | Desktop browser | Playwright | Direct launch |
| `android-phone` | Pixel 7 emulator (`Pixel_7_API_34`, API 34, arm64-v8a) | Playwright | ADB port-forward → CDP port `9222` |
| `ios-phone` | iPhone 15 simulator (iOS 17.5) | WebDriverIO + Appium XCUITest | WebView context switch (port `4723`) |
| `ios-tablet` | iPad Air 11-inch (M2) simulator (iOS 17.5) | WebDriverIO + Appium XCUITest | WebView context switch |
| `desktop-tauri` | Tauri macOS app | WebDriverIO + tauri-driver | WebDriver protocol (port `4444`) |

**Config:**
- Defaults: `app/tests/platforms.config.defaults.ts`
- Active config: `app/tests/platforms.config.ts`
- Local overrides (gitignored): `app/tests/platforms.config.local.ts` — copy from defaults to customize simulator names/ports for your machine.

**Server credentials** (for hitting a real ZoneMinder server during e2e) live in `app/.env`:

```bash
ZM_HOST_1=http://your-server:port
ZM_USER_1=admin
ZM_PASSWORD_1=password
```

Loaded by `app/tests/helpers/config.ts` and `app/playwright.config.ts` via `dotenv`.

## Platform Tags

Scenarios are tagged to control which profiles execute them:

| Tag | Meaning |
|---|---|
| `@all` | Run on every platform |
| `@web` | Browser only |
| `@android` | Android only |
| `@ios` | iPhone + iPad |
| `@ios-phone` | iPhone form factor only |
| `@ios-tablet` | iPad form factor only |
| `@tauri` | Tauri desktop only |
| `@visual` | Capture visual-regression screenshot |
| `@native` | Requires Appium (PiP, biometrics, push, native downloads) |

Examples in `app/tests/features/dashboard.feature`:
- `@all` — runs everywhere
- `@ios-phone @android @visual` — phone-only layout check with screenshot
- `@ios-tablet @visual` — tablet layout check
- `@web @tauri` — desktop-only hover preview (no touch)

## Test File Organization

**Unit tests:** Co-located in `__tests__/` next to source.

```
app/src/lib/http.ts
app/src/lib/__tests__/http.test.ts

app/src/hooks/useGo2RTCStream.ts
app/src/hooks/__tests__/useGo2RTCStream.test.ts

app/src/stores/dashboard.ts
app/src/stores/__tests__/...

app/src/components/dashboard/DashboardLayout.tsx
app/src/components/dashboard/__tests__/...
```

**Vitest exclusions** (`app/vitest.config.ts`): `**/node_modules/**`, `**/dist/**`, `**/tests/**` (Playwright dir), `**/*.spec.ts`.

**E2E feature files:** `app/tests/features/*.feature` — Gherkin format only, never raw `.spec.ts`.

```
app/tests/features/
├── dashboard.feature
├── events.feature
├── group-filter.feature
├── kiosk.feature
├── monitor-detail.feature
├── monitors.feature
├── montage.feature
├── profiles.feature
├── settings.feature
└── timeline.feature
```

**Step definitions:** `app/tests/steps/<screen>.steps.ts` — one file per screen, never one monolith.

```
app/tests/steps/
├── common.steps.ts        # Auth, navigation, viewport
├── dashboard.steps.ts
├── events.steps.ts
├── monitors.steps.ts
├── platform.steps.ts      # Cross-platform helpers (visual, overflow)
└── ...                    # one per feature file
```

**Native-only specs (Appium):** `app/tests/native/specs/<feature>.spec.ts` — for flows that require native OS interaction (PiP, biometric auth, push notifications, share sheet, native downloads, app lifecycle).

**Test helpers:** `app/tests/helpers/` — `config.ts` (env), `ios-launcher.ts`, `visual-regression.ts`.

**Generated specs (gitignored):** `app/tests/.features-gen/` — produced by `bddgen` during `test:e2e`.

## Unit Test Structure

Imports come from `vitest` directly:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
```

Pattern from `app/src/lib/__tests__/url-builder.test.ts`:

```typescript
describe('normalizePortalUrl', () => {
  it('adds http:// prefix when protocol is missing', () => {
    expect(normalizePortalUrl('zm.example.com')).toBe('http://zm.example.com');
  });

  it('preserves https:// protocol', () => {
    expect(normalizePortalUrl('https://zm.example.com')).toBe('https://zm.example.com');
  });
});
```

Pattern from `app/src/hooks/__tests__/useGo2RTCStream.test.ts`:

```typescript
describe('useGo2RTCStream', () => {
  let containerElement: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset shared state
  });

  it('plays stream when activated', async () => {
    const { result } = renderHook(() => useGo2RTCStream(...));
    await waitFor(() => expect(result.current.isPlaying).toBe(true));
  });
});
```

What unit tests cover: happy path, edge cases (empty/null/undefined), error paths, state changes, security-critical logic (crypto, auth, URL construction).

## Mocking

**Global setup:** `app/src/tests/setup.ts` (loaded via `vitest.config.ts:setupFiles`).

What's mocked globally:
- `localStorage` — in-memory store implementation
- `WebSocket` — `MockWebSocket` class with async open/close
- `AudioContext` — for notification-sound code
- `@capacitor/core` — `isNativePlatform: () => false`, `getPlatform: () => 'web'`
- `@capacitor/haptics` — all methods stubbed
- `@capacitor/network` — connected wifi by default
- `@capawesome/capacitor-badge`
- `@aparajita/capacitor-biometric-auth`
- `capacitor-barcode-scanner`
- `html5-qrcode`
- `../src/plugins/ssl-trust`

**Per-test mocking pattern** (from `app/src/lib/__tests__/http.test.ts`):

```typescript
vi.mock('@capacitor/core', () => ({
  CapacitorHttp: { request: vi.fn() },
}));

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

vi.mock('../platform', () => ({
  Platform: {
    isNative: false,
    isTauri: false,
    isWeb: true,
    isDev: false,
    shouldUseProxy: false,
  },
}));

vi.mock('../logger', () => ({
  log: { api: vi.fn(), error: vi.fn(), http: vi.fn() },
  LogLevel: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 },
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});
```

**What to mock:**
- External HTTP (mock `fetch`, `CapacitorHttp`, `@tauri-apps/plugin-http`)
- Capacitor plugins
- The `Platform` detector when testing platform-specific branches
- The logger when you don't care about output

**What NOT to mock:**
- The unit under test
- Pure utility functions in the same module being tested
- React Testing Library queries

When adding a new Capacitor plugin, add a mock to `app/src/tests/setup.ts` (rule #14).

## E2E Test Structure (Gherkin BDD)

**Feature file** (`app/tests/features/dashboard.feature`):

```gherkin
Feature: Dashboard Customization
  As a ZoneMinder user
  I want to customize my dashboard with widgets
  So that I can see the information I care about at a glance

  Background:
    Given I am logged into zmNinjaNg
    When I navigate to the "Dashboard" page

  @all
  Scenario: Add a timeline widget and verify it displays data
    When I open the Add Widget dialog
    And I select the "Timeline" widget type
    And I enter widget title "Test Timeline"
    And I click the Add button in the dialog
    Then the widget "Test Timeline" should appear on the dashboard
    And the widget should contain non-empty content

  @ios-phone @android @visual
  Scenario: Phone layout stacks widgets single-column with no overflow
    Given the viewport is mobile size
    When I open the Add Widget dialog
    ...
    And no element should overflow the viewport horizontally
    And the page should match the visual baseline
```

**Step definition** (`app/tests/steps/dashboard.steps.ts`):

```typescript
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { testConfig } from '../helpers/config';

const { When, Then } = createBdd();

let lastWidgetTitle: string;

When('I open the Add Widget dialog', async ({ page }) => {
  const addWidgetBtn = page.getByTestId('add-widget-trigger');
  await expect(addWidgetBtn).toBeVisible({ timeout: testConfig.timeouts.element });
  await addWidgetBtn.click();
  const dialog = page.getByTestId('add-widget-dialog');
  await expect(dialog).toBeVisible({ timeout: testConfig.timeouts.element });
});

Then('the widget {string} should appear on the dashboard', async ({ page }, _title: string) => {
  await expect(page.locator('.react-grid-item').filter({ hasText: lastWidgetTitle }))
    .toBeVisible({ timeout: testConfig.timeouts.element });
});
```

Selectors strongly prefer `page.getByTestId(...)` (matches the `data-testid` rule), with role/text fallbacks for legacy elements.

**Login Background:** `Given I am logged into zmNinjaNg` (in `app/tests/steps/common.steps.ts`) handles the auth flow once per scenario — content-based detection (looks for `app-init-blocker` to disappear, then either the setup form or the authenticated nav).

## Conditional Testing Pattern

For features that depend on dynamic content or optional UI:

```typescript
let actionPerformed = false;

When('I click download if exists', async ({ page }) => {
  const button = page.getByTestId('download-button');
  if (await button.isVisible({ timeout: 1000 })) {
    await button.click();
    actionPerformed = true;
  }
});

Then('I should see progress if started', async ({ page }) => {
  if (!actionPerformed) return;
  await expect(page.getByTestId('progress')).toBeVisible();
});
```

This avoids brittle assumptions about whether a server has data, downloads exist, or groups are configured.

## Visual Regression

Scenarios tagged `@visual` capture screenshots and compare against per-platform baselines.

- Threshold: 0.2% pixel diff
- Baselines: `app/tests/screenshots/<platform>/`
- Generate baselines on first run with `--update-snapshots`
- Web baseline: `npm run test:e2e:visual-update`
- Per-platform: `npm run test:e2e:android -- --update-snapshots`
- Native screenshot harness (WebdriverIO): `wdio.config.device-screenshots.ts` + `npm run test:screenshots:ios-phone|ios-tablet|android` writes to `app/tests/screenshots/devices/`

Common visual scenarios assert both: visual baseline match AND `no element should overflow the viewport horizontally` for phone form factors.

Per project memory: never commit screenshot files without explicit user approval.

## Playwright Configuration Highlights

From `app/playwright.config.ts`:
- `fullyParallel: true`
- `forbidOnly: !!process.env.CI`
- Retries: `2` in CI, `1` locally
- Workers: `1` in CI (serial), unlimited locally
- Reporter: `html`
- Default timeout: `30000` ms
- `baseURL: 'http://localhost:5173'`
- `trace: 'on'` (always-on trace; timeline + screenshot per action)
- `screenshot: 'on'`, `video: 'on-first-retry'`
- Web server: `npm run dev:all` on `http://localhost:5173`, reused if already running
- Chromium launched with `--disable-web-security` and `--disable-features=IsolateOrigins,site-per-process` to allow cross-origin ZoneMinder API access in tests

## Test Timeouts

From `app/tests/helpers/config.ts`:

```typescript
timeouts: {
  transition: 5000,  // page load / route change
  element: 3000,     // wait for an element
  short: 1000,       // brief waits
}
```

From `app/tests/platforms.config.defaults.ts`:

```typescript
timeouts: {
  appLaunch: 30000,
  navigation: 10000,
  element: 5000,
  screenshot: 1000,
  webviewSwitch: 10000,
}
```

## Coverage Thresholds

From `app/vitest.config.ts`:

```typescript
thresholds: {
  lines: 60,
  functions: 60,
  branches: 60,
  statements: 60,
}
```

Excluded: `node_modules/`, `src/tests/`, `**/*.d.ts`, `**/*.config.*`, `**/mockData`, `dist/`.

View HTML coverage report: `npm run test:coverage` then open `app/coverage/index.html`.

## Test-First Workflow

From AGENTS.md:

1. Understand the bug/feature requirement
2. Write a failing test that reproduces the issue
3. Implement the fix/feature
4. Run tests — verify they pass
5. Run full test suite to check for regressions
6. Commit

**Pre-commit checks (in order):**
1. `npm test` — must pass
2. `npx tsc --noEmit` — must pass
3. `npm run build` — must succeed (catches stricter `tsc -b` errors)
4. `npm run test:e2e -- <feature>.feature` — if UI/navigation changed
5. State which tests were run: "Tests verified: npm test ✓, tsc --noEmit ✓, build ✓, test:e2e -- dashboard.feature ✓"

UI changes also require: `data-testid` on new elements, e2e scenarios in a `.feature` file with platform tags, updated visual baselines, all 5 language files updated.

Native plugin changes also require an Appium spec in `app/tests/native/specs/`.

**Per project memory:**
- Device e2e tests (`ios-phone`, `android`, `ios-tablet`, `tauri`) are manual-invoke-only — only `npm run test:e2e` (web) runs in the automated workflow. Never run device e2e from an agent without explicit user request.
- Don't wrap test commands with `rtk` — output compression obscures results.

## Writing Good E2E Scenarios

Ask: "If I were a human QA tester with this feature on 5 devices, what would I check?"

- One scenario per user goal, not per element
- Verify outcomes (data persisted, navigation happened, file downloaded), not just element presence
- Fill forms and verify data persists after refresh or navigation
- Test error states, edge cases, device-specific layout
- Add `@visual` to catch layout regressions
- Never write "check heading is visible" — that tests nothing
- Never mock the thing you're testing
- Use `TestActions` abstraction in steps, not raw Playwright/WebDriverIO calls — keeps steps driver-agnostic

---

*Testing analysis: 2026-04-26*
