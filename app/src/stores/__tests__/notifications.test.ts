import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationStore } from '../notifications';
import type { ZMAlarmEvent } from '../../types/notifications';

const mockService = {
  connect: vi.fn().mockResolvedValue(undefined),
  onStateChange: vi.fn(() => vi.fn()),
  onEvent: vi.fn(() => vi.fn()),
  setMonitorFilter: vi.fn().mockResolvedValue(undefined),
  updateBadgeCount: vi.fn().mockResolvedValue(undefined),
  registerPushToken: vi.fn().mockResolvedValue(undefined),
  deregisterPushToken: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../services/notifications', () => ({
  getNotificationService: vi.fn(() => mockService),
  resetNotificationService: vi.fn(),
}));

vi.mock('../auth', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({ accessToken: 'access-token' })),
  },
}));

vi.mock('../../lib/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notifications: vi.fn(),
  },
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4,
  },
}));

vi.mock('../../lib/version', () => ({
  getAppVersion: vi.fn(() => '1.0.0'),
}));

describe('Notification Store', () => {
  const profileId = 'profile-1';
  const baseEvent: ZMAlarmEvent = {
    MonitorId: 1,
    MonitorName: 'Front Door',
    EventId: 101,
    Cause: 'Motion',
    Name: 'Front Door',
    ImageUrl: 'https://example.com/1.jpg',
  };

  beforeEach(() => {
    localStorage.clear();
    useNotificationStore.setState({
      profileSettings: {},
      connectionState: 'disconnected',
      isConnected: false,
      currentProfileId: null,
      profileEvents: {},
      _cleanupFunctions: [],
    });
    vi.clearAllMocks();
  });

  it('returns default settings for a profile', () => {
    const settings = useNotificationStore.getState().getProfileSettings(profileId);
    expect(settings.enabled).toBe(false);
    expect(settings.port).toBe(9000);
    expect(settings.monitorFilters).toEqual([]);
  });

  it('updates profile settings and disconnects when disabling active profile', () => {
    useNotificationStore.setState({
      isConnected: true,
      currentProfileId: profileId,
    });

    const disconnectSpy = vi.spyOn(useNotificationStore.getState(), 'disconnect');

    useNotificationStore.getState().updateProfileSettings(profileId, {
      enabled: false,
      host: 'example.com',
    });

    const settings = useNotificationStore.getState().getProfileSettings(profileId);
    expect(settings.host).toBe('example.com');
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('adds and updates monitor filters', () => {
    const store = useNotificationStore.getState();

    store.setMonitorFilter(profileId, 1, true, 60);
    store.setMonitorFilter(profileId, 1, false, 120);

    const settings = store.getProfileSettings(profileId);
    expect(settings.monitorFilters).toHaveLength(1);
    expect(settings.monitorFilters[0]).toEqual({
      monitorId: 1,
      enabled: false,
      checkInterval: 120,
    });
  });

  it('removes monitor filters', () => {
    const store = useNotificationStore.getState();

    store.setMonitorFilter(profileId, 1, true, 60);
    store.setMonitorFilter(profileId, 2, true, 60);
    store.removeMonitorFilter(profileId, 1);

    const settings = store.getProfileSettings(profileId);
    expect(settings.monitorFilters).toHaveLength(1);
    expect(settings.monitorFilters[0].monitorId).toBe(2);
  });

  it('adds events and updates badge count', () => {
    const store = useNotificationStore.getState();

    store.addEvent(profileId, baseEvent);
    store.addEvent(profileId, { ...baseEvent, EventId: 102 });

    const events = store.getEvents(profileId);
    expect(events).toHaveLength(2);
    expect(store.getUnreadCount(profileId)).toBe(2);
    expect(store.getProfileSettings(profileId).badgeCount).toBe(2);
  });

  it('defaults source to websocket', () => {
    const store = useNotificationStore.getState();
    store.addEvent(profileId, baseEvent);
    const events = store.getEvents(profileId);
    expect(events[0].source).toBe('websocket');
  });

  it('stores push source when specified', () => {
    const store = useNotificationStore.getState();
    store.addEvent(profileId, baseEvent, 'push');
    const events = store.getEvents(profileId);
    expect(events[0].source).toBe('push');
  });

  it('replaces duplicate events by EventId', () => {
    const store = useNotificationStore.getState();

    store.addEvent(profileId, baseEvent);
    store.addEvent(profileId, { ...baseEvent, MonitorName: 'Back Door' });

    const events = store.getEvents(profileId);
    expect(events).toHaveLength(1);
    expect(events[0].MonitorName).toBe('Back Door');
  });

  it('updates source when duplicate event replaces existing', () => {
    const store = useNotificationStore.getState();

    store.addEvent(profileId, baseEvent, 'websocket');
    store.addEvent(profileId, baseEvent, 'push');

    const events = store.getEvents(profileId);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('push');
  });

  it('marks events read and clears all', () => {
    const store = useNotificationStore.getState();

    store.addEvent(profileId, baseEvent);
    store.addEvent(profileId, { ...baseEvent, EventId: 102 });

    store.markEventRead(profileId, 101);
    expect(store.getUnreadCount(profileId)).toBe(1);

    store.markAllRead(profileId);
    expect(store.getUnreadCount(profileId)).toBe(0);

    store.clearEvents(profileId);
    expect(store.getEvents(profileId)).toHaveLength(0);
  });

  it('limits stored events to 100', () => {
    const store = useNotificationStore.getState();

    for (let i = 1; i <= 150; i += 1) {
      store.addEvent(profileId, { ...baseEvent, EventId: i });
    }

    const events = store.getEvents(profileId);
    expect(events).toHaveLength(100);
    expect(events[0].EventId).toBe(150);
  });
});
