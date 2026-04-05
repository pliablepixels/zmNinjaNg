# Multi-Server Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route per-monitor API calls, streaming URLs, and portal URLs to the correct ZoneMinder server in multi-server setups, while maintaining zero behavior change for single-server setups.

**Architecture:** Fetch `/servers.json` and `/storages.json` at bootstrap. Build a ServerId-to-URLs map. Enrich each monitor with resolved `recordingUrl`, `portalPath`, and `apiBaseUrl` based on its `ServerId`. All downstream code uses these resolved URLs instead of the profile's defaults. When no servers exist or a monitor has no `ServerId`, fall back to profile URLs.

**Tech Stack:** TypeScript, Zod, React, TanStack Query, Zustand, Vitest

---

## File Structure

| File | Responsibility |
|---|---|
| **Create:** `app/src/lib/server-resolver.ts` | Build ServerId-to-URLs map, resolve per-monitor URLs |
| **Create:** `app/src/lib/__tests__/server-resolver.test.ts` | Tests for server resolver |
| **Create:** `app/src/hooks/useServerUrls.ts` | React hook wrapping server resolver for components |
| **Modify:** `app/src/api/server.ts` | Extend ServerSchema, add StorageSchema, add `getStorages()` |
| **Modify:** `app/src/api/__tests__/server.test.ts` | Tests for new schema fields and `getStorages()` |
| **Modify:** `app/src/api/monitors.ts` | Add optional `apiBaseUrl` param to daemon/alarm functions |
| **Modify:** `app/src/api/__tests__/monitors.test.ts` | Tests for `apiBaseUrl` routing |
| **Modify:** `app/src/stores/profile-bootstrap.ts` | Initialize server resolver after auth |
| **Modify:** `app/src/hooks/useMonitorStream.ts` | Use resolved `recordingUrl` and `portalPath` |
| **Modify:** `app/src/hooks/useStreamLifecycle.ts` | Accept and use resolved `portalPath` |
| **Modify:** `app/src/components/video/VideoPlayer.tsx` | Resolve go2rtcUrl per monitor |
| **Modify:** `app/src/components/monitors/MontageMonitor.tsx` | Use resolved `portalPath` |
| **Modify:** `app/src/pages/hooks/useAlarmControl.ts` | Pass resolved `apiBaseUrl` |
| **Modify:** `app/src/pages/hooks/usePTZControl.ts` | Use resolved `portalPath` |
| **Modify:** `app/src/pages/MonitorDetail.tsx` | Pass resolved URLs to PTZ and alarm hooks |
| **Modify:** `app/src/pages/EventDetail.tsx` | Use resolved `portalPath`/`recordingUrl` for event monitor |
| **Modify:** `app/src/pages/Events.tsx` | Pass resolved `portalPath` to event list/montage views |
| **Modify:** `app/src/pages/EventMontage.tsx` | Pass resolved `portalPath` to event montage view |
| **Modify:** `app/src/components/events/ZmsEventPlayer.tsx` | Use resolved `recordingUrl` and `portalPath` |
| **Modify:** `app/src/components/events/EventListView.tsx` | Use resolved `portalPath` per event |
| **Modify:** `app/src/components/events/EventMontageView.tsx` | Use resolved `portalPath` per event |
| **Modify:** `app/src/components/timeline/TimelineScrubber.tsx` | Use resolved `portalPath` per event |
| **Modify:** `app/src/components/timeline/EventPreviewPopover.tsx` | Use resolved `portalPath` per event |
| **Modify:** `app/src/services/eventPoller.ts` | Use resolved `portalPath` for event notifications |
| **Modify:** `app/src/lib/download.ts` | Use resolved `portalPath` for event downloads |
| **Modify:** `app/src/pages/Server.tsx` | Show all servers, per-server health stats, storage info |
| **Modify:** `app/src/locales/{en,de,es,fr,zh}/translation.json` | New i18n keys for multi-server UI |

---

### Task 1: Extend ServerSchema and add StorageSchema

**Files:**
- Modify: `app/src/api/server.ts:16-25`
- Modify: `app/src/api/__tests__/server.test.ts`

- [ ] **Step 1: Write the failing tests**

In `app/src/api/__tests__/server.test.ts`, add tests for the new fields and `getStorages()`:

```typescript
it('parses server routing fields', async () => {
  mockGet.mockResolvedValue({
    data: {
      servers: [{
        Id: '2',
        Name: 'pseudo',
        Protocol: 'https',
        Hostname: 'pseudo.example.com',
        Port: 443,
        PathToIndex: '/zm/index.php',
        PathToZMS: '/cgi-bin/nph-zms',
        PathToApi: '/api',
        Status: 'Running',
        CpuLoad: 1.1,
        TotalMem: 33322881024,
        FreeMem: 17571549184,
      }],
    },
  });

  const servers = await getServers();

  expect(servers[0].Protocol).toBe('https');
  expect(servers[0].Port).toBe(443);
  expect(servers[0].PathToIndex).toBe('/zm/index.php');
  expect(servers[0].PathToZMS).toBe('/cgi-bin/nph-zms');
  expect(servers[0].PathToApi).toBe('/api');
});

it('returns storage list', async () => {
  mockGet.mockResolvedValue({
    data: {
      storage: [{
        Storage: {
          Id: '15',
          Path: '/media/unicron/zm/events',
          Name: 'zm',
          Type: 'local',
          ServerId: '13',
          Enabled: true,
          DiskTotalSpace: 5951063719936,
          DiskUsedSpace: 5254257319936,
        },
      }],
    },
  });

  const storages = await getStorages();

  expect(mockGet).toHaveBeenCalledWith('/storage.json');
  expect(storages).toHaveLength(1);
  expect(storages[0].ServerId).toBe('13');
  expect(storages[0].Name).toBe('zm');
});

it('handles empty storage response', async () => {
  mockGet.mockResolvedValue({
    data: { storage: [] },
  });

  const storages = await getStorages();
  expect(storages).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- --run server.test`
Expected: FAIL — missing fields on Server type, `getStorages` not exported

- [ ] **Step 3: Extend ServerSchema and add StorageSchema**

In `app/src/api/server.ts`, replace the existing `ServerSchema` (lines 16-25) and add storage types:

```typescript
const ServerSchema = z.object({
  Id: z.coerce.string(),
  Name: z.string(),
  Protocol: z.string().optional(),
  Hostname: z.string().optional(),
  Port: z.coerce.number().optional(),
  PathToIndex: z.string().optional(),
  PathToZMS: z.string().optional(),
  PathToApi: z.string().optional(),
  State_Id: z.coerce.number().optional(),
  Status: z.string().optional(),
  CpuLoad: z.coerce.number().optional(),
  CpuUserPercent: z.coerce.number().optional(),
  CpuSystemPercent: z.coerce.number().optional(),
  CpuIdlePercent: z.coerce.number().optional(),
  CpuUsagePercent: z.coerce.number().optional(),
  TotalMem: z.coerce.number().optional(),
  FreeMem: z.coerce.number().optional(),
  TotalSwap: z.coerce.number().optional(),
  FreeSwap: z.coerce.number().optional(),
  zmstats: z.boolean().optional(),
  zmaudit: z.boolean().optional(),
  zmtrigger: z.boolean().optional(),
  zmeventnotification: z.boolean().optional(),
});

const StorageSchema = z.object({
  Id: z.coerce.string(),
  Path: z.string().nullable(),
  Name: z.string(),
  Type: z.string(),
  Url: z.string().nullable(),
  DiskSpace: z.coerce.number().nullable(),
  Scheme: z.string().nullable(),
  ServerId: z.coerce.string().nullable(),
  DoDelete: z.coerce.boolean().optional(),
  Enabled: z.coerce.boolean().optional(),
  DiskTotalSpace: z.coerce.number().nullable(),
  DiskUsedSpace: z.coerce.number().nullable(),
});

const StoragesResponseSchema = z.object({
  storage: z.array(z.object({ Storage: StorageSchema })),
});
```

Add the type exports:

```typescript
export type Storage = z.infer<typeof StorageSchema>;
```

Add the API function:

```typescript
/**
 * Get all storage areas
 *
 * Fetches storage configuration including disk usage per storage area.
 * Each storage has a ServerId linking it to a server (for multi-server setups).
 *
 * @returns Promise resolving to array of Storage objects
 */
export async function getStorages(): Promise<Storage[]> {
  const client = getApiClient();
  const response = await client.get('/storage.json');

  const validated = validateApiResponse(StoragesResponseSchema, response.data, {
    endpoint: '/storage.json',
    method: 'GET',
  });

  return validated.storage.map((s) => s.Storage);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- --run server.test`
Expected: PASS

- [ ] **Step 5: Run type check**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add app/src/api/server.ts app/src/api/__tests__/server.test.ts
git commit -m "feat: extend ServerSchema with routing fields, add StorageSchema and getStorages

refs #TBD"
```

---

### Task 2: Server resolver — build ServerId-to-URLs map

**Files:**
- Create: `app/src/lib/server-resolver.ts`
- Create: `app/src/lib/__tests__/server-resolver.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/src/lib/__tests__/server-resolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildServerMap,
  resolveMonitorUrls,
  type ServerUrlMap,
} from '../server-resolver';
import type { Server } from '../../api/server';

const pseudoServer: Server = {
  Id: '2',
  Name: 'pseudo',
  Protocol: 'https',
  Hostname: 'pseudo.example.com',
  Port: 443,
  PathToIndex: '/zm/index.php',
  PathToZMS: '/cgi-bin/nph-zms',
  PathToApi: '/api',
};

const firewall2Server: Server = {
  Id: '6',
  Name: 'firewall2',
  Protocol: 'https',
  Hostname: 'zm.example.com',
  Port: 443,
  PathToIndex: '/index.php',
  PathToZMS: '/zm/cgi-bin/nph-zms',
  PathToApi: '/api',
};

const tikipiServer: Server = {
  Id: '12',
  Name: 'tikipi',
  Protocol: 'https',
  Hostname: 'tikipi.example.com',
  Port: 80,
  PathToIndex: '/index.php',
  PathToZMS: '/cgi-bin/nph-zms',
  PathToApi: '/zm/api',
};

const profileDefaults = {
  portalUrl: 'https://zm.example.com',
  cgiUrl: 'https://zm.example.com/zm/cgi-bin/nph-zms',
  apiUrl: 'https://zm.example.com/api',
  go2rtcUrl: 'https://zm.example.com:1984',
};

describe('buildServerMap', () => {
  it('builds map from server list', () => {
    const map = buildServerMap([pseudoServer, firewall2Server, tikipiServer]);

    expect(map.size).toBe(3);
    expect(map.get('2')).toEqual({
      recordingUrl: 'https://pseudo.example.com:443/cgi-bin/nph-zms',
      portalPath: 'https://pseudo.example.com:443/zm/index.php',
      apiBaseUrl: 'https://pseudo.example.com:443/api',
    });
    expect(map.get('12')).toEqual({
      recordingUrl: 'https://tikipi.example.com:80/cgi-bin/nph-zms',
      portalPath: 'https://tikipi.example.com:80/index.php',
      apiBaseUrl: 'https://tikipi.example.com:80/zm/api',
    });
  });

  it('returns empty map for empty server list', () => {
    const map = buildServerMap([]);
    expect(map.size).toBe(0);
  });

  it('skips servers missing Hostname', () => {
    const incomplete: Server = { Id: '99', Name: 'broken' };
    const map = buildServerMap([incomplete]);
    expect(map.size).toBe(0);
  });

  it('defaults Protocol to https and Port to 443 when missing', () => {
    const minimal: Server = {
      Id: '10',
      Name: 'minimal',
      Hostname: 'minimal.example.com',
      PathToIndex: '/index.php',
      PathToZMS: '/cgi-bin/nph-zms',
      PathToApi: '/api',
    };
    const map = buildServerMap([minimal]);
    expect(map.get('10')?.recordingUrl).toBe('https://minimal.example.com:443/cgi-bin/nph-zms');
  });
});

describe('resolveMonitorUrls', () => {
  const serverMap = buildServerMap([pseudoServer, firewall2Server]);

  it('resolves URLs for a monitor with a matching ServerId', () => {
    const urls = resolveMonitorUrls('2', serverMap, profileDefaults);

    expect(urls.recordingUrl).toBe('https://pseudo.example.com:443/cgi-bin/nph-zms');
    expect(urls.portalPath).toBe('https://pseudo.example.com:443/zm/index.php');
    expect(urls.apiBaseUrl).toBe('https://pseudo.example.com:443/api');
    expect(urls.isMultiServer).toBe(true);
  });

  it('falls back to profile defaults when ServerId is null', () => {
    const urls = resolveMonitorUrls(null, serverMap, profileDefaults);

    expect(urls.recordingUrl).toBe(profileDefaults.cgiUrl);
    expect(urls.portalPath).toBe(profileDefaults.portalUrl + '/index.php');
    expect(urls.apiBaseUrl).toBe(profileDefaults.apiUrl);
    expect(urls.isMultiServer).toBe(false);
  });

  it('falls back to profile defaults when ServerId not in map', () => {
    const urls = resolveMonitorUrls('999', serverMap, profileDefaults);

    expect(urls.recordingUrl).toBe(profileDefaults.cgiUrl);
    expect(urls.isMultiServer).toBe(false);
  });

  it('falls back to profile defaults when server map is empty', () => {
    const emptyMap: ServerUrlMap = new Map();
    const urls = resolveMonitorUrls('2', emptyMap, profileDefaults);

    expect(urls.recordingUrl).toBe(profileDefaults.cgiUrl);
    expect(urls.isMultiServer).toBe(false);
  });

  it('falls back to profile defaults when ServerId is "0"', () => {
    const urls = resolveMonitorUrls('0', serverMap, profileDefaults);

    expect(urls.recordingUrl).toBe(profileDefaults.cgiUrl);
    expect(urls.isMultiServer).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- --run server-resolver.test`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the server resolver**

Create `app/src/lib/server-resolver.ts`:

```typescript
/**
 * Server Resolver
 *
 * Maps ZoneMinder ServerId values to per-server URLs for multi-server routing.
 * Single-server setups produce an empty map, and all lookups fall back to
 * profile defaults — zero behavior change.
 */

import type { Server } from '../api/server';
import { log, LogLevel } from './logger';

export interface ServerUrls {
  /** ZMS streaming URL: Protocol://Hostname:Port/PathToZMS */
  recordingUrl: string;
  /** Portal URL with index.php: Protocol://Hostname:Port/PathToIndex */
  portalPath: string;
  /** API base URL: Protocol://Hostname:Port/PathToApi */
  apiBaseUrl: string;
}

export interface ResolvedMonitorUrls extends ServerUrls {
  /** True when the monitor resolved to a different server than the profile default */
  isMultiServer: boolean;
}

export type ServerUrlMap = Map<string, ServerUrls>;

interface ProfileDefaults {
  portalUrl: string;
  cgiUrl: string;
  apiUrl: string;
  go2rtcUrl?: string;
}

/**
 * Build a ServerId → ServerUrls map from the servers list.
 * Servers missing a Hostname are skipped (can't route to them).
 */
export function buildServerMap(servers: Server[]): ServerUrlMap {
  const map: ServerUrlMap = new Map();

  for (const server of servers) {
    if (!server.Hostname) continue;

    const protocol = server.Protocol || 'https';
    const port = server.Port ?? 443;
    const base = `${protocol}://${server.Hostname}:${port}`;

    const urls: ServerUrls = {
      recordingUrl: `${base}${server.PathToZMS || '/cgi-bin/nph-zms'}`,
      portalPath: `${base}${server.PathToIndex || '/index.php'}`,
      apiBaseUrl: `${base}${server.PathToApi || '/api'}`,
    };

    map.set(server.Id, urls);

    log.http(`Multi-server: mapped server ${server.Name} (${server.Id})`, LogLevel.DEBUG, {
      hostname: server.Hostname,
      recordingUrl: urls.recordingUrl,
      portalPath: urls.portalPath,
      apiBaseUrl: urls.apiBaseUrl,
    });
  }

  return map;
}

/**
 * Resolve per-monitor URLs from ServerId.
 * Falls back to profile defaults when:
 * - ServerId is null, undefined, or "0"
 * - ServerId not found in the map
 * - Map is empty (single-server setup)
 */
export function resolveMonitorUrls(
  serverId: string | null | undefined,
  serverMap: ServerUrlMap,
  defaults: ProfileDefaults
): ResolvedMonitorUrls {
  const fallback: ResolvedMonitorUrls = {
    recordingUrl: defaults.cgiUrl,
    portalPath: defaults.portalUrl + '/index.php',
    apiBaseUrl: defaults.apiUrl,
    isMultiServer: false,
  };

  if (!serverId || serverId === '0' || serverMap.size === 0) {
    return fallback;
  }

  const serverUrls = serverMap.get(serverId);
  if (!serverUrls) {
    return fallback;
  }

  return {
    ...serverUrls,
    isMultiServer: true,
  };
}

// ========== Module-level cache ==========

let cachedServerMap: ServerUrlMap = new Map();

export function setServerMap(map: ServerUrlMap): void {
  cachedServerMap = map;
}

export function getServerMap(): ServerUrlMap {
  return cachedServerMap;
}

export function clearServerMap(): void {
  cachedServerMap = new Map();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- --run server-resolver.test`
Expected: PASS

- [ ] **Step 5: Run type check**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/server-resolver.ts app/src/lib/__tests__/server-resolver.test.ts
git commit -m "feat: add server resolver for multi-server URL routing"
```

---

### Task 3: React hook for resolved URLs

**Files:**
- Create: `app/src/hooks/useServerUrls.ts`

- [ ] **Step 1: Create the hook**

Create `app/src/hooks/useServerUrls.ts`:

```typescript
/**
 * Hook to resolve per-monitor URLs for multi-server setups.
 *
 * Returns the correct recordingUrl, portalPath, and apiBaseUrl for a
 * given monitor's ServerId. Falls back to profile defaults for
 * single-server setups or when ServerId is null.
 */

import { useMemo } from 'react';
import { useCurrentProfile } from './useCurrentProfile';
import { resolveMonitorUrls, getServerMap, type ResolvedMonitorUrls } from '../lib/server-resolver';

/**
 * Resolve per-monitor server URLs.
 *
 * @param serverId - The monitor's ServerId (from Monitor.ServerId)
 * @returns Resolved URLs for streaming, portal, and API access
 */
export function useServerUrls(serverId: string | null | undefined): ResolvedMonitorUrls {
  const { currentProfile } = useCurrentProfile();

  return useMemo(() => {
    if (!currentProfile) {
      return {
        recordingUrl: '',
        portalPath: '',
        apiBaseUrl: '',
        isMultiServer: false,
      };
    }

    return resolveMonitorUrls(serverId, getServerMap(), {
      portalUrl: currentProfile.portalUrl,
      cgiUrl: currentProfile.cgiUrl,
      apiUrl: currentProfile.apiUrl,
      go2rtcUrl: currentProfile.go2rtcUrl,
    });
  }, [serverId, currentProfile]);
}
```

- [ ] **Step 2: Run type check**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/src/hooks/useServerUrls.ts
git commit -m "feat: add useServerUrls hook for multi-server URL resolution"
```

---

### Task 4: Initialize server resolver at bootstrap

**Files:**
- Modify: `app/src/stores/profile-bootstrap.ts:258-269`

- [ ] **Step 1: Add bootstrap function for server map**

In `app/src/stores/profile-bootstrap.ts`, add a new bootstrap function before `performBootstrap`:

```typescript
/**
 * Bootstrap multi-server map from /servers.json
 */
export async function bootstrapServerMap(): Promise<void> {
  try {
    const { getServers } = await import('../api/server');
    const { buildServerMap, setServerMap } = await import('../lib/server-resolver');

    log.profileService('Fetching server list for multi-server routing', LogLevel.DEBUG);
    const servers = await getServers();

    if (servers.length === 0) {
      log.profileService('No servers returned, single-server mode', LogLevel.DEBUG);
      return;
    }

    const serverMap = buildServerMap(servers);
    setServerMap(serverMap);

    log.profileService('Multi-server map initialized', LogLevel.INFO, {
      serverCount: servers.length,
      mappedCount: serverMap.size,
    });
  } catch (error) {
    log.profileService('Failed to fetch servers, single-server fallback', LogLevel.WARN, {
      error,
    });
  }
}
```

- [ ] **Step 2: Call it in performBootstrap**

In the `performBootstrap` function, add the call after `bootstrapAuth` (auth must complete first so the token is available):

```typescript
export async function performBootstrap(
  profile: Profile,
  context: BootstrapContext
): Promise<void> {
  await bootstrapSSLTrust(profile);
  await bootstrapAuth(profile, context);
  await bootstrapServerMap();
  await bootstrapTimezone(profile, context);
  await bootstrapZmsPath(profile, context);
  await bootstrapGo2RTCPath(profile, context);
  await bootstrapMultiPortStreaming(profile, context);
}
```

- [ ] **Step 3: Clear server map on profile switch**

In `app/src/stores/profile-bootstrap.ts`, import `clearServerMap` and clear it at the top of `performBootstrap` to ensure stale maps don't carry over between profiles:

Add to the top of `performBootstrap`, before `bootstrapSSLTrust`:

```typescript
const { clearServerMap } = await import('../lib/server-resolver');
clearServerMap();
```

- [ ] **Step 4: Run type check and tests**

Run: `cd app && npx tsc --noEmit && npm test -- --run`
Expected: No errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add app/src/stores/profile-bootstrap.ts
git commit -m "feat: initialize server resolver map at profile bootstrap"
```

---

### Task 5: Add apiBaseUrl routing to per-monitor API functions

**Files:**
- Modify: `app/src/api/monitors.ts:182-274`
- Modify: `app/src/api/__tests__/monitors.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `app/src/api/__tests__/monitors.test.ts`:

```typescript
it('routes triggerAlarm to alternate server when apiBaseUrl provided', async () => {
  mockGet.mockResolvedValue({
    data: { status: 'ok', output: 'Command sent' },
  });

  await triggerAlarm('5', 'https://pseudo.example.com/api');

  expect(mockGet).toHaveBeenCalledWith(
    '/monitors/alarm/id:5/command:on.json',
    { baseURL: 'https://pseudo.example.com/api' }
  );
});

it('routes cancelAlarm to alternate server when apiBaseUrl provided', async () => {
  mockGet.mockResolvedValue({
    data: { status: 'ok', output: 'Command sent' },
  });

  await cancelAlarm('5', 'https://pseudo.example.com/api');

  expect(mockGet).toHaveBeenCalledWith(
    '/monitors/alarm/id:5/command:off.json',
    { baseURL: 'https://pseudo.example.com/api' }
  );
});

it('routes getAlarmStatus to alternate server when apiBaseUrl provided', async () => {
  mockGet.mockResolvedValue({ data: { status: 'on' } });

  await getAlarmStatus('6', 'https://pseudo.example.com/api');

  expect(mockGet).toHaveBeenCalledWith(
    '/monitors/alarm/id:6/command:status.json',
    { baseURL: 'https://pseudo.example.com/api' }
  );
});

it('routes getDaemonStatus to alternate server when apiBaseUrl provided', async () => {
  mockGet.mockResolvedValue({
    data: { status: 'ok', statustext: 'running' },
  });

  await getDaemonStatus('7', 'zmc', 'https://pseudo.example.com/api');

  expect(mockGet).toHaveBeenCalledWith(
    '/monitors/daemonStatus/id:7/daemon:zmc.json',
    { baseURL: 'https://pseudo.example.com/api' }
  );
});

it('uses default client baseURL when apiBaseUrl is undefined', async () => {
  mockGet.mockResolvedValue({
    data: { status: 'ok', statustext: 'running' },
  });

  await getDaemonStatus('7', 'zmc');

  expect(mockGet).toHaveBeenCalledWith(
    '/monitors/daemonStatus/id:7/daemon:zmc.json',
    undefined
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- --run monitors.test`
Expected: FAIL — functions don't accept the extra parameter yet

- [ ] **Step 3: Add apiBaseUrl parameter to the four functions**

In `app/src/api/monitors.ts`, update each function signature to accept an optional `apiBaseUrl` and pass it as `{ baseURL }` to `client.get`:

```typescript
export async function triggerAlarm(monitorId: string, apiBaseUrl?: string): Promise<void> {
  log.api('Triggering monitor alarm', LogLevel.INFO, { monitorId, apiBaseUrl });

  const client = getApiClient();
  const config = apiBaseUrl ? { baseURL: apiBaseUrl } : undefined;
  const response = await client.get(
    `/monitors/alarm/id:${monitorId}/command:on.json`,
    config
  );

  const validated = validateApiResponse(AlarmStatusResponseSchema, response.data, {
    endpoint: `/monitors/alarm/id:${monitorId}/command:on.json`,
    method: 'GET',
  });

  if (validated.status === 'false' && validated.error) {
    throw new Error(`Failed to trigger alarm: ${validated.error} (code: ${validated.code})`);
  }
}

export async function cancelAlarm(monitorId: string, apiBaseUrl?: string): Promise<void> {
  log.api('Cancelling monitor alarm', LogLevel.INFO, { monitorId, apiBaseUrl });

  const client = getApiClient();
  const config = apiBaseUrl ? { baseURL: apiBaseUrl } : undefined;
  const response = await client.get(
    `/monitors/alarm/id:${monitorId}/command:off.json`,
    config
  );

  const validated = validateApiResponse(AlarmStatusResponseSchema, response.data, {
    endpoint: `/monitors/alarm/id:${monitorId}/command:off.json`,
    method: 'GET',
  });

  if (validated.status === 'false' && validated.error) {
    throw new Error(`Failed to cancel alarm: ${validated.error} (code: ${validated.code})`);
  }
}

export async function getAlarmStatus(monitorId: string, apiBaseUrl?: string): Promise<AlarmStatusResponse> {
  log.api('Fetching alarm status', LogLevel.INFO, { monitorId, apiBaseUrl });

  const client = getApiClient();
  const config = apiBaseUrl ? { baseURL: apiBaseUrl } : undefined;
  const response = await client.get(
    `/monitors/alarm/id:${monitorId}/command:status.json`,
    config
  );

  const validated = validateApiResponse(AlarmStatusResponseSchema, response.data, {
    endpoint: `/monitors/alarm/id:${monitorId}/command:status.json`,
    method: 'GET',
  });

  return validated;
}

export async function getDaemonStatus(
  monitorId: string,
  daemon: 'zmc' | 'zma',
  apiBaseUrl?: string
): Promise<DaemonStatusResponse> {
  log.api('Fetching daemon status', LogLevel.INFO, { monitorId, daemon, apiBaseUrl });

  const client = getApiClient();
  const config = apiBaseUrl ? { baseURL: apiBaseUrl } : undefined;
  const response = await client.get(
    `/monitors/daemonStatus/id:${monitorId}/daemon:${daemon}.json`,
    config
  );

  const validated = validateApiResponse(DaemonStatusResponseSchema, response.data, {
    endpoint: `/monitors/daemonStatus/id:${monitorId}/daemon:${daemon}.json`,
    method: 'GET',
  });

  return validated;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- --run monitors.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/api/monitors.ts app/src/api/__tests__/monitors.test.ts
git commit -m "feat: add apiBaseUrl routing to daemon/alarm API functions"
```

---

### Task 6: Wire up useMonitorStream and useStreamLifecycle

**Files:**
- Modify: `app/src/hooks/useMonitorStream.ts`
- Modify: `app/src/hooks/useStreamLifecycle.ts`

- [ ] **Step 1: Update useMonitorStream to use resolved URLs**

In `app/src/hooks/useMonitorStream.ts`, import `useServerUrls` and use it to resolve `recordingUrl` and `portalPath`:

Add import:
```typescript
import { useServerUrls } from './useServerUrls';
```

Add `serverId` to the options interface:
```typescript
interface UseMonitorStreamOptions {
  monitorId: string;
  serverId?: string | null;
  streamOptions?: Partial<StreamOptions>;
  enabled?: boolean;
}
```

Inside the hook function, resolve URLs and use them:
```typescript
export function useMonitorStream({
  monitorId,
  serverId,
  streamOptions = {},
  enabled = true,
}: UseMonitorStreamOptions): UseMonitorStreamReturn {
  const { currentProfile, settings } = useCurrentProfile();
  const bandwidth = useBandwidthSettings();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { recordingUrl, portalPath } = useServerUrls(serverId);

  // ... existing state ...

  const { connKey, forceRegenerate } = useStreamLifecycle({
    monitorId,
    portalUrl: portalPath ? portalPath.replace(/\/index\.php$/, '') : currentProfile?.portalUrl,
    accessToken,
    viewMode: settings.viewMode,
    mediaRef: imgRef,
    logFn: log.monitor,
    enabled,
  });

  // Build stream URL using resolved recordingUrl instead of currentProfile.cgiUrl
  const streamUrl = currentProfile && connKey !== 0
    ? getStreamUrl(recordingUrl || currentProfile.cgiUrl, monitorId, {
      mode: settings.viewMode === 'snapshot' ? 'single' : 'jpeg',
      scale: bandwidth.imageScale,
      maxfps:
        settings.viewMode === 'streaming'
          ? settings.streamMaxFps
          : undefined,
      token: accessToken || undefined,
      connkey: connKey,
      cacheBuster: settings.viewMode === 'snapshot' ? cacheBuster : undefined,
      minStreamingPort:
        settings.viewMode === 'streaming'
          ? currentProfile.minStreamingPort
          : undefined,
      ...streamOptions,
    })
    : '';

  // ... rest of hook unchanged ...
```

- [ ] **Step 2: Update callers of useMonitorStream to pass serverId**

The only direct caller is `VideoPlayer.tsx` (line 100). It already has `monitor.Id` — add `serverId: monitor.ServerId` to the options. See Task 8.

- [ ] **Step 3: Update MontageMonitor to use resolved portalPath**

In `app/src/components/monitors/MontageMonitor.tsx`, the `useStreamLifecycle` call on line 73 uses `currentProfile?.portalUrl`. Update it to use `useServerUrls`:

Add import:
```typescript
import { useServerUrls } from '../../hooks/useServerUrls';
```

Inside the component, resolve URLs:
```typescript
const { portalPath } = useServerUrls(monitor.ServerId);
const resolvedPortalUrl = portalPath ? portalPath.replace(/\/index\.php$/, '') : currentProfile?.portalUrl;
```

Update the `useStreamLifecycle` call:
```typescript
const { connKey } = useStreamLifecycle({
  monitorId: monitor.Id,
  monitorName: monitor.Name,
  portalUrl: resolvedPortalUrl,
  accessToken,
  viewMode: settings.viewMode,
  mediaRef,
  logFn: log.montageMonitor,
});
```

- [ ] **Step 4: Run type check and tests**

Run: `cd app && npx tsc --noEmit && npm test -- --run`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/src/hooks/useMonitorStream.ts app/src/hooks/useStreamLifecycle.ts app/src/components/monitors/MontageMonitor.tsx
git commit -m "feat: wire useMonitorStream and MontageMonitor to multi-server URLs"
```

---

### Task 7: Wire up useAlarmControl and usePTZControl

**Files:**
- Modify: `app/src/pages/hooks/useAlarmControl.ts`
- Modify: `app/src/pages/hooks/usePTZControl.ts`
- Modify: `app/src/pages/MonitorDetail.tsx`

- [ ] **Step 1: Update useAlarmControl to accept and pass apiBaseUrl**

In `app/src/pages/hooks/useAlarmControl.ts`, add `apiBaseUrl` to the options interface and pass it through:

```typescript
interface UseAlarmControlOptions {
  monitorId: string | undefined;
  apiBaseUrl?: string;
}

export function useAlarmControl({ monitorId, apiBaseUrl }: UseAlarmControlOptions): UseAlarmControlReturn {
  // ... existing code ...

  const {
    data: alarmStatus,
    isLoading: isAlarmLoading,
    refetch: refetchAlarmStatus,
  } = useQuery({
    queryKey: ['monitor-alarm-status', monitorId],
    queryFn: () => getAlarmStatus(monitorId!, apiBaseUrl),
    enabled: !!monitorId,
    refetchInterval: bandwidth.alarmStatusInterval,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  });

  // ... inside handleAlarmToggle:
  const handleAlarmToggle = useCallback(
    async (nextValue: boolean) => {
      if (!monitorId) return;
      // ... existing optimistic update code ...
      try {
        if (nextValue) {
          await triggerAlarm(monitorId, apiBaseUrl);
        } else {
          await cancelAlarm(monitorId, apiBaseUrl);
        }
        // ... rest unchanged ...
```

- [ ] **Step 2: Update usePTZControl to accept resolved portalUrl**

No structural change needed — `usePTZControl` already accepts `portalUrl` as a parameter. The change is in the caller (`MonitorDetail.tsx`).

- [ ] **Step 3: Update MonitorDetail.tsx to pass resolved URLs**

In `app/src/pages/MonitorDetail.tsx`, import `useServerUrls` and pass resolved URLs to the hooks:

```typescript
import { useServerUrls } from '../hooks/useServerUrls';

// Inside the component, after monitor is available:
const { portalPath, apiBaseUrl } = useServerUrls(monitor?.Monitor.ServerId);
const resolvedPortalUrl = portalPath ? portalPath.replace(/\/index\.php$/, '') : currentProfile?.portalUrl || '';

const { handlePTZCommand } = usePTZControl({
  portalUrl: resolvedPortalUrl,
  monitorId: monitor?.Monitor.Id || '',
  accessToken,
  isContinuous,
});

// And for alarm control (wherever useAlarmControl is called):
const alarmControl = useAlarmControl({
  monitorId: monitor?.Monitor.Id,
  apiBaseUrl,
});
```

- [ ] **Step 4: Run type check and tests**

Run: `cd app && npx tsc --noEmit && npm test -- --run`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/hooks/useAlarmControl.ts app/src/pages/hooks/usePTZControl.ts app/src/pages/MonitorDetail.tsx
git commit -m "feat: route alarm and PTZ controls through multi-server URLs"
```

---

### Task 8: Wire up VideoPlayer with resolved go2rtcUrl

**Files:**
- Modify: `app/src/components/video/VideoPlayer.tsx`

- [ ] **Step 1: Import useServerUrls and resolve URLs**

In `app/src/components/video/VideoPlayer.tsx`, add:

```typescript
import { useServerUrls } from '../../hooks/useServerUrls';
```

Inside the component:
```typescript
const { recordingUrl } = useServerUrls(monitor.ServerId);
```

Update the MJPEG stream hook to pass `serverId`:
```typescript
const mjpegStream = useMonitorStream({
  monitorId: monitor.Id,
  serverId: monitor.ServerId,
  streamOptions: {
    maxfps: rawSettings?.streamMaxFps,
    scale: rawSettings?.streamScale,
  },
  enabled: effectiveStreamingMethod === 'mjpeg',
});
```

For Go2RTC, keep using `profile?.go2rtcUrl` for now (Go2RTC per-server routing is deferred until confirmed needed).

- [ ] **Step 2: Run type check**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/video/VideoPlayer.tsx
git commit -m "feat: pass serverId through VideoPlayer to MJPEG stream"
```

---

### Task 9: Wire up event views with resolved portalPath

**Files:**
- Modify: `app/src/pages/EventDetail.tsx`
- Modify: `app/src/components/events/ZmsEventPlayer.tsx`
- Modify: `app/src/components/events/EventListView.tsx`
- Modify: `app/src/components/events/EventMontageView.tsx`
- Modify: `app/src/components/timeline/TimelineScrubber.tsx`
- Modify: `app/src/components/timeline/EventPreviewPopover.tsx`
- Modify: `app/src/pages/Events.tsx`
- Modify: `app/src/pages/EventMontage.tsx`
- Modify: `app/src/services/eventPoller.ts`
- Modify: `app/src/lib/download.ts`

This task covers all event-related URL consumers. The pattern is the same everywhere: resolve `portalPath` based on the event's `MonitorId` → monitor's `ServerId`.

- [ ] **Step 1: Update EventDetail.tsx**

`EventDetail.tsx` has direct access to the event and its monitor. Import `useServerUrls` and resolve URLs:

```typescript
import { useServerUrls } from '../hooks/useServerUrls';

// Inside component, after monitor data is available:
const { portalPath, recordingUrl: resolvedRecordingUrl } = useServerUrls(monitor?.Monitor?.ServerId);
const resolvedPortalUrl = portalPath ? portalPath.replace(/\/index\.php$/, '') : currentProfile?.portalUrl || '';
```

Then replace all instances of `currentProfile.portalUrl` with `resolvedPortalUrl` in the event URL calls (lines ~192, 196, 299, 333, 388).

- [ ] **Step 2: Update event list and montage components**

For `EventListView.tsx`, `EventMontageView.tsx`, `TimelineScrubber.tsx`, `EventPreviewPopover.tsx`: these receive `portalUrl` as a prop from their parent pages.

**Option A (simpler, chosen):** These components receive events that have a `MonitorId`. To resolve per-event, the parent page should look up each event's monitor ServerId and pass the correct portalUrl. However, events on the same page may belong to different monitors on different servers.

The cleanest approach: add a `getPortalUrlForMonitor` helper that these components can call inline, using the server map directly (not a hook, since it's called per-event-row):

In `app/src/lib/server-resolver.ts`, add:

```typescript
/**
 * Quick lookup: get portalUrl for a monitor's server.
 * Designed for use in list renderers where a hook per-row is impractical.
 */
export function getPortalUrlForMonitor(
  serverId: string | null | undefined,
  profilePortalUrl: string
): string {
  if (!serverId || serverId === '0' || cachedServerMap.size === 0) {
    return profilePortalUrl;
  }
  const serverUrls = cachedServerMap.get(serverId);
  if (!serverUrls) return profilePortalUrl;
  // Strip /index.php from portalPath to get the portal base URL
  return serverUrls.portalPath.replace(/\/index\.php$/, '');
}
```

Then in components like `EventListView.tsx`, import `getPortalUrlForMonitor` and look up per-event. This requires knowing the event's monitor's ServerId. Since the monitor list is already in the monitors store, add a helper:

In `app/src/lib/server-resolver.ts`, add:

```typescript
/**
 * Quick lookup: get portalUrl for an event using monitors from the store.
 * Falls back to profilePortalUrl if the monitor or server isn't found.
 */
export function getPortalUrlForEvent(
  monitorId: string,
  monitors: Array<{ Monitor: { Id: string; ServerId: string | null } }>,
  profilePortalUrl: string
): string {
  const monitorData = monitors.find((m) => m.Monitor.Id === monitorId);
  return getPortalUrlForMonitor(monitorData?.Monitor.ServerId, profilePortalUrl);
}
```

Then in `EventListView.tsx` and similar, use:

```typescript
import { getPortalUrlForEvent } from '../../lib/server-resolver';
import { useMonitorStore } from '../../stores/monitors';

// Inside component:
const monitors = useMonitorStore((s) => s.monitors);

// Per-event row:
const eventPortalUrl = getPortalUrlForEvent(event.MonitorId, monitors, portalUrl);
const thumbnailUrl = getEventImageUrl(eventPortalUrl, Event.Id, 'snapshot', { ... });
```

Apply this same pattern to `EventMontageView.tsx`, `TimelineScrubber.tsx`, `EventPreviewPopover.tsx`.

- [ ] **Step 3: Update ZmsEventPlayer.tsx**

`ZmsEventPlayer` receives `portalUrl` as a prop. The parent (`EventDetail.tsx`) should now pass the resolved URL (done in step 1). No change needed in ZmsEventPlayer itself beyond what the parent provides.

- [ ] **Step 4: Update eventPoller.ts and download.ts**

In `app/src/services/eventPoller.ts`, import `getPortalUrlForEvent` and use it instead of `currentProfile.portalUrl` when building event image URLs.

In `app/src/lib/download.ts`, accept `portalUrl` as a parameter (it already does via `buildEventVideoUrl`). The caller (`EventDetail.tsx`) passes the resolved URL.

- [ ] **Step 5: Run type check and full tests**

Run: `cd app && npx tsc --noEmit && npm test -- --run`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add app/src/pages/EventDetail.tsx app/src/components/events/ZmsEventPlayer.tsx \
  app/src/components/events/EventListView.tsx app/src/components/events/EventMontageView.tsx \
  app/src/components/timeline/TimelineScrubber.tsx app/src/components/timeline/EventPreviewPopover.tsx \
  app/src/pages/Events.tsx app/src/pages/EventMontage.tsx \
  app/src/services/eventPoller.ts app/src/lib/download.ts app/src/lib/server-resolver.ts
git commit -m "feat: route event image/video/ZMS URLs through multi-server resolver"
```

---

### Task 10: Multi-server Server page

**Files:**
- Modify: `app/src/pages/Server.tsx`
- Modify: `app/src/locales/{en,de,es,fr,zh}/translation.json`

- [ ] **Step 1: Add i18n keys for multi-server display**

Add to the `server` section in all 5 translation files:

English (`en`):
```json
"servers_title": "Servers",
"servers_desc": "All servers in this ZoneMinder cluster",
"storage_title": "Storage",
"storage_desc": "Storage areas and disk usage",
"storage_name": "Name",
"storage_path": "Path",
"storage_type": "Type",
"storage_server": "Server",
"storage_used": "Used",
"storage_total": "Total",
"no_storage_info": "No storage info"
```

German (`de`):
```json
"servers_title": "Server",
"servers_desc": "Alle Server in diesem ZoneMinder-Cluster",
"storage_title": "Speicher",
"storage_desc": "Speicherbereiche und Nutzung",
"storage_name": "Name",
"storage_path": "Pfad",
"storage_type": "Typ",
"storage_server": "Server",
"storage_used": "Belegt",
"storage_total": "Gesamt",
"no_storage_info": "Keine Speicherinfo"
```

Spanish (`es`):
```json
"servers_title": "Servidores",
"servers_desc": "Todos los servidores del clúster ZoneMinder",
"storage_title": "Almacenamiento",
"storage_desc": "Áreas de almacenamiento y uso de disco",
"storage_name": "Nombre",
"storage_path": "Ruta",
"storage_type": "Tipo",
"storage_server": "Servidor",
"storage_used": "Usado",
"storage_total": "Total",
"no_storage_info": "Sin info de almacenamiento"
```

French (`fr`):
```json
"servers_title": "Serveurs",
"servers_desc": "Tous les serveurs du cluster ZoneMinder",
"storage_title": "Stockage",
"storage_desc": "Zones de stockage et utilisation",
"storage_name": "Nom",
"storage_path": "Chemin",
"storage_type": "Type",
"storage_server": "Serveur",
"storage_used": "Utilisé",
"storage_total": "Total",
"no_storage_info": "Aucune info de stockage"
```

Chinese (`zh`):
```json
"servers_title": "服务器",
"servers_desc": "ZoneMinder集群中的所有服务器",
"storage_title": "存储",
"storage_desc": "存储区域和磁盘使用情况",
"storage_name": "名称",
"storage_path": "路径",
"storage_type": "类型",
"storage_server": "服务器",
"storage_used": "已用",
"storage_total": "总共",
"no_storage_info": "无存储信息"
```

- [ ] **Step 2: Rewrite Server.tsx to show all servers and storage**

Replace the single-server display logic (lines 150-336) with a loop over all servers. For each server, show its CPU, memory, status, and associated storage areas.

Key changes:
1. Import `getStorages` and add a query for it
2. Import `getDaemonCheck`, `getLoad`, `getDiskPercent` with per-server `apiBaseUrl` support (these need the same `{ baseURL }` pattern as the monitor functions — add optional `apiBaseUrl` params to them in `api/server.ts`)
3. Replace `primaryServer` with a loop over `servers`
4. For multi-server, show each server's metrics individually using per-server API calls
5. For single-server (servers empty or length 1), keep the existing simple layout
6. Add a Storage card showing per-storage disk usage with server association

For the per-server health queries, add `apiBaseUrl` parameter support to `getDaemonCheck`, `getLoad`, and `getDiskPercent` in `api/server.ts`, using the same pattern as Task 5:

```typescript
export async function getDaemonCheck(apiBaseUrl?: string): Promise<boolean> {
  const client = getApiClient();
  const config = apiBaseUrl ? { baseURL: apiBaseUrl } : undefined;
  const response = await client.get('/host/daemonCheck.json', config);
  // ... rest unchanged
}
```

Same for `getLoad` and `getDiskPercent`.

Then in `Server.tsx`, for each server in the list, create a query that hits that server's API:

```typescript
// For multi-server, create per-server queries using the server map
const serverMap = getServerMap();

// One query per server for daemon check
const serverHealthQueries = useQueries({
  queries: (servers || []).map((server) => {
    const urls = serverMap.get(server.Id);
    return {
      queryKey: ['server-daemon', server.Id, currentProfile?.id],
      queryFn: () => getDaemonCheck(urls?.apiBaseUrl),
      enabled: !!currentProfile && isAuthenticated && !!urls,
      refetchInterval: bandwidth.daemonCheckInterval,
    };
  }),
});
```

- [ ] **Step 3: Run type check and full tests**

Run: `cd app && npx tsc --noEmit && npm test -- --run`
Expected: No errors

- [ ] **Step 4: Build**

Run: `cd app && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/Server.tsx app/src/api/server.ts app/src/api/__tests__/server.test.ts \
  app/src/locales/
git commit -m "feat: show all servers and storage on Server page with per-server health"
```

---

### Task 11: Final integration test and cleanup

- [ ] **Step 1: Run full test suite**

```bash
cd app && npm test -- --run
```

Expected: All tests pass

- [ ] **Step 2: Run type check**

```bash
cd app && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Run build**

```bash
cd app && npm run build
```

Expected: Build succeeds

- [ ] **Step 4: Manual verification checklist**

Verify with a multi-server setup (Isaac's server):
- Montage shows streams from monitors on different servers
- Monitor detail page: daemon status returns correctly for monitors on non-primary servers
- Alarm arm/disarm works on monitors on non-primary servers
- PTZ controls route to the correct server
- Event images load for events on monitors hosted by non-primary servers
- Server page shows all servers with per-server metrics
- Server page shows storage areas with disk usage

Verify with a single-server setup:
- No behavior change — everything works as before
- No extra API calls (server map is empty, all lookups return defaults)

- [ ] **Step 5: Commit any fixes from manual testing**

```bash
git add -A
git commit -m "fix: address issues found during multi-server integration testing"
```
