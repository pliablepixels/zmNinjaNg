/**
 * Monitor Controls Card
 *
 * Displays alarm status/toggle and monitor mode selector.
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { isZmVersionAtLeast } from '../../lib/zm-version';
import type { MonitorFunction } from '../../pages/hooks/useModeControl';

interface MonitorControlsCardProps {
  // Alarm props
  hasAlarmStatus: boolean;
  displayAlarmArmed: boolean;
  alarmStatusLabel: string;
  isAlarmLoading: boolean;
  isAlarmUpdating: boolean;
  onAlarmToggle: (nextValue: boolean) => void;
  // Mode props
  currentFunction: MonitorFunction;
  isModeUpdating: boolean;
  onModeChange: (mode: MonitorFunction) => void;
  /** ZM server version string for feature detection. */
  zmVersion: string | null;
}

export function MonitorControlsCard({
  hasAlarmStatus,
  displayAlarmArmed,
  alarmStatusLabel,
  isAlarmLoading,
  isAlarmUpdating,
  onAlarmToggle,
  currentFunction,
  isModeUpdating,
  onModeChange,
  zmVersion,
}: MonitorControlsCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-muted/60 shadow-sm" data-testid="monitor-controls-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t('monitor_detail.controls_title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t('monitor_detail.alarm_status')}</span>
          <Badge variant={!hasAlarmStatus ? 'outline' : displayAlarmArmed ? 'destructive' : 'secondary'}>
            {isAlarmLoading && !isAlarmUpdating ? t('common.loading') : alarmStatusLabel}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="alarm-toggle" className="text-sm">
            {displayAlarmArmed ? t('monitor_detail.alarm_disarm_action') : t('monitor_detail.alarm_arm_action')}
          </Label>
          <Switch
            id="alarm-toggle"
            checked={displayAlarmArmed}
            onCheckedChange={onAlarmToggle}
            disabled={isAlarmUpdating || isAlarmLoading}
            data-testid="monitor-alarm-toggle"
          />
        </div>
        {!isZmVersionAtLeast(zmVersion, '1.38.0') && (
          <div className="space-y-2">
            <Label htmlFor="monitor-mode">{t('monitor_detail.mode_label')}</Label>
            <Select
              value={currentFunction}
              onValueChange={(value) => onModeChange(value as MonitorFunction)}
              disabled={isModeUpdating}
            >
              <SelectTrigger id="monitor-mode" data-testid="monitor-mode-select">
                <SelectValue placeholder={t('monitor_detail.mode_label')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Monitor">{t('monitor_detail.mode_monitor')}</SelectItem>
                <SelectItem value="Modect">{t('monitor_detail.mode_modect')}</SelectItem>
                <SelectItem value="Record">{t('monitor_detail.mode_record')}</SelectItem>
                <SelectItem value="Mocord">{t('monitor_detail.mode_mocord')}</SelectItem>
                <SelectItem value="Nodect">{t('monitor_detail.mode_nodect')}</SelectItem>
                <SelectItem value="None">{t('monitor_detail.mode_none')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isModeUpdating ? t('monitor_detail.mode_updating') : t('monitor_detail.mode_help')}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {isAlarmUpdating ? t('monitor_detail.alarm_updating') : t('monitor_detail.alarm_help')}
        </p>
      </CardContent>
    </Card>
  );
}
