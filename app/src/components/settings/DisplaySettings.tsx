import { Maximize2, Minimize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CardDescription, CardTitle } from '../ui/card';
import { CollapsibleCard } from '../ui/collapsible-card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { useSettingsStore } from '../../stores/settings';
import { useCurrentProfile } from '../../hooks/useCurrentProfile';

export function DisplaySettings() {
    const { t } = useTranslation();

    const { currentProfile, settings } = useCurrentProfile();
    const updateSettings = useSettingsStore((state) => state.updateProfileSettings);

    const handleDisplayModeChange = (checked: boolean) => {
        if (!currentProfile) return;
        updateSettings(currentProfile.id, {
            displayMode: checked ? 'compact' : 'normal',
        });
    };

    return (
        <CollapsibleCard
            header={
                <>
                    <div className="flex items-center gap-2">
                        <Minimize2 className="h-5 w-5 text-primary" />
                        <CardTitle>{t('settings.display_mode')}</CardTitle>
                    </div>
                    <CardDescription>
                        {t('settings.display_mode_desc')}
                    </CardDescription>
                </>
            }
        >
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border bg-card">
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="display-mode" className="text-base font-semibold">
                                {t('settings.compact_view')}
                            </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {settings.displayMode === 'compact'
                                ? t('settings.compact_view_desc')
                                : t('settings.normal_view_desc')}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                            <Maximize2 className="h-4 w-4" />
                            <span className="font-medium">{t('settings.normal')}</span>
                        </div>
                        <Switch
                            id="display-mode"
                            checked={settings.displayMode === 'compact'}
                            onCheckedChange={handleDisplayModeChange}
                            data-testid="settings-display-mode-switch"
                        />
                        <div className="flex items-center gap-2 text-sm">
                            <Minimize2 className="h-4 w-4" />
                            <span className="font-medium">{t('settings.compact')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </CollapsibleCard>
    );
}
