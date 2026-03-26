/**
 * Monitors Page
 *
 * Displays a grid of all available monitors with their status and event counts.
 * Allows filtering and quick access to monitor details.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMonitors, updateMonitor } from '../api/monitors';
import { getConsoleEvents } from '../api/events';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useBandwidthSettings } from '../hooks/useBandwidthSettings';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import { Button } from '../components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { MonitorCard } from '../components/monitors/MonitorCard';
import { MonitorSettingsDialog } from '../components/monitor-detail/MonitorSettingsDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { filterEnabledMonitors, filterMonitorsByGroup } from '../lib/filters';
import { useGroupFilter } from '../hooks/useGroupFilter';
import { GroupFilterSelect } from '../components/filters/GroupFilterSelect';
import type { Monitor } from '../api/types';
import { NotificationBadge } from '../components/NotificationBadge';
import { toast } from 'sonner';
import { log, LogLevel } from '../lib/logger';
export default function Monitors() {
  const { t } = useTranslation();
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);

  const { currentProfile, settings } = useCurrentProfile();
  const bandwidth = useBandwidthSettings();
  const updateSettings = useSettingsStore((state) => state.updateProfileSettings);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const zmVersion = useAuthStore((s) => s.version);
  const { isFilterActive, filteredMonitorIds } = useGroupFilter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['monitors', currentProfile?.id],
    queryFn: getMonitors,
    enabled: !!currentProfile && isAuthenticated,
    refetchInterval: bandwidth.monitorStatusInterval,
  });


  const resolveErrorMessage = (err: unknown) => {
    const message = (err as Error)?.message || t('common.unknown_error');
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401 || /unauthorized/i.test(message)) {
      return t('common.auth_required');
    }
    return t('monitors.failed_to_load', { error: message });
  };

  // Fetch event counts for the last week
  const { data: eventCounts } = useQuery({
    queryKey: ['consoleEvents', '1 week'],
    queryFn: () => getConsoleEvents('1 week'),
    enabled: !!currentProfile && isAuthenticated,
    refetchInterval: bandwidth.consoleEventsInterval,
  });

  // Memoize filtered monitors (all monitors, regardless of status)
  const enabledMonitors = useMemo(() => {
    return data?.monitors ? filterEnabledMonitors(data.monitors) : [];
  }, [data?.monitors]);

  // Apply group filter if active
  const allMonitors = useMemo(() => {
    if (!isFilterActive) return enabledMonitors;
    return filterMonitorsByGroup(enabledMonitors, filteredMonitorIds);
  }, [enabledMonitors, isFilterActive, filteredMonitorIds]);

  const handleShowSettings = (monitor: Monitor) => {
    setSelectedMonitor(monitor);
    setShowPropertiesDialog(true);
  };

  // Settings dialog save handler
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const handleSaveSettings = useCallback(async (changes: Record<string, string | undefined>) => {
    if (!selectedMonitor) return;
    setIsSavingSettings(true);
    try {
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) params[`Monitor[${key}]`] = value;
      }
      if (Object.keys(params).length > 0) {
        await updateMonitor(selectedMonitor.Id, params);
      }
      await refetch();
      toast.success(t('monitor_detail.capture_updated'));
    } catch (error) {
      log.monitor('Settings save failed', LogLevel.ERROR, { error });
      toast.error(t('monitor_detail.capture_failed'));
    } finally {
      setIsSavingSettings(false);
    }
  }, [selectedMonitor, refetch, t]);

  const handleFeedFitChange = (value: string) => {
    if (!currentProfile) return;
    updateSettings(currentProfile.id, {
      monitorsFeedFit: value as typeof settings.monitorsFeedFit,
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold tracking-tight">{t('monitors.title')}</h1>
        </div>
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {resolveErrorMessage(error)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight">{t('monitors.title')}</h1>
            <NotificationBadge />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {t('monitors.count', { count: allMonitors.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GroupFilterSelect />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden md:inline">{t('monitors.feed_fit')}</span>
            <Select value={settings.monitorsFeedFit} onValueChange={handleFeedFitChange}>
              <SelectTrigger className="h-8 sm:h-9 w-[170px]" data-testid="monitors-fit-select">
                <SelectValue placeholder={t('monitors.feed_fit')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contain" data-testid="monitors-fit-contain">
                  {t('montage.fit_fit')}
                </SelectItem>
                <SelectItem value="cover" data-testid="monitors-fit-cover">
                  {t('montage.fit_crop')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2 h-8 sm:h-9">
            <RefreshCw className="h-4 w-4 sm:mr-0" />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </Button>
        </div>
      </div>

      {/* All Cameras */}
      <div className="space-y-3 sm:space-y-4">
        {allMonitors.length === 0 ? (
          <div className="p-8 text-center border rounded-lg bg-muted/20 text-muted-foreground" data-testid="monitors-empty-state">
            {t('monitors.no_cameras')}
          </div>
        ) : (
          <div className="space-y-4" data-testid="monitor-grid">
            {allMonitors.map(({ Monitor, Monitor_Status }) => (
              <MonitorCard
                key={Monitor.Id}
                monitor={Monitor}
                status={Monitor_Status}
                eventCount={eventCounts?.[Monitor.Id]}
                onShowSettings={handleShowSettings}
                objectFit={settings.monitorsFeedFit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Monitor Settings Dialog */}
      {selectedMonitor && (
        <MonitorSettingsDialog
          open={showPropertiesDialog}
          onOpenChange={setShowPropertiesDialog}
          monitor={selectedMonitor}
          zmVersion={zmVersion}
          onSave={handleSaveSettings}
          isSaving={isSavingSettings}
        />
      )}
    </div>
  );
}
