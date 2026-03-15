/**
 * Events Widget Component
 *
 * Displays recent events in a scrollable list.
 * Features:
 * - Auto-refresh every 30 seconds
 * - Clickable events navigate to event detail
 * - Optional monitor filtering
 * - Server-side "Only Detected Objects" filter
 * - Client-side tag filtering (All Tagged or specific tags)
 * - Tag chips displayed per event
 * - Configurable event limit
 * - Loading and empty states
 */

import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEvents } from '../../../api/events';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getEventCauseIcon } from '../../../lib/event-icons';
import { useBandwidthSettings } from '../../../hooks/useBandwidthSettings';
import { useEventTagMapping } from '../../../hooks/useEventTags';
import { TagChipList } from '../../events/TagChip';
import { ALL_TAGS_FILTER_ID } from '../../../hooks/useEventFilters';

interface EventsWidgetProps {
    /** Optional monitor IDs to filter events */
    monitorIds?: string[];
    /** Maximum number of events to display (default: 5) */
    limit?: number;
    /** Override auto-refresh interval in milliseconds (default: uses bandwidth settings) */
    refreshInterval?: number;
    /** Only show events with object detection results (server-side filter) */
    onlyDetectedObjects?: boolean;
    /** Tag IDs to filter by (client-side). Use ALL_TAGS_FILTER_ID for "any tagged" */
    tagIds?: string[];
}

export const EventsWidget = memo(function EventsWidget({
    monitorIds,
    limit = 5,
    refreshInterval,
    onlyDetectedObjects = false,
    tagIds = [],
}: EventsWidgetProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const bandwidth = useBandwidthSettings();
    const monitorIdFilter = monitorIds?.length ? monitorIds.join(',') : undefined;
    const { data: eventsData, isLoading } = useQuery({
        queryKey: ['events', monitorIdFilter, limit, onlyDetectedObjects],
        queryFn: () => getEvents({
            monitorId: monitorIdFilter,
            limit,
            sort: 'StartTime',
            direction: 'desc',
            notesRegexp: onlyDetectedObjects ? 'detected:' : undefined,
        }),
        refetchInterval: refreshInterval ?? bandwidth.eventsWidgetInterval,
    });

    // Fetch tags for displayed events
    const eventIds = useMemo(
        () => (eventsData?.events || []).map((e) => e.Event.Id),
        [eventsData?.events]
    );
    const { eventTagMap } = useEventTagMapping({
        eventIds,
        enabled: eventIds.length > 0,
    });

    // Apply client-side tag filter
    const events = useMemo(() => {
        const raw = eventsData?.events || [];
        if (tagIds.length === 0 || eventTagMap.size === 0) return raw;

        const isAllTagsFilter = tagIds.includes(ALL_TAGS_FILTER_ID);
        return raw.filter((e) => {
            const eTags = eventTagMap.get(e.Event.Id) || [];
            if (isAllTagsFilter) return eTags.length > 0;
            return eTags.some((tag) => tagIds.includes(tag.Id));
        });
    }, [eventsData?.events, tagIds, eventTagMap]);

    if (isLoading) {
        return (
            <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
                ))}
            </div>
        );
    }

    if (!events.length) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4">
                {t('dashboard.no_recent_events')}
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="divide-y">
                {events.map((event) => {
                    const tags = eventTagMap.get(event.Event.Id) || [];
                    return (
                        <div
                            key={event.Event.Id}
                            className="p-3 hover:bg-muted/50 cursor-pointer transition-colors flex items-center gap-3"
                            onClick={() => navigate(`/events/${event.Event.Id}`, { state: { from: '/dashboard' } })}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-sm truncate">{event.Event.Name}</span>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {format(new Date(event.Event.StartDateTime), 'HH:mm:ss')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    {(() => {
                                        const CauseIcon = getEventCauseIcon(event.Event.Cause);
                                        return (
                                            <span className="flex items-center gap-1">
                                                <CauseIcon className="h-3 w-3" />
                                                {event.Event.Cause}
                                            </span>
                                        );
                                    })()}
                                    <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">
                                        {event.Event.Length}s
                                    </span>
                                </div>
                                {tags.length > 0 && (
                                    <div className="mt-1">
                                        <TagChipList tags={tags} maxVisible={3} size="sm" />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
