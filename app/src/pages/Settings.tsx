/**
 * Settings Page
 *
 * Three-section flat settings layout: Appearance, Streaming & Playback, Advanced.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Video as VideoIcon, Zap, Gauge, Leaf, RefreshCw, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { NotificationBadge } from '../components/NotificationBadge';
import { CertTrustDialog } from '../components/CertTrustDialog';
import { useSettingsStore, type WebRTCProtocol, type DateFormatPreset, type TimeFormatPreset } from '../stores/settings';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { getBandwidthSettings, type BandwidthMode } from '../lib/zmninja-ng-constants';
import { validateFormatString } from '../lib/format-date-time';
import { Platform } from '../lib/platform';
import { log, LogLevel } from '../lib/logger';
import type { CertInfo } from '../lib/ssl-trust';

// ---- Protocol config ----
const PROTOCOLS: { id: WebRTCProtocol; label: string; descKey: string }[] = [
  { id: 'webrtc', label: 'WebRTC', descKey: 'settings.protocol_webrtc_desc' },
  { id: 'mse', label: 'MSE', descKey: 'settings.protocol_mse_desc' },
  { id: 'hls', label: 'HLS', descKey: 'settings.protocol_hls_desc' },
];

// ---- Date/time preset config ----
const DATE_PRESETS: { value: DateFormatPreset; label: string }[] = [
  { value: 'MMM d, yyyy', label: 'MMM D, YYYY' },
  { value: 'MMM d', label: 'MMM D' },
  { value: 'dd/MM/yyyy', label: 'DD/MM/YYYY' },
  { value: 'dd/MM', label: 'DD/MM' },
  { value: 'custom', label: 'Custom...' },
];

const TIME_PRESETS: { value: TimeFormatPreset; label: string }[] = [
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' },
  { value: 'custom', label: 'Custom...' },
];

const FORMAT_TOKENS =
  'yyyy=year, MM=month, dd=day, MMM=abbr month, EEE=weekday, HH=24h, hh=12h, mm=min, ss=sec, a=AM/PM';

function getDateExample(preset: DateFormatPreset, custom: string): string {
  if (preset === 'custom') return validateFormatString(custom) || 'Invalid';
  return validateFormatString(preset) || '';
}

function getTimeExample(preset: TimeFormatPreset, custom: string): string {
  if (preset === 'custom') return validateFormatString(custom) || 'Invalid';
  if (preset === '12h') return validateFormatString('h:mm:ss a') || '';
  return validateFormatString('HH:mm:ss') || '';
}

// ---- Reusable row components ----

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">
      {label}
    </h2>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card divide-y">
      {children}
    </div>
  );
}

function SettingsRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      {children}
    </div>
  );
}

function RowLabel({ label, desc }: { label: string; desc?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-sm font-medium">{label}</div>
      {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
    </div>
  );
}

// ---- Main Settings page ----

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { currentProfile, settings } = useCurrentProfile();
  const updateSettings = useSettingsStore((state) => state.updateProfileSettings);

  const [customDateDraft, setCustomDateDraft] = useState(settings.customDateFormat);
  const [customTimeDraft, setCustomTimeDraft] = useState(settings.customTimeFormat);

  // Connection settings state
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null);
  const [certIsChanged, setCertIsChanged] = useState(false);
  const [reverifying, setReverifying] = useState(false);
  const [protocolsExpanded, setProtocolsExpanded] = useState(false);

  const customDatePreview = validateFormatString(customDateDraft);
  const customTimePreview = validateFormatString(customTimeDraft);

  // Generic update helper
  const update = <K extends keyof Parameters<typeof updateSettings>[1]>(
    key: K,
    value: Parameters<typeof updateSettings>[1][K]
  ) => {
    if (!currentProfile) return;
    updateSettings(currentProfile.id, { [key]: value });
  };

  // Bandwidth mode changes also reset related settings to defaults
  const handleBandwidthModeChange = (isLow: boolean) => {
    if (!currentProfile) return;
    const mode: BandwidthMode = isLow ? 'low' : 'normal';
    const bandwidthDefaults = getBandwidthSettings(mode);
    updateSettings(currentProfile.id, {
      bandwidthMode: mode,
      streamScale: bandwidthDefaults.imageScale,
      streamMaxFps: bandwidthDefaults.streamMaxFps,
      snapshotRefreshInterval: bandwidthDefaults.snapshotRefreshInterval,
    });
  };

  // Protocol checkboxes for Go2RTC
  const handleProtocolChange = (protocol: WebRTCProtocol, enabled: boolean) => {
    if (!currentProfile) return;
    const current = settings.webrtcProtocols || ['webrtc', 'mse', 'hls'];
    const updated = enabled
      ? current.includes(protocol) ? current : [...current, protocol]
      : current.filter((p) => p !== protocol);
    if (updated.length > 0) {
      updateSettings(currentProfile.id, { webrtcProtocols: updated });
    }
  };

  // Self-signed cert enable handler
  const handleSelfSignedCertsChange = async (checked: boolean) => {
    if (!currentProfile) return;

    // Update the setting immediately so the switch toggles
    updateSettings(currentProfile.id, {
      allowSelfSignedCerts: checked,
      ...(!checked && { trustedCertFingerprint: null }),
    });

    if (checked && Platform.isNative) {
      try {
        const { applySSLTrustSetting, getServerCertFingerprint } = await import('../lib/ssl-trust');
        await applySSLTrustSetting(true);
        const info = await getServerCertFingerprint(currentProfile.portalUrl);
        if (info) {
          setCertInfo(info);
          setCertIsChanged(false);
          setCertDialogOpen(true);
          return;
        }
        await applySSLTrustSetting(true, null);
      } catch (error) {
        log.sslTrust('Failed to fetch cert during enable', LogLevel.ERROR, { error });
      }
    }

    if (!checked) {
      const { applySSLTrustSetting } = await import('../lib/ssl-trust');
      await applySSLTrustSetting(false);
    }
  };

  const handleTrust = async () => {
    if (!currentProfile || !certInfo) return;
    setCertDialogOpen(false);
    updateSettings(currentProfile.id, {
      allowSelfSignedCerts: true,
      trustedCertFingerprint: certInfo.fingerprint,
    });
    const { applySSLTrustSetting } = await import('../lib/ssl-trust');
    await applySSLTrustSetting(true, certInfo.fingerprint);
  };

  const handleCancelTrust = async () => {
    setCertDialogOpen(false);
    const { applySSLTrustSetting } = await import('../lib/ssl-trust');
    await applySSLTrustSetting(false);
  };

  const handleReverify = async () => {
    if (!currentProfile) return;
    setReverifying(true);
    try {
      const { applySSLTrustSetting, getServerCertFingerprint } = await import('../lib/ssl-trust');
      await applySSLTrustSetting(true);
      const info = await getServerCertFingerprint(currentProfile.portalUrl);
      if (info) {
        const isChanged =
          settings.trustedCertFingerprint !== null &&
          info.fingerprint !== settings.trustedCertFingerprint;
        setCertInfo(info);
        setCertIsChanged(isChanged);
        setCertDialogOpen(true);
      }
      await applySSLTrustSetting(true, settings.trustedCertFingerprint);
    } catch (error) {
      log.sslTrust('Failed to re-verify certificate', LogLevel.ERROR, { error });
    } finally {
      setReverifying(false);
    }
  };

  return (
    <>
      <div className="p-3 sm:p-4 md:p-6 space-y-6">
        {/* Page header */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight">{t('settings.title')}</h1>
            <NotificationBadge />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
            {t('settings.subtitle')}
          </p>
        </div>

        {/* ── Section 1: Appearance ── */}
        <section>
          <SectionHeader label={t('settings.section_appearance', 'Appearance')} />
          <SettingsCard>
            {/* Language */}
            <SettingsRow>
              <RowLabel label={t('settings.language')} desc={t('settings.select_language')} />
              <Select
                value={i18n.language}
                onValueChange={(value) => i18n.changeLanguage(value)}
              >
                <SelectTrigger className="w-36" data-testid="settings-language-select">
                  <SelectValue placeholder={t('settings.select_language')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en" data-testid="settings-language-option-en">{t('languages.en')}</SelectItem>
                  <SelectItem value="es" data-testid="settings-language-option-es">{t('languages.es')}</SelectItem>
                  <SelectItem value="fr" data-testid="settings-language-option-fr">{t('languages.fr')}</SelectItem>
                  <SelectItem value="de" data-testid="settings-language-option-de">{t('languages.de')}</SelectItem>
                  <SelectItem value="zh" data-testid="settings-language-option-zh">{t('languages.zh')}</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            {/* Date Format */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <RowLabel label={t('settings.date_format')} />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {getDateExample(settings.dateFormat, settings.customDateFormat)}
                  </span>
                  <Select
                    value={settings.dateFormat}
                    onValueChange={(v) => update('dateFormat', v as DateFormatPreset)}
                  >
                    <SelectTrigger className="w-36" data-testid="settings-date-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_PRESETS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {settings.dateFormat === 'custom' && (
                <div className="space-y-1 pl-1">
                  <div className="flex items-center gap-3">
                    <Input
                      value={customDateDraft}
                      onChange={(e) => setCustomDateDraft(e.target.value)}
                      onBlur={() => {
                        if (customDatePreview) update('customDateFormat', customDateDraft);
                      }}
                      placeholder="EEE, MMM d yyyy"
                      className="w-44 font-mono text-sm"
                      data-testid="settings-custom-date-format"
                    />
                    <span className={customDatePreview ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
                      {customDatePreview || t('settings.invalid_format')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{FORMAT_TOKENS}</p>
                </div>
              )}
            </div>

            {/* Time Format */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <RowLabel label={t('settings.time_format')} />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {getTimeExample(settings.timeFormat, settings.customTimeFormat)}
                  </span>
                  <Select
                    value={settings.timeFormat}
                    onValueChange={(v) => update('timeFormat', v as TimeFormatPreset)}
                  >
                    <SelectTrigger className="w-36" data-testid="settings-time-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_PRESETS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {settings.timeFormat === 'custom' && (
                <div className="space-y-1 pl-1">
                  <div className="flex items-center gap-3">
                    <Input
                      value={customTimeDraft}
                      onChange={(e) => setCustomTimeDraft(e.target.value)}
                      onBlur={() => {
                        if (customTimePreview) update('customTimeFormat', customTimeDraft);
                      }}
                      placeholder="h:mm:ss a"
                      className="w-44 font-mono text-sm"
                      data-testid="settings-custom-time-format"
                    />
                    <span className={customTimePreview ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
                      {customTimePreview || t('settings.invalid_format')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{FORMAT_TOKENS}</p>
                </div>
              )}
            </div>
          </SettingsCard>
        </section>

        {/* ── Section 2: Live Streaming ── */}
        <section>
          <SectionHeader label={t('settings.section_live_streaming', 'Live Streaming')} />
          <SettingsCard>
            {/* Bandwidth Mode */}
            <SettingsRow>
              <RowLabel
                label={t('settings.bandwidth_mode')}
                desc={
                  settings.bandwidthMode === 'low'
                    ? t('settings.bandwidth_low_desc')
                    : t('settings.bandwidth_normal_desc')
                }
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                {settings.bandwidthMode === 'low' && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    {t('settings.bandwidth_saving')}
                  </Badge>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" />
                  <span>{t('settings.bandwidth_normal')}</span>
                </div>
                <Switch
                  id="bandwidth-mode"
                  checked={settings.bandwidthMode === 'low'}
                  onCheckedChange={handleBandwidthModeChange}
                  data-testid="settings-bandwidth-mode-switch"
                />
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Leaf className="h-3.5 w-3.5 text-green-600" />
                  <span>{t('settings.bandwidth_low')}</span>
                </div>
              </div>
            </SettingsRow>

            {/* Streaming Mode */}
            <SettingsRow>
              <RowLabel
                label={t('settings.streaming_mode')}
                desc={
                  settings.viewMode === 'streaming'
                    ? t('settings.streaming_mode_desc')
                    : t('settings.snapshot_mode_desc')
                }
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                {settings.viewMode === 'snapshot' && (
                  <Badge variant="secondary" className="text-xs">
                    {t('settings.recommended')}
                  </Badge>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Image className="h-3.5 w-3.5" />
                  <span>{t('settings.snapshot')}</span>
                </div>
                <Switch
                  id="view-mode"
                  checked={settings.viewMode === 'streaming'}
                  onCheckedChange={(checked) => update('viewMode', checked ? 'streaming' : 'snapshot')}
                  data-testid="settings-view-mode-switch"
                />
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <VideoIcon className="h-3.5 w-3.5" />
                  <span>{t('settings.streaming')}</span>
                </div>
              </div>
            </SettingsRow>

            {/* Go2RTC */}
            <SettingsRow>
              <RowLabel
                label={t('settings.enable_go2rtc')}
                desc={
                  settings.streamingMethod === 'auto'
                    ? t('settings.go2rtc_enabled_note')
                    : t('settings.go2rtc_disabled_note')
                }
              />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Zap className="h-4 w-4 text-yellow-500" />
                <Switch
                  id="go2rtc-mode"
                  checked={settings.streamingMethod === 'auto'}
                  onCheckedChange={(enabled) => update('streamingMethod', enabled ? 'auto' : 'mjpeg')}
                  data-testid="settings-go2rtc-switch"
                />
              </div>
            </SettingsRow>

            {/* Go2RTC protocols (collapsible with chevron) */}
            {settings.streamingMethod === 'auto' && (
              <div className="px-4 py-2 bg-muted/40">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground w-full"
                  onClick={() => setProtocolsExpanded(!protocolsExpanded)}
                >
                  <ChevronDown className={cn("h-3 w-3 transition-transform", !protocolsExpanded && "-rotate-90")} />
                  {t('settings.webrtc_protocols')}
                </button>
                {protocolsExpanded && (
                  <div className="space-y-2 mt-2">
                    {PROTOCOLS.map(({ id, label, descKey }) => (
                      <div key={id} className="flex items-start gap-3">
                        <Checkbox
                          id={`protocol-${id}`}
                          checked={settings.webrtcProtocols?.includes(id) ?? true}
                          onCheckedChange={(checked) => handleProtocolChange(id, checked === true)}
                          data-testid={`protocol-${id}-checkbox`}
                        />
                        <div>
                          <Label htmlFor={`protocol-${id}`} className="text-sm font-medium cursor-pointer">
                            {label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{t(descKey)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Snapshot Refresh Interval (only in snapshot mode) */}
            {settings.viewMode === 'snapshot' && (
              <div className="px-4 py-3 space-y-2">
                <RowLabel
                  label={t('settings.refresh_interval')}
                  desc={t('settings.refresh_interval_desc')}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    id="refresh-interval"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.snapshotRefreshInterval}
                    onChange={(e) => update('snapshotRefreshInterval', Number(e.target.value))}
                    className="w-20"
                    data-testid="settings-refresh-interval"
                  />
                  <span className="text-xs text-muted-foreground">{t('settings.seconds')}</span>
                  <div className="flex gap-1.5">
                    {[1, 3, 5].map((val) => (
                      <Button key={val} variant="outline" size="sm" className="h-7 text-xs px-2"
                        onClick={() => update('snapshotRefreshInterval', val)}>
                        {val}s{val === 3 ? ` (${t('settings.default')})` : ''}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Stream FPS */}
            <div className="px-4 py-3 space-y-2">
              <RowLabel
                label={t('settings.stream_fps')}
                desc={t('settings.stream_fps_desc')}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  id="stream-fps"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.streamMaxFps}
                  onChange={(e) => update('streamMaxFps', Number(e.target.value))}
                  className="w-20"
                  data-testid="stream-fps-input"
                />
                <span className="text-xs text-muted-foreground">{t('settings.fps_label')}</span>
                <div className="flex gap-1.5">
                  {[5, 10, 15, 30].map((val) => (
                    <Button key={val} variant="outline" size="sm" className="h-7 text-xs px-2"
                      onClick={() => update('streamMaxFps', val)}
                      data-testid={`stream-fps-${val}`}>
                      {val === 10
                        ? t('settings.fps_option_default', { value: val })
                        : t('settings.fps_option', { value: val })}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stream Scale */}
            <div className="px-4 py-3 space-y-2">
              <RowLabel
                label={t('settings.stream_scale')}
                desc={t('settings.stream_scale_desc')}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  id="stream-scale"
                  type="number"
                  min="10"
                  max="100"
                  step="10"
                  value={settings.streamScale}
                  onChange={(e) => update('streamScale', Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground">%</span>
                <div className="flex gap-1.5">
                  {[25, 50, 75, 100].map((val) => (
                    <Button key={val} variant="outline" size="sm" className="h-7 text-xs px-2"
                      onClick={() => update('streamScale', val)}>
                      {val}%{val === 50 ? ` (${t('settings.default')})` : ''}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

          </SettingsCard>
        </section>

        {/* ── Section 3: Playback ── */}
        <section>
          <SectionHeader label={t('settings.section_playback', 'Playback')} />
          <SettingsCard>
            {/* Event Autoplay */}
            <SettingsRow>
              <RowLabel
                label={t('settings.event_autoplay')}
                desc={t('settings.event_autoplay_desc')}
              />
              <Switch
                id="event-autoplay"
                checked={settings.eventVideoAutoplay}
                onCheckedChange={(checked) => update('eventVideoAutoplay', checked)}
                data-testid="settings-event-autoplay-switch"
              />
            </SettingsRow>

            {/* Events Per Page */}
            <div className="px-4 py-3 space-y-2">
              <RowLabel
                label={t('settings.events_per_page')}
                desc={t('settings.events_per_page_desc')}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  id="event-limit"
                  type="number"
                  min="10"
                  max="1000"
                  step="10"
                  value={settings.defaultEventLimit || 100}
                  onChange={(e) =>
                    currentProfile &&
                    updateSettings(currentProfile.id, { defaultEventLimit: Number(e.target.value) })
                  }
                  className="w-24"
                  data-testid="settings-event-limit"
                />
                <span className="text-xs text-muted-foreground">{t('settings.events_per_page_suffix')}</span>
                <div className="flex gap-1.5">
                  {[100, 300, 500].map((val) => (
                    <Button key={val} variant="outline" size="sm" className="h-7 text-xs px-2"
                      onClick={() =>
                        currentProfile &&
                        updateSettings(currentProfile.id, { defaultEventLimit: val })
                      }>
                      {val}{val === 100 ? ` (${t('settings.default')})` : ''}
                    </Button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('settings.event_limit_tip')}</p>
            </div>

            {/* Dashboard Refresh */}
            <div className="px-4 py-3 space-y-2">
              <RowLabel
                label={t('settings.dashboard_refresh_interval')}
                desc={t('settings.dashboard_refresh_interval_desc')}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  id="dashboard-refresh"
                  type="number"
                  min="5"
                  max="300"
                  step="5"
                  value={settings.dashboardRefreshInterval || 30}
                  onChange={(e) =>
                    currentProfile &&
                    updateSettings(currentProfile.id, { dashboardRefreshInterval: Number(e.target.value) })
                  }
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">{t('settings.seconds')}</span>
                <div className="flex gap-1.5">
                  {[10, 30, 60].map((val) => (
                    <Button key={val} variant="outline" size="sm" className="h-7 text-xs px-2"
                      onClick={() =>
                        currentProfile &&
                        updateSettings(currentProfile.id, { dashboardRefreshInterval: val })
                      }>
                      {val}{val === 30 ? ` (${t('settings.default')})` : ''}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </SettingsCard>
        </section>

        {/* ── Section 4: Advanced ── */}
        <section>
          <SectionHeader label={t('settings.section_advanced', 'Advanced')} />
          <SettingsCard>
            {/* Self-signed certs — only relevant for HTTPS */}
            {currentProfile?.portalUrl?.startsWith('https') && (<><SettingsRow>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t('settings.allow_self_signed_certs')}</div>
                <div className="text-xs text-muted-foreground">{t('settings.allow_self_signed_certs_desc')}</div>
                {settings.allowSelfSignedCerts && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                    {t('settings.allow_self_signed_certs_warning')}
                  </p>
                )}
                {Platform.isDesktopOrWeb && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('settings.self_signed_certs_desktop_note')}
                  </p>
                )}
              </div>
              <Switch
                id="self-signed-certs"
                checked={settings.allowSelfSignedCerts}
                onCheckedChange={handleSelfSignedCertsChange}
                data-testid="settings-self-signed-certs-switch"
              />
            </SettingsRow>

            {/* Cert fingerprint display (only when enabled on native) */}
            {settings.allowSelfSignedCerts && Platform.isNative && (
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">{t('ssl.trusted_fingerprint')}</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                    onClick={handleReverify}
                    disabled={reverifying}
                    data-testid="cert-reverify-button"
                  >
                    <RefreshCw className={`h-3 w-3 ${reverifying ? 'animate-spin' : ''}`} />
                    {t('ssl.reverify_button')}
                  </Button>
                </div>
                {settings.trustedCertFingerprint ? (
                  <p
                    className="font-mono text-[10px] break-all text-muted-foreground leading-relaxed"
                    title={settings.trustedCertFingerprint}
                  >
                    {settings.trustedCertFingerprint}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('ssl.no_fingerprint')}</p>
                )}
              </div>
            )}
            </>)}

            {/* Log Redaction */}
            <SettingsRow>
              <RowLabel
                label={t('settings.disable_log_redaction')}
                desc={t('settings.disable_log_redaction_desc')}
              />
              <Switch
                id="log-redaction"
                checked={settings.disableLogRedaction}
                onCheckedChange={(checked) =>
                  currentProfile &&
                  updateSettings(currentProfile.id, { disableLogRedaction: checked })
                }
                data-testid="settings-log-redaction-switch"
              />
            </SettingsRow>
          </SettingsCard>
        </section>
      </div>

      <CertTrustDialog
        open={certDialogOpen}
        certInfo={certInfo}
        isChanged={certIsChanged}
        onTrust={handleTrust}
        onCancel={handleCancelTrust}
      />
    </>
  );
}
