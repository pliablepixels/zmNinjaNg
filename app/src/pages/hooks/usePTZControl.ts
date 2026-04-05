/**
 * Hook for PTZ (Pan-Tilt-Zoom) camera control
 *
 * Handles sending PTZ commands with optional auto-stop for non-continuous mode.
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { controlMonitor } from '../../api/monitors';
import { log, LogLevel } from '../../lib/logger';

interface UsePTZControlOptions {
  portalUrl: string;
  monitorId: string;
  accessToken: string | null;
  isContinuous: boolean;
  minStreamingPort?: number;
}

interface UsePTZControlReturn {
  handlePTZCommand: (command: string) => Promise<void>;
}

export function usePTZControl({
  portalUrl,
  monitorId,
  accessToken,
  isContinuous,
  minStreamingPort,
}: UsePTZControlOptions): UsePTZControlReturn {
  const { t } = useTranslation();

  const handlePTZCommand = useCallback(
    async (command: string) => {
      if (!portalUrl || !monitorId) return;

      try {
        await controlMonitor(portalUrl, monitorId, command, accessToken || undefined, minStreamingPort);

        // Auto-stop logic for non-continuous mode
        // Only apply to moveCon* and zoomCon* commands
        if (!isContinuous && (command.startsWith('moveCon') || command.startsWith('zoomCon'))) {
          setTimeout(async () => {
            try {
              await controlMonitor(portalUrl, monitorId, 'moveStop', accessToken || undefined, minStreamingPort);
            } catch (e) {
              log.monitorDetail('Auto-stop command failed', LogLevel.WARN, { error: e });
            }
          }, 500);
        }
      } catch (error) {
        log.monitorDetail('PTZ command failed', LogLevel.ERROR, { command, error });
        toast.error(t('monitor_detail.ptz_failed'));
      }
    },
    [portalUrl, monitorId, accessToken, isContinuous, minStreamingPort, t]
  );

  return { handlePTZCommand };
}
