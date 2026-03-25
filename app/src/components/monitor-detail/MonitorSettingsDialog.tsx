/**
 * Monitor Settings Dialog
 *
 * Tabbed settings panel for monitor configuration.
 * Shows Capturing/Analysing/Recording on ZM 1.38+, legacy Function on older servers.
 */

import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Monitor } from '../../api/types';
import type { MonitorFunction } from '../../pages/hooks/useModeControl';

interface MonitorSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monitor: Monitor;
  // Version detection
  hasNewApi: boolean;
  // Capture settings (ZM 1.38+)
  onCapturingChange?: (value: 'None' | 'Ondemand' | 'Always') => void;
  onAnalysingChange?: (value: 'None' | 'Always') => void;
  onRecordingChange?: (value: 'None' | 'OnMotion' | 'Always') => void;
  isCaptureUpdating?: boolean;
  // Legacy mode (ZM < 1.38)
  onFunctionChange?: (value: MonitorFunction) => void;
  isModeUpdating?: boolean;
  // Storage settings (both versions)
  onSaveJPEGsChange?: (value: string) => void;
  onVideoWriterChange?: (value: string) => void;
  isStorageUpdating?: boolean;
  // Enabled toggle
  onEnabledChange?: (enabled: boolean) => void;
  isEnabledUpdating?: boolean;
  // Cycle settings (MonitorDetail only)
  cycleSeconds?: number;
  onCycleSecondsChange?: (value: string) => void;
  // Read-only display (MonitorDetail only)
  feedFit?: string;
  orientedResolution?: string;
  rotationStatus?: string;
}

/** Shared row layout for label + value/control pairs. */
function SettingsRow({
  label,
  children,
  testId,
}: {
  label: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-b-0"
      data-testid={testId}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

export function MonitorSettingsDialog({
  open,
  onOpenChange,
  monitor,
  hasNewApi,
  onCapturingChange,
  onAnalysingChange,
  onRecordingChange,
  isCaptureUpdating = false,
  onFunctionChange,
  isModeUpdating = false,
  onSaveJPEGsChange,
  onVideoWriterChange,
  isStorageUpdating = false,
  onEnabledChange,
  isEnabledUpdating = false,
  cycleSeconds,
  onCycleSecondsChange,
  feedFit,
  orientedResolution,
  rotationStatus,

}: MonitorSettingsDialogProps) {
  const { t } = useTranslation();
  const isEnabled = monitor.Enabled === '1' || monitor.Enabled === 'true';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg w-[calc(100%-1.5rem)] max-h-[90vh] overflow-y-auto"
        data-testid="monitor-settings-dialog"
      >
        <DialogHeader>
          <DialogTitle>{monitor.Name}</DialogTitle>
          <DialogDescription>
            Monitor #{monitor.Id} · {monitor.Type}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="capture" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="capture" className="flex-1" data-testid="settings-tab-capture">
              {t('monitor_detail.tab_capture')}
            </TabsTrigger>
            <TabsTrigger value="video" className="flex-1" data-testid="settings-tab-video">
              {t('monitor_detail.tab_video')}
            </TabsTrigger>
            <TabsTrigger value="display" className="flex-1" data-testid="settings-tab-display">
              {t('monitor_detail.tab_display')}
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Capture & Recording */}
          <TabsContent value="capture" className="mt-4 space-y-0">
            {hasNewApi ? (
              <>
                <SettingsRow label={t('monitor_detail.capturing_label')} testId="settings-capturing-row">
                  <Select
                    value={monitor.Capturing ?? 'Always'}
                    onValueChange={(v) => onCapturingChange?.(v as 'None' | 'Ondemand' | 'Always')}
                    disabled={isCaptureUpdating}
                  >
                    <SelectTrigger className="w-32 h-8" data-testid="settings-capturing-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">{t('monitor_detail.capturing_none')}</SelectItem>
                      <SelectItem value="Ondemand">{t('monitor_detail.capturing_ondemand')}</SelectItem>
                      <SelectItem value="Always">{t('monitor_detail.capturing_always')}</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>

                <SettingsRow label={t('monitor_detail.analysing_label')} testId="settings-analysing-row">
                  <Select
                    value={monitor.Analysing ?? 'None'}
                    onValueChange={(v) => onAnalysingChange?.(v as 'None' | 'Always')}
                    disabled={isCaptureUpdating}
                  >
                    <SelectTrigger className="w-32 h-8" data-testid="settings-analysing-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">{t('monitor_detail.analysing_none')}</SelectItem>
                      <SelectItem value="Always">{t('monitor_detail.analysing_always')}</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>

                <SettingsRow label={t('monitor_detail.recording_label')} testId="settings-recording-row">
                  <Select
                    value={monitor.Recording ?? 'None'}
                    onValueChange={(v) => onRecordingChange?.(v as 'None' | 'OnMotion' | 'Always')}
                    disabled={isCaptureUpdating}
                  >
                    <SelectTrigger className="w-32 h-8" data-testid="settings-recording-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">{t('monitor_detail.recording_none')}</SelectItem>
                      <SelectItem value="OnMotion">{t('monitor_detail.recording_onmotion')}</SelectItem>
                      <SelectItem value="Always">{t('monitor_detail.recording_always')}</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
              </>
            ) : (
              <SettingsRow label={t('monitor_detail.function_label')} testId="settings-function-row">
                <Select
                  value={monitor.Function}
                  onValueChange={(v) => onFunctionChange?.(v as MonitorFunction)}
                  disabled={isModeUpdating}
                >
                  <SelectTrigger className="w-32 h-8" data-testid="settings-function-select">
                    <SelectValue />
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
              </SettingsRow>
            )}

            {onEnabledChange && (
              <SettingsRow label={t('monitor_detail.enabled_label')} testId="settings-enabled-row">
                <Switch
                  checked={isEnabled}
                  onCheckedChange={onEnabledChange}
                  disabled={isEnabledUpdating}
                  data-testid="settings-enabled-toggle"
                />
              </SettingsRow>
            )}

            {onSaveJPEGsChange && (
              <SettingsRow label={t('monitor_detail.save_jpegs_label')} testId="settings-savejpegs-row">
                <Select
                  value={monitor.SaveJPEGs ?? '0'}
                  onValueChange={onSaveJPEGsChange}
                  disabled={isStorageUpdating}
                >
                  <SelectTrigger className="w-40 h-8" data-testid="settings-savejpegs-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('monitor_detail.save_jpegs_disabled')}</SelectItem>
                    <SelectItem value="1">{t('monitor_detail.save_jpegs_frames')}</SelectItem>
                    <SelectItem value="2">{t('monitor_detail.save_jpegs_analysis')}</SelectItem>
                    <SelectItem value="3">{t('monitor_detail.save_jpegs_both')}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>
            )}

            {onVideoWriterChange && (
              <SettingsRow label={t('monitor_detail.video_writer_label')} testId="settings-videowriter-row">
                <Select
                  value={monitor.VideoWriter ?? '0'}
                  onValueChange={onVideoWriterChange}
                  disabled={isStorageUpdating}
                >
                  <SelectTrigger className="w-40 h-8" data-testid="settings-videowriter-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('monitor_detail.video_writer_disabled')}</SelectItem>
                    <SelectItem value="1">{t('monitor_detail.video_writer_encode')}</SelectItem>
                    <SelectItem value="2">{t('monitor_detail.video_writer_passthrough')}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>
            )}

            {onCycleSecondsChange && cycleSeconds !== undefined && (
              <SettingsRow label={t('monitor_detail.cycle_label')} testId="settings-cycle-row">
                <Select value={String(cycleSeconds)} onValueChange={onCycleSecondsChange}>
                  <SelectTrigger className="w-32 h-8" data-testid="monitor-detail-cycle-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('monitor_detail.cycle_off')}</SelectItem>
                    <SelectItem value="5">{t('monitor_detail.cycle_seconds', { seconds: 5 })}</SelectItem>
                    <SelectItem value="10">{t('monitor_detail.cycle_seconds', { seconds: 10 })}</SelectItem>
                    <SelectItem value="15">{t('monitor_detail.cycle_seconds', { seconds: 15 })}</SelectItem>
                    <SelectItem value="30">{t('monitor_detail.cycle_seconds', { seconds: 30 })}</SelectItem>
                    <SelectItem value="60">{t('monitor_detail.cycle_seconds', { seconds: 60 })}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>
            )}
          </TabsContent>

          {/* Tab 2: Video (read-only) */}
          <TabsContent value="video" className="mt-4 space-y-0">
            {monitor.Path && (
              <div className="py-2.5 border-b border-border/40" data-testid="settings-source-row">
                <span className="text-sm text-muted-foreground">{t('monitor_detail.source_title')}</span>
                <Input
                  value={monitor.Path}
                  readOnly
                  className="mt-1.5 text-xs h-8 bg-muted/50 font-mono"
                  data-testid="settings-source-input"
                />
              </div>
            )}
            <SettingsRow label={t('monitors.resolution')}>
              {orientedResolution ?? `${monitor.Width}x${monitor.Height}`}
            </SettingsRow>
            <SettingsRow label={t('monitors.colours')}>
              {monitor.Colours}
            </SettingsRow>
            <SettingsRow label={t('monitors.max_fps')}>
              {monitor.MaxFPS || t('monitors.unlimited')}
            </SettingsRow>
            <SettingsRow label={t('monitors.alarm_max_fps')}>
              {monitor.AlarmMaxFPS || t('monitors.same_as_max_fps')}
            </SettingsRow>
            <SettingsRow label={t('monitors.controllable')}>
              <Badge variant={monitor.Controllable === '1' || monitor.Controllable === 'true' ? 'secondary' : 'outline'}>
                {monitor.Controllable === '1' || monitor.Controllable === 'true' ? t('common.yes') : t('common.no')}
              </Badge>
            </SettingsRow>
          </TabsContent>

          {/* Tab 3: Display (read-only) */}
          <TabsContent value="display" className="mt-4 space-y-0">
            {rotationStatus && (
              <SettingsRow label={t('monitor_detail.rotation_label')} testId="monitor-rotation">
                {rotationStatus}
              </SettingsRow>
            )}
            {feedFit && (
              <SettingsRow label={t('monitor_detail.feed_fit')}>
                {t(`monitor_detail.fit_${feedFit.replace('-', '_')}`)}
              </SettingsRow>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
