# Coding Conventions

**Analysis Date:** 2026-04-26

## Language & Compiler

**TypeScript:**
- Version: `~5.9.3` (`app/package.json`)
- Config: `app/tsconfig.app.json` (extends from `app/tsconfig.json`)
- Strict mode: `"strict": true`
- Additional checks: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `erasableSyntaxOnly`
- `verbatimModuleSyntax: true` — `import type` is required for type-only imports
- Target: `ES2022`, module: `ESNext`, moduleResolution: `bundler`
- JSX: `react-jsx` (no React import needed)
- Build command: `npm run build` (runs `tsc -b && vite build`) — `tsc -b` is stricter than `tsc --noEmit` and catches unused variables/narrowing issues; always run `npm run build` before commits.

**React:**
- Version: `^19.2.0`
- Hooks-only (no class components)
- Function components with named function exports for pages, named arrow function exports for components

## Linting

**Tool:** ESLint flat config (`app/eslint.config.js`)

**Extends:**
- `@eslint/js` recommended
- `typescript-eslint` recommended
- `eslint-plugin-react-hooks` (flat recommended)
- `eslint-plugin-react-refresh` (vite preset)

**Globally ignored:** `dist`, `android`, `ios`, `coverage`, `src-tauri/target`, `node_modules`

**Run:** `npm run lint` (from `app/`)

## Naming Patterns

**Files:**
- React pages and components: `PascalCase.tsx` (e.g., `app/src/pages/Dashboard.tsx`, `app/src/components/monitors/MonitorCard.tsx`)
- Hooks: `useXxx.ts` (e.g., `app/src/hooks/useBandwidthSettings.ts`)
- Lib utilities: `kebab-case.ts` or `camelCase.ts` mixed (e.g., `app/src/lib/url-builder.ts`, `app/src/lib/secureStorage.ts`)
- Stores: `camelCase.ts` (e.g., `app/src/stores/dashboard.ts`)
- Tests: `*.test.ts` next to source in `__tests__/` (e.g., `app/src/lib/__tests__/http.test.ts`)
- E2E features: `kebab-case.feature` in `app/tests/features/`
- Step definitions: `<screen>.steps.ts` in `app/tests/steps/`

**Functions:** `camelCase` (e.g., `formatAppDate`, `getMonitorStreamUrl`)

**Components/Types:** `PascalCase` (e.g., `Dashboard`, `MonitorCard`, `HttpOptions`)

**Constants:** `SCREAMING_SNAKE_CASE` for module-level (e.g., `MIN_ENCRYPTED_BYTES`, `GRID_LAYOUT`)

**Booleans:** `is*`, `has*`, `should*` prefixes (e.g., `isNative`, `isEditing`, `shouldUseProxy`)

**`data-testid`:** kebab-case, descriptive (e.g., `data-testid="dashboard-refresh-button"`, `data-testid="add-widget-trigger"`, `data-testid="widget-type-monitor"`). Required on all interactive elements (rule #13).

## Import Organization

**Observed order:**
1. React/external libraries (`react`, `@tanstack/react-query`, `react-i18next`, `lucide-react`, `zustand`)
2. Local API modules (`../api/...`)
3. Local hooks (`../hooks/...`)
4. Local stores (`../stores/...`)
5. Local components (`../components/...`)
6. Local lib utilities (`../lib/...`)
7. Type-only imports last (`import type { Monitor } from '../api/types';`)

**Path alias:** `@/*` maps to `./src/*` (`app/vitest.config.ts`), but relative imports (`../`, `./`) are the dominant pattern in source code.

**Type imports:** Use `import type { ... }` due to `verbatimModuleSyntax: true`. Example: `import type { DashboardWidget, WidgetType } from '../../stores/dashboard';`

## Mandatory Patterns (from AGENTS.md)

### Logging — never use `console.*`

Use `log.*` component helpers from `app/src/lib/logger.ts` with explicit `LogLevel`.

```typescript
import { log, LogLevel } from '../lib/logger';

log.secureStorage('Value encrypted', LogLevel.DEBUG, { key });
log.profileForm('Testing connection', LogLevel.INFO, { portalUrl });
log.download('Failed to download', LogLevel.ERROR, { url, error });
log.http('Request started', LogLevel.DEBUG, { url, method });
```

Available component helpers (see `logger.ts` lines 251–258): `api`, `app`, `auth`, `crypto`, `dashboard`, `discovery`, `download`, `errorBoundary`, `eventCard`, `eventDetail`, `eventMontage`, `http`, `imageError`, `kiosk`, `monitor`, `monitorCard`, `monitorDetail`, `montageMonitor`, `navigation`, `notificationHandler`, `notifications`, `notificationSettings`, `profile`, `profileForm`, `profileService`, `profileSwitcher`, `push`, `queryCache`, `secureImage`, `secureStorage`, `server`, `sslTrust`, `time`, `timeline`, `videoMarkers`, `videoPlayer`, `zmsEventPlayer`.

The logger automatically sanitizes secrets (passwords, tokens) via `app/src/lib/log-sanitizer.ts` and persists logs to `useLogStore` for in-app display.

### HTTP — never use raw `fetch()` / `axios`

Use abstractions from `app/src/lib/http.ts`:

```typescript
import { httpGet, httpPost, httpPut, httpDelete } from '../lib/http';

const data = await httpGet<MonitorData>('/api/monitors.json');
await httpPost('/api/states/change.json', { monitorId: '1', newState: 'Alert' });
```

Handles platform differences (CapacitorHttp on native, Tauri plugin-http on desktop, fetch on web), CORS proxying, token injection, and request/response logging.

### i18n — never hardcode user-facing strings

```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
<Text>{t('setup.title')}</Text>
toast.error(t('montage.screen_too_small'));
```

Translations: `app/src/locales/{en,de,es,fr,zh}/translation.json`. Setup: `app/src/i18n.ts`. Updates must include all 5 languages (rule #5). Labels must be short on a 320px-wide phone — prefer single-word synonyms (rule #23).

### Profile-scoped settings — never global singletons

Use `getProfileSettings` / `updateProfileSettings` from `app/src/stores/settings.ts`. Each profile has its own settings; do not store user prefs globally (rule #7).

### Bandwidth settings — never hardcode polling intervals

```typescript
import { useBandwidthSettings } from '../hooks/useBandwidthSettings';

const bandwidth = useBandwidthSettings();
const { data } = useQuery({
  queryKey: ['monitors'],
  queryFn: getMonitors,
  refetchInterval: bandwidth.monitorStatusInterval,
});
```

Outside React: `getBandwidthSettings(mode)` from `app/src/lib/zmninja-ng-constants.ts`. New polling properties go on the `BandwidthSettings` interface with both `normal` and `low` (low ≈ 2× slower) values (rule #8).

### Date/time formatting — never hardcode `format(date, 'HH:mm')`

```typescript
// Inside React
import { useDateTimeFormat } from '../hooks/useDateTimeFormat';
const { fmtDate, fmtTime, fmtTimeShort, fmtDateTime, fmtDateTimeShort } = useDateTimeFormat();

// Outside React (services, canvas, renderers)
import { formatAppDate, formatAppTimeShort, type FormatSettings } from '../lib/format-date-time';
formatAppTimeShort(date, settings);
```

Source: `app/src/lib/format-date-time.ts`. Applies user-chosen format from settings (rule #24).

### Capacitor plugins — dynamic imports only

```typescript
// CORRECT
if (Capacitor.isNativePlatform()) {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* not available */ }
}

// WRONG — static import breaks the web bundle
import { Haptics } from '@capacitor/haptics';
```

Static imports of `@capacitor/core` itself are fine (used in `app/src/lib/platform.ts`). Plugin packages must be dynamically imported with platform checks. Match the `@capacitor/core` major version when adding plugins; add a mock in `app/src/tests/setup.ts` (rule #14).

Examples in repo:
- `app/src/components/events/EventMontageView.tsx:77`
- `app/src/hooks/useNotificationDelivered.ts:73,103-104`
- `app/src/components/kiosk/KioskOverlay.tsx:73-75`

### Mobile downloads — never convert to Blob

Use CapacitorHttp base64 directly. Converting large media to a Blob on mobile causes OOM (rule #15). See `app/src/lib/download.ts`.

### Tauri packages — match JS and Rust versions

`@tauri-apps/*` (in `app/package.json`) and `tauri-plugin-*` (in `app/src-tauri/Cargo.toml`) major versions must match (rule #16).

### Platform detection

```typescript
import { Platform } from '../lib/platform';
if (Platform.isNative) { /* iOS/Android via Capacitor */ }
if (Platform.isTauri) { /* Tauri desktop */ }
if (Platform.isWeb) { /* Browser */ }
if (Platform.isDesktopOrWeb) { /* Not mobile */ }
if (Platform.isTVDevice) { /* Android TV / Fire Stick */ }
```

Source: `app/src/lib/platform.ts`. All getters; safe to use across re-renders.

### Text overflow

```tsx
<div className="flex items-center gap-2">
  <span className="truncate min-w-0" title={text}>{text}</span>
</div>
```

`truncate` + `min-w-0` in flex containers; `title` for tooltip on hover. Multi-line: `line-clamp-N`. Examples: `app/src/components/monitors/MonitorCard.tsx:129,265` (rule #11).

## Error Handling

**Patterns observed:**

- Async functions: `try`/`catch` with logger error reporting via `log.<component>('msg', LogLevel.ERROR, { context, error })`. See `app/src/lib/format-date-time.ts:39–44` for fallback-on-error pattern.
- HTTP errors: throw `HttpError` (extends `Error` with `status`, `statusText`, `data`, `headers` fields). Defined in `app/src/lib/http.ts:48–67`.
- Component-level: `app/src/components/ErrorBoundary.tsx` wraps app; `app/src/components/RouteErrorBoundary.tsx` wraps routes.
- Capacitor optional plugins: wrap dynamic import in `try`/`catch` and silently no-op if plugin is unavailable.
- Toast for user-facing errors: `import { toast } from 'sonner'; toast.error(t('...'));`

## React/Component Patterns

- **State management:** Zustand stores in `app/src/stores/`. Use `useShallow` from `zustand/react/shallow` for derived selectors to prevent unnecessary re-renders.
- **Server state:** TanStack Query (`@tanstack/react-query`) with `useQuery` / `useMutation`. Query keys are tuples (e.g., `['monitors']`).
- **Forms:** React Hook Form + Zod resolvers (`@hookform/resolvers`).
- **UI primitives:** Radix UI (`@radix-ui/react-*`) + Tailwind via `class-variance-authority`. Components live in `app/src/components/ui/`.
- **Toasts:** `sonner`.
- **Routing:** `react-router-dom` v7.

## File Size & Modularity

- Target ~400 LOC max per file (rule #12). Extract cohesive blocks to separate modules.
- Prefer DRY but tolerate three similar lines over premature abstraction.
- Delete replaced code completely — no commented-out code or unused files (rule #18).

## Comments

- File-level docblock at top of each module describing purpose and features (e.g., `app/src/lib/http.ts:1–13`, `app/src/lib/logger.ts:1–14`).
- Function-level JSDoc on exported APIs with `@param`, `@returns`, and `@example` where useful (e.g., `app/src/hooks/useBandwidthSettings.ts:13–27`).
- Inline comments explain non-obvious decisions, not what the code does.

## Configuration

- Vite: `app/vite.config.ts`
- Vitest: `app/vitest.config.ts`
- Playwright: `app/playwright.config.ts`
- Capacitor: `app/capacitor.config.ts`
- Tailwind: `app/tailwind.config.js`
- Tauri: `app/src-tauri/`

## Documentation

Update `docs/developer-guide/` in the same session as code changes (rule #4):
- API modules → `07-api-and-data-fetching.rst`
- Components → `05-component-architecture.rst`
- Utilities → `12-shared-services-and-components.rst`
- Hooks → `05-component-architecture.rst` or relevant chapter

User-facing changes update `docs/user-guide/`.

---

*Convention analysis: 2026-04-26*
