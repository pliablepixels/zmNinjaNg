/**
 * Hook to resolve per-monitor URLs for multi-server setups.
 *
 * Returns the correct recordingUrl, portalPath, and apiBaseUrl for a
 * given monitor's ServerId. Falls back to profile defaults for
 * single-server setups or when ServerId is null.
 *
 * Reacts to server map changes (populated during bootstrap) via
 * useSyncExternalStore so streams re-render with correct URLs once
 * the server list is fetched.
 */

import { useMemo, useSyncExternalStore } from 'react';
import { useCurrentProfile } from './useCurrentProfile';
import {
  resolveMonitorUrls,
  getServerMap,
  getServerMapVersion,
  subscribeServerMap,
  type ResolvedMonitorUrls,
} from '../lib/server-resolver';

export function useServerUrls(serverId: string | null | undefined): ResolvedMonitorUrls {
  const { currentProfile } = useCurrentProfile();

  // Re-render when the server map changes (e.g., after bootstrap populates it)
  const mapVersion = useSyncExternalStore(subscribeServerMap, getServerMapVersion);

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
    });
  }, [serverId, currentProfile, mapVersion]);
}
