/**
 * Hook for monitor alarm control
 *
 * Handles alarm status polling, toggle with optimistic updates, and state management.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getAlarmStatus, triggerAlarm, cancelAlarm } from '../../api/monitors';
import { log, LogLevel } from '../../lib/logger';
import { useBandwidthSettings } from '../../hooks/useBandwidthSettings';

interface UseAlarmControlOptions {
  monitorId: string | undefined;
  apiBaseUrl?: string;
}

interface UseAlarmControlReturn {
  isAlarmArmed: boolean;
  isAlarmLoading: boolean;
  isAlarmUpdating: boolean;
  hasAlarmStatus: boolean;
  displayAlarmArmed: boolean;
  alarmStatusLabel: string;
  alarmBorderClass: string;
  handleAlarmToggle: (nextValue: boolean) => Promise<void>;
}

export function useAlarmControl({ monitorId, apiBaseUrl }: UseAlarmControlOptions): UseAlarmControlReturn {
  const { t } = useTranslation();
  const bandwidth = useBandwidthSettings();
  const [isAlarmUpdating, setIsAlarmUpdating] = useState(false);
  const [alarmToggleValue, setAlarmToggleValue] = useState(false);
  const [alarmPendingValue, setAlarmPendingValue] = useState<boolean | null>(null);

  const {
    data: alarmStatus,
    isLoading: isAlarmLoading,
    refetch: refetchAlarmStatus,
  } = useQuery({
    queryKey: ['monitor-alarm-status', monitorId],
    queryFn: () => getAlarmStatus(monitorId!, apiBaseUrl),
    enabled: !!monitorId,
    refetchInterval: bandwidth.alarmStatusInterval,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  });

  // Parse alarm status
  const { isAlarmArmed, hasAlarmStatus, parsedAlarmStatus } = useMemo(() => {
    const alarmStatusNumeric = alarmStatus?.status ?? alarmStatus?.output;
    const alarmStatusValue = alarmStatusNumeric?.toString().toLowerCase();
    const has = alarmStatusNumeric !== undefined && alarmStatusNumeric !== null;
    const parsed =
      alarmStatusNumeric !== undefined && alarmStatusNumeric !== null
        ? Number(alarmStatusNumeric)
        : Number.NaN;
    const armed = Number.isFinite(parsed)
      ? parsed !== 0
      : alarmStatusValue === 'on' ||
        alarmStatusValue === '1' ||
        alarmStatusValue === 'armed' ||
        alarmStatusValue === 'true';

    return { isAlarmArmed: armed, hasAlarmStatus: has, parsedAlarmStatus: parsed };
  }, [alarmStatus]);

  // Border class based on alarm state
  const alarmBorderClass = useMemo(() => {
    if (!Number.isFinite(parsedAlarmStatus)) return 'ring-0';
    if (parsedAlarmStatus === 2) return 'ring-4 ring-orange-500/70';
    if (parsedAlarmStatus === 3 || parsedAlarmStatus === 4) return 'ring-4 ring-red-500/70';
    return 'ring-0';
  }, [parsedAlarmStatus]);

  const displayAlarmArmed =
    alarmPendingValue ?? (isAlarmUpdating ? alarmToggleValue : isAlarmArmed);

  const alarmStatusLabel = hasAlarmStatus
    ? displayAlarmArmed
      ? t('monitor_detail.alarm_armed')
      : t('monitor_detail.alarm_disarmed')
    : t('common.unknown');

  // Sync toggle value with actual alarm status
  useEffect(() => {
    if (!hasAlarmStatus) return;
    setAlarmToggleValue(isAlarmArmed);
    if (alarmPendingValue !== null && alarmPendingValue === isAlarmArmed) {
      setAlarmPendingValue(null);
    }
  }, [hasAlarmStatus, isAlarmArmed, monitorId]);

  // Clear pending value after timeout
  useEffect(() => {
    if (alarmPendingValue === null) return;

    const timeout = setTimeout(() => {
      setAlarmPendingValue(null);
    }, 6000);

    return () => clearTimeout(timeout);
  }, [alarmPendingValue]);

  const handleAlarmToggle = useCallback(
    async (nextValue: boolean) => {
      if (!monitorId) return;

      const previousValue = alarmToggleValue;
      setAlarmToggleValue(nextValue);
      setAlarmPendingValue(nextValue);
      setIsAlarmUpdating(true);

      try {
        if (nextValue) {
          await triggerAlarm(monitorId, apiBaseUrl);
        } else {
          await cancelAlarm(monitorId, apiBaseUrl);
        }
        await refetchAlarmStatus();
        setTimeout(() => {
          refetchAlarmStatus();
        }, 1500);
        toast.success(
          nextValue
            ? t('monitor_detail.alarm_armed_toast')
            : t('monitor_detail.alarm_disarmed_toast')
        );
      } catch (toggleError) {
        log.monitorDetail('Alarm toggle failed', LogLevel.ERROR, {
          monitorId,
          nextValue,
          error: toggleError,
        });
        setAlarmToggleValue(previousValue);
        setAlarmPendingValue(previousValue);
        toast.error(t('monitor_detail.alarm_failed'));
      } finally {
        setIsAlarmUpdating(false);
      }
    },
    [monitorId, apiBaseUrl, alarmToggleValue, refetchAlarmStatus, t]
  );

  return {
    isAlarmArmed,
    isAlarmLoading,
    isAlarmUpdating,
    hasAlarmStatus,
    displayAlarmArmed,
    alarmStatusLabel,
    alarmBorderClass,
    handleAlarmToggle,
  };
}
