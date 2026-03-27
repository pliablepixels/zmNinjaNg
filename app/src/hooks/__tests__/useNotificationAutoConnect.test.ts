/**
 * useNotificationAutoConnect Hook Tests
 *
 * Tests auto-connect trigger conditions, profile-switch disconnect,
 * mode-based branching, and network/visibility reconnect behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotificationAutoConnect } from '../useNotificationAutoConnect';

// Mock logger
vi.mock('../../lib/logger', () => ({
  log: {
    notifications: vi.fn(),
    notificationHandler: vi.fn(),
  },
  LogLevel: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
  },
}));

// Mock Platform
vi.mock('../../lib/platform', () => ({
  Platform: {
    isDesktopOrWeb: true,
  },
}));

// Mock notification store (getState usage inside hook)
const mockNotificationStoreState = { connectionState: 'disconnected' };

vi.mock('../../stores/notifications', () => ({
  useNotificationStore: {
    getState: vi.fn(() => mockNotificationStoreState),
  },
}));

// Mock event poller
const mockPollerStart = vi.fn().mockResolvedValue(undefined);
const mockPollerStop = vi.fn();
const mockPollerIsRunning = vi.fn().mockReturnValue(false);

vi.mock('../../services/eventPoller', () => ({
  getEventPoller: vi.fn(() => ({
    start: mockPollerStart,
    stop: mockPollerStop,
    isRunning: mockPollerIsRunning,
  })),
}));

// Mock notification service
const mockCheckAlive = vi.fn().mockResolvedValue(true);

vi.mock('../../services/notifications', () => ({
  getNotificationService: vi.fn(() => ({
    checkAlive: mockCheckAlive,
  })),
}));

// --- Helpers ---

type Settings = {
  enabled?: boolean;
  notificationMode?: string;
  host?: string;
};

const defaultProfile = {
  id: 'profile-1' as string,
  username: 'admin' as string | undefined,
  password: 'secret' as string | undefined,
  portalUrl: 'http://zm.local',
  name: 'Test Profile',
  apiUrl: 'http://zm.local/api',
  cgiUrl: 'http://zm.local/cgi-bin',
  isDefault: true,
  createdAt: Date.now(),
};

const defaultSettings: Settings = {
  enabled: true,
  notificationMode: 'es',
  host: 'ws://zmeventserver:9000',
};

function makeParams(overrides: Partial<{
  currentProfile: typeof defaultProfile | null;
  settings: Settings | null;
  isConnected: boolean;
  connectionState: string;
  currentProfileId: string | null;
}> & Record<string, unknown> = {}) {
  const connect = vi.fn().mockResolvedValue(undefined);
  const disconnect = vi.fn();
  const reconnect = vi.fn();
  const getDecryptedPassword = vi.fn().mockResolvedValue('secret');

  return {
    currentProfile: defaultProfile,
    settings: defaultSettings,
    isConnected: false,
    connectionState: 'disconnected',
    currentProfileId: 'profile-1',
    connect,
    disconnect,
    reconnect,
    getDecryptedPassword,
    ...overrides,
  };
}

describe('useNotificationAutoConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockNotificationStoreState.connectionState = 'disconnected';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('disabled notifications', () => {
    it('does not attempt connect when settings.enabled is false', async () => {
      const params = makeParams({ settings: { ...defaultSettings, enabled: false } });
      renderHook(() => useNotificationAutoConnect(params));

      vi.runAllTimers();
      await vi.runAllTimersAsync();

      expect(params.connect).not.toHaveBeenCalled();
    });

    it('does not start event poller when settings.enabled is false', () => {
      const params = makeParams({
        settings: { ...defaultSettings, enabled: false, notificationMode: 'direct' },
      });
      renderHook(() => useNotificationAutoConnect(params));

      expect(mockPollerStart).not.toHaveBeenCalled();
    });

    it('does not attempt connect when settings is null', () => {
      const params = makeParams({ settings: null });
      renderHook(() => useNotificationAutoConnect(params));

      vi.runAllTimers();

      expect(params.connect).not.toHaveBeenCalled();
    });
  });

  describe('ES mode auto-connect', () => {
    it('calls connect with profile credentials after delay', async () => {
      const params = makeParams();
      renderHook(() => useNotificationAutoConnect(params));

      // Advance the 500ms delay and flush microtasks
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Allow async getDecryptedPassword + connect to resolve
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(params.connect).toHaveBeenCalledWith(
        'profile-1',
        'admin',
        'secret',
        'http://zm.local',
      );
    });

    it('does not connect when already connected', async () => {
      const params = makeParams({ isConnected: true });
      renderHook(() => useNotificationAutoConnect(params));

      await act(async () => {
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();
      });

      expect(params.connect).not.toHaveBeenCalled();
    });

    it('does not connect when connectionState is not "disconnected"', async () => {
      const params = makeParams({ connectionState: 'connecting' });
      renderHook(() => useNotificationAutoConnect(params));

      await act(async () => {
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();
      });

      expect(params.connect).not.toHaveBeenCalled();
    });

    it('does not connect when host is missing', async () => {
      const params = makeParams({ settings: { ...defaultSettings, host: undefined } });
      renderHook(() => useNotificationAutoConnect(params));

      await act(async () => {
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();
      });

      expect(params.connect).not.toHaveBeenCalled();
    });

    it('does not connect when profile has no username', async () => {
      const params = makeParams({
        currentProfile: { ...defaultProfile, username: undefined },
      });
      renderHook(() => useNotificationAutoConnect(params));

      await act(async () => {
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();
      });

      expect(params.connect).not.toHaveBeenCalled();
    });

    it('does not connect when currentProfile is null', async () => {
      const params = makeParams({ currentProfile: null });
      renderHook(() => useNotificationAutoConnect(params));

      await act(async () => {
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();
      });

      expect(params.connect).not.toHaveBeenCalled();
    });

    it('skips connect when store state changes to non-disconnected before async completes', async () => {
      const params = makeParams();
      // Simulate store having changed state by the time decrypt resolves
      params.getDecryptedPassword = vi.fn().mockImplementation(async () => {
        mockNotificationStoreState.connectionState = 'connecting';
        return 'secret';
      });

      renderHook(() => useNotificationAutoConnect(params));

      await act(async () => {
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();
      });

      expect(params.connect).not.toHaveBeenCalled();
    });

    it('does not connect when password cannot be decrypted', async () => {
      const params = makeParams();
      params.getDecryptedPassword = vi.fn().mockResolvedValue(null);

      renderHook(() => useNotificationAutoConnect(params));

      await act(async () => {
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();
      });

      expect(params.connect).not.toHaveBeenCalled();
    });

    it('only attempts auto-connect once per mount', async () => {
      const params = makeParams();
      const { rerender } = renderHook(() => useNotificationAutoConnect(params));

      await act(async () => {
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();
      });

      expect(params.connect).toHaveBeenCalledTimes(1);

      rerender();

      await act(async () => {
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();
      });

      // Still only once — hasAttemptedAutoConnect flag prevents repeated calls
      expect(params.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('direct mode auto-connect (desktop/web)', () => {
    it('starts event poller for direct mode on desktop', () => {
      const params = makeParams({
        settings: { ...defaultSettings, notificationMode: 'direct' },
      });
      renderHook(() => useNotificationAutoConnect(params));

      expect(mockPollerStart).toHaveBeenCalledWith('profile-1');
    });

    it('does not call connect() in direct mode', async () => {
      const params = makeParams({
        settings: { ...defaultSettings, notificationMode: 'direct' },
      });
      renderHook(() => useNotificationAutoConnect(params));

      await act(async () => {
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();
      });

      expect(params.connect).not.toHaveBeenCalled();
    });
  });

  describe('profile switching', () => {
    it('disconnects when profile changes and was connected to different profile', () => {
      const params = makeParams({
        isConnected: true,
        currentProfileId: 'profile-OLD',
        currentProfile: { ...defaultProfile, id: 'profile-NEW' },
      });
      renderHook(() => useNotificationAutoConnect(params));

      expect(params.disconnect).toHaveBeenCalled();
    });

    it('does not disconnect when connected to the same profile', () => {
      const params = makeParams({
        isConnected: true,
        currentProfileId: 'profile-1',
        currentProfile: defaultProfile,
      });
      renderHook(() => useNotificationAutoConnect(params));

      expect(params.disconnect).not.toHaveBeenCalled();
    });

    it('resets auto-connect flag when notification mode changes', async () => {
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useNotificationAutoConnect>[0]) =>
          useNotificationAutoConnect(props),
        {
          initialProps: makeParams(),
        },
      );

      await act(async () => {
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();
      });

      expect(result.current).toBeUndefined(); // hook returns void

      // Change notification mode — this resets hasAttemptedAutoConnect
      const newParams = makeParams({
        settings: { ...defaultSettings, notificationMode: 'direct' },
      });

      rerender(newParams);

      // Poller should now be started (new mode = direct)
      expect(mockPollerStart).toHaveBeenCalled();
    });
  });

  describe('event poller cleanup', () => {
    it('stops event poller on unmount when running', () => {
      mockPollerIsRunning.mockReturnValue(true);
      const params = makeParams({
        settings: { ...defaultSettings, notificationMode: 'direct' },
      });

      const { unmount } = renderHook(() => useNotificationAutoConnect(params));

      unmount();

      expect(mockPollerStop).toHaveBeenCalled();
    });

    it('does not stop poller on unmount when not running', () => {
      mockPollerIsRunning.mockReturnValue(false);
      const params = makeParams();

      const { unmount } = renderHook(() => useNotificationAutoConnect(params));

      unmount();

      expect(mockPollerStop).not.toHaveBeenCalled();
    });
  });

  describe('network change reconnect', () => {
    it('calls reconnect when online event fires in ES mode', () => {
      const params = makeParams({ settings: { ...defaultSettings, enabled: true, notificationMode: 'es' } });
      renderHook(() => useNotificationAutoConnect(params));

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      expect(params.reconnect).toHaveBeenCalled();
    });

    it('does not add online listener for direct mode', () => {
      const params = makeParams({
        settings: { ...defaultSettings, notificationMode: 'direct' },
      });
      const addEventSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useNotificationAutoConnect(params));

      const onlineListeners = addEventSpy.mock.calls.filter(([event]) => event === 'online');
      expect(onlineListeners).toHaveLength(0);

      addEventSpy.mockRestore();
    });

    it('removes online listener on unmount', () => {
      const params = makeParams({ settings: { ...defaultSettings, enabled: true, notificationMode: 'es' } });
      const removeEventSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useNotificationAutoConnect(params));
      unmount();

      const removed = removeEventSpy.mock.calls.some(([event]) => event === 'online');
      expect(removed).toBe(true);

      removeEventSpy.mockRestore();
    });
  });

  describe('visibility change reconnect (web)', () => {
    it('calls reconnect when tab becomes visible and WebSocket is not alive', async () => {
      mockCheckAlive.mockResolvedValue(false);

      const params = makeParams({
        isConnected: true,
        settings: { ...defaultSettings, enabled: true, notificationMode: 'es' },
      });
      renderHook(() => useNotificationAutoConnect(params));

      await act(async () => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Allow checkAlive promise to resolve
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(params.reconnect).toHaveBeenCalled();
    });

    it('does not call reconnect when WebSocket is alive on tab focus', async () => {
      mockCheckAlive.mockResolvedValue(true);

      const params = makeParams({
        isConnected: true,
        settings: { ...defaultSettings, enabled: true, notificationMode: 'es' },
      });
      renderHook(() => useNotificationAutoConnect(params));

      await act(async () => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.runAllTimersAsync();
      });

      expect(params.reconnect).not.toHaveBeenCalled();
    });

    it('does not check liveness when not connected on tab focus', async () => {
      const params = makeParams({
        isConnected: false,
        settings: { ...defaultSettings, enabled: true, notificationMode: 'es' },
      });
      renderHook(() => useNotificationAutoConnect(params));

      await act(async () => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.runAllTimersAsync();
      });

      expect(mockCheckAlive).not.toHaveBeenCalled();
    });

    it('removes visibilitychange listener on unmount', () => {
      const params = makeParams({ settings: { ...defaultSettings, enabled: true, notificationMode: 'es' } });
      const removeEventSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useNotificationAutoConnect(params));
      unmount();

      const removed = removeEventSpy.mock.calls.some(([event]) => event === 'visibilitychange');
      expect(removed).toBe(true);

      removeEventSpy.mockRestore();
    });
  });
});
