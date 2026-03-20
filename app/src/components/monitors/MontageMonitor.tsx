/**
 * Montage Monitor Component
 *
 * Individual monitor tile for the montage grid view.
 * Features:
 * - Live streaming or snapshot mode (MJPEG or WebRTC)
 * - WebRTC monitors start muted to avoid cacophony
 * - Auto-reconnection on stream failure
 * - Header bar with action buttons (download, events, timeline, maximize)
 * - Drag handle for grid repositioning (in edit mode)
 * - Click to navigate to monitor detail view
 * - Fullscreen mode: header slides in on hover from top edge
 */

import { useState, useEffect, useRef, memo } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import type { Monitor, MonitorStatus, Profile } from '../../api/types';
import { getZmsControlUrl } from '../../lib/url-builder';
import { ZMS_COMMANDS } from '../../lib/zm-constants';
import { httpGet } from '../../lib/http';
import { useMonitorStore } from '../../stores/monitors';
import { useSettingsStore } from '../../stores/settings';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { VideoPlayer } from '../video/VideoPlayer';
import { Clock, ChartGantt, Download, Maximize2, Pin } from 'lucide-react';
import { cn } from '../../lib/utils';
import { downloadSnapshotFromElement } from '../../lib/download';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { log, LogLevel } from '../../lib/logger';

interface MontageMonitorProps {
  monitor: Monitor;
  status: MonitorStatus | undefined;
  currentProfile: Profile | null;
  accessToken: string | null;
  navigate: NavigateFunction;
  isFullscreen?: boolean;
  isEditing?: boolean;
  isPinned?: boolean;
  onPinToggle?: () => void;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  showOverlay?: boolean;
}

function MontageMonitorComponent({
  monitor,
  status,
  currentProfile,
  accessToken,
  navigate,
  isFullscreen = false,
  isEditing = false,
  isPinned = false,
  onPinToggle,
  objectFit,
  showOverlay = false,
}: MontageMonitorProps) {
  const { t } = useTranslation();
  const isRunning = status?.Status === 'Connected';
  const regenerateConnKey = useMonitorStore((state) => state.regenerateConnKey);
  const settings = useSettingsStore(
    useShallow((state) => state.getProfileSettings(currentProfile?.id || ''))
  );
  const [connKey, setConnKey] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);
  const resolvedFit = objectFit ?? 'cover';
  // Track previous connKey to send CMD_QUIT before regenerating
  const prevConnKeyRef = useRef<number>(0);
  const isInitialMountRef = useRef(true);

  // Force regenerate connKey when component mounts or monitor ID changes
  useEffect(() => {
    const monitorId = monitor.Id;

    // Send CMD_QUIT for previous connKey before generating new one (skip on initial mount)
    if (!isInitialMountRef.current && prevConnKeyRef.current !== 0 && settings.viewMode === 'streaming' && currentProfile) {
      const controlUrl = getZmsControlUrl(
        currentProfile.portalUrl,
        ZMS_COMMANDS.cmdQuit,
        prevConnKeyRef.current.toString(),
        {
          token: accessToken || undefined,
        }
      );

      log.montageMonitor('Sending CMD_QUIT before regenerating connkey', LogLevel.DEBUG, {
        monitorId,
        monitorName: monitor.Name,
        oldConnkey: prevConnKeyRef.current,
      });

      httpGet(controlUrl).catch(() => {
        // Silently ignore errors - connection may already be closed
      });
    }

    isInitialMountRef.current = false;

    // Generate new connKey
    log.montageMonitor('Regenerating connkey', LogLevel.DEBUG, { monitorId });
    setImageLoaded(false);
    const newKey = regenerateConnKey(monitorId);
    setConnKey(newKey);
    prevConnKeyRef.current = newKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitor.Id]); // ONLY regenerate when monitor ID changes

  // Store cleanup parameters in ref to access latest values on unmount
  const cleanupParamsRef = useRef({ monitorId: '', monitorName: '', connKey: 0, profile: currentProfile, token: accessToken, viewMode: settings.viewMode });

  // Update cleanup params whenever they change
  useEffect(() => {
    cleanupParamsRef.current = {
      monitorId: monitor.Id,
      monitorName: monitor.Name,
      connKey,
      profile: currentProfile,
      token: accessToken,
      viewMode: settings.viewMode,
    };
  }, [monitor.Id, monitor.Name, connKey, currentProfile, accessToken, settings.viewMode]);

  // Cleanup: send CMD_QUIT and abort image loading on unmount ONLY
  useEffect(() => {
    return () => {
      const params = cleanupParamsRef.current;

      // Send CMD_QUIT to properly close the stream connection (only in streaming mode)
      if (params.viewMode === 'streaming' && params.profile && params.connKey !== 0) {
        const controlUrl = getZmsControlUrl(params.profile.portalUrl, ZMS_COMMANDS.cmdQuit, params.connKey.toString(), {
          token: params.token || undefined,
        });

        log.montageMonitor('Sending CMD_QUIT on unmount', LogLevel.DEBUG, {
          monitorId: params.monitorId,
          monitorName: params.monitorName,
          connkey: params.connKey,
        });

        // Send CMD_QUIT asynchronously, ignore errors (connection may already be closed)
        httpGet(controlUrl).catch(() => {
          // Silently ignore errors - server connection may already be closed
        });
      }

      // Abort image loading to release browser connection
      if (mediaRef.current) {
        log.montageMonitor('Aborting image element', LogLevel.DEBUG, { monitorId: params.monitorId });
        mediaRef.current.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      }
    };
  }, []); // Empty deps = only run on unmount

  // Handle snapshot download
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mediaRef.current) {
      downloadSnapshotFromElement(mediaRef.current, monitor.Name)
        .then(() => toast.success(t('montage.snapshot_saved', { name: monitor.Name })))
        .catch(() => toast.error(t('montage.snapshot_failed')));
    }
  };

  return (
    <Card
      className={cn(
        "h-full overflow-hidden flex flex-col rounded-none relative",
        isFullscreen
          ? "border-none shadow-none bg-black m-0 p-0"
          : "border-0 shadow-none bg-card",
      )}
    >
      {/* Edit mode border — rendered as overlay to avoid compact CSS !important overrides */}
      {isEditing && !isFullscreen && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            border: isPinned ? '2px solid rgba(96, 165, 250, 0.7)' : '2px solid rgba(250, 204, 21, 0.7)',
          }}
        />
      )}
      {/* Header / Drag Handle - Toggled via toolbar button in fullscreen mode */}
      <div
        className={cn(
          "flex items-center gap-1 px-2 h-8 shrink-0 select-none z-10",
          isFullscreen
            ? cn(
                "absolute top-0 left-0 right-0 bg-black/80 text-white transition-all duration-200",
                showOverlay ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
              )
            : "bg-card border-b",
          isEditing && !isFullscreen ? "hover:bg-accent/50" : "cursor-default"
        )}
      >
        {/* Monitor status and name */}
        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
          <Badge
            variant={isRunning ? "default" : "destructive"}
            className={cn(
              "h-1.5 w-1.5 p-0 rounded-full shrink-0",
              isRunning ? "bg-green-500 hover:bg-green-500" : "bg-red-500 hover:bg-red-500"
            )}
          />
          <span className={cn(
            "text-xs font-medium truncate",
            isFullscreen && "text-white"
          )} title={monitor.Name}>
            {monitor.Name}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6",
              isFullscreen ? "text-white hover:bg-white/20" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={handleDownload}
            title={t('montage.save_snapshot')}
            aria-label={t('montage.save_snapshot')}
            data-testid="montage-download-btn"
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6",
              isFullscreen ? "text-white hover:bg-white/20" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/events?monitorId=${monitor.Id}`);
            }}
            title={t('common.events')}
            aria-label={t('monitors.view_events')}
            data-testid="montage-events-btn"
          >
            <Clock className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6",
              isFullscreen ? "text-white hover:bg-white/20" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/timeline?monitorId=${monitor.Id}`);
            }}
            title={t('sidebar.timeline')}
            aria-label={t('sidebar.timeline')}
            data-testid="montage-timeline-btn"
          >
            <ChartGantt className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6",
              isFullscreen ? "text-white hover:bg-white/20" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/monitors/${monitor.Id}`);
            }}
            title={t('monitor_detail.maximize')}
            aria-label={t('monitor_detail.maximize')}
            data-testid="montage-maximize-btn"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Video Content */}
      <div
        className={cn(
          "flex-1 relative overflow-hidden",
          isFullscreen ? "bg-black" : "bg-black/90",
          !isFullscreen && "cursor-pointer"
        )}
        onClick={() => !isEditing && navigate(`/monitors/${monitor.Id}`)}
      >
        {/* Skeleton loader */}
        {!imageLoaded && (
          <div
            className="absolute inset-0 bg-muted/20 animate-pulse flex items-center justify-center"
          >
            <div className="text-muted-foreground text-xs">{monitor.Width} × {monitor.Height}</div>
          </div>
        )}

        <VideoPlayer
          monitor={monitor}
          profile={currentProfile}
          externalMediaRef={mediaRef}
          objectFit={resolvedFit}
          showStatus={false}
          muted={true}
          className="w-full h-full"
          onLoad={() => setImageLoaded(true)}
        />
      </div>

      {/* Pin button — bottom-left corner, outside drag handle, edit mode only */}
      {isEditing && !isFullscreen && onPinToggle && (
        <button
          type="button"
          className={cn(
            "absolute bottom-1 left-1 z-30 rounded-full p-1.5 touch-manipulation transition-all no-drag",
            isPinned
              ? "bg-blue-500 text-white shadow-md"
              : "bg-black/50 text-white/70 hover:bg-black/70 hover:text-white"
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onPinToggle(); }}
          title={isPinned ? t('montage.unpin_monitor') : t('montage.pin_monitor')}
          data-testid={`montage-pin-${monitor.Id}`}
        >
          <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
        </button>
      )}
    </Card>
  );
}

// Wrap in React.memo to prevent unnecessary re-renders
// This is important because grid layout changes can trigger parent re-renders
// and we don't want to tear down and re-establish video streams unnecessarily
export const MontageMonitor = memo(MontageMonitorComponent);
