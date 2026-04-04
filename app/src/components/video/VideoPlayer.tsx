/**
 * VideoPlayer - Unified video player that selects WebRTC (Go2RTC) or MJPEG
 * based on user preferences and monitor capabilities.
 */

import { useRef, useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { Monitor, Profile } from '../../api/types';
import { useSettingsStore } from '../../stores/settings';
import { useGo2RTCStream } from '../../hooks/useGo2RTCStream';
import { useMonitorStream } from '../../hooks/useMonitorStream';
import { log, LogLevel } from '../../lib/logger';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

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
  const userStreamingPreference = rawSettings?.streamingMethod ?? 'auto';

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

  const [go2rtcFailed, setGo2rtcFailed] = useState(false);
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

  // Fall back to MJPEG when Go2RTC fails
  useEffect(() => {
    if (streamingMethod === 'webrtc' && go2rtcStream.state === 'error' && !go2rtcFailed) {
      log.videoPlayer('Go2RTC failed, falling back to MJPEG', LogLevel.WARN, {
        monitorId: monitor.Id,
        error: go2rtcStream.error,
      });
      setGo2rtcFailed(true);
    }
  }, [streamingMethod, go2rtcStream.state, go2rtcStream.error, go2rtcFailed, monitor.Id]);

  // Reset failure state when monitor changes
  useEffect(() => {
    setGo2rtcFailed(false);
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
    if (isWebRTC && status.state === 'connected') {
      onLoad?.();
    }
  }, [isWebRTC, status.state, onLoad]);

  // Map protocol to display label
  const protocolLabel = {
    webrtc: 'WebRTC',
    mse: 'MSE',
    hls: 'HLS',
    go2rtc: t('video.streaming_webrtc'),
    mjpeg: t('video.streaming_mjpeg'),
  }[status.protocol] || status.protocol;

  return (
    <div className="relative w-full h-full" data-testid="video-player">
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
          style={{ objectFit }}
          data-testid="video-player-mjpeg"
          src={mjpegStream.streamUrl}
          alt={monitor.Name}
          onLoad={onLoad}
        />
      )}

      {showStatus && (
        <div className="absolute top-2 left-2 flex gap-2" data-testid="video-player-status">
          <Badge variant="secondary" className="text-xs">
            {protocolLabel}
          </Badge>
          {status.state === 'connecting' && (
            <Badge variant="outline" className="text-xs">{t('video.connecting')}</Badge>
          )}
          {status.state === 'error' && (
            <Badge variant="destructive" className="text-xs">{t('video.connection_error')}</Badge>
          )}
        </div>
      )}

      {status.state === 'error' && status.error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4" data-testid="video-player-error">
          <p className="text-center mb-4">{t('video.connection_failed')}</p>
          <p className="text-sm text-gray-300 mb-4">{status.error}</p>
          <Button onClick={handleRetry} variant="secondary" size="sm" data-testid="video-player-retry">
            {t('video.retry_connection')}
          </Button>
        </div>
      )}

      {status.state === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30" data-testid="video-player-loading">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
        </div>
      )}
    </div>
  );
}
