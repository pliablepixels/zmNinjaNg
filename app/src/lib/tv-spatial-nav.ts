/**
 * Enables WebView spatial navigation on Android TV devices.
 * Called once on app startup when TV mode is active.
 */

import { Platform } from './platform';
import { log, LogLevel } from './logger';

interface TvDetectorPlugin {
  isTV(): Promise<{ isTV: boolean }>;
  enableSpatialNavigation(): Promise<void>;
}

export async function enableSpatialNavigation(): Promise<void> {
  if (!Platform.isNative) return;

  try {
    const { registerPlugin } = await import('@capacitor/core');
    const TvDetector = registerPlugin<TvDetectorPlugin>('TvDetector');
    await TvDetector.enableSpatialNavigation();
    log.auth('Spatial navigation enabled', LogLevel.INFO);
  } catch {
    // Not on Android TV or plugin not available
  }
}

export async function checkIsTV(): Promise<boolean> {
  if (Platform.isTVDevice) return true;

  if (!Platform.isNative) return false;

  try {
    const { registerPlugin } = await import('@capacitor/core');
    const TvDetector = registerPlugin<TvDetectorPlugin>('TvDetector');
    const result = await TvDetector.isTV();
    return result.isTV;
  } catch {
    return false;
  }
}
