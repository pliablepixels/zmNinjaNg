/**
 * Notification Handler Component
 *
 * A headless component that manages the notification system.
 * It listens to the notification store and displays toast notifications
 * for new events. It also handles auto-connecting to the notification
 * server when a profile is loaded.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../stores/notifications';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useProfileStore } from '../stores/profile';
import { useAuthStore } from '../stores/auth';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { getEventCauseIcon } from '../lib/event-icons';
import { log, LogLevel } from '../lib/logger';
import { navigationService } from '../lib/navigation';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Platform } from '../lib/platform';
import { getPushService } from '../services/pushNotifications';
import { getEventPoller } from '../services/eventPoller';
import { getNotificationService } from '../services/notifications';
import {
  onProfileSwitchRequest,
  clearPendingProfileSwitch,
  resolveProfileForNotification,
  type PendingProfileSwitch,
} from '../lib/notification-profile';

/**
 * NotificationHandler component.
 * This component does not render any visible UI itself but manages
 * side effects related to notifications (toasts, sounds, connection).
 */
export function NotificationHandler() {
  const navigate = useNavigate();
  const { currentProfile } = useCurrentProfile();
  const getDecryptedPassword = useProfileStore((state) => state.getDecryptedPassword);
  const switchProfile = useProfileStore((state) => state.switchProfile);
  const { t } = useTranslation();

  const {
    getProfileSettings,
    getEvents,
    isConnected,
    connectionState,
    currentProfileId,
    connect,
    disconnect,
    reconnect,
  } = useNotificationStore();

  const lastEventId = useRef<number | null>(null);
  const hasAttemptedAutoConnect = useRef(false);
  const lastProfileId = useRef<string | null>(null);

  // Profile switch confirmation state
  const [pendingSwitch, setPendingSwitch] = useState<PendingProfileSwitch | null>(null);

  // Handle profile switch confirmation from push notification taps
  const handleConfirmSwitch = useCallback(async () => {
    if (!pendingSwitch) return;

    const { targetProfileId, eventId } = pendingSwitch;
    setPendingSwitch(null);
    clearPendingProfileSwitch();

    log.notificationHandler('User confirmed profile switch from notification', LogLevel.INFO, {
      targetProfileId,
      eventId,
    });

    try {
      await switchProfile(targetProfileId);
      navigationService.navigateToEvent(eventId, { from: '/monitors', fromNotification: true });
    } catch (error) {
      log.notificationHandler('Profile switch failed', LogLevel.ERROR, error);
      toast.error(t('notifications.profile_switch_failed'));
    }
  }, [pendingSwitch, switchProfile, t]);

  const handleCancelSwitch = useCallback(() => {
    log.notificationHandler('User declined profile switch from notification', LogLevel.INFO, {
      targetProfileId: pendingSwitch?.targetProfileId,
    });
    setPendingSwitch(null);
    clearPendingProfileSwitch();
  }, [pendingSwitch]);

  // Listen for profile switch requests from the push notification service
  useEffect(() => {
    const unsubscribe = onProfileSwitchRequest((pending) => {
      setPendingSwitch(pending);
    });
    return unsubscribe;
  }, []);

  // Get settings and events for current profile
  const settings = currentProfile ? getProfileSettings(currentProfile.id) : null;
  const events = currentProfile ? getEvents(currentProfile.id) : [];

  // Reset auto-connect flag when profile changes, disabled, or mode changes
  useEffect(() => {
    if (!settings?.enabled) {
      hasAttemptedAutoConnect.current = false;
    }
  }, [settings?.enabled]);

  useEffect(() => {
    hasAttemptedAutoConnect.current = false;
  }, [settings?.notificationMode]);

  // Initialize push notifications on mobile
  // Runs when notifications are enabled or mode changes to ensure FCM token
  // is registered with the correct backend (ES websocket vs ZM REST API)
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !settings?.enabled || !currentProfile) return;

    const mode = settings.notificationMode || 'es';

    // In direct mode, set currentProfileId so the push service knows which
    // profile to register against (there's no WebSocket connect to set it)
    if (mode === 'direct') {
      useNotificationStore.setState({ currentProfileId: currentProfile.id });
      // Sync badge count with server after setting profile
      useNotificationStore.getState()._updateBadge();
    }

    const pushService = getPushService();

    if (pushService.isReady()) {
      // Token already obtained — re-register with server for current mode
      log.notificationHandler('Re-registering FCM token for mode change', LogLevel.INFO, { mode });
      pushService.registerTokenWithServer().catch((error) => {
        log.notificationHandler('Failed to re-register FCM token', LogLevel.ERROR, error);
      });
    } else {
      // First time — initialize to get FCM token and register
      pushService.initialize().catch((error) => {
        log.notificationHandler('Failed to initialize push notifications', LogLevel.ERROR, error);
      });
    }
  }, [settings?.enabled, settings?.notificationMode, currentProfile]);

  // Handle profile switching
  useEffect(() => {
    if (currentProfile?.id !== lastProfileId.current) {
      lastProfileId.current = currentProfile?.id || null;
      hasAttemptedAutoConnect.current = false;

      // Disconnect from previous profile if connected to a different one
      if (isConnected && currentProfileId !== currentProfile?.id) {
        log.notifications('Profile changed - disconnecting from previous profile', LogLevel.INFO, { previousProfile: currentProfileId,
          newProfile: currentProfile?.id, });
        disconnect();
      }
    }
  }, [currentProfile?.id, isConnected, currentProfileId, disconnect]);

  // Process delivered notifications on cold start / profile load.
  // Uses currentProfile (persisted, available immediately) instead of
  // currentProfileId (runtime-only, null on cold start).
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !currentProfile) return;

    const profileId = currentProfile.id;

    const processDelivered = async () => {
      try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        const { notifications } = await FirebaseMessaging.getDeliveredNotifications();

        if (notifications.length > 0) {
          const store = useNotificationStore.getState();
          const { profiles } = useProfileStore.getState();

          for (const notif of notifications) {
            const data = notif.data as Record<string, string> | undefined;
            const mid = data?.mid || data?.MonitorId;
            const eid = data?.eid || data?.EventId;

            // Resolve which profile this notification belongs to
            const resolved = resolveProfileForNotification(data?.profile, profileId);
            const eventProfileId: string = resolved.targetProfileId || profileId;
            const profile = profiles.find(p => p.id === eventProfileId);

            // Only construct image URL for current profile's notifications
            let imageUrl: string | undefined;
            if (eid && eventProfileId === profileId && profile) {
              imageUrl = `${profile.portalUrl}/index.php?view=image&eid=${eid}&fid=snapshot&width=600`;
            }

            const monitorName = data?.monitorName || data?.MonitorName || notif.title?.replace(/\s*Alarm.*$/, '') || 'Unknown';
            const cause = data?.cause || data?.Cause || notif.body || 'Motion detected';

            store.addEvent(eventProfileId, {
              MonitorId: mid ? parseInt(String(mid), 10) : 0,
              MonitorName: monitorName,
              EventId: eid ? parseInt(String(eid), 10) : Date.now(),
              Cause: cause,
              Name: monitorName,
              ImageUrl: imageUrl,
            }, 'push');
          }
          log.notificationHandler('Added delivered notifications to history', LogLevel.INFO, { count: notifications.length });
        }

        await FirebaseMessaging.removeAllDeliveredNotifications();
      } catch (err) {
        log.notificationHandler('Failed to process delivered notifications', LogLevel.ERROR, err);
      }
    };

    processDelivered();
  }, [currentProfile]);

  // Clear native badge and sync badge count when app comes to foreground (iOS/Android)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerCleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

        const listener = await CapApp.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            const store = useNotificationStore.getState();
            const profileId = store.currentProfileId;

            // Only process and clear delivered notifications if we have an active profile.
            // On cold start, currentProfileId may still be null — the processDelivered
            // effect (which depends on currentProfileId) will handle those instead.
            if (!profileId) return;

            // Read delivered notifications that arrived while backgrounded
            try {
              const { notifications } = await FirebaseMessaging.getDeliveredNotifications();
              if (notifications.length > 0) {
                const { profiles } = useProfileStore.getState();

                for (const notif of notifications) {
                  const data = notif.data as Record<string, string> | undefined;
                  const mid = data?.mid || data?.MonitorId;
                  const eid = data?.eid || data?.EventId;

                  // Resolve which profile this notification belongs to
                  const resolved = resolveProfileForNotification(data?.profile, profileId);
                  const eventProfileId: string = resolved.targetProfileId || profileId;
                  const profile = profiles.find(p => p.id === eventProfileId);

                  // Only construct image URL for current profile's notifications
                  let imageUrl: string | undefined;
                  if (eid && eventProfileId === profileId && profile) {
                    imageUrl = `${profile.portalUrl}/index.php?view=image&eid=${eid}&fid=snapshot&width=600`;
                  }

                  const monitorName = data?.monitorName || data?.MonitorName || notif.title?.replace(/\s*Alarm.*$/, '') || 'Unknown';
                  const cause = data?.cause || data?.Cause || notif.body || 'Motion detected';

                  store.addEvent(eventProfileId, {
                    MonitorId: mid ? parseInt(String(mid), 10) : 0,
                    MonitorName: monitorName,
                    EventId: eid ? parseInt(String(eid), 10) : Date.now(),
                    Cause: cause,
                    Name: monitorName,
                    ImageUrl: imageUrl,
                  }, 'push');
                }
                log.notificationHandler('Added delivered notifications to history on resume', LogLevel.INFO, { count: notifications.length });
              }
            } catch (err) {
              log.notificationHandler('Failed to read delivered notifications on resume', LogLevel.ERROR, err);
            }

            await FirebaseMessaging.removeAllDeliveredNotifications();
            log.notificationHandler('Cleared delivered notifications on app resume', LogLevel.DEBUG);

            // Sync badge count with server
            store._updateBadge();
          }
        });

        listenerCleanup = () => { listener.remove(); };
      } catch (e) {
        log.notificationHandler('Failed to setup badge clearing on resume', LogLevel.ERROR, e);
      }
    };

    setup();
    return () => { listenerCleanup?.(); };
  }, []);

  // Network change listener: reconnect when connectivity is restored
  useEffect(() => {
    const mode = settings?.notificationMode || 'es';
    if (!settings?.enabled || mode !== 'es') return;

    const handleOnline = () => {
      log.notificationHandler('Network restored, triggering reconnect', LogLevel.INFO);
      reconnect();
    };

    window.addEventListener('online', handleOnline);

    // On native platforms, also use Capacitor's Network plugin for faster detection
    let networkCleanup: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      import('@capacitor/network').then(({ Network }) => {
        Network.addListener('networkStatusChange', (status) => {
          if (status.connected) {
            log.notificationHandler('Native network restored, triggering reconnect', LogLevel.INFO);
            reconnect();
          }
        }).then((handle) => {
          networkCleanup = () => handle.remove();
        });
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      networkCleanup?.();
    };
  }, [settings?.enabled, settings?.notificationMode, reconnect]);

  // Visibility change listener (desktop/web): check liveness when tab becomes visible
  useEffect(() => {
    const mode = settings?.notificationMode || 'es';
    if (!settings?.enabled || mode !== 'es' || Capacitor.isNativePlatform()) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!isConnected) return;

      log.notificationHandler('Tab visible, checking WebSocket liveness', LogLevel.DEBUG);
      const service = getNotificationService();
      const alive = await service.checkAlive(5000);

      if (!alive) {
        log.notificationHandler('WebSocket not responding after tab resume, reconnecting', LogLevel.WARN);
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [settings?.enabled, settings?.notificationMode, isConnected, reconnect]);

  // App resume liveness check (mobile): verify WebSocket is alive when app returns to foreground
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const mode = settings?.notificationMode || 'es';
    if (!settings?.enabled || mode !== 'es') return;

    let listenerCleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');

        const listener = await CapApp.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive || !isConnected) return;

          log.notificationHandler('App resumed, checking WebSocket liveness', LogLevel.DEBUG);
          const service = getNotificationService();
          const alive = await service.checkAlive(5000);

          if (!alive) {
            log.notificationHandler('WebSocket not responding after app resume, reconnecting', LogLevel.WARN);
            reconnect();
          }
        });

        listenerCleanup = () => { listener.remove(); };
      } catch (e) {
        log.notificationHandler('Failed to setup app resume liveness check', LogLevel.ERROR, e);
      }
    };

    setup();
    return () => { listenerCleanup?.(); };
  }, [settings?.enabled, settings?.notificationMode, isConnected, reconnect]);

  // Listen to navigation events from services (e.g., push notifications)
  useEffect(() => {
    const unsubscribe = navigationService.addListener((event) => {
      log.notificationHandler('Navigating from service event', LogLevel.INFO, { path: event.path,
        replace: event.replace, });

      if (event.replace) {
        navigate(event.path, { replace: true, state: event.state });
      } else {
        navigate(event.path, { state: event.state });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [navigate]);

  // Auto-connect when profile loads (if enabled)
  // In ES mode: connects websocket. In Direct mode on desktop: starts event poller.
  useEffect(() => {
    if (
      !settings?.enabled ||
      !currentProfile ||
      !currentProfile.username ||
      !currentProfile.password ||
      hasAttemptedAutoConnect.current
    ) {
      return;
    }

    const mode = settings.notificationMode || 'es';

    if (mode === 'direct') {
      if (Platform.isDesktopOrWeb) {
        // Desktop (Tauri) or web browser: start event poller
        hasAttemptedAutoConnect.current = true;
        log.notifications('Starting event poller for direct mode', LogLevel.INFO, {
          profileId: currentProfile.id,
        });
        const poller = getEventPoller();
        poller.start(currentProfile.id);
      }
      // Native mobile (iOS/Android): push notifications handle everything via FCM
      return;
    }

    // ES mode: auto-connect websocket (existing behavior)
    if (
      !settings.host ||
      isConnected ||
      connectionState !== 'disconnected'
    ) {
      return;
    }

    hasAttemptedAutoConnect.current = true;

    log.notifications('Auto-connecting to notification server', LogLevel.INFO, { profileId: currentProfile.id, });

    const attemptConnect = async () => {
      try {
        const password = await getDecryptedPassword(currentProfile.id);

        // Check state again right before connecting to avoid race conditions
        // This is crucial because getDecryptedPassword is async and state might have changed
        const currentState = useNotificationStore.getState().connectionState;
        if (currentState !== 'disconnected') {
           log.notifications('Skipping auto-connect - already connected or connecting', LogLevel.INFO, { state: currentState,
             profileId: currentProfile.id, });
           return;
        }

        if (password) {
          await connect(currentProfile.id, currentProfile.username!, password, currentProfile.portalUrl);
          log.notifications('Auto-connected to notification server', LogLevel.INFO, { profileId: currentProfile.id, });
        } else {
          log.notifications('Auto-connect failed - could not decrypt password', LogLevel.ERROR, {
            profileId: currentProfile.id,
          });
        }
      } catch (error) {
        // The service handles reconnection internally via exponential backoff
        log.notifications('Auto-connect failed, service will retry automatically', LogLevel.ERROR, {
          profileId: currentProfile.id,
          error,
        });
      }
    };

    // Small delay to ensure store initialization is complete
    setTimeout(() => attemptConnect(), 500);
  }, [settings?.enabled, settings?.notificationMode, settings?.host, isConnected, connectionState, currentProfile, connect, getDecryptedPassword]);

  // Stop event poller on cleanup or when mode/profile changes
  useEffect(() => {
    return () => {
      const poller = getEventPoller();
      if (poller.isRunning()) {
        poller.stop();
      }
    };
  }, [currentProfile?.id, settings?.notificationMode, settings?.enabled]);

  // Listen for new events and show toasts
  useEffect(() => {
    if (!settings?.showToasts || events.length === 0) {
      return;
    }

    const latestEvent = events[0];

    // Only show toast if this is a new event we haven't seen
    if (latestEvent.EventId !== lastEventId.current) {
      lastEventId.current = latestEvent.EventId;

      // Show toast notification
      toast(
        <div className="flex items-start gap-3">
          {latestEvent.ImageUrl ? (
            <div className="flex-shrink-0">
              <img
                src={latestEvent.ImageUrl ? `${latestEvent.ImageUrl}&token=${useAuthStore.getState().accessToken}` : ''}
                alt={latestEvent.MonitorName}
                className="h-16 w-16 rounded object-cover border"
                onError={(e) => {
                  // Fallback to icon if image fails to load
                  e.currentTarget.style.display = 'none';
                  const icon = e.currentTarget.nextElementSibling as HTMLElement;
                  if (icon) icon.style.display = 'block';
                }}
              />
              <div style={{ display: 'none' }} className="mt-0.5">
                <Bell className="h-5 w-5 text-primary" />
              </div>
            </div>
          ) : (
            <div className="flex-shrink-0 mt-0.5">
              <Bell className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{latestEvent.MonitorName}</div>
            {currentProfile && (
              <div className="text-xs text-muted-foreground/70">{currentProfile.name}</div>
            )}
            {(() => {
              const CauseIcon = getEventCauseIcon(latestEvent.Cause);
              return (
                <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                  <CauseIcon className="h-3 w-3" />
                  {latestEvent.Cause}
                </div>
              );
            })()}
            <div className="text-xs text-muted-foreground mt-1">
              {t('events.event_id')}: {latestEvent.EventId}
            </div>
          </div>
        </div>,
        {
          duration: 5000,
          action: latestEvent.EventId
            ? {
                label: t('common.view'),
                onClick: () => {
                  // Navigate to event detail
                  navigate(`/events/${latestEvent.EventId}`);
                },
              }
            : undefined,
        }
      );

      // Play sound if enabled
      if (settings?.playSound) {
        playNotificationSound();
      }

      log.notifications('Showed notification toast', LogLevel.INFO, { profileId: currentProfile?.id,
        monitor: latestEvent.MonitorName,
        eventId: latestEvent.EventId, });
    }
  }, [events, settings?.showToasts, settings?.playSound, currentProfile?.id, t, navigate]);

  // Render profile switch confirmation dialog when a cross-profile notification is tapped
  return (
    <ProfileSwitchDialog
      pending={pendingSwitch}
      onConfirm={handleConfirmSwitch}
      onCancel={handleCancelSwitch}
    />
  );
}

/**
 * Profile switch confirmation dialog.
 * Shown when the user taps a notification from a different profile.
 */
function ProfileSwitchDialog({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingProfileSwitch | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      data-testid="profile-switch-dialog"
    >
      <div className="w-full max-w-sm mx-4 rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">
          {t('notifications.switch_profile_title')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('notifications.switch_profile_desc', { profile: pending.targetProfileName })}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            onClick={onCancel}
            data-testid="profile-switch-cancel"
          >
            {t('common.cancel')}
          </button>
          <button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            onClick={onConfirm}
            data-testid="profile-switch-confirm"
          >
            {t('notifications.switch_profile_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Plays a notification sound using the Web Audio API.
 * Generates a simple beep tone.
 */
function playNotificationSound() {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // 800 Hz tone
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    log.notifications('Failed to play notification sound', LogLevel.ERROR, error);
  }
}
