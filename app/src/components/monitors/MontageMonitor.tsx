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

import { useState, useRef, memo } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import type { Monitor, MonitorStatus, Profile } from '../../api/types';
import { useAuthStore } from '../../stores/auth';
import { getMonitorRunState, monitorDotColor } from '../../lib/monitor-status';
import { useStreamLifecycle } from '../../hooks/useStreamLifecycle';
import { useServerUrls } from '../../hooks/useServerUrls';
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
import { log } from '../../lib/logger';
import { handleKeyClick } from '../../lib/tv-a11y';

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
  const zmVersion = useAuthStore((s) => s.version);
  const runState = getMonitorRunState(monitor, status, zmVersion);
  const settings = useSettingsStore(
    useShallow((state) => state.getProfileSettings(currentProfile?.id || ''))
  );
  const [imageLoaded, setImageLoaded] = useState(false);
  const [protocol, setProtocol] = useState('MJPEG');
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);
  const resolvedFit = objectFit ?? 'cover';
  const { portalPath } = useServerUrls(monitor.ServerId);
  const resolvedPortalUrl = portalPath ? portalPath.replace(/\/index\.php$/, '') : currentProfile?.portalUrl;

  // Stream lifecycle: connKey generation, CMD_QUIT on regen/unmount, media abort
  const { connKey } = useStreamLifecycle({
    monitorId: monitor.Id,
    monitorName: monitor.Name,
    portalUrl: resolvedPortalUrl,
    accessToken,
    viewMode: settings.viewMode,
    mediaRef,
    logFn: log.montageMonitor,
  });

  // Reset image loaded state when connKey changes (new stream connection)
  const prevConnKeyForLoadRef = useRef(0);
  if (connKey !== 0 && connKey !== prevConnKeyForLoadRef.current) {
    prevConnKeyForLoadRef.current = connKey;
    if (imageLoaded) {
      setImageLoaded(false);
    }
  }

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
            variant="default"
            className={cn(
              "h-1.5 w-1.5 p-0 rounded-full shrink-0",
              monitorDotColor(runState)
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
        onKeyDown={handleKeyClick}
        tabIndex={isEditing ? -1 : 0}
        role="button"
      >
        <VideoPlayer
          monitor={monitor}
          profile={currentProfile}
          externalMediaRef={mediaRef}
          objectFit={resolvedFit}
          muted={true}
          className="w-full h-full"
          onLoad={() => setImageLoaded(true)}
          onProtocolChange={setProtocol}
        />
        {settings.montageShowToolbar && (
          <span className="absolute bottom-1.5 right-1.5 z-30 text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white/90 font-medium pointer-events-none">
            {protocol}
          </span>
        )}
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
