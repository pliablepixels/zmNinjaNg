/**
 * Unit tests for server-resolver module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  log: { http: vi.fn() },
  LogLevel: { DEBUG: 'DEBUG' },
}));

import {
  buildServerMap,
  resolveMonitorUrls,
  getPortalUrlForMonitor,
  getPortalUrlForEvent,
  setServerMap,
  clearServerMap,
} from '../server-resolver';
import type { Server } from '../../api/server';

function makeServer(overrides: Partial<Server> & { Id: string; Name: string }): Server {
  return {
    Id: overrides.Id,
    Name: overrides.Name,
    Hostname: overrides.Hostname,
    Protocol: overrides.Protocol,
    Port: overrides.Port,
    PathToIndex: overrides.PathToIndex,
    PathToZMS: overrides.PathToZMS,
    PathToApi: overrides.PathToApi,
  } as Server;
}

const pseudoServer = makeServer({
  Id: '1',
  Name: 'pseudo',
  Protocol: 'https',
  Hostname: 'pseudo.example.com',
  Port: 443,
  PathToIndex: '/zm/index.php',
  PathToZMS: '/cgi-bin/nph-zms',
  PathToApi: '/api',
});

const firewall2Server = makeServer({
  Id: '2',
  Name: 'firewall2',
  Protocol: 'https',
  Hostname: 'zm.example.com',
  Port: 443,
  PathToIndex: '/index.php',
  PathToZMS: '/zm/cgi-bin/nph-zms',
  PathToApi: '/api',
});

const tikipiServer = makeServer({
  Id: '3',
  Name: 'tikipi',
  Protocol: 'https',
  Hostname: 'tikipi.example.com',
  Port: 80,
  PathToIndex: '/index.php',
  PathToZMS: '/cgi-bin/nph-zms',
  PathToApi: '/zm/api',
});

const testServers = [pseudoServer, firewall2Server, tikipiServer];

const defaults = {
  cgiUrl: 'https://default.example.com/cgi-bin/nph-zms',
  portalUrl: 'https://default.example.com',
  apiUrl: 'https://default.example.com/api',
};

describe('buildServerMap', () => {
  it('builds map from server list with correct URLs', () => {
    const map = buildServerMap(testServers);

    expect(map.size).toBe(3);

    const pseudo = map.get('1')!;
    expect(pseudo.recordingUrl).toBe('https://pseudo.example.com:443/cgi-bin/nph-zms');
    expect(pseudo.portalPath).toBe('https://pseudo.example.com:443/zm/index.php');
    expect(pseudo.apiBaseUrl).toBe('https://pseudo.example.com:443/api');

    const fw2 = map.get('2')!;
    expect(fw2.recordingUrl).toBe('https://zm.example.com:443/zm/cgi-bin/nph-zms');
    expect(fw2.portalPath).toBe('https://zm.example.com:443/index.php');
    expect(fw2.apiBaseUrl).toBe('https://zm.example.com:443/api');

    const tikipi = map.get('3')!;
    expect(tikipi.recordingUrl).toBe('https://tikipi.example.com:80/cgi-bin/nph-zms');
    expect(tikipi.portalPath).toBe('https://tikipi.example.com:80/index.php');
    expect(tikipi.apiBaseUrl).toBe('https://tikipi.example.com:80/zm/api');
  });

  it('returns empty map for empty list', () => {
    const map = buildServerMap([]);
    expect(map.size).toBe(0);
  });

  it('skips servers missing Hostname', () => {
    const noHost = makeServer({ Id: '99', Name: 'nohost' });
    const map = buildServerMap([noHost, pseudoServer]);
    expect(map.size).toBe(1);
    expect(map.has('99')).toBe(false);
    expect(map.has('1')).toBe(true);
  });

  it('defaults Protocol to https and Port to 443 when missing', () => {
    const minimal = makeServer({
      Id: '10',
      Name: 'minimal',
      Hostname: 'minimal.example.com',
    });
    const map = buildServerMap([minimal]);
    const entry = map.get('10')!;
    expect(entry.recordingUrl).toBe('https://minimal.example.com:443/cgi-bin/nph-zms');
    expect(entry.portalPath).toBe('https://minimal.example.com:443/index.php');
    expect(entry.apiBaseUrl).toBe('https://minimal.example.com:443/api');
  });

  it('skips servers with Port 0', () => {
    const portZero = makeServer({
      Id: '50',
      Name: 'portzero',
      Hostname: 'real.example.com',
      Port: 0,
    });
    const map = buildServerMap([portZero, pseudoServer]);
    expect(map.has('50')).toBe(false);
    expect(map.has('1')).toBe(true);
  });

  it('skips servers with negative Port', () => {
    const negativePort = makeServer({
      Id: '51',
      Name: 'neg',
      Hostname: 'real.example.com',
      Port: -1 as unknown as number,
    });
    const map = buildServerMap([negativePort]);
    expect(map.has('51')).toBe(false);
  });

  it('skips servers with placeholder hostname "server.localdomain"', () => {
    const placeholder = makeServer({
      Id: '52',
      Name: 'placeholder',
      Hostname: 'server.localdomain',
      Port: 443,
    });
    const map = buildServerMap([placeholder]);
    expect(map.has('52')).toBe(false);
  });

  it('skips servers with placeholder hostname "localhost"', () => {
    const placeholder = makeServer({
      Id: '53',
      Name: 'localhost',
      Hostname: 'localhost',
      Port: 443,
    });
    const map = buildServerMap([placeholder]);
    expect(map.has('53')).toBe(false);
  });

  it('skips rows with combined placeholder hostname and port 0 (common ZM default row)', () => {
    const zmDefault = makeServer({
      Id: '1',
      Name: 'zm-default',
      Hostname: 'server.localdomain',
      Port: 0,
      PathToApi: '/zm/api',
    });
    const map = buildServerMap([zmDefault]);
    expect(map.size).toBe(0);
  });
});

describe('resolveMonitorUrls', () => {
  let serverMap: ReturnType<typeof buildServerMap>;

  beforeEach(() => {
    serverMap = buildServerMap(testServers);
  });

  it('resolves URLs for monitor with matching ServerId', () => {
    const result = resolveMonitorUrls('1', serverMap, defaults);
    expect(result.isMultiServer).toBe(true);
    expect(result.recordingUrl).toBe('https://pseudo.example.com:443/cgi-bin/nph-zms');
    expect(result.portalPath).toBe('https://pseudo.example.com:443/zm/index.php');
    expect(result.apiBaseUrl).toBe('https://pseudo.example.com:443/api');
  });

  it('falls back to profile defaults when ServerId is null', () => {
    const result = resolveMonitorUrls(null, serverMap, defaults);
    expect(result.isMultiServer).toBe(false);
    expect(result.recordingUrl).toBe(defaults.cgiUrl);
    expect(result.portalPath).toBe('https://default.example.com/index.php');
    expect(result.apiBaseUrl).toBe(defaults.apiUrl);
  });

  it('falls back when ServerId not in map', () => {
    const result = resolveMonitorUrls('999', serverMap, defaults);
    expect(result.isMultiServer).toBe(false);
    expect(result.recordingUrl).toBe(defaults.cgiUrl);
  });

  it('falls back when server map is empty', () => {
    const result = resolveMonitorUrls('1', new Map(), defaults);
    expect(result.isMultiServer).toBe(false);
    expect(result.recordingUrl).toBe(defaults.cgiUrl);
  });

  it('falls back when ServerId is "0"', () => {
    const result = resolveMonitorUrls('0', serverMap, defaults);
    expect(result.isMultiServer).toBe(false);
    expect(result.recordingUrl).toBe(defaults.cgiUrl);
  });

  it('falls back to profile defaults when ServerId points at a skipped placeholder row', () => {
    const mapWithPlaceholder = buildServerMap([
      makeServer({
        Id: '1',
        Name: 'zm-default',
        Hostname: 'server.localdomain',
        Port: 0,
        PathToApi: '/zm/api',
      }),
    ]);
    const result = resolveMonitorUrls('1', mapWithPlaceholder, defaults);
    expect(result.isMultiServer).toBe(false);
    expect(result.recordingUrl).toBe(defaults.cgiUrl);
    expect(result.apiBaseUrl).toBe(defaults.apiUrl);
    expect(result.apiBaseUrl).not.toContain(':0');
    expect(result.apiBaseUrl).not.toContain('server.localdomain');
  });
});

describe('getPortalUrlForMonitor', () => {
  beforeEach(() => {
    const map = buildServerMap(testServers);
    setServerMap(map);
  });

  afterEach(() => {
    clearServerMap();
  });

  it('returns server portal URL without /index.php when found', () => {
    const url = getPortalUrlForMonitor('1', 'https://fallback.example.com');
    expect(url).toBe('https://pseudo.example.com:443/zm');
  });

  it('returns profilePortalUrl when not found', () => {
    const url = getPortalUrlForMonitor('999', 'https://fallback.example.com');
    expect(url).toBe('https://fallback.example.com');
  });
});

describe('getPortalUrlForEvent', () => {
  beforeEach(() => {
    const map = buildServerMap(testServers);
    setServerMap(map);
  });

  afterEach(() => {
    clearServerMap();
  });

  const monitors = [
    { Monitor: { Id: '10', ServerId: '1' } },
    { Monitor: { Id: '20', ServerId: '2' } },
    { Monitor: { Id: '30', ServerId: null } },
  ];

  it('returns correct URL when monitor and server found', () => {
    const url = getPortalUrlForEvent('10', monitors, 'https://fallback.example.com');
    expect(url).toBe('https://pseudo.example.com:443/zm');
  });

  it('returns profilePortalUrl when monitor not found', () => {
    const url = getPortalUrlForEvent('999', monitors, 'https://fallback.example.com');
    expect(url).toBe('https://fallback.example.com');
  });
});
