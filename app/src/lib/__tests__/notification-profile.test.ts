import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock the profile store before importing the module under test
const mockProfiles = [
  { id: 'profile-1', name: 'Home Server', portalUrl: 'http://home:8080' },
  { id: 'profile-2', name: 'Office Server', portalUrl: 'http://office:8080' },
];

vi.mock('../../stores/profile', () => ({
  useProfileStore: {
    getState: () => ({
      profiles: mockProfiles,
    }),
  },
}));

vi.mock('../logger', () => ({
  log: {
    push: vi.fn(),
  },
  LogLevel: { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' },
}));

import {
  findProfileByName,
  resolveProfileForNotification,
  requestProfileSwitch,
  onProfileSwitchRequest,
  clearPendingProfileSwitch,
} from '../notification-profile';

describe('notification-profile', () => {
  describe('findProfileByName', () => {
    it('finds a profile by exact name', () => {
      const result = findProfileByName('Home Server');
      expect(result).toBeDefined();
      expect(result!.id).toBe('profile-1');
    });

    it('finds a profile case-insensitively', () => {
      const result = findProfileByName('home server');
      expect(result).toBeDefined();
      expect(result!.id).toBe('profile-1');
    });

    it('returns undefined for unknown profile', () => {
      const result = findProfileByName('Unknown Profile');
      expect(result).toBeUndefined();
    });
  });

  describe('resolveProfileForNotification', () => {
    it('returns current profile when data.profile is undefined', () => {
      const result = resolveProfileForNotification(undefined, 'profile-1');
      expect(result.targetProfileId).toBe('profile-1');
      expect(result.isCrossProfile).toBe(false);
    });

    it('returns current profile when currentProfileId is null', () => {
      const result = resolveProfileForNotification('Home Server', null);
      expect(result.targetProfileId).toBeNull();
      expect(result.isCrossProfile).toBe(false);
    });

    it('returns same profile when notification matches current', () => {
      const result = resolveProfileForNotification('Home Server', 'profile-1');
      expect(result.targetProfileId).toBe('profile-1');
      expect(result.isCrossProfile).toBe(false);
    });

    it('detects cross-profile notification', () => {
      const result = resolveProfileForNotification('Office Server', 'profile-1');
      expect(result.targetProfileId).toBe('profile-2');
      expect(result.isCrossProfile).toBe(true);
    });

    it('falls back to current profile when notification profile is not found', () => {
      const result = resolveProfileForNotification('Deleted Server', 'profile-1');
      expect(result.targetProfileId).toBe('profile-1');
      expect(result.isCrossProfile).toBe(false);
    });
  });

  describe('profile switch request lifecycle', () => {
    afterEach(() => {
      clearPendingProfileSwitch();
    });

    it('notifies listeners when a switch is requested', () => {
      const callback = vi.fn();
      const unsubscribe = onProfileSwitchRequest(callback);

      requestProfileSwitch({
        targetProfileId: 'profile-2',
        targetProfileName: 'Office Server',
        eventId: '12345',
      });

      expect(callback).toHaveBeenCalledWith({
        targetProfileId: 'profile-2',
        targetProfileName: 'Office Server',
        eventId: '12345',
      });

      unsubscribe();
    });

    it('fires pending request immediately on subscribe', () => {
      requestProfileSwitch({
        targetProfileId: 'profile-2',
        targetProfileName: 'Office Server',
        eventId: '99',
      });

      const callback = vi.fn();
      const unsubscribe = onProfileSwitchRequest(callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ targetProfileId: 'profile-2' })
      );

      unsubscribe();
    });

    it('clears pending switch', () => {
      requestProfileSwitch({
        targetProfileId: 'profile-2',
        targetProfileName: 'Office Server',
        eventId: '99',
      });

      clearPendingProfileSwitch();

      const callback = vi.fn();
      const unsubscribe = onProfileSwitchRequest(callback);

      // Should not be called since pending was cleared
      expect(callback).not.toHaveBeenCalled();

      unsubscribe();
    });

    it('unsubscribe stops future notifications', () => {
      const callback = vi.fn();
      const unsubscribe = onProfileSwitchRequest(callback);
      unsubscribe();

      requestProfileSwitch({
        targetProfileId: 'profile-2',
        targetProfileName: 'Office Server',
        eventId: '55',
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
