/**
 * VideoPlayer - Unified video player that selects WebRTC (Go2RTC) or MJPEG
 * based on user preferences and monitor capabilities.
 *
 * Protocol negotiation: Go2RTC tries protocols in order (WebRTC → MSE → HLS).
 * If connected but no video frames arrive within a timeout, falls back to MJPEG.
 * The status badge updates in real-time to show which protocol is being tried.
 */

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { Monitor, Profile } from '../../api/types';
import { useSettingsStore } from '../../stores/settings';
import { useGo2RTCStream } from '../../hooks/useGo2RTCStream';
import { useMonitorStream } from '../../hooks/useMonitorStream';
import { log, LogLevel } from '../../lib/logger';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { VideoOff } from 'lucide-react';

/** Seconds to wait for video frames after Go2RTC reports "connected" */
const GO2RTC_VIDEO_TIMEOUT_S = 8;

/** Minutes before retrying Go2RTC on a monitor that previously failed */
const GO2RTC_RETRY_INTERVAL_MIN = 5;

/** Cache of monitors where Go2RTC failed — skip straight to MJPEG until TTL expires */
const go2rtcFailureCache = new Map<string, number>();

function isGo2rtcCachedFailure(monitorId: string): boolean {
  const failedAt = go2rtcFailureCache.get(monitorId);
  if (!failedAt) return false;
  if (Date.now() - failedAt > GO2RTC_RETRY_INTERVAL_MIN * 60 * 1000) {
    go2rtcFailureCache.delete(monitorId);
    return false;
  }
  return true;
}

function markGo2rtcFailed(monitorId: string): void {
  go2rtcFailureCache.set(monitorId, Date.now());
}

export interface VideoPlayerProps {
  monitor: Monitor;
  profile: Profile | null;
  className?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  showStatus?: boolean;
  externalMediaRef?: React.RefObject<HTMLImageElement | HTMLVideoElement | null>;
  muted?: boolean;
  onLoad?: () => void;
}

export function VideoPlayer({
  monitor,
  profile,
  className = '',
  objectFit = 'contain',
  showStatus = false,
  externalMediaRef,
  muted = false,
  onLoad,
}: VideoPlayerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const rawSettings = useSettingsStore(
    useShallow((state) => state.profileSettings[profile?.id || ''])
  );
  const globalStreamingMethod = rawSettings?.streamingMethod ?? 'auto';
  // Per-monitor override takes precedence over global setting
  const monitorOverride = rawSettings?.monitorStreamingOverrides?.[monitor.Id];
  const userStreamingPreference = monitorOverride ?? globalStreamingMethod;

  // Determine streaming method: WebRTC if supported and enabled, otherwise MJPEG
  const lastLoggedRef = useRef<string>('');
  const streamingMethod = useMemo(() => {
    const canUseWebRTC =
      userStreamingPreference !== 'mjpeg' &&
      monitor.Go2RTCEnabled === true &&
      !!profile?.go2rtcUrl;

    const method = canUseWebRTC ? 'webrtc' : 'mjpeg';

    // Log once per monitor/method combination
    const logKey = `${monitor.Id}-${method}`;
    if (lastLoggedRef.current !== logKey) {
      lastLoggedRef.current = logKey;
      log.videoPlayer(`Streaming: ${method === 'webrtc' ? 'WebRTC' : 'MJPEG'}`, LogLevel.INFO, {
        monitorId: monitor.Id,
        monitorName: monitor.Name,
        monitorGo2RTCEnabled: monitor.Go2RTCEnabled,
        ...(method === 'webrtc' && { go2rtcUrl: profile?.go2rtcUrl }),
      });
    }

    return method;
  }, [userStreamingPreference, monitor.Go2RTCEnabled, monitor.Id, monitor.Name, profile?.go2rtcUrl]);

  const [go2rtcFailed, setGo2rtcFailed] = useState(() => isGo2rtcCachedFailure(monitor.Id));
  const [hasVideoFrames, setHasVideoFrames] = useState(false);
  const effectiveStreamingMethod = go2rtcFailed ? 'mjpeg' : streamingMethod;

  const go2rtcStream = useGo2RTCStream({
    go2rtcUrl: profile?.go2rtcUrl || '',
    monitorId: monitor.Id,
    channel: 0,
    containerRef,
    protocols: rawSettings?.webrtcProtocols,
    enabled: streamingMethod === 'webrtc' && !!profile?.go2rtcUrl && !go2rtcFailed,
    muted,
  });

  // Fall back to MJPEG when Go2RTC reports error state
  useEffect(() => {
    if (streamingMethod === 'webrtc' && go2rtcStream.state === 'error' && !go2rtcFailed) {
      log.videoPlayer('Go2RTC error, falling back to MJPEG', LogLevel.WARN, {
        monitorId: monitor.Id,
        error: go2rtcStream.error,
      });
      markGo2rtcFailed(monitor.Id);
      setGo2rtcFailed(true);
    }
  }, [streamingMethod, go2rtcStream.state, go2rtcStream.error, go2rtcFailed, monitor.Id]);

  // Fall back to MJPEG when Go2RTC connects but no video frames arrive
  const videoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearVideoTimeout = useCallback(() => {
    if (videoTimeoutRef.current) {
      clearTimeout(videoTimeoutRef.current);
      videoTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (streamingMethod !== 'webrtc' || go2rtcFailed) {
      clearVideoTimeout();
      return;
    }

    if (go2rtcStream.state === 'connected' && !hasVideoFrames) {
      // Start timeout — if no frames arrive, fall back
      clearVideoTimeout();
      videoTimeoutRef.current = setTimeout(() => {
        // Check for video frames by inspecting the video element
        const video = go2rtcStream.getVideoElement();
        const hasFrames = video && video.videoWidth > 0 && video.videoHeight > 0 && !video.paused;

        if (!hasFrames) {
          log.videoPlayer('Go2RTC connected but no video frames, falling back to MJPEG', LogLevel.WARN, {
            monitorId: monitor.Id,
            protocol: go2rtcStream.activeProtocol,
            videoWidth: video?.videoWidth,
            videoHeight: video?.videoHeight,
            paused: video?.paused,
          });
          markGo2rtcFailed(monitor.Id);
          setGo2rtcFailed(true);
        } else {
          setHasVideoFrames(true);
        }
      }, GO2RTC_VIDEO_TIMEOUT_S * 1000);
    }

    if (hasVideoFrames) {
      clearVideoTimeout();
    }

    return clearVideoTimeout;
  }, [streamingMethod, go2rtcFailed, go2rtcStream.state, hasVideoFrames, go2rtcStream, monitor.Id, clearVideoTimeout]);

  // Reset failure state when monitor changes (check cache for new monitor)
  useEffect(() => {
    setGo2rtcFailed(isGo2rtcCachedFailure(monitor.Id));
    setHasVideoFrames(false);
  }, [monitor.Id]);

  const mjpegStream = useMonitorStream({
    monitorId: monitor.Id,
    serverId: monitor.ServerId,
    streamOptions: {
      maxfps: rawSettings?.streamMaxFps,
      scale: rawSettings?.streamScale,
    },
    enabled: effectiveStreamingMethod === 'mjpeg',
  });

  // Track MJPEG image error state
  const [mjpegError, setMjpegError] = useState(false);
  useEffect(() => {
    if (effectiveStreamingMethod === 'mjpeg') {
      setMjpegError(false);
    }
  }, [effectiveStreamingMethod, monitor.Id]);

  const handleMjpegLoad = useCallback(() => {
    setMjpegError(false);
    onLoad?.();
  }, [onLoad]);

  const handleMjpegError = useCallback(() => {
    setMjpegError(true);
  }, []);

  // Sync media ref for snapshot capture
  useEffect(() => {
    if (!externalMediaRef) return;
    const ref = externalMediaRef as React.MutableRefObject<HTMLImageElement | HTMLVideoElement | null>;

    if (effectiveStreamingMethod === 'mjpeg' && imgRef.current) {
      ref.current = imgRef.current;
    } else if (effectiveStreamingMethod === 'webrtc') {
      ref.current = go2rtcStream.getVideoElement();
    }
  }, [externalMediaRef, effectiveStreamingMethod, mjpegStream.streamUrl, go2rtcStream.state, go2rtcStream]);

  // Derive current status
  const isWebRTC = effectiveStreamingMethod === 'webrtc';
  const status = useMemo(() => ({
    state: isWebRTC ? go2rtcStream.state : (mjpegStream.streamUrl ? 'connected' : 'connecting'),
    error: isWebRTC ? go2rtcStream.error : null,
    protocol: isWebRTC ? (go2rtcStream.activeProtocol || 'go2rtc') : 'mjpeg',
  }), [isWebRTC, go2rtcStream.state, go2rtcStream.error, go2rtcStream.activeProtocol, mjpegStream.streamUrl]);

  const handleRetry = () => {
    log.videoPlayer('Retry requested', LogLevel.INFO, { monitorId: monitor.Id, go2rtcFailed });

    if (go2rtcFailed) {
      setGo2rtcFailed(false);
      setHasVideoFrames(false);
      go2rtcStream.retry();
    } else if (isWebRTC) {
      go2rtcStream.retry();
    } else {
      mjpegStream.regenerateConnection();
    }
  };

  // Log status changes
  useEffect(() => {
    log.videoPlayer('Stream status', LogLevel.DEBUG, {
      method: effectiveStreamingMethod,
      state: status.state,
      protocol: status.protocol,
      monitorId: monitor.Id,
    });
  }, [effectiveStreamingMethod, status.state, status.protocol, monitor.Id]);

  // Notify parent when stream is connected (WebRTC path)
  useEffect(() => {
    if (isWebRTC && status.state === 'connected' && hasVideoFrames) {
      onLoad?.();
    }
  }, [isWebRTC, status.state, hasVideoFrames, onLoad]);

  // Protocol label for status badge
  const protocolLabel = useMemo(() => {
    if (go2rtcFailed && effectiveStreamingMethod === 'mjpeg' && streamingMethod === 'webrtc') {
      // Fell back from Go2RTC to MJPEG
      return t('video.streaming_mjpeg');
    }
    const labels: Record<string, string> = {
      webrtc: 'WebRTC',
      mse: 'MSE',
      hls: 'HLS',
      go2rtc: t('video.streaming_webrtc'),
      mjpeg: t('video.streaming_mjpeg'),
    };
    return labels[status.protocol] || status.protocol;
  }, [status.protocol, go2rtcFailed, effectiveStreamingMethod, streamingMethod, t]);

  // Status badge variant
  const statusBadgeVariant = useMemo(() => {
    if (go2rtcFailed) return 'outline' as const; // fell back
    if (status.state === 'connected') return 'secondary' as const;
    if (status.state === 'connecting') return 'outline' as const;
    return 'destructive' as const;
  }, [go2rtcFailed, status.state]);

  // Whether we're in a "waiting for video" state
  const isWaitingForVideo = isWebRTC && status.state === 'connected' && !hasVideoFrames;
  const showNoVideo = (status.state === 'connecting' || isWaitingForVideo) ||
    (!isWebRTC && (!mjpegStream.streamUrl || mjpegError));

  return (
    <div className="relative w-full h-full" data-testid="video-player">
      {/* Background placeholder — shown until video/image loads */}
      {showNoVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30" data-testid="video-player-loading">
          <VideoOff className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}

      {isWebRTC && (
        <div
          ref={containerRef}
          className={`w-full h-full ${className}`}
          style={{ objectFit } as React.CSSProperties}
          data-testid="video-player-webrtc-container"
        />
      )}

      {!isWebRTC && mjpegStream.streamUrl && (
        <img
          ref={imgRef}
          className={`w-full h-full ${className}`}
          style={{ objectFit, ...(mjpegError ? { display: 'none' } : {}) }}
          data-testid="video-player-mjpeg"
          src={mjpegStream.streamUrl}
          alt={monitor.Name}
          onLoad={handleMjpegLoad}
          onError={handleMjpegError}
        />
      )}

      {/* Protocol status badge */}
      {showStatus && (
        <div className="absolute bottom-1.5 right-1.5 z-20 flex gap-1.5" data-testid="video-player-status">
          {isWaitingForVideo && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 animate-pulse bg-black/40 text-white border-white/20">
              {t('video.connecting')}
            </Badge>
          )}
          <Badge variant={statusBadgeVariant} className="text-[10px] px-1.5 py-0 h-4 bg-black/40 text-white border-white/20">
            {protocolLabel}
          </Badge>
        </div>
      )}

      {/* Error overlay */}
      {status.state === 'error' && status.error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4" data-testid="video-player-error">
          <VideoOff className="h-10 w-10 text-white/60 mb-3" />
          <p className="text-center text-sm mb-2">{t('video.connection_failed')}</p>
          <p className="text-xs text-gray-300 mb-4">{status.error}</p>
          <Button onClick={handleRetry} variant="secondary" size="sm" data-testid="video-player-retry">
            {t('video.retry_connection')}
          </Button>
        </div>
      )}
    </div>
  );
}
