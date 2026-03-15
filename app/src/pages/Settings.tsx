/**
 * Settings Page
 *
 * Global application settings configuration.
 * Handles language selection, theme preferences, and view mode toggles.
 */

import { useTranslation } from 'react-i18next';
import { DashboardSettings } from '../components/settings/DashboardSettings';
import { ConnectionSettings } from '../components/settings/ConnectionSettings';
import { DebugSettings } from '../components/settings/DebugSettings';
import { DisplaySettings } from '../components/settings/DisplaySettings';
import { EventSettings } from '../components/settings/EventSettings';
import { LanguageSettings } from '../components/settings/LanguageSettings';
import { VideoSettings } from '../components/settings/VideoSettings';

export default function Settings() {
  const { t } = useTranslation();

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
          {t('settings.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6">
        <LanguageSettings />
        <VideoSettings />
        <DisplaySettings />
        <EventSettings />
        <DashboardSettings />
        <ConnectionSettings />
        <DebugSettings />
      </div>
    </div>
  );
}
