/**
 * Monitor Widget Component
 *
 * Displays live monitor streams in dashboard widgets.
 * Features:
 * - Single or multiple monitor display
 * - Automatic grid layout for multiple monitors
 * - Respects user streaming vs snapshot preferences
 * - Periodic refresh in snapshot mode
 * - Error handling and offline states
 * - Stream URL generation with auth tokens
 * - Hover overlay with monitor name
 */

import { useEffect, useState, useRef, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getMonitor, getMonitors, getStreamUrl } from '../../../api/monitors';
import { getZmsControlUrl } from '../../../lib/url-builder';
import { ZMS_COMMANDS } from '../../../lib/zm-constants';
import { httpGet } from '../../../lib/http';
import { useProfileStore } from '../../../stores/profile';
import { useAuthStore } from '../../../stores/auth';
import { useMonitorStore } from '../../../stores/monitors';
import { useSettingsStore, type MonitorFeedFit } from '../../../stores/settings';
import { useBandwidthSettings } from '../../../hooks/useBandwidthSettings';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, VideoOff } from 'lucide-react';
import { Skeleton } from '../../ui/skeleton';
import { useTranslation } from 'react-i18next';
import { calculateGridDimensions, getGridTemplateStyle } from '../../../lib/grid-utils';
import { filterEnabledMonitors } from '../../../lib/filters';
import { log, LogLevel } from '../../../lib/logger';

interface MonitorWidgetProps {
    /** Array of monitor IDs to display */
    monitorIds: string[];
    objectFit?: MonitorFeedFit;
}

/**
 * Single Monitor Display Component
 * Renders a single monitor stream with error handling
 * Respects streaming vs snapshot settings from user preferences
 */
function SingleMonitor({ monitorId, objectFit }: { monitorId: string; objectFit: MonitorFeedFit }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const bandwidth = useBandwidthSettings();
    const { data: monitor, isLoading, error } = useQuery({
        queryKey: ['monitor', monitorId],
        queryFn: () => getMonitor(monitorId),
        enabled: !!monitorId,
    });

    const currentProfile = useProfileStore(
        useShallow((state) => {
            const { profiles, currentProfileId } = state;
            return profiles.find((p) => p.id === currentProfileId) || null;
        })
    );
    const accessToken = useAuthStore((state) => state.accessToken);
    const regenerateConnKey = useMonitorStore((state) => state.regenerateConnKey);
    // Select raw profileSettings to avoid calling getProfileSettings() which creates new objects
    const rawSettings = useSettingsStore(
        useShallow((state) => state.profileSettings[currentProfile?.id || ''])
    );
    // Merge with defaults in render - only include settings actually used by this component
    const settings = {
        viewMode: rawSettings?.viewMode ?? 'snapshot',
        streamMaxFps: rawSettings?.streamMaxFps ?? 10,
    };

    const [connKey, setConnKey] = useState(0);
    const [cacheBuster, setCacheBuster] = useState(Date.now());
    const [displayedImageUrl, setDisplayedImageUrl] = useState<string>('');
    const imgRef = useRef<HTMLImageElement>(null);

    // Track previous connKey to send CMD_QUIT before regenerating
    const prevConnKeyRef = useRef<number>(0);
    const isInitialMountRef = useRef(true);

    // Force regenerate connKey when monitor ID changes
    useEffect(() => {
        if (!monitor) return;

        const monitorId = monitor.Monitor.Id;

        // Send CMD_QUIT for previous connKey before generating new one (skip on initial mount)
        if (!isInitialMountRef.current && prevConnKeyRef.current !== 0 && settings.viewMode === 'streaming' && currentProfile) {
            const controlUrl = getZmsControlUrl(
                currentProfile.portalUrl,
                ZMS_COMMANDS.cmdQuit,
                prevConnKeyRef.current.toString(),
                {
                    token: accessToken || undefined,
                }
            );

            log.dashboard('Sending CMD_QUIT before regenerating connkey for widget', LogLevel.DEBUG, {
                monitorId,
                monitorName: monitor.Monitor.Name,
                oldConnkey: prevConnKeyRef.current,
            });

            httpGet(controlUrl).catch(() => {
                // Silently ignore errors - connection may already be closed
            });
        }

        isInitialMountRef.current = false;

        // Generate new connKey
        log.dashboard('Regenerating connkey for widget', LogLevel.DEBUG, { monitorId });
        const newKey = regenerateConnKey(monitorId);
        setConnKey(newKey);
        prevConnKeyRef.current = newKey;
        setCacheBuster(Date.now());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [monitor?.Monitor.Id]); // ONLY regenerate when monitor ID changes

    // Snapshot mode: periodic refresh
    useEffect(() => {
        if (settings.viewMode !== 'snapshot') return;

        const interval = setInterval(() => {
            setCacheBuster(Date.now());
        }, bandwidth.snapshotRefreshInterval * 1000);

        return () => clearInterval(interval);
    }, [settings.viewMode, bandwidth.snapshotRefreshInterval]);

    // Store cleanup parameters in ref to access latest values on unmount
    const cleanupParamsRef = useRef({ monitorId: '', monitorName: '', connKey: 0, profile: currentProfile, token: accessToken, viewMode: settings.viewMode });

    // Update cleanup params whenever they change
    useEffect(() => {
        cleanupParamsRef.current = {
            monitorId: monitor?.Monitor.Id || '',
            monitorName: monitor?.Monitor.Name || '',
            connKey,
            profile: currentProfile,
            token: accessToken,
            viewMode: settings.viewMode,
        };
    }, [monitor?.Monitor.Id, monitor?.Monitor.Name, connKey, currentProfile, accessToken, settings.viewMode]);

    // Cleanup: send CMD_QUIT and abort image loading on unmount ONLY
    useEffect(() => {
        return () => {
            const params = cleanupParamsRef.current;

            // Send CMD_QUIT to properly close the stream connection (only in streaming mode)
            if (params.viewMode === 'streaming' && params.profile && params.monitorId && params.connKey !== 0) {
                const controlUrl = getZmsControlUrl(params.profile.portalUrl, ZMS_COMMANDS.cmdQuit, params.connKey.toString(), {
                    token: params.token || undefined,
                });

                log.dashboard('Sending CMD_QUIT on unmount', LogLevel.DEBUG, {
                    monitorId: params.monitorId,
                    monitorName: params.monitorName,
                    connkey: params.connKey,
                });

                // Send CMD_QUIT asynchronously, ignore errors (connection may already be closed)
                httpGet(controlUrl).catch(() => {
                    // Silently ignore errors - server connection may already be closed
                });
            }

            // Abort image loading to release browser connection
            if (imgRef.current) {
                imgRef.current.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            }
        };
    }, []); // Empty deps = only run on unmount

    const streamUrl = currentProfile && monitor && connKey !== 0
        ? getStreamUrl(currentProfile.cgiUrl, monitor.Monitor.Id, {
            mode: settings.viewMode === 'snapshot' ? 'single' : 'jpeg',
            scale: bandwidth.imageScale,
            maxfps: settings.viewMode === 'streaming' ? settings.streamMaxFps : undefined,
            token: accessToken || undefined,
            connkey: connKey,
            // Only use cacheBuster in snapshot mode to force refresh; streaming mode uses only connkey
            cacheBuster: settings.viewMode === 'snapshot' ? cacheBuster : undefined,
            // Only use multi-port in streaming mode, not snapshot
            minStreamingPort:
                settings.viewMode === 'streaming'
                    ? currentProfile.minStreamingPort
                    : undefined,
        })
        : '';

    // Preload images in snapshot mode to avoid flickering
    useEffect(() => {
        if (settings.viewMode !== 'snapshot' || !streamUrl) {
            setDisplayedImageUrl(streamUrl);
            return;
        }

        // Preload the new image
        const img = new Image();
        img.onload = () => {
            // Only update the displayed URL when the new image is fully loaded
            setDisplayedImageUrl(streamUrl);
        };
        img.onerror = () => {
            // On error, still update to trigger the error handler
            setDisplayedImageUrl(streamUrl);
        };
        img.src = streamUrl;
    }, [streamUrl, settings.viewMode]);

    if (isLoading) {
        return <Skeleton className="w-full h-full" />;
    }

    if (error || !monitor) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/30 p-4 text-center">
                <AlertTriangle className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-xs">{t('dashboard.offline')}</span>
            </div>
        );
    }

    // Don't show deleted monitors
    if (monitor.Monitor.Deleted === true) {
        return null;
    }

    return (
        <div
            className="w-full h-full bg-black relative group overflow-hidden cursor-pointer"
            onClick={() => navigate(`/monitors/${monitor.Monitor.Id}`, { state: { from: '/dashboard' } })}
        >
            {displayedImageUrl && (
                <img
                    ref={imgRef}
                    src={displayedImageUrl}
                    alt={monitor.Monitor.Name}
                    className="w-full h-full"
                    style={{ objectFit }}
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                />
            )}
            <div className="hidden absolute inset-0 flex items-center justify-center text-white/50 bg-zinc-900">
                <VideoOff className="h-8 w-8" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <p className="text-white text-xs font-medium truncate">{monitor.Monitor.Name}</p>
            </div>
        </div>
    );
}

export const MonitorWidget = memo(function MonitorWidget({ monitorIds, objectFit = 'contain' }: MonitorWidgetProps) {
    const { t } = useTranslation();

    // Fetch all monitors to check which ones are deleted
    const { data: monitorsData } = useQuery({
        queryKey: ['monitors'],
        queryFn: getMonitors,
    });

    // Filter out deleted monitors
    const activeMonitorIds = useMemo(() => {
        if (!monitorsData?.monitors) return monitorIds;

        const enabledMonitors = filterEnabledMonitors(monitorsData.monitors);
        const enabledIds = new Set(enabledMonitors.map(m => m.Monitor.Id));

        return monitorIds.filter(id => enabledIds.has(id));
    }, [monitorIds, monitorsData?.monitors]);

    if (!monitorIds || monitorIds.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                {t('dashboard.no_monitors_selected')}
            </div>
        );
    }

    if (activeMonitorIds.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                {t('dashboard.no_monitors_available')}
            </div>
        );
    }

    if (activeMonitorIds.length === 1) {
        return <SingleMonitor monitorId={activeMonitorIds[0]} objectFit={objectFit} />;
    }

    // Calculate optimal grid layout for multiple monitors
    const { cols, rows } = calculateGridDimensions(activeMonitorIds.length);
    const gridStyle = getGridTemplateStyle(cols, rows);

    return (
        <div
            className="w-full h-full grid gap-0 bg-black"
            style={gridStyle}
        >
            {activeMonitorIds.map((id) => (
                <div key={id} className="relative overflow-hidden">
                    <SingleMonitor monitorId={id} objectFit={objectFit} />
                </div>
            ))}
        </div>
    );
});
