/**
 * Quick-Look Dock (web).
 *
 * Persistent strip at the bottom of the viewport showing the most recent
 * notification events for the active profile, present on every route. Each
 * row deep-links to the corresponding event. Dismissable per session via
 * sessionStorage. Hidden on phone-portrait viewports < 480px wide so the
 * dock never fights with the thumb-zone of the bottom toolbar.
 *
 * The functional-equivalent on native is the home-screen widget; on Tauri
 * it's the system-tray popover. See specs/quick-look-surfaces/spec.md.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Capacitor } from '@capacitor/core';
import { useNotificationStore } from '../../stores/notifications';
import { useCurrentProfile } from '../../hooks/useCurrentProfile';
import { useDateTimeFormat } from '../../hooks/useDateTimeFormat';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

const DISMISS_KEY = 'zmng-quicklook-dock-dismissed';
const MAX_VISIBLE = 5;
const HIDE_BELOW_PX = 480;

export function QuickLookDock() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fmtTimeShort } = useDateTimeFormat();
  const { currentProfile } = useCurrentProfile();

  const events = useNotificationStore(
    useShallow((state) =>
      currentProfile ? state.profileEvents[currentProfile.id] ?? [] : []
    )
  );

  // Per-session dismiss
  const [dismissed, setDismissed] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  });

  // Track narrow viewports so the dock disappears under 480px wide
  const [tooNarrow, setTooNarrow] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < HIDE_BELOW_PX;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setTooNarrow(window.innerWidth < HIDE_BELOW_PX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Dock is web-only; on native, the home-screen widget is the equivalent surface.
  if (Capacitor.isNativePlatform()) return null;
  if (dismissed) return null;
  if (tooNarrow) return null;

  const recent = [...events]
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .slice(0, MAX_VISIBLE);

  const dismiss = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(DISMISS_KEY, '1');
    }
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30',
        'bg-card/95 backdrop-blur border-t border-border',
        'pb-[env(safe-area-inset-bottom)]'
      )}
      role="region"
      aria-label={t('quicklook.region_label')}
      data-testid="quicklook-dock"
    >
      <div className="flex items-stretch gap-2 px-3 py-1.5 max-w-screen-xl mx-auto">
        <div className="flex-1 flex items-center gap-2 overflow-x-auto">
          {recent.length === 0 ? (
            <span
              className="text-xs text-muted-foreground"
              data-testid="quicklook-empty"
            >
              {t('quicklook.empty')}
            </span>
          ) : (
            recent.map((event) => (
              <button
                key={`${event.MonitorId}-${event.EventId}-${event.receivedAt}`}
                type="button"
                onClick={() => navigate(`/events/${event.EventId}`)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded-md',
                  'text-xs hover:bg-accent transition-colors min-w-0 shrink-0',
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
                data-testid={`quicklook-event-${event.EventId}`}
              >
                <span className="font-medium truncate max-w-[120px]" title={event.MonitorName}>
                  {event.MonitorName}
                </span>
                <span className="text-muted-foreground">
                  {fmtTimeShort(new Date(event.receivedAt))}
                </span>
              </button>
            ))
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={dismiss}
          aria-label={t('quicklook.dismiss')}
          title={t('quicklook.dismiss')}
          data-testid="quicklook-dismiss"
          className="h-7 w-7 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
