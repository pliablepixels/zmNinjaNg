import { useState } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CardDescription, CardTitle } from '../ui/card';
import { CollapsibleCard } from '../ui/collapsible-card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { useSettingsStore } from '../../stores/settings';
import { useCurrentProfile } from '../../hooks/useCurrentProfile';
import { Platform } from '../../lib/platform';
import { CertTrustDialog } from '../CertTrustDialog';
import type { CertInfo } from '../../lib/ssl-trust';
import { log, LogLevel } from '../../lib/logger';

export function ConnectionSettings() {
    const { t } = useTranslation();

    const { currentProfile, settings } = useCurrentProfile();
    const updateSettings = useSettingsStore((state) => state.updateProfileSettings);

    const [certDialogOpen, setCertDialogOpen] = useState(false);
    const [certInfo, setCertInfo] = useState<CertInfo | null>(null);
    const [certIsChanged, setCertIsChanged] = useState(false);
    const [reverifying, setReverifying] = useState(false);

    const handleSelfSignedCertsChange = async (checked: boolean) => {
        if (!currentProfile) return;

        if (checked && Platform.isNative) {
            // When enabling, fetch the server cert and show TOFU dialog
            try {
                // Temporarily enable SSL trust so we can connect to the self-signed server
                const { applySSLTrustSetting, getServerCertFingerprint } = await import('../../lib/ssl-trust');
                await applySSLTrustSetting(true);

                const info = await getServerCertFingerprint(currentProfile.portalUrl);
                if (info) {
                    setCertInfo(info);
                    setCertIsChanged(false);
                    setCertDialogOpen(true);
                    return; // Don't save setting yet — wait for user to trust
                }
                // If we couldn't fetch the cert (e.g., HTTP server), just enable
                await applySSLTrustSetting(true, null);
            } catch (error) {
                log.sslTrust('Failed to fetch cert during enable', LogLevel.ERROR, { error });
            }
        }

        updateSettings(currentProfile.id, {
            allowSelfSignedCerts: checked,
            ...(!checked && { trustedCertFingerprint: null }),
        });

        if (!checked) {
            const { applySSLTrustSetting } = await import('../../lib/ssl-trust');
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

        const { applySSLTrustSetting } = await import('../../lib/ssl-trust');
        await applySSLTrustSetting(true, certInfo.fingerprint);
    };

    const handleCancelTrust = async () => {
        setCertDialogOpen(false);
        // Disable SSL trust since user rejected the certificate
        const { applySSLTrustSetting } = await import('../../lib/ssl-trust');
        await applySSLTrustSetting(false);
    };

    const handleReverify = async () => {
        if (!currentProfile) return;
        setReverifying(true);
        try {
            const { applySSLTrustSetting, getServerCertFingerprint } = await import('../../lib/ssl-trust');
            // Temporarily allow all to fetch the current cert
            await applySSLTrustSetting(true);

            const info = await getServerCertFingerprint(currentProfile.portalUrl);
            if (info) {
                const isChanged = settings.trustedCertFingerprint !== null &&
                    info.fingerprint !== settings.trustedCertFingerprint;
                setCertInfo(info);
                setCertIsChanged(isChanged);
                setCertDialogOpen(true);
            }
            // Restore the fingerprint-based trust
            await applySSLTrustSetting(true, settings.trustedCertFingerprint);
        } catch (error) {
            log.sslTrust('Failed to re-verify certificate', LogLevel.ERROR, { error });
        } finally {
            setReverifying(false);
        }
    };

    return (
        <>
            <CollapsibleCard
                header={
                    <>
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-primary" />
                            <CardTitle>{t('settings.connection_settings')}</CardTitle>
                        </div>
                        <CardDescription>
                            {t('settings.connection_settings_desc')}
                        </CardDescription>
                    </>
                }
            >
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border bg-card">
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="self-signed-certs" className="text-base font-semibold">
                                {t('settings.allow_self_signed_certs')}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                {t('settings.allow_self_signed_certs_desc')}
                            </p>
                            {settings.allowSelfSignedCerts && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-medium">
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
                    </div>

                    {settings.allowSelfSignedCerts && Platform.isNative && (
                        <div className="p-4 rounded-lg border bg-card space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">
                                    {t('ssl.trusted_fingerprint')}
                                </Label>
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
                                <p className="font-mono text-[10px] break-all text-muted-foreground leading-relaxed"
                                   title={settings.trustedCertFingerprint}>
                                    {settings.trustedCertFingerprint}
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    {t('ssl.no_fingerprint')}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </CollapsibleCard>

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
