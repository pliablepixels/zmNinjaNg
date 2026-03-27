/**
 * Monitor Stream Hook
 *
 * Manages the lifecycle of a ZoneMinder video stream or snapshot sequence.
 * Handles connection keys (connkey) to allow multiple simultaneous streams.
 * Implements cache busting and periodic refreshing for snapshot mode.
 *
 * Features:
 * - Supports both 'streaming' (MJPEG) and 'snapshot' (JPEG refresh) modes
 * - Handles connection cleanup on unmount to prevent zombie streams on server
 * - Implements image preloading for smooth snapshot transitions
 * - Generates unique connection keys per stream instance
 */

import { useState, useEffect, useRef } from 'react';
import { getStreamUrl } from '../api/monitors';
import { useCurrentProfile } from './useCurrentProfile';
import { useBandwidthSettings } from './useBandwidthSettings';
import { useStreamLifecycle } from './useStreamLifecycle';
import { useAuthStore } from '../stores/auth';
import { log, LogLevel } from '../lib/logger';
import type { StreamOptions } from '../api/types';

interface UseMonitorStreamOptions {
  monitorId: string;
  streamOptions?: Partial<StreamOptions>;
  enabled?: boolean; // Enable/disable stream management (default: true)
}

interface UseMonitorStreamReturn {
  streamUrl: string;
  displayedImageUrl: string;
  imgRef: React.RefObject<HTMLImageElement | null>;
  regenerateConnection: () => void;
}

/**
 * Custom hook for managing monitor stream URLs and connections.
 *
 * @param options - Configuration options
 * @param options.monitorId - The ID of the monitor to stream
 * @param options.streamOptions - Optional overrides for stream parameters
 */
export function useMonitorStream({
  monitorId,
  streamOptions = {},
  enabled = true,
}: UseMonitorStreamOptions): UseMonitorStreamReturn {
  const { currentProfile, settings } = useCurrentProfile();
  const bandwidth = useBandwidthSettings();
  const accessToken = useAuthStore((state) => state.accessToken);

  const [cacheBuster, setCacheBuster] = useState(Date.now());
  const [displayedImageUrl, setDisplayedImageUrl] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);

  // Stream lifecycle: connKey generation, CMD_QUIT on regen/unmount, media abort
  const { connKey, forceRegenerate } = useStreamLifecycle({
    monitorId,
    portalUrl: currentProfile?.portalUrl,
    accessToken,
    viewMode: settings.viewMode,
    mediaRef: imgRef,
    logFn: log.monitor,
    enabled,
  });

  // Reset cacheBuster when connKey changes (new connection)
  useEffect(() => {
    if (connKey !== 0) {
      setCacheBuster(Date.now());
    }
  }, [connKey]);

  // Snapshot mode: periodic refresh
  useEffect(() => {
    if (!enabled || settings.viewMode !== 'snapshot') return;

    const interval = setInterval(() => {
      setCacheBuster(Date.now());
    }, bandwidth.snapshotRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [enabled, settings.viewMode, bandwidth.snapshotRefreshInterval]);

  // Build stream URL - ONLY when we have a valid connKey to prevent zombie streams
  const streamUrl = currentProfile && connKey !== 0
    ? getStreamUrl(currentProfile.cgiUrl, monitorId, {
      mode: settings.viewMode === 'snapshot' ? 'single' : 'jpeg',
      scale: bandwidth.imageScale,
      maxfps:
        settings.viewMode === 'streaming'
          ? settings.streamMaxFps
          : undefined,
      token: accessToken || undefined,
      connkey: connKey,
      // Only use cacheBuster in snapshot mode to force refresh; streaming mode uses only connkey
      cacheBuster: settings.viewMode === 'snapshot' ? cacheBuster : undefined,
      // Only use multi-port in streaming mode, not snapshot
      minStreamingPort:
        settings.viewMode === 'streaming'
          ? currentProfile.minStreamingPort
          : undefined,
      ...streamOptions,
    })
    : '';

  // Preload images in snapshot mode to avoid flickering
  useEffect(() => {
    if (!enabled) return;

    // In streaming mode or if no URL, just use the streamUrl directly
    if (settings.viewMode !== 'snapshot') {
      setDisplayedImageUrl(streamUrl);
      return;
    }

    // In snapshot mode, preload the image to avoid flickering
    if (!streamUrl) {
      setDisplayedImageUrl('');
      return;
    }

    // Note: We previously attempted to use native HTTP fetch for snapshots on native platforms
    // to bypass CORS, but it caused NSURLErrorDomain errors on iOS.
    // We now rely on standard Image preloading which works fine.

    const img = new Image();
    img.onload = () => {
      // Only update the displayed URL when the new image is fully loaded
      setDisplayedImageUrl(streamUrl);
    };
    img.onerror = () => {
      // On error, still update to trigger the error handler
      setDisplayedImageUrl(streamUrl);
    };
    img.src = streamUrl;
  }, [enabled, streamUrl, settings.viewMode]);

  const regenerateConnection = () => {
    log.monitor(`Manually regenerating connection for monitor ${monitorId}`, LogLevel.WARN);
    forceRegenerate();
    setCacheBuster(Date.now());
  };

  return {
    streamUrl,
    displayedImageUrl,
    imgRef,
    regenerateConnection,
  };
}
