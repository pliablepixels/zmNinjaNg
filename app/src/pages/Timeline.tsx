import { useMemo, useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { getEvents } from '../api/events';
import type { EventData } from '../api/types';
import { getMonitors } from '../api/monitors';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { RefreshCw, Filter, Clock, ScanSearch, X, Crosshair, ZoomIn, ZoomOut } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { filterEnabledMonitors } from '../lib/filters';
import { formatForServer } from '../lib/time';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { useTranslation } from 'react-i18next';
import { QuickDateRangeButtons } from '../components/ui/quick-date-range-buttons';
import { MonitorFilterPopoverContent } from '../components/filters/MonitorFilterPopover';
import { EmptyState } from '../components/ui/empty-state';
import { NotificationBadge } from '../components/NotificationBadge';
import { useTimelineFilters } from '../hooks/useTimelineFilters';
import { useEventTagMapping } from '../hooks/useEventTags';
import { TimelineCanvas } from '../components/timeline/TimelineCanvas';
import { DetectionFilterTabs, categorizeEvent, type DetectionCategory } from '../components/timeline/DetectionFilterTabs';
import { EventPreviewPopover } from '../components/timeline/EventPreviewPopover';
import type { TimelineEvent } from '../components/timeline/timeline-layout';
import type { MonitorRow } from '../components/timeline/timeline-renderer';
import type { ScrubberState } from '../components/timeline/TimelineScrubber';

export default function Timeline() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const {
    selectedMonitorIds, startDateInput, endDateInput, onlyDetectedObjects,
    setSelectedMonitorIds, setStartDateInput, setEndDateInput, setOnlyDetectedObjects,
    clearFilters, activeFilterCount,
  } = useTimelineFilters();

  // Stable default dates — computed once, not every render
  const defaultDates = useRef({
    start: format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
    end: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });
  const startDate = startDateInput || defaultDates.current.start;
  const endDate = endDateInput || defaultDates.current.end;

  // Detection filter state
  const [detectionCategory, setDetectionCategory] = useState<DetectionCategory>('all');

  // Viewport control keys — increment to trigger action
  const [resetKey, setResetKey] = useState(0);
  const [zoomInKey, setZoomInKey] = useState(0);
  const [zoomOutKey, setZoomOutKey] = useState(0);

  // Scrubber state — saved for restore after navigating back
  const scrubberStateRef = useRef<ScrubberState | null>(null);
  const initialScrubberState = (location.state as { scrubberState?: ScrubberState })?.scrubberState ?? null;

  const handleScrubberStateChange = useCallback((state: ScrubberState | null) => {
    scrubberStateRef.current = state;
  }, []);

  /** Navigate to event, preserving scrubber state for return. */
  const navigateToEvent = useCallback((eventId: string) => {
    navigate(`/events/${eventId}`, {
      state: { from: '/timeline', scrubberState: scrubberStateRef.current },
    });
  }, [navigate]);

  // Event preview popover state
  const [selectedEvent, setSelectedEvent] = useState<{
    event: TimelineEvent;
    position: { x: number; y: number };
  } | null>(null);

  // Fetch monitors
  const { data: monitorsData } = useQuery({
    queryKey: ['monitors'],
    queryFn: getMonitors,
  });

  // Get enabled monitors
  const enabledMonitors = useMemo(
    () => monitorsData?.monitors ? filterEnabledMonitors(monitorsData.monitors) : [],
    [monitorsData]
  );

  // Build monitor lookup map
  const monitorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const { Monitor } of enabledMonitors) {
      map.set(Monitor.Id, Monitor.Name);
    }
    return map;
  }, [enabledMonitors]);

  // Build monitor filter string for API
  const monitorFilter = useMemo(() => {
    if (selectedMonitorIds.length === 0) return undefined;
    return selectedMonitorIds.join(',');
  }, [selectedMonitorIds]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['timeline-events', startDate, endDate, monitorFilter, onlyDetectedObjects],
    queryFn: () =>
      getEvents({
        startDateTime: formatForServer(new Date(startDate)),
        endDateTime: formatForServer(new Date(endDate)),
        monitorId: monitorFilter,
        notesRegexp: onlyDetectedObjects ? 'detected:' : undefined,
        sort: 'StartDateTime',
        direction: 'desc',
        limit: 2000,
      }),
  });

  // Transform API events to TimelineEvent[]
  const allTimelineEvents: TimelineEvent[] = useMemo(() => {
    if (!data?.events) return [];
    return data.events.map(({ Event }) => ({
      id: Event.Id,
      monitorId: Event.MonitorId,
      startMs: new Date(Event.StartDateTime.replace(' ', 'T')).getTime(),
      endMs: Event.EndDateTime
        ? new Date(Event.EndDateTime.replace(' ', 'T')).getTime()
        : new Date(Event.StartDateTime.replace(' ', 'T')).getTime() + parseFloat(Event.Length) * 1000,
      cause: Event.Cause,
      alarmRatio: parseInt(Event.AlarmFrames) / Math.max(parseInt(Event.Frames), 1),
      notes: Event.Notes ?? '',
    }));
  }, [data]);

  // Compute detection category counts
  const detectionCounts = useMemo(() => {
    const counts: Record<DetectionCategory, number> = {
      all: allTimelineEvents.length,
      person: 0,
      vehicle: 0,
      animal: 0,
      other: 0,
    };
    for (const ev of allTimelineEvents) {
      const cat = categorizeEvent(ev.notes);
      counts[cat]++;
    }
    return counts;
  }, [allTimelineEvents]);

  // Filter by detection category
  const filteredEvents = useMemo(() => {
    if (detectionCategory === 'all') return allTimelineEvents;
    return allTimelineEvents.filter((ev) => categorizeEvent(ev.notes) === detectionCategory);
  }, [allTimelineEvents, detectionCategory]);

  // Build MonitorRow[] for canvas — only monitors that have events in the filtered set
  const monitorRows: MonitorRow[] = useMemo(() => {
    const activeIds = new Set(filteredEvents.map((ev) => ev.monitorId));
    const rows: MonitorRow[] = [];
    // Deduplicate and maintain stable order
    const seen = new Set<string>();
    for (const { Monitor } of enabledMonitors) {
      if (activeIds.has(Monitor.Id) && !seen.has(Monitor.Id)) {
        seen.add(Monitor.Id);
        rows.push({ id: Monitor.Id, name: Monitor.Name });
      }
    }
    return rows;
  }, [enabledMonitors, filteredEvents]);

  // Canvas time range — fit to actual event extent (with padding), fall back to filter range
  const { startMs, endMs } = useMemo(() => {
    const filterStart = new Date(startDate).getTime();
    const filterEnd = new Date(endDate).getTime();

    if (filteredEvents.length === 0) {
      return { startMs: filterStart, endMs: filterEnd };
    }

    let minMs = Infinity;
    let maxMs = -Infinity;
    for (const ev of filteredEvents) {
      if (ev.startMs < minMs) minMs = ev.startMs;
      if (ev.endMs > maxMs) maxMs = ev.endMs;
    }

    // Add 5% padding on each side so events aren't flush with edges
    const span = maxMs - minMs;
    const padding = Math.max(span * 0.05, 60_000); // at least 1 minute
    return {
      startMs: Math.max(filterStart, minMs - padding),
      endMs: Math.min(filterEnd, maxMs + padding),
    };
  }, [filteredEvents, startDate, endDate]);

  // Fetch tags for loaded events
  const eventIds = useMemo(
    () => data?.events?.map((e) => e.Event.Id) ?? [],
    [data],
  );
  const { getTagsForEvent } = useEventTagMapping({ eventIds });

  // Build a lookup from raw API events for the preview popover
  const rawEventMap = useMemo(() => {
    const map = new Map<string, EventData>();
    if (!data?.events) return map;
    for (const e of data.events) {
      map.set(e.Event.Id, e);
    }
    return map;
  }, [data]);

  const handleEventClick = useCallback((ev: TimelineEvent) => {
    // Find the raw API event data for the popover
    const raw = rawEventMap.get(ev.id);
    if (!raw) return;
    // Position the popover near the center of the screen
    setSelectedEvent({
      event: ev,
      position: { x: window.innerWidth / 2 - 144, y: 200 },
    });
  }, [rawEventMap]);

  const handleEventHover = useCallback((_event: TimelineEvent | null, _x: number, _y: number) => {
    // Hover is handled by the canvas renderer (highlight effect)
  }, []);

  const handleOpenEvent = useCallback((eventId: string) => {
    setSelectedEvent(null);
    navigateToEvent(eventId);
  }, [navigateToEvent]);

  const handleClosePopover = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  // Stats
  const totalAlarmFrames = useMemo(
    () => data?.events?.reduce((sum, e) => sum + parseInt(e.Event.AlarmFrames || '0'), 0) ?? 0,
    [data]
  );
  const totalDurationMins = useMemo(
    () => Math.round((data?.events?.reduce((sum, e) => sum + parseFloat(e.Event.Length || '0'), 0) ?? 0) / 60),
    [data]
  );
  const activeMonitorCount = useMemo(
    () => data?.events ? new Set(data.events.map((e) => e.Event.MonitorId)).size : 0,
    [data]
  );

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-lg font-bold mb-6">{t('timeline.title')}</h1>
        <div className="p-4 bg-destructive/10 text-destructive rounded-md">
          {t('timeline.load_error')}: {(error as Error).message}
        </div>
      </div>
    );
  }

  // Build popover event data from selected event
  const popoverEvent = selectedEvent ? (() => {
    const raw = rawEventMap.get(selectedEvent.event.id);
    if (!raw) return null;
    return {
      id: raw.Event.Id,
      monitorId: raw.Event.MonitorId,
      cause: raw.Event.Cause,
      startDateTime: raw.Event.StartDateTime,
      duration: raw.Event.Length,
      alarmFrames: raw.Event.AlarmFrames,
      notes: raw.Event.Notes,
      monitorName: monitorNameMap.get(raw.Event.MonitorId) ?? raw.Event.Name,
      tags: getTagsForEvent(raw.Event.Id).map((tag) => tag.Name),
    };
  })() : null;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6" data-testid="timeline-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight">{t('timeline.title')}</h1>
            <NotificationBadge />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
            <span className="hidden sm:inline">{t('timeline.subtitle')}</span>
            {selectedMonitorIds.length > 0 && ` (${t('timeline.cameras_selected', { count: selectedMonitorIds.length })})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { clearFilters(); defaultDates.current = { start: format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"), end: format(new Date(), "yyyy-MM-dd'T'HH:mm") }; }} variant="outline" size="sm" className="h-8 sm:h-9" data-testid="timeline-reset-button">
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('common.reset')}</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="startDate" className="text-xs">{t('timeline.start_date')}</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDateInput(e.target.value)}
                data-testid="timeline-start-date"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-xs">{t('timeline.end_date')}</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDateInput(e.target.value)}
                data-testid="timeline-end-date"
              />
            </div>
            <div>
              <Label className="text-xs">{t('timeline.monitors')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between" data-testid="timeline-monitor-filter">
                    {selectedMonitorIds.length === 0
                      ? t('timeline.all_monitors')
                      : t('timeline.monitors_selected', { count: selectedMonitorIds.length })}
                    <Filter className="h-4 w-4 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm">
                  <MonitorFilterPopoverContent
                    monitors={enabledMonitors}
                    selectedMonitorIds={selectedMonitorIds}
                    onSelectionChange={setSelectedMonitorIds}
                    idPrefix="timeline"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Object Detection Filter */}
          <div className="flex items-center justify-between p-3 rounded-md border bg-card">
            <div className="flex items-center gap-2">
              <ScanSearch className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="timeline-only-detected" className="cursor-pointer">
                {t('events.filter.onlyDetectedObjects')}
              </Label>
            </div>
            <Switch
              id="timeline-only-detected"
              checked={onlyDetectedObjects}
              onCheckedChange={setOnlyDetectedObjects}
              data-testid="timeline-detected-objects-toggle"
            />
          </div>

          {/* Quick Date Ranges + Clear */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">{t('events.quick_ranges')}</Label>
              <QuickDateRangeButtons
                onRangeSelect={({ start, end }) => {
                  setStartDateInput(format(start, "yyyy-MM-dd'T'HH:mm"));
                  setEndDateInput(format(end, "yyyy-MM-dd'T'HH:mm"));
                }}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground" data-testid="timeline-clear-filters">
                <X className="h-4 w-4 mr-1" />
                {t('common.clear')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detection Filter Tabs */}
      {allTimelineEvents.length > 0 && (
        <div className="flex items-center justify-between gap-4" data-testid="timeline-detection-filters">
          <DetectionFilterTabs
            selected={detectionCategory}
            onSelect={setDetectionCategory}
            counts={detectionCounts}
          />
        </div>
      )}

      {/* Timeline Canvas */}
      <Card className="shadow-lg">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[600px] gap-4" data-testid="timeline-loading">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <div className="text-muted-foreground">{t('timeline.loading')}</div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="h-[600px] flex items-center justify-center" data-testid="timeline-empty-state">
              <EmptyState
                icon={Clock}
                title={detectionCategory !== 'all' ? t('timeline.no_events_in_range') : t('timeline.no_events_found')}
                description={t('timeline.adjust_filters')}
              />
            </div>
          ) : (
            <div className="p-4" data-testid="timeline-content">
              <div className="mb-2 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => setZoomInKey((k) => k + 1)}
                  title="Zoom in"
                  data-testid="timeline-zoom-in-button"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => setZoomOutKey((k) => k + 1)}
                  title="Zoom out"
                  data-testid="timeline-zoom-out-button"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => setResetKey((k) => k + 1)}
                  title={t('timeline.center_view')}
                  data-testid="timeline-center-button"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                </Button>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-xs text-muted-foreground/50">
                  {t('timeline.pinch_to_zoom')}
                </span>
              </div>
              <TimelineCanvas
                monitors={monitorRows}
                events={filteredEvents}
                startMs={startMs}
                endMs={endMs}
                resetKey={resetKey}
                zoomInKey={zoomInKey}
                zoomOutKey={zoomOutKey}
                onEventClick={handleEventClick}
                onEventHover={handleEventHover}
                onScrubberEventTap={navigateToEvent}
                onScrubberStateChange={handleScrubberStateChange}
                initialScrubberState={initialScrubberState}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Preview Popover */}
      {selectedEvent && popoverEvent && (
        <EventPreviewPopover
          event={popoverEvent}
          position={selectedEvent.position}
          onOpenEvent={handleOpenEvent}
          onClose={handleClosePopover}
        />
      )}

      {/* Event Statistics — compact inline */}
      {data?.events && data.events.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" data-testid="timeline-statistics">
          <span><span className="font-semibold text-blue-500">{data.events.length}</span> {t('timeline.total_events')}</span>
          <span className="text-border">|</span>
          <span><span className="font-semibold text-green-500">{activeMonitorCount}</span> {t('timeline.active_monitors')}</span>
          <span className="text-border">|</span>
          <span><span className="font-semibold text-amber-500">{totalAlarmFrames.toLocaleString()}</span> {t('timeline.alarm_frames')}</span>
          <span className="text-border">|</span>
          <span><span className="font-semibold text-purple-500">{totalDurationMins}m</span> {t('timeline.total_duration')}</span>
        </div>
      )}
    </div>
  );
}
