# Development Guidelines

## Quick Reference
1. **NO SUPERLATIVES**: Never use "comprehensive", "critical", "major", "robust", "powerful", etc. Plain, factual language only.
2. **Issues First**: Create GitHub issue before implementing features or fixing bugs
3. **Testing**: Write tests first, run and verify pass before commit
4. **Documentation**: Update `docs/developer-guide/` when adding new APIs, components, or utilities
5. **Internationalization**: Update ALL language files (en, de, es, fr, zh)
6. **Cross-platform**: iOS, Android, Desktop, mobile portrait + landscape
7. **Settings**: Profile-scoped only; read/write via `getProfileSettings`/`updateProfileSettings`
8. **Bandwidth**: Polling/refresh features need bandwidth settings support (normal vs. low)
9. **Logging**: Use `log.*` component helpers with explicit LogLevel, never `console.*`
10. **HTTP**: Use `lib/http.ts` abstractions (`httpGet`, `httpPost`, etc.), never raw `fetch()` or `axios`
11. **Text Overflow**: Use `truncate` + `min-w-0` in flex containers; add `title` for tooltips
12. **Coding**: DRY, small files (~400 LOC max), extract complex logic to separate modules
13. **Cross-Platform Tests**: E2E tests run on real devices — Android emulator, iOS simulator (phone + tablet), Tauri desktop, and web browser. See [Testing section](#testing).

---

## Forbidden Actions

- **NEVER USE SUPERLATIVE LANGUAGE** - No "comprehensive", "critical", "major", "robust", "powerful", "extensively", "thoroughly", "excellent", "amazing", "significant", etc. in ANY communication (responses, commits, docs, comments). Use plain, factual descriptions.
- **Never use `console.*`** - use `log.*` component helpers with explicit LogLevel
- **Never use raw `fetch()` or `axios`** - use `app/src/lib/http.ts` abstractions
- **Never convert to Blob on mobile** - use CapacitorHttp base64 directly
- **Never commit without running tests** - unit tests AND e2e tests must pass
- **Never use static imports for Capacitor plugins** - use dynamic imports with platform checks
- **Never claim "build passed" as proof code works** - build only checks types, not behavior
- **Never leave features half-implemented** - complete fully or don't start
- **Never merge to main without user approval** - always request review first
- **Never hardcode user-facing strings** - all text must use i18n
- **Never skip `data-testid` on interactive elements** - required for e2e tests
- **Never implement features/fixes without a GitHub issue** - create issue first, reference in commits
- **Never add new APIs/components without updating docs** - update developer-guide in same session
- **Never update Tauri JS or Rust packages independently** - JS `@tauri-apps/*` and Rust `tauri-plugin-*` versions must match. Update both `package.json` and `Cargo.toml` together.
- **Never check in plan files** - Plans (`.md` files used during feature planning) must not be committed to the repository. Delete plan files once the feature is complete.

---

## Working Directory

All `npm` commands must be run from the `app/` directory.

```bash
cd app
```

Structure:
- `./` - workspace root (contains AGENTS.md, docs/, scripts/)
- `app/` - main application (run npm commands here)
- `app/src/` - source code
- `app/tests/` - e2e test features and helpers

---

## Testing

### Philosophy: Be a Human Tester
Every test must verify what a real human would verify. Sit in front of the device and ask: "Can I accomplish this task? Does this look right? Does the data make sense?"

**Do**:
- Click buttons and verify the outcome (data changed, navigation happened, file downloaded)
- Fill forms and verify data persists after refresh or navigation
- Test on all platforms: Android phone, iOS phone, iOS tablet, Tauri desktop, web browser
- Test error states, edge cases, and device-specific layout behavior
- Add `@visual` screenshots at the end of scenarios to catch layout regressions
- Verify real data (monitor names, event counts, dates) — not just element presence

**Don't**:
- Mock the thing you're testing
- Write "check heading is visible" as a test — that's not testing anything
- Only test that "component renders"
- Write tests that pass but don't verify real behavior
- Skip platform-specific layout checks (phone vs. tablet vs. desktop)

### Test-First Workflow
1. Understand the bug/feature requirement
2. Write a failing test that reproduces the issue
3. Implement the fix/feature
4. Run tests - verify they pass
5. Run full test suite to check for regressions
6. Commit

### Unit Tests
**Location**: Next to source in `__tests__/` subdirectory
- Example: `app/src/lib/crypto.ts` → `app/src/lib/__tests__/crypto.test.ts`

**What to test**: Happy path, edge cases (empty/null/undefined), error cases, state changes

**Run**: `npm test`

### E2E Tests
**When required**: UI changes, navigation changes, interaction changes, new workflows

**Location**: `app/tests/features/*.feature` (Gherkin format, never .spec.ts directly)

**Step definitions**: `app/tests/steps/<screen>.steps.ts` (one file per screen, not one monolith)

**Run**: `npm run test:e2e -- <feature>.feature`

### Cross-Platform E2E Tests
Tests run on 5 platform profiles using two drivers. Playwright drives Chromium-based platforms (web, Android) via CDP. WebDriverIO + Appium drives WebKit-based platforms (iOS, Tauri) via native drivers. A shared `TestActions` abstraction keeps step definitions driver-agnostic.

| Profile | Device | Driver | Connection |
|---|---|---|---|
| `web-chromium` | Desktop browser | Playwright | Direct launch |
| `android-phone` | Pixel 7 Emulator | Playwright | ADB port-forward → CDP |
| `ios-phone` | iPhone 15 Simulator | WebDriverIO + Appium XCUITest | WebView context switch |
| `ios-tablet` | iPad Air Simulator | WebDriverIO + Appium XCUITest | WebView context switch |
| `desktop-tauri` | Tauri macOS app | WebDriverIO + tauri-driver | WebDriver protocol |

### Platform Tags
Use tags in `.feature` files to control which platforms run each scenario:
- `@all` — runs on every platform
- `@android` — Android emulator only
- `@ios` — iPhone + iPad simulators
- `@ios-phone` / `@ios-tablet` — specific iOS form factor
- `@tauri` — Tauri desktop only
- `@web` — browser only
- `@visual` — takes comparison screenshots
- `@native` — requires Appium (native-plugin flows only)

### Test Commands
```bash
# Unit tests
npm test                                # Unit tests
npm test -- --coverage                  # With coverage

# E2E tests (web browser only - fast)
npm run test:e2e                        # All web e2e tests
npm run test:e2e -- <feature>.feature   # Specific feature
npm run test:e2e -- --headed            # See browser

# Cross-platform e2e (requires simulators/emulators)
npm run test:e2e:android                # Android emulator (Playwright via CDP)
npm run test:e2e:ios-phone              # iPhone simulator (WebDriverIO + Appium)
npm run test:e2e:ios-tablet             # iPad simulator (WebDriverIO + Appium)
npm run test:e2e:tauri                  # Tauri desktop (WebDriverIO + tauri-driver)
npm run test:e2e:all-platforms          # All platforms sequentially

# Visual regression
npm run test:e2e:visual-update          # Regenerate all baselines
npm run test:e2e:android -- --update-snapshots  # Platform-specific

# Native-only (Appium)
npm run test:native                     # PiP, biometrics, push, downloads

# Setup verification
npm run test:platform:setup             # Check tools, simulators, ports
```

### Platform Test Configuration
Simulator names, ports, and timeouts are in `app/tests/platforms.config.defaults.ts`. To customize for your machine, copy to `platforms.config.local.ts` (gitignored) and edit.

Server credentials in `.env`:
```bash
ZM_HOST_1=http://your-server:port
ZM_USER_1=admin
ZM_PASSWORD_1=password
```

### Visual Regression
Scenarios tagged `@visual` capture screenshots and compare against per-platform baselines in `app/tests/screenshots/<platform>/`. Threshold: 0.2% pixel diff.

```gherkin
@all @visual
Scenario: Dashboard with widgets
  Given I am logged into zmNinjaNG
  ...
  Then the page should match the visual baseline
```

First run on a new platform: use `--update-snapshots` to generate baselines.

### Extending Tests for New Features

When you add a new feature, ask yourself: "If I were a human QA tester with this feature on 5 devices, what would I check?"

**Step 1: Write the human test plan.** Before writing Gherkin, list what a human would do:
- What actions would they take? (tap, scroll, fill, swipe, toggle)
- What would they verify after each action? (data changed, UI updated, file appeared)
- What looks different on a phone vs. tablet vs. desktop? (columns, layout, overflow)
- What could go wrong? (network error, empty state, slow load)

**Step 2: Write Gherkin scenarios.** One scenario per distinct user goal — not per element.

Bad (testing for the sake of it):
```gherkin
Scenario: View new feature page
  Given I am logged into zmNinjaNG
  When I navigate to the "New Feature" page
  Then I should see the heading "New Feature"
```

Good (testing like a human):
```gherkin
@all @visual
Scenario: Create and verify a new widget
  Given I am logged into zmNinjaNG
  When I navigate to the "Dashboard" page
  And I open the Add Widget dialog
  And I select widget type "My New Widget"
  And I enter the title "Test Widget"
  And I save the widget
  Then the widget "Test Widget" should appear on the dashboard
  And the widget should display real data
  When I refresh the page
  Then the widget "Test Widget" should still be present
  And the page should match the visual baseline

@ios-phone @android
Scenario: New widget adapts to phone layout
  Given I am logged into zmNinjaNG
  When I navigate to the "Dashboard" page
  Then the new widget should not overflow the screen width
  And all widget content should be readable without horizontal scroll
  And the page should match the visual baseline
```

**Step 3: Add platform-specific scenarios when layout differs.** If the feature looks different on phone vs. tablet vs. desktop, add tagged scenarios:
- `@ios-phone @android` for phone-specific layout checks
- `@ios-tablet` for tablet-specific layout checks
- `@tauri` for desktop-specific behavior (resize, keyboard shortcuts)

**Step 4: Add step definitions** to the appropriate `app/tests/steps/<screen>.steps.ts` file. Create a new steps file if adding a new screen. Use `TestActions` interface methods (not raw Playwright or WebDriverIO APIs) so steps work across all drivers. See `app/tests/steps/dashboard.steps.ts` for the pattern.

**Step 5: Add visual baselines.** Run with `--update-snapshots` on each platform to capture baselines, then commit them.

**Step 6: If the feature uses a native plugin** (haptics, filesystem, camera, etc.), add a test to the Appium suite in `app/tests/native/specs/`.

### Extending Tests Checklist
- [ ] Human test plan written (what would a QA tester check on each device?)
- [ ] Gherkin scenarios test user goals, not element presence
- [ ] `@all` tag on scenarios that apply to every platform
- [ ] Device-specific scenarios tagged (`@ios-phone`, `@ios-tablet`, `@android`, `@tauri`)
- [ ] `@visual` tag on scenarios that should capture screenshots
- [ ] Step definitions in per-screen file (not monolith)
- [ ] Visual baselines generated for all platforms
- [ ] Native plugin flows covered in Appium suite if applicable
- [ ] Run `npm run test:e2e` (web) + at least one platform test before committing

### Conditional Testing Pattern
For features depending on dynamic content:
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

### Native-Only Tests (Appium)
For flows that require native OS interaction (not reachable via WebView):

**Location**: `app/tests/native/specs/<feature>.spec.ts`

**When to add**: PiP, biometric auth, push notifications, native file downloads, share sheet, app lifecycle (background/foreground)

**Run**: `npm run test:native`

---

## Verification Workflow

For every code change, execute in order:

1. **Unit Tests**: `npm test` - must PASS
2. **Type Check**: `npx tsc --noEmit`
3. **Build**: `npm run build`
4. **E2E Tests** (if UI/navigation changed): `npm run test:e2e -- <feature>.feature`
5. **Platform Tests** (if layout/rendering changed): run at least one platform test (`npm run test:e2e:android`, `npm run test:e2e:ios-phone`, etc.)
6. **Commit** only after all tests pass

State which tests were run: "Tests verified: npm test ✓, tsc --noEmit ✓, build ✓, test:e2e -- dashboard.feature ✓, test:e2e:ios-phone ✓"

### Pre-Commit Checklist

**All changes**:
- [ ] Tests written/updated
- [ ] `npm test` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds

**UI changes** (additional):
- [ ] `data-testid` added to new elements
- [ ] E2E tests updated in .feature file with platform tags (`@all`, `@ios-phone`, etc.)
- [ ] `npm run test:e2e -- <feature>.feature` passes
- [ ] At least one platform test passes (android, ios-phone, ios-tablet, or tauri)
- [ ] Visual baselines updated if layout changed (`--update-snapshots`)
- [ ] All language files updated

**Native plugin changes** (additional):
- [ ] Appium test added/updated in `app/tests/native/specs/`
- [ ] `npm run test:native` passes

### Never commit if:
- Tests are failing
- Tests don't exist for new functionality
- You haven't actually run the tests
- You only ran build but not unit/e2e tests
- You changed layout but didn't run a platform test
- You wrote a scenario that only checks element presence without interaction

---

## Internationalization

Every user-facing string must be internationalized.

- **Location**: `app/src/locales/{lang}/translation.json`
- **Languages**: en, de, es, fr, zh (update ALL)
- **Usage**:
  ```typescript
  const { t } = useTranslation();
  <Text>{t('setup.title')}</Text>
  toast.error(t('montage.screen_too_small'));
  ```
- **New language**: Follow `.agent/workflows/add_language.md`

---

## UI & Cross-Platform

### Platform Support
- Test on all 5 platform profiles: web-chromium, android-phone, ios-phone, ios-tablet, desktop-tauri
- Run `npm run test:e2e:all-platforms` for full cross-platform verification
- At minimum, run web + one mobile platform test before committing UI changes
- Verify phone portrait layout doesn't overflow or truncate content

### Data Tags
- **Format**: `data-testid="kebab-case-name"`
- **Add to**: All interactive elements and key containers
  ```tsx
  <button data-testid="add-profile-button">
  ```

### Text Overflow
- **Single-line**: `className="truncate"` + `title={text}`
- **Multi-line**: `className="line-clamp-2"`
- **In flex containers**: Add `min-w-0` with truncate
  ```tsx
  <div className="flex items-center gap-2">
    <span className="truncate min-w-0">{text}</span>
  </div>
  ```

---

## Logging

Never use `console.*` - use structured logging.

```typescript
import { log, LogLevel } from '../lib/logger';

// Component-specific helpers (preferred)
log.secureStorage('Value encrypted', LogLevel.DEBUG, { key });
log.profileForm('Testing connection', LogLevel.INFO, { portalUrl });
log.download('Failed to download', LogLevel.ERROR, { url }, error);
```

**Available helpers**: `log.notifications()`, `log.profileService()`, `log.push()`, `log.eventDetail()`, `log.monitorDetail()`, `log.profileForm()`, `log.monitorCard()`, `log.montageMonitor()`, `log.videoPlayer()`, `log.errorBoundary()`, `log.imageError()`, `log.download()`, `log.crypto()`, `log.http()`, `log.navigation()`, `log.secureStorage()`, `log.time()`, `log.discovery()`, `log.dashboard()`, `log.queryCache()`, `log.api()`, `log.auth()`, `log.profile()`, `log.monitor()`

---

## HTTP Requests

Use `lib/http.ts` abstractions - never `fetch()` or `axios` directly.

```typescript
import { httpGet, httpPost, httpPut, httpDelete } from '../lib/http';

const data = await httpGet<MonitorData>('/api/monitors.json');
await httpPost('/api/states/change.json', { monitorId: '1', newState: 'Alert' });
```

The abstraction automatically handles platform differences (Capacitor HTTP on mobile, fetch on web), logging, and authentication.

---

## Background Tasks & Downloads

Use background task store for long-running operations.

```typescript
const taskStore = useBackgroundTasks.getState();
const taskId = taskStore.addTask({
  type: 'download',
  metadata: { title: 'Video.mp4', description: 'Event 12345' },
  cancelFn: () => abortController.abort(),
});
taskStore.updateProgress(taskId, percentage, bytesProcessed);
taskStore.completeTask(taskId);
```

### Mobile Downloads - OOM Prevention
Never convert to Blob on mobile:

```typescript
// Mobile - CapacitorHttp returns base64 directly
const response = await CapacitorHttp.request({ method: 'GET', url, responseType: 'blob' });
const base64Data = response.data as string; // Already base64
await Filesystem.writeFile({ path: filename, data: base64Data, directory: Directory.Documents });
```

---

## Capacitor Native Features

### Dynamic Imports Required
```typescript
// Good - Dynamic import with platform check
if (Capacitor.isNativePlatform()) {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Feature not available
  }
}

// Bad - Static import breaks on web
import { Haptics } from '@capacitor/haptics';
```

### Test Mocks
Add mocks to `app/src/tests/setup.ts`:
```typescript
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: vi.fn().mockResolvedValue(undefined) },
  ImpactStyle: { Heavy: 'Heavy', Medium: 'Medium', Light: 'Light' },
}));
```

### Version Compatibility
Match Capacitor plugin version with `@capacitor/core`:
```bash
npm list @capacitor/core
npm install @capacitor/haptics@7  # Match major version
```

### iOS/Android Native Code
- Capacitor regenerates some files - check before modifying
- Document custom native modifications
- Ensure changes won't be overwritten on regeneration

---

## Adding Dependencies

1. **Check compatibility**:
   ```bash
   npm info <package> peerDependencies
   npm list @capacitor/core  # For Capacitor plugins
   ```

2. **Install**: Match major versions for Capacitor plugins

3. **Tauri plugins**: JS `@tauri-apps/*` and Rust `tauri-plugin-*` must have matching versions. Update both `package.json` and `Cargo.toml` together.

4. **Update test mocks** if needed in `app/src/tests/setup.ts`

5. **Verify**: `npm test && npm run build`

---

## Settings & Data Management

### Profile-Scoped Settings
Settings must be stored under `ProfileSettings` via `getProfileSettings(currentProfile?.id)` and `updateProfileSettings(profileId, ...)`. Never use global singletons.

### Breaking Changes
Detect version/structure changes in stored data. If incompatible, prompt user to reset (don't crash).

---

## Bandwidth Settings

Features that poll or refresh data from the server must respect bandwidth settings to support users on low-bandwidth connections or mobile data.

### When to Use Bandwidth Settings

**Always use bandwidth settings for:**
- API polling intervals (useQuery `refetchInterval`)
- Auto-refresh timers for data fetching
- Background data sync operations
- Periodic status checks

**Examples requiring bandwidth settings:**
- Monitor status polling
- Event count refreshing
- Dashboard widget updates
- Timeline/heatmap data
- Daemon health checks
- Alarm status checking

### Implementation Pattern

```typescript
import { useBandwidthSettings } from '../hooks/useBandwidthSettings';

const bandwidth = useBandwidthSettings();

// Use in React Query
const { data } = useQuery({
  queryKey: ['monitors'],
  queryFn: getMonitors,
  refetchInterval: bandwidth.monitorStatusInterval, // Respects normal vs. low mode
});

// Use in timers
useEffect(() => {
  const interval = setInterval(() => {
    fetchData();
  }, bandwidth.eventsWidgetInterval);
  return () => clearInterval(interval);
}, [bandwidth.eventsWidgetInterval]);
```

### Available Bandwidth Properties

From `useBandwidthSettings()`:
- `monitorStatusInterval` - Monitor status updates
- `alarmStatusInterval` - Alarm state checking
- `consoleEventsInterval` - Event count refreshing
- `eventsWidgetInterval` - Dashboard events widget
- `timelineHeatmapInterval` - Timeline/heatmap data
- `daemonCheckInterval` - Server daemon health
- `snapshotRefreshInterval` - Snapshot image refresh
- `imageScale` - Image scaling percentage
- `imageQuality` - Image quality percentage
- `streamMaxFps` - Maximum stream FPS

### Adding New Bandwidth Properties

If adding a new polling/refresh feature:

1. **Add to BandwidthSettings type** in `lib/zmninja-ng-constants.ts`:
   ```typescript
   export interface BandwidthSettings {
     // ... existing properties
     myNewFeatureInterval: number; // Description
   }
   ```

2. **Add values for both modes**:
   ```typescript
   export const BANDWIDTH_SETTINGS: Record<BandwidthMode, BandwidthSettings> = {
     normal: {
       // ... existing settings
       myNewFeatureInterval: 30000, // 30 sec
     },
     low: {
       // ... existing settings
       myNewFeatureInterval: 60000, // 60 sec (2x slower for low bandwidth)
     },
   };
   ```

3. **Use in your component** via `useBandwidthSettings()`

### Quick Check

**Before implementing any feature that polls or auto-refreshes:**
- Does it fetch data from the server repeatedly?
- Does it run on a timer or interval?
- Could it consume significant bandwidth over time?

If yes to any → Use bandwidth settings!

---

## Documentation

### When to Update Developer Docs
Update `docs/developer-guide/` when adding:
- New API modules (`api/*.ts`) → Update `07-api-and-data-fetching.rst`
- New components (`components/*.tsx`) → Update `05-component-architecture.rst`
- New utilities (`lib/*.ts`) → Update `12-shared-services-and-components.rst`
- New hooks (`hooks/*.ts`) → Update `05-component-architecture.rst` or relevant chapter

### What to Document
- Purpose and usage examples
- Key functions/props with brief descriptions
- Integration patterns (how it connects to existing code)
- Any gotchas or platform-specific behavior

### Documentation Timing
Update docs in the same session as the code change, not as a separate task.

---

## Code Quality

### Keep It Simple
- DRY, modular code
- Three similar lines > premature abstraction
- Don't over-engineer

### Keep It Small
- Target ~400 LOC max per file
- Extract cohesive blocks to separate modules

### Remove Legacy Code
- Delete old code completely when replacing functionality
- Don't leave unused files or commented code

### Get User Approval Early
For complex features with multiple approaches, UX changes, or architectural decisions: present options and get approval before implementing.

---

## Feature Development & Commits

### When to Create GitHub Issues
**Always create a GitHub issue for:**
- New user-facing functionality (screens, buttons, workflows)
- New API integrations (endpoints, data types)
- Bug fixes (describe the bug, reproduction steps, expected behavior)
- Architectural changes (new stores, new patterns)

**Commit directly to main (no issue needed) for:**
- Documentation-only updates
- Refactoring without behavior change (same functionality, cleaner code)
- Test additions for existing, working code
- Dependency updates

### Workflow
1. **Create GitHub Issue first:**
   - Features: `gh issue create --title "feat: Description" --body "..." --label "enhancement"`
   - Bugs: `gh issue create --title "fix: Description" --body "Bug: ...\nSteps to reproduce: ...\nExpected: ..." --label "bug"`
2. Create branch: `git checkout -b feature/<short-description>`. Don't create a branch for bug fixes.
3. Implement with tests
4. Request user approval before merging
5. Tag all commits to the issue: `refs #<id>`
6. Use `fixes #<id>` in final commit to auto-close the issue after user confirms that the fix is working. DO NOT close issues automatically

### Commit Guidelines
- Detailed, descriptive messages (no vague summaries)
- One logical change per commit
- No superlative language (see Forbidden Actions)
- Use conventional format: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`

**Examples**:
- `fix: resolve overflow issue in flex containers`
- `feat: add haptic feedback to buttons`

### Issue References
- `refs #<id>` for references
- `fixes #<id>` to close issues

---

## Quick Decision Trees

**Adding a Feature?**
→ Create GitHub issue first, then: create feature branch, implement, test, update docs, reference issue in commits, update developer docs if needed

**Fixing a Bug?**
→ Create GitHub issue (describe bug + repro steps), write reproduction test, fix, verify test passes

**Adding UI?**
→ Need: `data-testid`, e2e test in .feature file with platform tags, human-tester scenarios (not just "element visible"), i18n keys in ALL languages, visual baselines on each platform, text overflow handling

**Adding New API Module?**
→ Create in `api/`, update `docs/developer-guide/07-api-and-data-fetching.rst`

**Adding New Component?**
→ Create in `components/`, update `docs/developer-guide/05-component-architecture.rst`

**Adding New Utility?**
→ Create in `lib/`, update `docs/developer-guide/12-shared-services-and-components.rst`

**Adding HTTP Request?**
→ Use `httpGet`/`httpPost`/`httpPut`/`httpDelete` from `lib/http.ts`

**Adding Logging?**
→ Use `log.componentName(message, LogLevel.X, details)`

**Adding Capacitor Plugin?**
→ Match `@capacitor/core` version, add mock to setup.ts, use dynamic imports

**Adding User-Facing Text?**
→ Add i18n key to ALL translation files (en, de, es, fr, zh)

**Mobile Download?**
→ Use CapacitorHttp base64 directly, never convert to Blob

**Adding Polling/Auto-Refresh Feature?**
→ Use `useBandwidthSettings()` and appropriate interval property (e.g., `monitorStatusInterval`, `consoleEventsInterval`). If no matching property exists, add to `lib/zmninja-ng-constants.ts` with values for both normal and low modes.

**Adding a New Screen/Page?**
→ Create `.feature` file in `app/tests/features/`, step definitions in `app/tests/steps/<screen>.steps.ts`, write human-tester scenarios (what would a QA person do on each device?), tag with `@all` + device-specific tags, add `@visual` for layout verification, generate visual baselines on all platforms.

**Using a Native Plugin?**
→ Dynamic import with platform check, add unit test mock to `setup.ts`, add Appium test in `app/tests/native/specs/` for the native flow.

---

## AI Agent Pitfalls

1. **Using superlative language** - NEVER use "comprehensive", "critical", "major", "robust", "powerful", etc. in responses, commits, docs, or code comments. Use plain, factual descriptions.
2. **Claiming success without verification** - Always run `npm test` AND relevant e2e tests
3. **Skipping tests for "simple" changes** - All changes need test verification
4. **Batching unrelated changes** - Split into separate commits
5. **Using wrong working directory** - All npm commands from `app/`
6. **Partial i18n updates** - Add to ALL language files
7. **Static Capacitor imports** - Use dynamic imports with platform check
8. **Forgetting data-testid** - All interactive elements need test selectors
9. **Not reading error output** - Analyze why tests failed, fix systematically
10. **Implementing without GitHub issue** - Create issue first for features and bugs
11. **Forgetting documentation updates** - Update developer-guide when adding APIs/components
12. **Hardcoding polling intervals** - Use `useBandwidthSettings()` for all polling/auto-refresh features
13. **Writing shallow E2E tests** - Never write "element is visible" as a test. Every scenario must include user interaction and verification of outcomes. Ask: "Would a human QA tester consider this tested?"
14. **Skipping platform-specific tests** - UI changes must be tested on at least one real platform (android, ios-phone, ios-tablet, or tauri), not just web browser viewport emulation
15. **Forgetting visual baselines** - Layout changes require updating screenshot baselines on all affected platforms
16. **Monolith step definitions** - Step definitions go in per-screen files (`app/tests/steps/<screen>.steps.ts`), not one giant file

