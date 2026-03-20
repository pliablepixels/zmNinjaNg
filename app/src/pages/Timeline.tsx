import { useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getEvents } from '../api/events';
import { getMonitors } from '../api/monitors';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { RefreshCw, Filter, Activity, AlertCircle, Clock, ScanSearch, X } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { filterEnabledMonitors } from '../lib/filters';
import { TIMELINE } from '../lib/zmninja-ng-constants';
import { escapeHtml } from '../lib/utils';
import { formatForServer } from '../lib/time';
import { Timeline as VisTimeline } from 'vis-timeline/standalone';
import { DataSet } from 'vis-data';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import '../styles/timeline.css';
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

interface TimelineGroup {
  id: string;
  content: string;
  style?: string;
}

export default function Timeline() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineInstance = useRef<VisTimeline | null>(null);

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

  // Build monitor filter string for API
  const monitorFilter = useMemo(() => {
    if (selectedMonitorIds.length === 0) {
      return undefined;
    }
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
        limit: 500,
      }),
  });

  // Initialize and update timeline
  useEffect(() => {
    if (!timelineRef.current || !data?.events) return;

    // Professional color palette with better contrast
    const colors = [
      { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' }, // Blue
      { bg: '#ef4444', border: '#dc2626', text: '#ffffff' }, // Red
      { bg: '#10b981', border: '#059669', text: '#ffffff' }, // Green
      { bg: '#f59e0b', border: '#d97706', text: '#ffffff' }, // Amber
      { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' }, // Violet
      { bg: '#ec4899', border: '#db2777', text: '#ffffff' }, // Pink
      { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' }, // Cyan
      { bg: '#84cc16', border: '#65a30d', text: '#ffffff' }, // Lime
      { bg: '#f97316', border: '#ea580c', text: '#ffffff' }, // Orange
      { bg: '#6366f1', border: '#4f46e5', text: '#ffffff' }, // Indigo
    ];

    // Create groups (one per monitor)
    // Deduplicate monitors to prevent crashes
    const uniqueMonitors = Array.from(
      new Map(enabledMonitors.map(m => [m.Monitor.Id, m])).values()
    );

    const groups = new DataSet(
      uniqueMonitors.map(({ Monitor }) => {
        const colorIdx = parseInt(Monitor.Id) % colors.length;
        const color = colors[colorIdx];
        return {
          id: Monitor.Id,
          content: `<strong>${escapeHtml(Monitor.Name)}</strong>`,
          style: `background: linear-gradient(to right, ${color.bg}15, ${color.bg}08);`,
        };
      })
    );

    // Create items (events)
    // Deduplicate events to prevent crashes
    const uniqueEvents = Array.from(
      new Map(data.events.map(e => [e.Event.Id, e])).values()
    );

    const items = new DataSet(
      uniqueEvents.map(({ Event }) => {
        const startTime = new Date(Event.StartDateTime.replace(' ', 'T'));
        const endTime = Event.EndDateTime ? new Date(Event.EndDateTime.replace(' ', 'T')) : new Date(startTime.getTime() + parseInt(Event.Length) * 1000);
        const colorIdx = parseInt(Event.MonitorId) % colors.length;
        const color = colors[colorIdx];

        // Determine event severity based on alarm frames
        const alarmRatio = parseInt(Event.AlarmFrames) / parseInt(Event.Frames);
        const isHighPriority = alarmRatio > 0.5;

        // Format duration nicely
        const duration = parseInt(Event.Length);
        const durationText = duration >= 60
          ? `${Math.floor(duration / 60)}m ${duration % 60}s`
          : `${duration}s`;

        return {
          id: Event.Id,
          group: Event.MonitorId,
          start: startTime,
          end: endTime,
          content: `<div style="display: flex; align-items: center; gap: 4px;">
            ${isHighPriority ? '<span style="font-size: 10px;">⚠️</span>' : ''}
            <span style="font-weight: 600;">${escapeHtml(Event.Cause)}</span>
            <span style="opacity: 0.8;">•</span>
            <span>${durationText}</span>
          </div>`,
          title: `<strong>${escapeHtml(Event.Name)}</strong>\n━━━━━━━━━━━━━━━\n${t('timeline.tooltip_cause')}: ${escapeHtml(Event.Cause)}\n${t('timeline.tooltip_time')}: ${format(startTime, 'HH:mm:ss')}\n${t('timeline.tooltip_duration')}: ${durationText}\n${t('timeline.tooltip_frames_total')}: ${Event.Frames} total\n${t('timeline.tooltip_alarm_frames')}: ${Event.AlarmFrames}\n${t('timeline.tooltip_score')}: ${Event.MaxScore}`,
          style: `
            background: linear-gradient(135deg, ${color.bg} 0%, ${color.bg}dd 100%);
            border-color: ${color.border};
            color: ${color.text};
            ${isHighPriority ? 'border-width: 3px; box-shadow: 0 0 8px ' + color.border + '80;' : ''}
          `,
          className: 'timeline-event',
        };
      })
    );

    // Timeline options — set start/end so vis-timeline opens at the filter range
    const windowStart = new Date(startDate);
    const windowEnd = new Date(endDate);
    const options = {
      width: '100%',
      height: '600px',
      start: windowStart,
      end: windowEnd,
      margin: {
        item: {
          horizontal: 10,
          vertical: 8,
        },
        axis: 50,
      },
      orientation: 'top',
      stack: true,
      stackSubgroups: true,
      showCurrentTime: true,
      showMajorLabels: true,
      showMinorLabels: true,
      zoomMin: TIMELINE.zoomMin, // 1 minute
      zoomMax: 1000 * 60 * 60 * 24 * 90, // 90 days — supports month+ ranges
      moveable: true,
      zoomable: true,
      selectable: true,
      tooltip: {
        followMouse: true,
        overflowMethod: 'cap' as 'cap',
      },
      groupOrder: (a: TimelineGroup, b: TimelineGroup) => {
        return parseInt(a.id) - parseInt(b.id);
      },
    };

    // Destroy previous instance and recreate — vis-timeline doesn't reliably
    // update when items + window change simultaneously
    if (timelineInstance.current) {
      timelineInstance.current.destroy();
      timelineInstance.current = null;
    }

    timelineInstance.current = new VisTimeline(timelineRef.current, items, groups, options);

    // Handle event click
    timelineInstance.current.on('select', (properties) => {
      if (properties.items && properties.items.length > 0) {
        const eventId = properties.items[0];
        navigate(`/events/${eventId}`);
      }
    });



    return () => {
      if (timelineInstance.current) {
        timelineInstance.current.destroy();
        timelineInstance.current = null;
      }
    };
  }, [data, enabledMonitors, navigate, startDate, endDate]);

  // Note: cleanup on unmount is handled by the effect above (its return fn)

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

      {/* Timeline Graph */}
      <Card className="shadow-lg">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[600px] gap-4" data-testid="timeline-loading">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <div className="text-muted-foreground">{t('timeline.loading')}</div>
            </div>
          ) : data?.events && data.events.length === 0 ? (
            <div className="h-[600px] flex items-center justify-center" data-testid="timeline-empty-state">
              <EmptyState
                icon={Clock}
                title={t('timeline.no_events_found')}
                description={t('timeline.adjust_filters')}
              />
            </div>
          ) : (
            <div className="p-6" data-testid="timeline-content">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground" data-testid="timeline-events-count">
                  {t('timeline.showing_events', { count: data?.events.length })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('timeline.tip')}
                </div>
              </div>
              <div
                ref={timelineRef}
                className="vis-timeline-custom"
                data-testid="timeline-container"
                style={{
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Statistics */}
      {data?.events && data.events.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="timeline-statistics">
          <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{data.events.length}</div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">{t('timeline.total_events')}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {new Set(data.events.map(e => e.Event.MonitorId)).size}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">{t('timeline.active_monitors')}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-amber-600">
                    {data.events.reduce((sum, e) => sum + parseInt(e.Event.AlarmFrames || '0'), 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">{t('timeline.alarm_frames')}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(data.events.reduce((sum, e) => sum + parseFloat(e.Event.Length || '0'), 0) / 60)}m
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">{t('timeline.total_duration')}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
