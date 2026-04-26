/**
 * useDeepLinkHandler
 *
 * Listens for `zmninja://` URL opens delivered by Capacitor's `App` plugin
 * and routes the running app to the matching screen. Switches the active
 * profile first when the deep link references a different one.
 *
 * Web platforms also receive deep links when the URL bar contains an
 * `app_url=zmninja://...` query (used by widget / tray previews).
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useProfileStore } from '../stores/profile';
import { parseDeepLink, deepLinkToRoute } from '../lib/deep-link';
import { log, LogLevel } from '../lib/logger';

export function useDeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let mounted = true;

    async function handleUrl(url: string) {
      const parsed = parseDeepLink(url);
      if (!parsed) {
        log.notifications('Deep link could not be parsed', LogLevel.WARN, { url });
        return;
      }

      const { currentProfileId, profiles, switchProfile } = useProfileStore.getState();
      if (parsed.profileId && parsed.profileId !== currentProfileId) {
        const target = profiles.find((p) => p.id === parsed.profileId);
        if (!target) {
          log.notifications('Deep link references unknown profile; routing under current', LogLevel.WARN, {
            url,
            profileId: parsed.profileId,
          });
        } else {
          try {
            await switchProfile(parsed.profileId);
          } catch (err) {
            log.notifications('Profile switch failed; aborting deep link', LogLevel.ERROR, {
              url,
              profileId: parsed.profileId,
              error: (err as Error)?.message,
            });
            return;
          }
        }
      }

      const route = deepLinkToRoute(parsed);
      log.notifications('Routing deep link', LogLevel.INFO, { url, route });
      navigate(route);
    }

    async function setup() {
      if (Capacitor.isNativePlatform()) {
        try {
          const { App } = await import('@capacitor/app');
          const handle = await App.addListener('appUrlOpen', (event) => {
            if (mounted) void handleUrl(event.url);
          });
          if (!mounted) {
            handle.remove();
            return;
          }
          cleanup = () => {
            handle.remove();
          };
        } catch (err) {
          log.notifications('Could not register appUrlOpen listener', LogLevel.WARN, {
            error: (err as Error)?.message,
          });
        }
        return;
      }

      // Web: support `?app_url=...` once on mount, useful for previews.
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const initial = params.get('app_url');
        if (initial) void handleUrl(initial);
      }
    }

    void setup();

    return () => {
      mounted = false;
      if (cleanup) cleanup();
    };
  }, [navigate]);
}
