import { Bug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CardDescription, CardTitle } from '../ui/card';
import { CollapsibleCard } from '../ui/collapsible-card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { useSettingsStore } from '../../stores/settings';
import { useCurrentProfile } from '../../hooks/useCurrentProfile';

export function DebugSettings() {
    const { t } = useTranslation();

    const { currentProfile, settings } = useCurrentProfile();
    const updateSettings = useSettingsStore((state) => state.updateProfileSettings);

    const handleLogRedactionChange = (checked: boolean) => {
        if (!currentProfile) return;
        updateSettings(currentProfile.id, {
            disableLogRedaction: checked,
        });
    };

    return (
        <CollapsibleCard
            header={
                <>
                    <div className="flex items-center gap-2">
                        <Bug className="h-5 w-5 text-primary" />
                        <CardTitle>{t('settings.debug_settings')}</CardTitle>
                    </div>
                    <CardDescription>
                        {t('settings.debug_settings_desc')}
                    </CardDescription>
                </>
            }
        >
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border bg-card">
                    <div className="flex-1 space-y-1">
                        <Label htmlFor="log-redaction" className="text-base font-semibold">
                            {t('settings.disable_log_redaction')}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.disable_log_redaction_desc')}
                        </p>
                        {settings.disableLogRedaction && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                                {t('settings.disable_log_redaction_warning')}
                            </p>
                        )}
                    </div>
                    <Switch
                        id="log-redaction"
                        checked={settings.disableLogRedaction}
                        onCheckedChange={handleLogRedactionChange}
                        data-testid="settings-log-redaction-switch"
                    />
                </div>
            </div>
        </CollapsibleCard>
    );
}
