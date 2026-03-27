/**
 * Playback Section
 *
 * Event autoplay, events per page, and dashboard refresh interval settings.
 */

import { useTranslation } from 'react-i18next';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { SectionHeader, SettingsCard, SettingsRow, RowLabel } from './SettingsLayout';
import type { Profile } from '../../api/types';
import type { ProfileSettings } from '../../stores/settings';

export interface PlaybackSectionProps {
  settings: ProfileSettings;
  update: <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) => void;
  currentProfile: Profile | null;
  updateSettings: (profileId: string, updates: Partial<ProfileSettings>) => void;
}

export function PlaybackSection({
  settings,
  update,
  currentProfile,
  updateSettings,
}: PlaybackSectionProps) {
  const { t } = useTranslation();

  return (
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
                  }
                  data-testid={`events-per-page-preset-${val}`}>
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
              data-testid="dashboard-refresh-input"
            />
            <span className="text-xs text-muted-foreground">{t('settings.seconds')}</span>
            <div className="flex gap-1.5">
              {[10, 30, 60].map((val) => (
                <Button key={val} variant="outline" size="sm" className="h-7 text-xs px-2"
                  onClick={() =>
                    currentProfile &&
                    updateSettings(currentProfile.id, { dashboardRefreshInterval: val })
                  }
                  data-testid={`dashboard-refresh-preset-${val}`}>
                  {val}{val === 30 ? ` (${t('settings.default')})` : ''}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </SettingsCard>
    </section>
  );
}
