/**
 * Event List View
 *
 * List view of events with thumbnails and metadata.
 */

import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { EventCard } from './EventCard';
import { getEventImageUrl, type EventFilters } from '../../api/events';
import { calculateThumbnailDimensions, EVENT_GRID_CONSTANTS, getMonitorDimensions } from '../../lib/event-utils';
import type { EventData, Monitor, Tag } from '../../api/types';

interface EventListViewProps {
  events: EventData[];
  monitors: Array<{ Monitor: Monitor }>;
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

// Helper to render a single event item
const EventItem = ({
  event,
  monitors,
  thumbnailFit,
  portalUrl,
  accessToken,
  eventTagMap,
  eventFilters,
}: {
  event: EventData;
  monitors: Array<{ Monitor: Monitor }>;
  thumbnailFit: 'contain' | 'cover' | 'none' | 'scale-down';
  portalUrl: string;
  accessToken?: string;
  eventTagMap?: Map<string, Tag[]>;
  eventFilters?: EventFilters;
}) => {
  const { Event } = event;
  const monitorData = monitors.find((m) => m.Monitor.Id === Event.MonitorId)?.Monitor;

  const { width: monitorWidth, height: monitorHeight } = getMonitorDimensions(monitorData, Event.Width, Event.Height);

  const { width: thumbnailWidth, height: thumbnailHeight } = calculateThumbnailDimensions(
    monitorWidth,
    monitorHeight,
    monitorData?.Orientation ?? Event.Orientation,
    EVENT_GRID_CONSTANTS.LIST_VIEW_TARGET_SIZE
  );

  const thumbnailUrl = getEventImageUrl(portalUrl, Event.Id, 'snapshot', {
    token: accessToken,
    width: thumbnailWidth,
    height: thumbnailHeight,
  });

  const monitorName = monitorData?.Name || `Camera ${Event.MonitorId}`;

  return (
    <div className="pb-3">
      <EventCard
        event={Event}
        monitorName={monitorName}
        thumbnailUrl={thumbnailUrl}
        objectFit={thumbnailFit}
        thumbnailWidth={thumbnailWidth}
        thumbnailHeight={thumbnailHeight}
        tags={eventTagMap?.get(Event.Id)}
        eventFilters={eventFilters}
      />
    </div>
  );
};

export const EventListView = ({
  events,
  monitors,
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
}: EventListViewProps) => {
  const { t } = useTranslation();

  const isLoadingData = isLoadingMore || isFetching;
  const hasMore = totalCount !== undefined ? events.length < totalCount : false;
  const remaining = totalCount !== undefined ? Math.min(batchSize, totalCount - events.length) : batchSize;

  // Status header - shows "Showing X of Y events" at the top
  const header = (
    <div className="text-xs text-muted-foreground pb-3 flex items-center gap-2">
      {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
      {totalCount !== undefined
        ? t('events.showing_of_total', { showing: events.length, total: totalCount })
        : t('events.showing_events', { count: events.length })}
    </div>
  );

  // Footer with Load More button
  const footer = hasMore ? (
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
  ) : null;

  return (
    <div className="min-h-0" data-testid="event-list">
      {header}
      {events.map((event) => (
        <EventItem
          key={event.Event.Id}
          event={event}
          monitors={monitors}
          thumbnailFit={thumbnailFit}
          portalUrl={portalUrl}
          accessToken={accessToken}
          eventTagMap={eventTagMap}
          eventFilters={eventFilters}
        />
      ))}
      {footer}
    </div>
  );
};
