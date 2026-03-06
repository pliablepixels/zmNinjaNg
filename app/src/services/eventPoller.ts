/**
 * Event Poller Service
 *
 * Polls the ZM events API for new events in Direct notification mode on desktop (Tauri).
 * New events are fed into the notification store, which triggers the existing
 * sonner toast display via NotificationHandler.
 */

import { getEvents } from '../api/events';
import { getMonitors } from '../api/monitors';
import { useNotificationStore } from '../stores/notifications';
import { useProfileStore } from '../stores/profile';
import { useAuthStore } from '../stores/auth';
import { log, LogLevel } from '../lib/logger';

class EventPollerService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private profileId: string | null = null;
  private seenEventIds = new Set<number>();
  private isFirstPoll = true;
  private monitorNames = new Map<string, string>();

  /**
   * Start polling for new events.
   */
  start(profileId: string): void {
    if (this.intervalId) {
      this.stop();
    }

    this.profileId = profileId;
    this.seenEventIds.clear();
    this.isFirstPoll = true;

    log.notifications('Starting event poller for direct mode', LogLevel.INFO, { profileId });

    // Load monitor names for event enrichment
    this._loadMonitorNames();

    // Poll immediately, then on interval
    this._poll();
    this._scheduleNext();
  }

  /**
   * Stop polling.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.profileId = null;
    this.seenEventIds.clear();
    this.isFirstPoll = true;
    this.monitorNames.clear();

    log.notifications('Stopped event poller', LogLevel.INFO);
  }

  /**
   * Check if the poller is running.
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  private async _loadMonitorNames(): Promise<void> {
    try {
      const result = await getMonitors();
      this.monitorNames.clear();
      for (const m of result.monitors) {
        this.monitorNames.set(m.Monitor.Id, m.Monitor.Name);
      }
      log.notifications('Event poller loaded monitor names', LogLevel.DEBUG, {
        count: this.monitorNames.size,
      });
    } catch (error) {
      log.notifications('Event poller failed to load monitor names', LogLevel.WARN, error);
    }
  }

  private _getInterval(): number {
    const profileId = this.profileId;
    if (!profileId) return 30000;

    const notificationSettings = useNotificationStore.getState().getProfileSettings(profileId);
    return (notificationSettings.pollingInterval || 30) * 1000;
  }

  private _scheduleNext(): void {
    const interval = this._getInterval();
    this.intervalId = setInterval(() => this._poll(), interval);
  }

  private async _poll(): Promise<void> {
    if (!this.profileId) return;

    try {
      const notificationSettings = useNotificationStore.getState().getProfileSettings(this.profileId);
      const filters: Parameters<typeof getEvents>[0] = {
        limit: 5,
        sort: 'StartDateTime',
        direction: 'desc',
      };
      if (notificationSettings.onlyDetectedEvents) {
        filters.notesFilter = 'detected:';
      }

      const result = await getEvents(filters);

      const events = result.events || [];

      if (this.isFirstPoll) {
        // On first poll, seed the seen set without triggering notifications
        for (const event of events) {
          const eventId = parseInt(String(event.Event.Id), 10);
          this.seenEventIds.add(eventId);
        }
        this.isFirstPoll = false;
        log.notifications('Event poller seeded with existing events', LogLevel.DEBUG, {
          count: events.length,
        });
        return;
      }

      const notificationStore = useNotificationStore.getState();
      const { profiles, currentProfileId } = useProfileStore.getState();
      const currentProfile = profiles.find(p => p.id === currentProfileId);
      const authStore = useAuthStore.getState();

      for (const event of events) {
        const eventId = parseInt(String(event.Event.Id), 10);

        if (this.seenEventIds.has(eventId)) continue;

        this.seenEventIds.add(eventId);

        let imageUrl: string | undefined;
        if (currentProfile && authStore.accessToken) {
          imageUrl = `${currentProfile.portalUrl}/index.php?view=image&eid=${eventId}&fid=snapshot&width=600&token=${authStore.accessToken}`;
        }

        const monitorId = parseInt(String(event.Event.MonitorId), 10);
        const monitorName = this.monitorNames.get(String(event.Event.MonitorId)) || `Monitor ${monitorId}`;
        const cause = event.Event.Cause || 'Motion detected';

        log.notifications('Event poller found new event', LogLevel.INFO, {
          eventId,
          monitorName,
          cause,
        });

        notificationStore.addEvent(this.profileId, {
          MonitorId: monitorId,
          MonitorName: monitorName,
          EventId: eventId,
          Cause: cause,
          Name: monitorName,
          ImageUrl: imageUrl,
        }, 'poll');
      }

      // Prevent unbounded growth of seen set
      if (this.seenEventIds.size > 500) {
        const recentIds = events.map(e => parseInt(String(e.Event.Id), 10));
        this.seenEventIds = new Set(recentIds);
      }
    } catch (error) {
      log.notifications('Event poller failed', LogLevel.ERROR, error);
    }
  }
}

// Singleton
let eventPoller: EventPollerService | null = null;

export function getEventPoller(): EventPollerService {
  if (!eventPoller) {
    eventPoller = new EventPollerService();
  }
  return eventPoller;
}

export function resetEventPoller(): void {
  if (eventPoller) {
    eventPoller.stop();
    eventPoller = null;
  }
}
