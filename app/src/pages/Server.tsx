/**
 * Server Page
 *
 * Displays server information, status, and controls for the ZoneMinder server.
 * Includes version info, load metrics, disk usage, and run state management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useBandwidthSettings } from '../hooks/useBandwidthSettings';
import { useAuthStore } from '../stores/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Server as ServerIcon,
  Activity,
  HardDrive,
  Cpu,
  Info,
  PlayCircle,
  RefreshCw,
  Loader2,
  Play,
  Square,
  RotateCw,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getServers, getLoad, getDiskPercent, getDaemonCheck } from '../api/server';
import { getServerTimeZone } from '../api/time';
import { getStates, changeState } from '../api/states';
import { useToast } from '../hooks/use-toast';
import { log, LogLevel } from '../lib/logger';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { NotificationBadge } from '../components/NotificationBadge';

export default function Server() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentProfile } = useCurrentProfile();
  const bandwidth = useBandwidthSettings();
  const { version, apiVersion, isAuthenticated } = useAuthStore();
  const [selectedAction, setSelectedAction] = useState<string>('');

  // Fetch server information
  const { data: servers, isLoading: serversLoading } = useQuery({
    queryKey: ['servers', currentProfile?.id],
    queryFn: getServers,
    enabled: !!currentProfile && isAuthenticated,
  });

  // Fetch daemon status
  const { data: isDaemonRunning, isLoading: daemonLoading } = useQuery({
    queryKey: ['daemon-check', currentProfile?.id],
    queryFn: getDaemonCheck,
    enabled: !!currentProfile && isAuthenticated,
    refetchInterval: bandwidth.daemonCheckInterval,
  });

  // Fetch load average
  const { data: loadData, isLoading: loadLoading } = useQuery({
    queryKey: ['server-load', currentProfile?.id],
    queryFn: getLoad,
    enabled: !!currentProfile && isAuthenticated,
  });

  // Fetch disk usage
  const { data: diskData, isLoading: diskLoading } = useQuery({
    queryKey: ['disk-usage', currentProfile?.id],
    queryFn: getDiskPercent,
    enabled: !!currentProfile && isAuthenticated,
  });

  // Fetch states
  const { data: states, isLoading: statesLoading } = useQuery({
    queryKey: ['states', currentProfile?.id],
    queryFn: getStates,
    enabled: !!currentProfile && isAuthenticated,
  });

  // Fetch timezone
  const { data: timezone, isLoading: timezoneLoading } = useQuery({
    queryKey: ['timezone', currentProfile?.id],
    queryFn: () => getServerTimeZone(),
    enabled: !!currentProfile && isAuthenticated,
  });

  // Mutation for state change
  const changeStateMutation = useMutation({
    mutationFn: (stateName: string) => changeState(stateName),
    onSuccess: () => {
      toast({
        title: t('common.success'),
        description: t('server.state_applied'),
      });
      queryClient.invalidateQueries({ queryKey: ['states'] });
      log.server('State/action applied', LogLevel.INFO, { action: selectedAction });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: t('server.state_apply_failed'),
        variant: 'destructive',
      });
      log.server('Failed to apply state/action', LogLevel.ERROR, error);
    },
  });

  // Find active state
  const activeState = states?.find((s) => s.IsActive === '1');

  // Set default selected action to active state
  useEffect(() => {
    if (activeState && !selectedAction) {
      setSelectedAction(activeState.Name);
    }
  }, [activeState, selectedAction]);

  const handleApply = () => {
    if (selectedAction) {
      changeStateMutation.mutate(selectedAction);
    }
  };

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['servers', currentProfile?.id] });
    queryClient.invalidateQueries({ queryKey: ['daemon-check', currentProfile?.id] });
    queryClient.invalidateQueries({ queryKey: ['server-load', currentProfile?.id] });
    queryClient.invalidateQueries({ queryKey: ['disk-usage', currentProfile?.id] });
    queryClient.invalidateQueries({ queryKey: ['states', currentProfile?.id] });
    queryClient.invalidateQueries({ queryKey: ['timezone', currentProfile?.id] });
  };

  const isRefreshing = serversLoading || daemonLoading || loadLoading || diskLoading || statesLoading || timezoneLoading;

  const formatMemory = (bytes: number | undefined) => {
    if (!bytes) return t('common.unknown');
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const primaryServer = servers && servers.length > 0 ? servers[0] : null;
  const diskUsageGB = diskData?.usage;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight">
              {t('server.title')}
            </h1>
            <NotificationBadge />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
            {t('server.subtitle')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('common.refresh')}</span>
        </Button>
      </div>

      {/* Version Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <CardTitle>{t('server.version_info')}</CardTitle>
          </div>
          <CardDescription>{t('server.version_info_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="text-sm font-medium text-muted-foreground">
                {t('server.zm_version')}
              </div>
              <div className="text-lg font-bold mt-1">{version || t('common.unknown')}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="text-sm font-medium text-muted-foreground">
                {t('server.api_version')}
              </div>
              <div className="text-lg font-bold mt-1">{apiVersion || t('common.unknown')}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="text-sm font-medium text-muted-foreground">
                {t('server.timezone')}
              </div>
              <div className="text-lg font-bold mt-1 break-words">{timezone || t('common.unknown')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Load Average */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t('server.load_average')}</CardTitle>
              </div>
              {loadLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadData?.load !== undefined
                ? (Array.isArray(loadData.load)
                    ? loadData.load[0]
                    : loadData.load
                  ).toFixed(2)
                : '--'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('server.load_desc')}</p>
          </CardContent>
        </Card>

        {/* Disk Usage */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t('server.disk_usage')}</CardTitle>
              </div>
              {diskLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {diskUsageGB !== undefined ? `${diskUsageGB.toFixed(1)} GB` : '--'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('server.disk_desc')}</p>
          </CardContent>
        </Card>

        {/* Server Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{t('server.status')}</CardTitle>
              </div>
              {(serversLoading || daemonLoading) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={isDaemonRunning ? 'default' : 'destructive'}>
                  {isDaemonRunning ? t('common.running') : t('common.stopped')}
                </Badge>
              </div>
              {primaryServer?.Hostname && (
                <p className="text-xs text-muted-foreground">
                  {t('server.hostname')}: {primaryServer.Hostname}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Server Details */}
      {primaryServer && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ServerIcon className="h-5 w-5 text-primary" />
              <CardTitle>{t('server.details')}</CardTitle>
            </div>
            <CardDescription>{t('server.details_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">
                  {t('server.server_name')}
                </div>
                <div className="text-base font-semibold">{primaryServer.Name}</div>
              </div>
              {primaryServer.TotalMem && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    {t('server.total_memory')}
                  </div>
                  <div className="text-base font-semibold">
                    {formatMemory(primaryServer.TotalMem)}
                  </div>
                </div>
              )}
              {primaryServer.FreeMem && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    {t('server.free_memory')}
                  </div>
                  <div className="text-base font-semibold">
                    {formatMemory(primaryServer.FreeMem)}
                  </div>
                </div>
              )}
              {primaryServer.CpuLoad !== undefined && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    {t('server.cpu_load')}
                  </div>
                  <div className="text-base font-semibold">
                    {(primaryServer.CpuLoad * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ZoneMinder Control */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-primary" />
            <CardTitle>{t('server.zm_control')}</CardTitle>
          </div>
          <CardDescription>{t('server.zm_control_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  {t('server.current_state')}
                </div>
                <div className="flex items-center gap-2">
                  {statesLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : activeState ? (
                    <Badge variant="outline" className="text-base px-3 py-1">
                      {activeState.Name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-base px-3 py-1">
                      {t('common.unknown')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {t('server.select_action')}
              </div>
              <div className="flex gap-2">
                <Select value={selectedAction} onValueChange={setSelectedAction}>
                  <SelectTrigger className="flex-1 [&>span]:!block [&>span]:!overflow-visible">
                    <SelectValue placeholder={t('server.select_state_or_action')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start">
                      <div className="flex items-center gap-2 w-full">
                        <Play className="h-4 w-4 flex-shrink-0" />
                        <span className="flex-1">{t('server.start')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="stop">
                      <div className="flex items-center gap-2 w-full">
                        <Square className="h-4 w-4 flex-shrink-0" />
                        <span className="flex-1">{t('server.stop')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="restart">
                      <div className="flex items-center gap-2 w-full">
                        <RotateCw className="h-4 w-4 flex-shrink-0" />
                        <span className="flex-1">{t('server.restart')}</span>
                      </div>
                    </SelectItem>
                    {states && states.length > 0 && states.map((state) => (
                      <SelectItem key={state.Id} value={state.Name}>
                        <div className="flex items-center gap-2 w-full">
                          <span className="flex-1 truncate">{state.Name}</span>
                          {state.IsActive === '1' && (
                            <Badge variant="secondary" className="text-xs whitespace-nowrap">
                              {t('server.active')}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleApply}
                  disabled={!selectedAction || changeStateMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {changeStateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4" />
                  )}
                  {t('server.apply')}
                </Button>
              </div>
              {changeStateMutation.isPending && (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('server.executing_action')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
