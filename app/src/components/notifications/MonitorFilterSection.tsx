/**
 * Monitor Filter Section
 *
 * Per-monitor notification filter list with enable toggles,
 * interval inputs, and quick-set buttons.
 */

import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import type { MonitorData } from '../../api/types';
import type { NotificationSettings } from '../../stores/notifications';

export interface MonitorFilterSectionProps {
  settings: NotificationSettings;
  monitors: MonitorData[];
  onAllMonitorsToggle: (allMonitors: boolean) => void;
  onMonitorToggle: (monitorId: number, enabled: boolean) => void;
  onIntervalChange: (monitorId: number, interval: number) => void;
}

export function MonitorFilterSection({
  settings,
  monitors,
  onAllMonitorsToggle,
  onMonitorToggle,
  onIntervalChange,
}: MonitorFilterSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('notification_settings.monitor_filters_title')}</CardTitle>
        <CardDescription>
          {t('notification_settings.monitor_filters_desc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* All Monitors toggle */}
        <div
          className="flex items-center justify-between p-4 rounded-lg border bg-card"
          data-testid="notification-all-monitors-card"
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor="all-monitors" className="text-base font-semibold">
              {t('notification_settings.all_monitors')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('notification_settings.all_monitors_desc')}
            </p>
          </div>
          <Switch
            id="all-monitors"
            checked={settings.allMonitors}
            onCheckedChange={onAllMonitorsToggle}
            data-testid="notification-all-monitors-toggle"
          />
        </div>

        {/* Individual monitor filters -- only shown when allMonitors is off */}
        {!settings.allMonitors && monitors.map((monitor) => {
          const monitorData = monitor.Monitor;
          const filter = settings.monitorFilters.find(
            (f) => f.monitorId === parseInt(monitorData.Id, 10)
          );
          const isEnabled = filter?.enabled || false;
          const interval = filter?.checkInterval || 60;

          return (
            <div
              key={monitorData.Id}
              className="flex flex-col gap-3 p-4 rounded-lg border bg-card"
              data-testid={`notification-monitor-card-${monitorData.Id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label
                    htmlFor={`monitor-${monitorData.Id}`}
                    className="text-base font-semibold"
                  >
                    {monitorData.Name}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t('notification_settings.monitor_id', { id: monitorData.Id })} • {t('notification_settings.function')}: {monitorData.Function}
                  </p>
                </div>
                <Switch
                  id={`monitor-${monitorData.Id}`}
                  checked={isEnabled}
                  onCheckedChange={(checked) =>
                    onMonitorToggle(parseInt(monitorData.Id, 10), checked)
                  }
                  data-testid={`notification-monitor-toggle-${monitorData.Id}`}
                />
              </div>

              {isEnabled && (
                <div className="flex flex-col gap-2 ml-6 pt-2 border-t">
                  <Label htmlFor={`interval-${monitorData.Id}`} className="text-sm">
                    {t('notification_settings.check_interval')}:
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id={`interval-${monitorData.Id}`}
                      type="number"
                      min="30"
                      max="3600"
                      step="30"
                      value={interval}
                      onChange={(e) =>
                        onIntervalChange(
                          parseInt(monitorData.Id, 10),
                          Number(e.target.value)
                        )
                      }
                      className="w-24"
                      data-testid={`notification-monitor-interval-${monitorData.Id}`}
                    />
                    <span className="text-sm text-muted-foreground">{t('notification_settings.seconds')}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onIntervalChange(parseInt(monitorData.Id, 10), 30)
                        }
                        data-testid={`notification-monitor-interval-30-${monitorData.Id}`}
                      >
                        {t('notification_settings.quick_interval_seconds', { value: 30 })}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onIntervalChange(parseInt(monitorData.Id, 10), 60)
                        }
                        data-testid={`notification-monitor-interval-60-${monitorData.Id}`}
                      >
                        {t('notification_settings.quick_interval_seconds', { value: 60 })}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onIntervalChange(parseInt(monitorData.Id, 10), 120)
                        }
                        data-testid={`notification-monitor-interval-120-${monitorData.Id}`}
                      >
                        {t('notification_settings.quick_interval_minutes', { value: 2 })}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {monitors.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {t('notification_settings.no_monitors')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
