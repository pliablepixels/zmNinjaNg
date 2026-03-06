/**
 * Event Poller Service
 *
 * Polls the ZM events API for new events in Direct notification mode on desktop (Tauri).
 * New events are fed into the notification store, which triggers the existing
 * sonner toast display via NotificationHandler.
 */

import { getEvents, getEventImageUrl } from '../api/events';
import type { EventFilters } from '../api/events';
import { getMonitors } from '../api/monitors';
import { useNotificationStore } from '../stores/notifications';
import { useProfileStore } from '../stores/profile';
import { useAuthStore } from '../stores/auth';
import { log, LogLevel } from '../lib/logger';

function parseEventId(id: string | number): number {
  return parseInt(String(id), 10);
}

class EventPollerService {
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private profileId: string | null = null;
  private seenEventIds = new Set<number>();
  private isFirstPoll = true;
  private monitorNames = new Map<string, string>();

  /**
   * Start polling for new events.
   * Loads monitor names first, then begins the poll cycle.
   */
  async start(profileId: string): Promise<void> {
    if (this.timerId) {
      this.stop();
    }

    this.profileId = profileId;
    this.seenEventIds.clear();
    this.isFirstPoll = true;

    log.notifications('Starting event poller for direct mode', LogLevel.INFO, { profileId });

    // Load monitor names before first poll so events have real names
    await this._loadMonitorNames();
    this._pollAndSchedule();
  }

  /**
   * Stop polling.
   */
  stop(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
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
    return this.timerId !== null;
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

  private _getIntervalMs(): number {
    if (!this.profileId) return 30000;
    const settings = useNotificationStore.getState().getProfileSettings(this.profileId);
    return (settings.pollingInterval || 30) * 1000;
  }

  private _pollAndSchedule(): void {
    if (!this.profileId) return;

    this._poll().finally(() => {
      // Schedule next poll only if still running (not stopped during _poll)
      if (this.profileId) {
        this.timerId = setTimeout(() => this._pollAndSchedule(), this._getIntervalMs());
      }
    });
  }

  private async _poll(): Promise<void> {
    if (!this.profileId) return;

    try {
      const settings = useNotificationStore.getState().getProfileSettings(this.profileId);
      const filters: EventFilters = {
        limit: 5,
        sort: 'StartDateTime',
        direction: 'desc',
      };
      if (settings.onlyDetectedEvents) {
        filters.notesRegexp = 'detected:';
      }

      const result = await getEvents(filters);
      const events = result.events || [];

      if (this.isFirstPoll) {
        // Seed the seen set without triggering notifications
        for (const event of events) {
          this.seenEventIds.add(parseEventId(event.Event.Id));
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
      const accessToken = useAuthStore.getState().accessToken;

      for (const event of events) {
        const eventId = parseEventId(event.Event.Id);
        if (this.seenEventIds.has(eventId)) continue;

        this.seenEventIds.add(eventId);

        const monitorId = parseEventId(event.Event.MonitorId);
        const monitorName = this.monitorNames.get(String(event.Event.MonitorId)) || `Monitor ${monitorId}`;
        const cause = event.Event.Cause || 'Motion';

        const imageUrl = currentProfile && accessToken
          ? getEventImageUrl(currentProfile.portalUrl, String(eventId), 'snapshot', { token: accessToken, width: 600 })
          : undefined;

        log.notifications('Event poller found new event', LogLevel.INFO, {
          eventId, monitorName, cause,
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
        this.seenEventIds = new Set(events.map(e => parseEventId(e.Event.Id)));
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
