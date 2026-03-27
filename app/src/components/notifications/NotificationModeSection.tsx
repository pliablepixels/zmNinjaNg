/**
 * Notification Mode Section
 *
 * Mode selection UI (ES vs Direct mode) and Direct mode options
 * (polling interval, object-detection-only toggle).
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { NotificationMode } from '../../types/notifications';
import type { NotificationSettings } from '../../stores/notifications';

export interface NotificationModeSectionProps {
  settings: NotificationSettings;
  directModeAvailable: boolean | null;
  profileId: string;
  onModeChange: (mode: NotificationMode) => void;
  onUpdateSettings: (profileId: string, updates: Partial<NotificationSettings>) => void;
  onPollingIntervalRestart: () => void;
}

export function NotificationModeSection({
  settings,
  directModeAvailable,
  profileId,
  onModeChange,
  onUpdateSettings,
  onPollingIntervalRestart,
}: NotificationModeSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Notification Mode Selector */}
      <Card>
        <CardHeader>
          <CardTitle>{t('notification_settings.mode_title')}</CardTitle>
          <CardDescription>
            {t('notification_settings.mode_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* ES Mode */}
            <button
              type="button"
              onClick={() => onModeChange('es')}
              className={`p-3 rounded-lg border text-left transition-colors ${
                (settings.notificationMode || 'es') === 'es'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
              data-testid="notification-mode-es"
            >
              <div className="font-semibold text-sm">{t('notification_settings.mode_es')}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('notification_settings.mode_es_desc')}
              </p>
            </button>

            {/* Direct Mode */}
            <button
              type="button"
              onClick={() => onModeChange('direct')}
              disabled={directModeAvailable !== true}
              className={`p-3 rounded-lg border text-left transition-colors ${
                settings.notificationMode === 'direct'
                  ? 'border-primary bg-primary/5'
                  : directModeAvailable
                    ? 'border-border hover:border-muted-foreground/50'
                    : 'border-border opacity-50 cursor-not-allowed'
              }`}
              title={directModeAvailable === false ? t('notification_settings.mode_direct_unavailable') : undefined}
              data-testid="notification-mode-direct"
            >
              <div className="font-semibold text-sm">{t('notification_settings.mode_direct')}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('notification_settings.mode_direct_desc')}
              </p>
              {directModeAvailable === false && (
                <p className="text-xs text-destructive mt-1">
                  {t('notification_settings.mode_direct_unavailable')}
                </p>
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Direct Mode Options */}
      {settings.notificationMode === 'direct' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('notification_settings.direct_options_title')}</CardTitle>
            <CardDescription>
              {t('notification_settings.direct_options_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('notification_settings.polling_interval')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('notification_settings.polling_interval_desc')}
                </p>
              </div>
              <Select
                value={String(settings.pollingInterval || 30)}
                onValueChange={(value) => {
                  onUpdateSettings(profileId, { pollingInterval: parseInt(value, 10) });
                  onPollingIntervalRestart();
                }}
              >
                <SelectTrigger className="w-28" data-testid="polling-interval-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10s</SelectItem>
                  <SelectItem value="15">15s</SelectItem>
                  <SelectItem value="30">30s</SelectItem>
                  <SelectItem value="60">60s</SelectItem>
                  <SelectItem value="120">120s</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="only-detected">{t('notification_settings.only_detected')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('notification_settings.only_detected_desc')}
                </p>
              </div>
              <Switch
                id="only-detected"
                checked={settings.onlyDetectedEvents || false}
                onCheckedChange={(checked) =>
                  onUpdateSettings(profileId, { onlyDetectedEvents: checked })
                }
                data-testid="only-detected-toggle"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
