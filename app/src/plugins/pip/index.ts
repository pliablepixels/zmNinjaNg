import { registerPlugin } from '@capacitor/core';
import type { PipPlugin } from './definitions';
import { log, LogLevel } from '../../lib/logger';

const Pip = registerPlugin<PipPlugin>('Pip', {
  web: () => import('./web').then((m) => new m.PipWeb()),
});

function browserPipEnabled(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean((document as { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled);
}

/**
 * Engage Picture-in-Picture for a `<video>` element on the first platform
 * path that supports it. Safe to call when PiP is unsupported — logs and
 * returns without throwing. Used by deep links (e.g. `?pip=auto`) and
 * future glanceable surfaces.
 */
export async function engageOnReady(
  videoEl: HTMLVideoElement | null | undefined,
  opts?: { eventId?: string }
): Promise<void> {
  if (!videoEl) {
    log.notifications('engageOnReady called with no video element', LogLevel.DEBUG);
    return;
  }

  // 1. Native plugin (Android stream-URL PiP today).
  try {
    const { supported } = await Pip.isPipSupported();
    if (supported && videoEl.currentSrc) {
      const aspectRatio =
        videoEl.videoWidth && videoEl.videoHeight
          ? `${videoEl.videoWidth}:${videoEl.videoHeight}`
          : undefined;
      await Pip.enterPip({
        url: videoEl.currentSrc,
        position: videoEl.currentTime || 0,
        aspectRatio,
      });
      log.notifications('engageOnReady: native PiP engaged', LogLevel.INFO, {
        eventId: opts?.eventId,
      });
      return;
    }
  } catch (err) {
    log.notifications('engageOnReady: native PiP failed, falling back', LogLevel.WARN, {
      eventId: opts?.eventId,
      error: (err as Error)?.message,
    });
  }

  // 2. Browser-native PiP (web + Tauri WebView when available).
  try {
    if (browserPipEnabled() && typeof videoEl.requestPictureInPicture === 'function') {
      await videoEl.requestPictureInPicture();
      log.notifications('engageOnReady: browser PiP engaged', LogLevel.INFO, {
        eventId: opts?.eventId,
      });
      return;
    }
  } catch (err) {
    log.notifications('engageOnReady: browser PiP failed', LogLevel.WARN, {
      eventId: opts?.eventId,
      error: (err as Error)?.message,
    });
  }

  log.notifications('engageOnReady: PiP not supported on this platform', LogLevel.INFO, {
    eventId: opts?.eventId,
  });
}

export * from './definitions';
export { Pip };
