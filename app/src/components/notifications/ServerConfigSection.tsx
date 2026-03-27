/**
 * Server Configuration Section
 *
 * ES mode server connection settings: host, port, SSL, toast/sound preferences,
 * and connect/disconnect buttons.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Server, Shield, Wifi, WifiOff, Loader2 } from 'lucide-react';
import type { NotificationSettings } from '../../stores/notifications';

export interface ServerConfigSectionProps {
  settings: NotificationSettings;
  profileId: string;
  isConnected: boolean;
  isConnecting: boolean;
  onUpdateSettings: (profileId: string, updates: Partial<NotificationSettings>) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ServerConfigSection({
  settings,
  profileId,
  isConnected,
  isConnecting,
  onUpdateSettings,
  onConnect,
  onDisconnect,
}: ServerConfigSectionProps) {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <CardTitle>{t('notification_settings.server_config_title')}</CardTitle>
        </div>
        <CardDescription>
          {t('notification_settings.server_config_desc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Host */}
        <div className="space-y-2">
          <Label htmlFor="host" className="text-base font-semibold">
            {t('notification_settings.server_host')}
          </Label>
          <Input
            id="host"
            type="text"
            placeholder={t('notification_settings.host_placeholder')}
            value={settings.host}
            onChange={(e) => onUpdateSettings(profileId, { host: e.target.value })}
            disabled={isConnected}
            autoCapitalize="none"
            autoCorrect="off"
            data-testid="notification-host-input"
          />
          <p className="text-xs text-muted-foreground">
            {t('notification_settings.server_host_desc')}
          </p>
        </div>

        {/* Advanced Settings */}
        <div className="space-y-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            data-testid="notification-advanced-toggle"
          >
            {showAdvanced ? t('notification_settings.hide_advanced') : t('notification_settings.show_advanced')}
          </Button>

          {showAdvanced && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/50">
              {/* Port */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="port">{t('notification_settings.port')}</Label>
                  <Input
                    id="port"
                    type="number"
                    value={settings.port}
                    onChange={(e) => onUpdateSettings(profileId, { port: Number(e.target.value) })}
                    disabled={isConnected}
                    data-testid="notification-port-input"
                  />
                  <p className="text-xs text-muted-foreground">{t('notification_settings.default_port')}</p>
                </div>

                {/* SSL */}
                <div className="space-y-2">
                  <Label htmlFor="ssl" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {t('notification_settings.use_ssl')}
                  </Label>
                  <div className="flex items-center h-10">
                    <Switch
                      id="ssl"
                      checked={settings.ssl}
                      onCheckedChange={(checked) => onUpdateSettings(profileId, { ssl: checked })}
                      disabled={isConnected}
                      data-testid="notification-ssl-toggle"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('notification_settings.ssl_desc')}
                  </p>
                </div>
              </div>

              {/* Toast and Sound Settings */}
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="show-toasts" className="text-sm">
                      {t('notification_settings.show_toasts')}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t('notification_settings.show_toasts_desc')}
                    </p>
                  </div>
                  <Switch
                    id="show-toasts"
                    checked={settings.showToasts}
                    onCheckedChange={(checked) => onUpdateSettings(profileId, { showToasts: checked })}
                    data-testid="notification-show-toasts-toggle"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="play-sound" className="text-sm">
                      {t('notification_settings.play_sound')}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t('notification_settings.play_sound_desc')}</p>
                  </div>
                  <Switch
                    id="play-sound"
                    checked={settings.playSound}
                    onCheckedChange={(checked) => onUpdateSettings(profileId, { playSound: checked })}
                    data-testid="notification-play-sound-toggle"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Connection Button */}
        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                onClick={onDisconnect}
                className="flex-1"
                data-testid="notification-disconnect-button"
              >
                <WifiOff className="h-4 w-4 mr-2" />
                {t('notification_settings.disconnect')}
              </Button>
              <Button
                variant="secondary"
                onClick={onConnect}
                disabled={isConnecting}
                className="flex-1"
                data-testid="notification-reconnect-button"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wifi className="h-4 w-4 mr-2" />
                )}
                {t('notification_settings.reconnect')}
              </Button>
            </>
          ) : (
            <Button
              onClick={onConnect}
              disabled={isConnecting || !settings.host}
              className="flex-1"
              data-testid="notification-connect-button"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              {t('notification_settings.connect')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
