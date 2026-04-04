/**
 * Event Montage View
 *
 * Grid view of events with thumbnails and metadata.
 * Features:
 * - Responsive grid layout
 * - Haptic feedback on downloads (native platforms)
 * - Touch-optimized download buttons
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, Loader2 } from 'lucide-react';
import { getEventCauseIcon } from '../../lib/event-icons';
import { getObjectClassIconFromList } from '../../lib/object-class-icons';
import { useDateTimeFormat } from '../../hooks/useDateTimeFormat';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { SecureImage } from '../ui/secure-image';
import { downloadEventVideo } from '../../lib/download';
import { getEventImageUrl, type EventFilters } from '../../api/events';
import { getPortalUrlForEvent } from '../../lib/server-resolver';
import { calculateThumbnailDimensions, getMonitorDimensions } from '../../lib/event-utils';
import { ZM_INTEGRATION } from '../../lib/zmninja-ng-constants';
import type { EventData, Monitor, Tag } from '../../api/types';
import { Capacitor } from '@capacitor/core';
import { TagChipList } from './TagChip';

interface EventMontageViewProps {
  events: EventData[];
  monitors: Array<{ Monitor: Monitor }>;
  gridCols: number;
  thumbnailFit: 'contain' | 'cover' | 'none' | 'scale-down';
  portalUrl: string;
  accessToken?: string;
  batchSize: number;
  totalCount?: number;
  isLoadingMore: boolean;
  isFetching?: boolean;
  onLoadMore: () => void;
  eventTagMap?: Map<string, Tag[]>;
  eventFilters?: EventFilters;
}

export const EventMontageView = ({
  events,
  monitors,
  gridCols,
  thumbnailFit,
  portalUrl,
  accessToken,
  batchSize,
  totalCount,
  isLoadingMore,
  isFetching = false,
  onLoadMore,
  eventTagMap,
  eventFilters,
}: EventMontageViewProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { fmtDateTimeShort } = useDateTimeFormat();

  // Haptic feedback helper
  const triggerHaptic = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        // Haptics not available, silently ignore
      }
    }
  };

  const isLoadingData = isLoadingMore || isFetching;
  const hasMore = totalCount !== undefined ? events.length < totalCount : false;
  const remaining = totalCount !== undefined ? Math.min(batchSize, totalCount - events.length) : batchSize;

  return (
    <div className="min-h-0" data-testid="events-montage-grid">
      {/* Status header */}
      <div className="text-xs text-muted-foreground pb-3 flex items-center gap-2">
        {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
        {totalCount !== undefined
          ? t('events.showing_of_total', { showing: events.length, total: totalCount })
          : t('events.showing_events', { count: events.length })}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
        {events.map((eventData) => {
          const event = eventData.Event;
          const monitorData = monitors.find((m) => m.Monitor.Id === event.MonitorId)?.Monitor;
          const monitorName = monitorData?.Name || `Camera ${event.MonitorId}`;
          const startTime = new Date(event.StartDateTime.replace(' ', 'T'));

          const { width: monitorWidth, height: monitorHeight } = getMonitorDimensions(monitorData, event.Width, event.Height);

          const { width: thumbnailWidth, height: thumbnailHeight } = calculateThumbnailDimensions(
            monitorWidth,
            monitorHeight,
            monitorData?.Orientation ?? event.Orientation,
            ZM_INTEGRATION.eventMontageImageWidth
          );

          const eventPortalUrl = getPortalUrlForEvent(event.MonitorId, monitors, portalUrl);
          const imageUrl = getEventImageUrl(eventPortalUrl, event.Id, 'snapshot', {
            token: accessToken,
            width: thumbnailWidth,
            height: thumbnailHeight,
          });

          const hasVideo = event.Videoed === '1';
          const aspectRatio = thumbnailWidth / thumbnailHeight;

          return (
            <Card
              key={event.Id}
              className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
              onClick={() => navigate(`/events/${event.Id}`, { state: { from: '/events', eventFilters } })}
            >
              <div className="relative bg-card" style={{ aspectRatio: aspectRatio.toString() }}>
                <SecureImage
                  src={imageUrl}
                  alt={event.Name}
                  className="w-full h-full"
                  style={{ objectFit: thumbnailFit }}
                  loading="lazy"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src =
                      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%231a1a1a" width="300" height="200"/%3E%3Ctext fill="%23444" x="50%" y="50%" text-anchor="middle" font-family="sans-serif"%3ENo Image%3C/text%3E%3C/svg%3E';
                  }}
                />
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {event.Length}s
                  </Badge>
                  {hasVideo && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await triggerHaptic();
                        downloadEventVideo(eventPortalUrl, event.Id, event.Name, accessToken);
                        // Background task drawer will show download progress
                      }}
                      title={t('eventMontage.download_video')}
                      aria-label={t('eventMontage.download_video')}
                      data-testid="event-download-button"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="p-3 space-y-1">
                <div className="font-medium text-sm truncate" title={event.Name}>
                  {event.Name}
                </div>
                <div className="text-xs text-muted-foreground truncate">{monitorName}</div>
                <div className="text-xs text-muted-foreground">{fmtDateTimeShort(startTime)}</div>
                {event.Cause && (() => {
                  const CauseIcon = getEventCauseIcon(event.Cause);
                  return (
                    <Badge variant="outline" className="text-xs gap-1">
                      <CauseIcon className="h-3 w-3" />
                      {event.Cause}
                    </Badge>
                  );
                })()}
                {event.Notes && (() => {
                  const noteText = event.Notes.split('|')[0].trim();
                  const isDetection = noteText.startsWith('detected:');
                  const classList = isDetection ? noteText.slice('detected:'.length) : '';
                  const NoteIcon = isDetection && classList ? getObjectClassIconFromList(classList) : null;
                  return (
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground truncate" title={event.Notes}>
                      {NoteIcon && <NoteIcon className="h-3 w-3 shrink-0" />}
                      <span className="truncate">{noteText}</span>
                    </p>
                  );
                })()}
                {/* Tags */}
                {eventTagMap && eventTagMap.get(event.Id) && (
                  <TagChipList
                    tags={eventTagMap.get(event.Id) || []}
                    maxVisible={3}
                    size="sm"
                    overflowText={(count) => t('events.tags.moreCount', { count })}
                  />
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Load More button */}
      {hasMore && (
        <div className="text-center py-4">
          <Button
            onClick={onLoadMore}
            disabled={isLoadingData}
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="events-load-more"
          >
            {isLoadingData ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('events.loading_more', { count: remaining })}
              </>
            ) : (
              t('events.load_more')
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
