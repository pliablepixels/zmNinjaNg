import { LayoutDashboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CardDescription, CardTitle } from '../ui/card';
import { CollapsibleCard } from '../ui/collapsible-card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useSettingsStore } from '../../stores/settings';
import { useCurrentProfile } from '../../hooks/useCurrentProfile';

export function DashboardSettings() {
    const { t } = useTranslation();

    const { currentProfile, settings } = useCurrentProfile();
    const updateSettings = useSettingsStore((state) => state.updateProfileSettings);

    const handleDashboardRefreshChange = (value: number) => {
        if (!currentProfile) return;
        updateSettings(currentProfile.id, {
            dashboardRefreshInterval: value,
        });
    };

    return (
        <CollapsibleCard
            header={
                <>
                    <div className="flex items-center gap-2">
                        <LayoutDashboard className="h-5 w-5 text-primary" />
                        <CardTitle>{t('settings.dashboard_settings')}</CardTitle>
                    </div>
                    <CardDescription>
                        {t('settings.dashboard_settings_desc')}
                    </CardDescription>
                </>
            }
        >
            <div className="space-y-6">
                <div className="space-y-3 p-4 rounded-lg border bg-card">
                    <div>
                        <Label htmlFor="dashboard-refresh" className="text-base font-semibold">
                            {t('settings.dashboard_refresh_interval')}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('settings.dashboard_refresh_interval_desc')}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <Input
                            id="dashboard-refresh"
                            type="number"
                            min="5"
                            max="300"
                            step="5"
                            value={settings.dashboardRefreshInterval || 30}
                            onChange={(e) => handleDashboardRefreshChange(Number(e.target.value))}
                            className="w-28"
                        />
                        <span className="text-sm text-muted-foreground">{t('settings.seconds')}</span>
                        <div className="flex flex-wrap gap-2 sm:ml-auto">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDashboardRefreshChange(10)}
                            >
                                10
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDashboardRefreshChange(30)}
                            >
                                30 ({t('settings.default')})
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDashboardRefreshChange(60)}
                            >
                                60
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </CollapsibleCard>
    );
}
