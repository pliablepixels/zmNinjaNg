/**
 * Monitor status utility.
 *
 * Single source of truth for deriving a monitor's run state from its
 * configuration and daemon status. Matches ZoneMinder's own console.js
 * color logic. Works across ZM 1.38+ and older versions.
 */

import type { Monitor, MonitorStatus } from '../api/types';
import { isZmVersionAtLeast } from './zm-version';

export type MonitorRunState = 'live' | 'warning' | 'offline' | 'disabled';

const ANALYSIS_FUNCTIONS = new Set(['Modect', 'Mocord', 'Nodect']);

function parseFps(fps: string | null | undefined): number {
  return parseFloat(fps ?? '0') || 0;
}

/**
 * Derives a monitor's run state.
 *
 * - "disabled": not configured to capture (Capturing=None / Function=None)
 * - "offline":  configured but daemon not connected or CaptureFPS is 0
 * - "warning":  capturing OK but analysis is enabled and AnalysisFPS is 0
 * - "live":     capturing frames and analysis (if enabled) is running
 */
export function getMonitorRunState(
  monitor: Monitor,
  status: MonitorStatus | undefined,
  zmVersion: string | null,
): MonitorRunState {
  const is138Plus = isZmVersionAtLeast(zmVersion, '1.38.0');

  const isConfigured = is138Plus
    ? monitor.Capturing !== 'None'
    : monitor.Function !== 'None';

  if (!isConfigured) return 'disabled';

  const connected = status?.Status === 'Connected';
  const captureFps = parseFps(status?.CaptureFPS);

  if (!connected || captureFps === 0) return 'offline';

  const analysisEnabled = is138Plus
    ? monitor.Analysing !== 'None'
    : ANALYSIS_FUNCTIONS.has(monitor.Function);

  if (analysisEnabled && parseFps(status?.AnalysisFPS) === 0) return 'warning';

  return 'live';
}

/** True when the monitor should be showing a video stream. */
export function isMonitorStreamable(state: MonitorRunState): boolean {
  return state === 'live' || state === 'warning';
}

/** Tailwind color class for the status dot. */
export function monitorDotColor(state: MonitorRunState): string {
  switch (state) {
    case 'live': return 'bg-green-500';
    case 'warning': return 'bg-amber-500';
    case 'offline': return 'bg-red-500';
    case 'disabled': return 'bg-zinc-400 dark:bg-zinc-600';
  }
}

/** Tailwind color classes for a Badge (with hover). */
export function monitorBadgeColor(state: MonitorRunState): string {
  switch (state) {
    case 'live': return 'bg-green-500/90 hover:bg-green-500';
    case 'warning': return 'bg-amber-500/90 hover:bg-amber-500';
    case 'offline': return 'bg-red-500/90 hover:bg-red-500';
    case 'disabled': return 'bg-zinc-400/90 hover:bg-zinc-400 dark:bg-zinc-600/90 dark:hover:bg-zinc-600';
  }
}

/** i18n key for the status label. */
export function monitorStatusI18nKey(state: MonitorRunState): string {
  switch (state) {
    case 'live': return 'monitors.live';
    case 'warning': return 'monitors.warning';
    case 'offline': return 'monitors.offline';
    case 'disabled': return 'monitors.disabled';
  }
}
