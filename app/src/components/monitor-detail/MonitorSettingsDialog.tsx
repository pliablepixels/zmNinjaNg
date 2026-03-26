/**
 * Monitor Settings Dialog
 *
 * Tabbed settings panel for monitor configuration.
 * Shows Capturing/Analysing/Recording on ZM 1.38+, legacy Function on older servers.
 * Editable fields use local state — changes are only sent when Save is pressed.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { PasswordInput } from '../ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Monitor } from '../../api/types';
import type { MonitorFunction } from '../../pages/hooks/useModeControl';
import { isZmVersionAtLeast } from '../../lib/zm-version';

interface MonitorSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monitor: Monitor;
  /** ZM server version string for feature detection. */
  zmVersion: string | null;
  /** Called with only the fields that changed when Save is pressed. */
  onSave?: (changes: Record<string, string | undefined>) => Promise<void>;
  isSaving?: boolean;
  // Cycle settings (MonitorDetail only — local setting, not a ZM API field)
  cycleSeconds?: number;
  onCycleSecondsChange?: (value: string) => void;
  // Read-only display (MonitorDetail only)
  orientedResolution?: string;
  /** Map of monitor ID to name for resolving LinkedMonitors. */
  monitorNames?: Record<string, string>;
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
  zmVersion,
  onSave,
  isSaving = false,
  cycleSeconds,
  onCycleSecondsChange,
  orientedResolution,
  monitorNames,
}: MonitorSettingsDialogProps) {
  const { t } = useTranslation();
  const editable = !!onSave;
  const is138Plus = isZmVersionAtLeast(zmVersion, '1.38.0');

  // --- Capture tab local state ---
  const [localCapturing, setLocalCapturing] = useState<string>(monitor.Capturing ?? 'Always');
  const [localAnalysing, setLocalAnalysing] = useState<string>(monitor.Analysing ?? 'None');
  const [localRecording, setLocalRecording] = useState<string>(monitor.Recording ?? 'None');
  const [localFunction, setLocalFunction] = useState<string>(monitor.Function);
  const [localEnabled, setLocalEnabled] = useState(monitor.Enabled === '1' || monitor.Enabled === 'true');
  const [localSaveJPEGs, setLocalSaveJPEGs] = useState(monitor.SaveJPEGs ?? '0');
  const [localVideoWriter, setLocalVideoWriter] = useState(monitor.VideoWriter ?? '0');

  // --- Video tab local state ---
  const [localPath, setLocalPath] = useState(monitor.Path ?? '');
  const [localUser, setLocalUser] = useState(monitor.User ?? '');
  const [localPass, setLocalPass] = useState(monitor.Pass ?? '');
  const [localMethod, setLocalMethod] = useState(monitor.Method ?? 'rtpRtsp');
  const [localMaxFPS, setLocalMaxFPS] = useState(monitor.MaxFPS ?? '');
  const [localAlarmMaxFPS, setLocalAlarmMaxFPS] = useState(monitor.AlarmMaxFPS ?? '');
  const [localOrientation, setLocalOrientation] = useState(monitor.Orientation ?? 'ROTATE_0');
  const [localEventStartCmd, setLocalEventStartCmd] = useState(monitor.EventStartCommand ?? '');
  const [localEventEndCmd, setLocalEventEndCmd] = useState(monitor.EventEndCommand ?? '');

  // Reset local state when monitor data changes (e.g. after refetch)
  useEffect(() => {
    // Capture tab
    setLocalCapturing(monitor.Capturing ?? 'Always');
    setLocalAnalysing(monitor.Analysing ?? 'None');
    setLocalRecording(monitor.Recording ?? 'None');
    setLocalFunction(monitor.Function);
    setLocalEnabled(monitor.Enabled === '1' || monitor.Enabled === 'true');
    setLocalSaveJPEGs(monitor.SaveJPEGs ?? '0');
    setLocalVideoWriter(monitor.VideoWriter ?? '0');
    // Video tab
    setLocalPath(monitor.Path ?? '');
    setLocalUser(monitor.User ?? '');
    setLocalPass(monitor.Pass ?? '');
    setLocalMethod(monitor.Method ?? 'rtpRtsp');
    setLocalMaxFPS(monitor.MaxFPS ?? '');
    setLocalAlarmMaxFPS(monitor.AlarmMaxFPS ?? '');
    setLocalOrientation(monitor.Orientation ?? 'ROTATE_0');
    setLocalEventStartCmd(monitor.EventStartCommand ?? '');
    setLocalEventEndCmd(monitor.EventEndCommand ?? '');
  }, [monitor]);

  // Check if anything changed from server state
  // On ZM 1.38+, Enabled is vestigial — Capturing controls whether the monitor is active
  const serverEnabled = monitor.Enabled === '1' || monitor.Enabled === 'true';

  // Video-tab change flags (same for both ZM versions)
  const videoHasChanges =
    localPath !== (monitor.Path ?? '') ||
    localUser !== (monitor.User ?? '') ||
    localPass !== (monitor.Pass ?? '') ||
    localMethod !== (monitor.Method ?? 'rtpRtsp') ||
    localMaxFPS !== (monitor.MaxFPS ?? '') ||
    localAlarmMaxFPS !== (monitor.AlarmMaxFPS ?? '') ||
    localOrientation !== (monitor.Orientation ?? 'ROTATE_0') ||
    localEventStartCmd !== (monitor.EventStartCommand ?? '') ||
    localEventEndCmd !== (monitor.EventEndCommand ?? '');

  const hasChanges = is138Plus
    ? (localCapturing !== (monitor.Capturing ?? 'Always') ||
       localAnalysing !== (monitor.Analysing ?? 'None') ||
       localRecording !== (monitor.Recording ?? 'None') ||
       localSaveJPEGs !== (monitor.SaveJPEGs ?? '0') ||
       localVideoWriter !== (monitor.VideoWriter ?? '0') ||
       videoHasChanges)
    : (localFunction !== monitor.Function ||
       localEnabled !== serverEnabled ||
       localSaveJPEGs !== (monitor.SaveJPEGs ?? '0') ||
       localVideoWriter !== (monitor.VideoWriter ?? '0') ||
       videoHasChanges);

  const handleSave = async () => {
    if (!onSave) return;
    const changes: Record<string, string | undefined> = {};

    if (is138Plus) {
      if (localCapturing !== (monitor.Capturing ?? 'Always')) changes.Capturing = localCapturing;
      if (localAnalysing !== (monitor.Analysing ?? 'None')) changes.Analysing = localAnalysing;
      if (localRecording !== (monitor.Recording ?? 'None')) changes.Recording = localRecording;
    } else {
      if (localFunction !== monitor.Function) changes.Function = localFunction;
      if (localEnabled !== serverEnabled) changes.Enabled = localEnabled ? '1' : '0';
    }
    if (localSaveJPEGs !== (monitor.SaveJPEGs ?? '0')) changes.SaveJPEGs = localSaveJPEGs;
    if (localVideoWriter !== (monitor.VideoWriter ?? '0')) changes.VideoWriter = localVideoWriter;

    // Video tab fields
    if (localPath !== (monitor.Path ?? '')) changes.Path = localPath;
    if (localUser !== (monitor.User ?? '')) changes.User = localUser;
    if (localPass !== (monitor.Pass ?? '')) changes.Pass = localPass;
    if (localMethod !== (monitor.Method ?? 'rtpRtsp')) changes.Method = localMethod;
    if (localMaxFPS !== (monitor.MaxFPS ?? '')) changes.MaxFPS = localMaxFPS;
    if (localAlarmMaxFPS !== (monitor.AlarmMaxFPS ?? '')) changes.AlarmMaxFPS = localAlarmMaxFPS;
    if (localOrientation !== (monitor.Orientation ?? 'ROTATE_0')) changes.Orientation = localOrientation;
    if (localEventStartCmd !== (monitor.EventStartCommand ?? '')) changes.EventStartCommand = localEventStartCmd;
    if (localEventEndCmd !== (monitor.EventEndCommand ?? '')) changes.EventEndCommand = localEventEndCmd;

    await onSave(changes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg w-[calc(100%-1.5rem)] max-h-[90vh] flex flex-col"
        data-testid="monitor-settings-dialog"
      >
        <DialogHeader>
          <DialogTitle>{monitor.Name}</DialogTitle>
          <DialogDescription>
            Monitor #{monitor.Id} · {monitor.Type}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="video" className="mt-2 flex flex-col min-h-0 flex-1">
          <TabsList className="w-full shrink-0">
            <TabsTrigger value="video" className="flex-1" data-testid="settings-tab-video">
              {t('monitor_detail.tab_video')}
            </TabsTrigger>
            <TabsTrigger value="capture" className="flex-1" data-testid="settings-tab-capture">
              {t('monitor_detail.tab_capture')}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Capture & Recording */}
          <TabsContent value="capture" className="mt-4 space-y-0 overflow-y-auto">
            {is138Plus ? (
              <>
                <SettingsRow label={t('monitor_detail.capturing_label')} testId="settings-capturing-row">
                  <Select
                    value={localCapturing}
                    onValueChange={setLocalCapturing}
                    disabled={!editable || isSaving}
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
                    value={localAnalysing}
                    onValueChange={setLocalAnalysing}
                    disabled={!editable || isSaving}
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
                    value={localRecording}
                    onValueChange={setLocalRecording}
                    disabled={!editable || isSaving}
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
                  value={localFunction}
                  onValueChange={(v) => setLocalFunction(v as MonitorFunction)}
                  disabled={!editable || isSaving}
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

            {/* Enabled toggle only for ZM < 1.38 — on 1.38+ Capturing controls this */}
            {!is138Plus && (
              <SettingsRow label={t('monitor_detail.enabled_label')} testId="settings-enabled-row">
                <Switch
                  checked={localEnabled}
                  onCheckedChange={setLocalEnabled}
                  disabled={!editable || isSaving}
                  data-testid="settings-enabled-toggle"
                />
              </SettingsRow>
            )}

            <SettingsRow label={t('monitor_detail.save_jpegs_label')} testId="settings-savejpegs-row">
              <Select
                value={localSaveJPEGs}
                onValueChange={setLocalSaveJPEGs}
                disabled={!editable || isSaving}
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

            <SettingsRow label={t('monitor_detail.video_writer_label')} testId="settings-videowriter-row">
              <Select
                value={localVideoWriter}
                onValueChange={setLocalVideoWriter}
                disabled={!editable || isSaving}
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

            {editable && (
              <div className="pt-4">
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="w-full"
                  data-testid="settings-save-button"
                >
                  {isSaving ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Tab: Video */}
          <TabsContent value="video" className="mt-4 space-y-0 overflow-y-auto">
            {/* Source Path — stacked layout for long value */}
            <div className="py-2.5 border-b border-border/40 " data-testid="settings-source-row">
              <span className="text-sm text-muted-foreground">{t('monitor_detail.source_path')}</span>
              <Input
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                disabled={!editable || isSaving}
                className="mt-1.5 text-xs h-8 font-mono"
                data-testid="settings-source-input"
              />
            </div>

            {/* Username */}
            <SettingsRow label={t('monitor_detail.username')} testId="settings-username-row">
              <Input
                value={localUser}
                onChange={(e) => setLocalUser(e.target.value)}
                disabled={!editable || isSaving}
                className="w-40 h-8 text-xs"
                data-testid="settings-username-input"
              />
            </SettingsRow>

            {/* Password */}
            <SettingsRow label={t('monitor_detail.password')} testId="settings-password-row">
              <PasswordInput
                value={localPass}
                onChange={(e) => setLocalPass(e.target.value)}
                disabled={!editable || isSaving}
                className="w-40 h-8 text-xs"
                data-testid="settings-password-input"
              />
            </SettingsRow>

            {/* Method */}
            <SettingsRow label={t('monitor_detail.method_label')} testId="settings-method-row">
              <Select
                value={localMethod}
                onValueChange={setLocalMethod}
                disabled={!editable || isSaving}
              >
                <SelectTrigger className="w-40 h-8" data-testid="settings-method-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rtpRtsp">{t('monitor_detail.method_tcp')}</SelectItem>
                  <SelectItem value="rtpUni">{t('monitor_detail.method_udp')}</SelectItem>
                  <SelectItem value="rtpMulti">{t('monitor_detail.method_udp_multicast')}</SelectItem>
                  <SelectItem value="rtpRtspHttp">{t('monitor_detail.method_http_tunnel')}</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            {/* Resolution — read-only */}
            <SettingsRow label={t('monitors.resolution')}>
              {orientedResolution ?? `${monitor.Width}x${monitor.Height}`}
            </SettingsRow>

            {/* Colours — read-only */}
            <SettingsRow label={t('monitors.colours')}>
              {monitor.Colours}
            </SettingsRow>

            {/* Max FPS — editable */}
            <SettingsRow label={t('monitors.max_fps')} testId="settings-maxfps-row">
              <Input
                type="number"
                step="any"
                min="0"
                value={localMaxFPS}
                onChange={(e) => setLocalMaxFPS(e.target.value)}
                disabled={!editable || isSaving}
                className="w-24 h-8 text-xs"
                data-testid="settings-maxfps-input"
              />
            </SettingsRow>

            {/* Alarm Max FPS — editable */}
            <SettingsRow label={t('monitors.alarm_max_fps')} testId="settings-alarmmaxfps-row">
              <Input
                type="number"
                step="any"
                min="0"
                value={localAlarmMaxFPS}
                onChange={(e) => setLocalAlarmMaxFPS(e.target.value)}
                disabled={!editable || isSaving}
                className="w-24 h-8 text-xs"
                data-testid="settings-alarmmaxfps-input"
              />
            </SettingsRow>

            {/* Orientation */}
            <SettingsRow label={t('monitor_detail.orientation_label')} testId="monitor-orientation">
              <Select
                value={localOrientation}
                onValueChange={setLocalOrientation}
                disabled={!editable || isSaving}
              >
                <SelectTrigger className="w-40 h-8" data-testid="settings-orientation-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROTATE_0">{t('monitor_detail.rotation_none')}</SelectItem>
                  <SelectItem value="ROTATE_90">{t('monitor_detail.orientation_90')}</SelectItem>
                  <SelectItem value="ROTATE_180">{t('monitor_detail.orientation_180')}</SelectItem>
                  <SelectItem value="ROTATE_270">{t('monitor_detail.orientation_270')}</SelectItem>
                  <SelectItem value="FLIP_HORI">{t('monitor_detail.rotation_flip_horizontal')}</SelectItem>
                  <SelectItem value="FLIP_VERT">{t('monitor_detail.rotation_flip_vertical')}</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            {/* Controllable — read-only badge */}
            <SettingsRow label={t('monitors.controllable')}>
              <Badge variant={monitor.Controllable === '1' || monitor.Controllable === 'true' ? 'secondary' : 'outline'}>
                {monitor.Controllable === '1' || monitor.Controllable === 'true' ? t('common.yes') : t('common.no')}
              </Badge>
            </SettingsRow>

            {/* Control Address — shown when controllable */}
            {(monitor.Controllable === '1' || monitor.Controllable === 'true') && monitor.ControlAddress && (
              <SettingsRow label={t('monitor_detail.control_address')} testId="settings-control-address">
                <span className="font-mono text-xs">{monitor.ControlAddress}</span>
              </SettingsRow>
            )}

            {/* Linked Monitors — read-only, shown only when defined */}
            {monitor.LinkedMonitors && (
              <SettingsRow label={t('monitor_detail.linked_monitors')} testId="settings-linked-monitors">
                <span className="text-xs">
                  {monitor.LinkedMonitors.split(',')
                    .map(id => monitorNames?.[id.trim()] ?? `#${id.trim()}`)
                    .join(', ')}
                </span>
              </SettingsRow>
            )}

            {/* Event Start Cmd — stacked layout */}
            <div className="py-2.5 border-b border-border/40 " data-testid="settings-event-start-cmd-row">
              <span className="text-sm text-muted-foreground">{t('monitor_detail.event_start_cmd')}</span>
              <Input
                value={localEventStartCmd}
                onChange={(e) => setLocalEventStartCmd(e.target.value)}
                disabled={!editable || isSaving}
                className="mt-1.5 text-xs h-8 font-mono"
                data-testid="settings-event-start-cmd-input"
              />
            </div>

            {/* Event End Cmd — stacked layout */}
            <div className="py-2.5 border-b border-border/40 " data-testid="settings-event-end-cmd-row">
              <span className="text-sm text-muted-foreground">{t('monitor_detail.event_end_cmd')}</span>
              <Input
                value={localEventEndCmd}
                onChange={(e) => setLocalEventEndCmd(e.target.value)}
                disabled={!editable || isSaving}
                className="mt-1.5 text-xs h-8 font-mono"
                data-testid="settings-event-end-cmd-input"
              />
            </div>

            {/* Save button for Video tab */}
            {editable && (
              <div className="pt-4">
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="w-full"
                  data-testid="settings-video-save-button"
                >
                  {isSaving ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
