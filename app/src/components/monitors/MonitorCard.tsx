/**
 * Monitor Card Component
 *
 * Displays a single monitor with a live stream preview (or static image),
 * status information, and quick action buttons.
 * It handles stream connection regeneration and snapshot downloading.
 */

import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Activity, Settings, Download, Clock } from 'lucide-react';
import { cn, formatEventCount } from '../../lib/utils';
import { downloadSnapshotFromElement } from '../../lib/download';
import { toast } from 'sonner';
import { useMonitorStream } from '../../hooks/useMonitorStream';
import type { MonitorCardProps } from '../../api/types';
import { log, LogLevel } from '../../lib/logger';
import { useTranslation } from 'react-i18next';
import { getMonitorAspectRatio } from '../../lib/monitor-rotation';
import type { CSSProperties } from 'react';

interface MonitorCardComponentProps extends MonitorCardProps {
  /** Callback to open the settings dialog for this monitor */
  onShowSettings: (monitor: MonitorCardProps['monitor']) => void;
}

/**
 * MonitorCard component.
 * Renders a card with monitor details and a live stream/image.
 *
 * @param props - Component properties
 * @param props.monitor - The monitor data object
 * @param props.status - The current status of the monitor (Connected/Disconnected, FPS, etc.)
 * @param props.eventCount - Number of events for this monitor
 * @param props.onShowSettings - Callback when settings button is clicked
 */
function MonitorCardComponent({
  monitor,
  status,
  eventCount,
  onShowSettings,
  objectFit,
}: MonitorCardComponentProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const resolvedFit: CSSProperties['objectFit'] = objectFit ?? 'cover';
  const isRunning = status?.Status === 'Connected';
  const aspectRatio = getMonitorAspectRatio(monitor.Width, monitor.Height, monitor.Orientation);

  // Use the custom hook to manage the monitor stream URL and connection state
  const {
    streamUrl,
    displayedImageUrl,
    imgRef,
    regenerateConnection,
  } = useMonitorStream({
    monitorId: monitor.Id,
  });

  /**
   * Handles image load errors.
   * Attempts to regenerate the connection key once before showing a fallback placeholder.
   */
  const handleImageError = () => {
    const img = imgRef.current;
    if (!img) return;

    // Only retry if we haven't retried too recently
    if (!img.dataset.retrying) {
      img.dataset.retrying = 'true';
      log.monitorCard(`Stream failed for ${monitor.Name}, regenerating connkey...`, LogLevel.WARN);
      regenerateConnection();
      toast.error(t('monitors.stream_connection_lost', { name: monitor.Name }));

      setTimeout(() => {
        if (img) {
          delete img.dataset.retrying;
        }
      }, 5000);
    } else {
      img.src =
        `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="240"%3E%3Crect fill="%231a1a1a" width="320" height="240"/%3E%3Ctext fill="%23444" x="50%" y="50%" text-anchor="middle" font-family="sans-serif"%3E${t('monitors.no_signal')}%3C/text%3E%3C/svg%3E`;
    }
  };

  /**
   * Downloads a snapshot of the current stream frame.
   */
  const handleDownloadSnapshot = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imgRef.current) {
      try {
        await downloadSnapshotFromElement(imgRef.current, monitor.Name);
        toast.success(t('monitors.snapshot_downloaded'));
      } catch (error) {
        log.monitorCard('Failed to download snapshot', LogLevel.ERROR, error);
        toast.error(t('monitors.snapshot_failed'));
      }
    }
  };

  const handleShowSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShowSettings(monitor);
  };

  return (
    <Card className="group overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-card ring-1 ring-border/50 hover:ring-primary/50" data-testid="monitor-card">
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Thumbnail Preview - Clickable */}
        <div
          className="relative bg-black/90 cursor-pointer w-full sm:w-72 md:w-80 focus:outline-none focus:ring-2 focus:ring-primary"
          style={{ aspectRatio: aspectRatio ?? '16 / 9' }}
          onClick={() => navigate(`/monitors/${monitor.Id}`, { state: { from: '/monitors' } })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate(`/monitors/${monitor.Id}`, { state: { from: '/monitors' } });
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`${t('monitors.view_live')}: ${monitor.Name}`}
        >
          {(displayedImageUrl || streamUrl) && (
            <img
              ref={imgRef}
              src={displayedImageUrl || streamUrl}
              alt={monitor.Name}
              className="w-full h-full"
              style={{ objectFit: resolvedFit }}
              onError={handleImageError}
              data-testid="monitor-player"
            />
          )}

          {/* Status Badge */}
          <div className="absolute top-2 left-2 z-10">
            <Badge
              variant={isRunning ? 'default' : 'destructive'}
              className={cn(
                'text-xs shadow-sm',
                isRunning
                  ? 'bg-green-500/90 hover:bg-green-500'
                  : 'bg-red-500/90 hover:bg-red-500'
              )}
              data-testid="monitor-status"
            >
              {isRunning ? t('monitors.live') : t('monitors.offline')}
            </Badge>
          </div>
        </div>

        {/* Monitor Info & Controls */}
        <div className="flex-1 flex flex-col gap-3 sm:gap-4">
          {/* Name & Resolution */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="font-semibold text-base truncate" data-testid="monitor-name">{monitor.Name}</div>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                ID: {monitor.Id}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {status?.CaptureFPS || '0'} FPS
              </span>
              <span>
                {monitor.Width}x{monitor.Height}
              </span>
              <span>{monitor.Type}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="text-sm font-medium text-muted-foreground">{t('monitors.function')}</span>
            <Badge
              variant={
                monitor.Capturing
                  ? (monitor.Capturing === 'None' ? 'outline' : 'secondary')
                  : (monitor.Function === 'None' ? 'outline' : 'secondary')
              }
              className="font-mono text-xs"
            >
              {monitor.Capturing ?? monitor.Function}
            </Badge>
            {monitor.Controllable === '1' && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <Activity className="h-3 w-3" />
                <span>{t('monitors.ptz_capable')}</span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 relative"
              onClick={() => navigate(`/events?monitorId=${monitor.Id}`, { state: { from: '/monitors' } })}
              data-testid="monitor-events-button"
            >
              <Clock className="h-3 w-3 mr-1" />
              {t('sidebar.events')}
              {eventCount !== undefined && eventCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 px-1 py-0 text-[10px] h-4 min-w-4 bg-blue-500/15 text-blue-400 border-blue-500/20"
                >
                  {formatEventCount(eventCount)}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={handleShowSettings}
              data-testid="monitor-settings-button"
            >
              <Settings className="h-3 w-3 mr-1" />
              {t('sidebar.settings')}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleDownloadSnapshot}
              title={t('monitors.download_snapshot')}
              aria-label={t('monitors.download_snapshot')}
              data-testid="monitor-download-button"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Memoize to prevent unnecessary re-renders when monitor data hasn't changed
export const MonitorCard = memo(MonitorCardComponent);
