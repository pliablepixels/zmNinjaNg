import { getEventImageUrl } from '../api/events';
import type { ThumbnailFallbackEntry } from '../stores/settings';

export interface ThumbnailChainOptions {
  token?: string;
  width?: number;
  height?: number;
  apiUrl?: string;
  minStreamingPort?: number;
  monitorId?: string;
}

export function resolveFallbackFids(chain: ThumbnailFallbackEntry[] | undefined): string[] {
  const fids: string[] = [];
  if (!Array.isArray(chain)) return fids;
  for (const entry of chain) {
    if (!entry.enabled) continue;
    if (entry.type === 'custom') {
      const fid = entry.customFid?.trim();
      if (fid) fids.push(fid);
      continue;
    }
    fids.push(entry.type);
  }
  return fids;
}

export function buildThumbnailChain(
  portalUrl: string,
  eventId: string,
  chain: ThumbnailFallbackEntry[] | undefined,
  options: ThumbnailChainOptions = {}
): string[] {
  return resolveFallbackFids(chain).map((fid) =>
    getEventImageUrl(portalUrl, eventId, fid, options)
  );
}
