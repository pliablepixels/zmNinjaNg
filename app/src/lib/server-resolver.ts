/**
 * Server Resolver
 *
 * Maps ZoneMinder ServerId values to constructed URLs for multi-server
 * routing. Each monitor can be assigned to a different server; this
 * module builds the recording, portal, and API URLs for each server
 * so that streams and API calls reach the correct host.
 */

import type { Server } from '../api/server';
import { log, LogLevel } from './logger';

// ========== Types ==========

export interface ServerUrls {
  recordingUrl: string;   // Protocol://Hostname:Port/PathToZMS
  portalPath: string;     // Protocol://Hostname:Port/PathToIndex
  apiBaseUrl: string;     // Protocol://Hostname:Port/PathToApi
}

export interface ResolvedMonitorUrls extends ServerUrls {
  isMultiServer: boolean; // true when resolved to a different server
}

export type ServerUrlMap = Map<string, ServerUrls>;

// ========== Module-level cache ==========

let cachedServerMap: ServerUrlMap = new Map();
/** Incremented on every setServerMap/clearServerMap so React hooks can react. */
let serverMapVersion = 0;
/** Listeners notified when the server map changes. */
const listeners = new Set<() => void>();

export function setServerMap(map: ServerUrlMap): void {
  cachedServerMap = map;
  serverMapVersion++;
  listeners.forEach((fn) => fn());
}

export function getServerMap(): ServerUrlMap {
  return cachedServerMap;
}

export function getServerMapVersion(): number {
  return serverMapVersion;
}

/** Subscribe to server map changes. Returns unsubscribe function. */
export function subscribeServerMap(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearServerMap(): void {
  cachedServerMap = new Map();
  serverMapVersion++;
  listeners.forEach((fn) => fn());
}

// ========== Functions ==========

/**
 * Build a map of ServerId to constructed URLs from a list of servers.
 * Servers without a Hostname are skipped.
 */
export function buildServerMap(servers: Server[]): ServerUrlMap {
  const map: ServerUrlMap = new Map();

  for (const server of servers) {
    if (!server.Hostname) {
      continue;
    }

    const protocol = server.Protocol || 'https';
    const port = server.Port ?? 443;
    const base = `${protocol}://${server.Hostname}:${port}`;

    const urls: ServerUrls = {
      recordingUrl: base + (server.PathToZMS || '/cgi-bin/nph-zms'),
      portalPath: base + (server.PathToIndex || '/index.php'),
      apiBaseUrl: base + (server.PathToApi || '/api'),
    };

    map.set(server.Id, urls);

    log.http(`Mapped server ${server.Name} (${server.Id})`, LogLevel.DEBUG, {
      base,
      recordingUrl: urls.recordingUrl,
      portalPath: urls.portalPath,
      apiBaseUrl: urls.apiBaseUrl,
    });
  }

  return map;
}

export interface ResolveDefaults {
  cgiUrl: string;
  portalUrl: string;
  apiUrl: string;
}

/**
 * Resolve URLs for a monitor based on its ServerId.
 * Falls back to profile defaults when the server is not mapped.
 */
export function resolveMonitorUrls(
  serverId: string | null | undefined,
  serverMap: ServerUrlMap,
  defaults: ResolveDefaults,
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

  const urls = serverMap.get(serverId);
  if (!urls) {
    return fallback;
  }

  return {
    ...urls,
    isMultiServer: true,
  };
}

/**
 * Get portal base URL for a monitor's server.
 * Uses the cached server map. Returns the portal path with /index.php stripped.
 * Falls back to profilePortalUrl when the server is not found.
 */
export function getPortalUrlForMonitor(
  serverId: string | null | undefined,
  profilePortalUrl: string,
): string {
  if (!serverId || serverId === '0' || cachedServerMap.size === 0) {
    return profilePortalUrl;
  }

  const urls = cachedServerMap.get(serverId);
  if (!urls) {
    return profilePortalUrl;
  }

  return urls.portalPath.replace(/\/index\.php$/, '');
}

/**
 * Get portal base URL for an event by looking up its monitor's server.
 */
export function getPortalUrlForEvent(
  monitorId: string,
  monitors: Array<{ Monitor: { Id: string; ServerId: string | null } }>,
  profilePortalUrl: string,
): string {
  const monitor = monitors.find((m) => m.Monitor.Id === monitorId);
  if (!monitor) {
    return profilePortalUrl;
  }

  return getPortalUrlForMonitor(monitor.Monitor.ServerId, profilePortalUrl);
}
