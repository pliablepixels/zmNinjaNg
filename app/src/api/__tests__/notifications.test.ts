import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registerToken,
  updateNotification,
  deleteNotification,
  checkNotificationsApiSupport,
} from '../notifications';
import { getApiClient } from '../client';
import type { ApiClient } from '../client';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../client', () => ({
  getApiClient: vi.fn(),
}));

vi.mock('../../lib/logger', () => ({
  log: { api: vi.fn() },
  LogLevel: { INFO: 'info', ERROR: 'error', DEBUG: 'debug' },
}));

const sampleNotification = {
  Id: 42,
  UserId: 1,
  Token: 'fcm-token-abc',
  Platform: 'ios' as const,
  MonitorList: '1,2,3',
  Interval: 30,
  PushState: 'enabled' as const,
  AppVersion: '0.2.6',
  BadgeCount: 0,
  LastNotifiedAt: null,
  CreatedOn: '2026-01-01 00:00:00',
  UpdatedOn: '2026-01-01 00:00:00',
};

describe('Notifications API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiClient).mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
    } as unknown as ApiClient);
  });

  describe('registerToken', () => {
    it('sends form-encoded data and returns the notification', async () => {
      mockPost.mockResolvedValue({
        data: { notification: { Notification: sampleNotification } },
      });

      const result = await registerToken({
        token: 'fcm-token-abc',
        platform: 'ios',
        monitorList: '1,2,3',
        interval: 30,
        pushState: 'enabled',
        appVersion: '0.2.6',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/notifications.json',
        expect.any(String),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const body = mockPost.mock.calls[0][1] as string;
      const params = new URLSearchParams(body);
      expect(params.get('Notification[Token]')).toBe('fcm-token-abc');
      expect(params.get('Notification[Platform]')).toBe('ios');
      expect(params.get('Notification[MonitorList]')).toBe('1,2,3');
      expect(params.get('Notification[Interval]')).toBe('30');
      expect(params.get('Notification[PushState]')).toBe('enabled');
      expect(params.get('Notification[AppVersion]')).toBe('0.2.6');

      expect(result).toEqual(sampleNotification);
    });

    it('omits optional fields when not provided', async () => {
      mockPost.mockResolvedValue({
        data: { notification: { Notification: sampleNotification } },
      });

      await registerToken({ token: 'tok', platform: 'android' });

      const body = mockPost.mock.calls[0][1] as string;
      const params = new URLSearchParams(body);
      expect(params.get('Notification[Token]')).toBe('tok');
      expect(params.get('Notification[Platform]')).toBe('android');
      expect(params.has('Notification[MonitorList]')).toBe(false);
      expect(params.has('Notification[Interval]')).toBe(false);
      expect(params.has('Notification[PushState]')).toBe(false);
      expect(params.has('Notification[AppVersion]')).toBe(false);
    });
  });

  describe('updateNotification', () => {
    it('sends PUT with form-encoded data to the correct endpoint', async () => {
      mockPut.mockResolvedValue({
        data: { notification: { Notification: sampleNotification } },
      });

      const result = await updateNotification(42, {
        monitorList: '4,5',
        interval: 60,
        pushState: 'disabled',
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/notifications/42.json',
        expect.any(String),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const body = mockPut.mock.calls[0][1] as string;
      const params = new URLSearchParams(body);
      expect(params.get('Notification[MonitorList]')).toBe('4,5');
      expect(params.get('Notification[Interval]')).toBe('60');
      expect(params.get('Notification[PushState]')).toBe('disabled');

      expect(result).toEqual(sampleNotification);
    });

    it('only includes fields that are provided', async () => {
      mockPut.mockResolvedValue({
        data: { notification: { Notification: sampleNotification } },
      });

      await updateNotification(42, { pushState: 'enabled' });

      const body = mockPut.mock.calls[0][1] as string;
      const params = new URLSearchParams(body);
      expect(params.has('Notification[MonitorList]')).toBe(false);
      expect(params.has('Notification[Interval]')).toBe(false);
      expect(params.get('Notification[PushState]')).toBe('enabled');
    });
  });

  describe('deleteNotification', () => {
    it('calls DELETE on the correct endpoint', async () => {
      mockDelete.mockResolvedValue({});

      await deleteNotification(42);

      expect(mockDelete).toHaveBeenCalledWith('/notifications/42.json');
    });
  });

  describe('checkNotificationsApiSupport', () => {
    it('returns true when the endpoint responds successfully', async () => {
      mockGet.mockResolvedValue({ data: { notifications: [] } });

      const supported = await checkNotificationsApiSupport();

      expect(mockGet).toHaveBeenCalledWith('/notifications.json');
      expect(supported).toBe(true);
    });

    it('returns false on a 404 response (error.response.status)', async () => {
      mockGet.mockRejectedValue({ response: { status: 404 } });

      const supported = await checkNotificationsApiSupport();
      expect(supported).toBe(false);
    });

    it('returns false on a 404 response (error.status)', async () => {
      mockGet.mockRejectedValue({ status: 404 });

      const supported = await checkNotificationsApiSupport();
      expect(supported).toBe(false);
    });

    it('re-throws non-404 errors', async () => {
      const serverError = { response: { status: 500 }, message: 'Internal Server Error' };
      mockGet.mockRejectedValue(serverError);

      await expect(checkNotificationsApiSupport()).rejects.toEqual(serverError);
    });
  });
});
