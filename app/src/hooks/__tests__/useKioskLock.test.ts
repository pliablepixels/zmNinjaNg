/**
 * useKioskLock Hook Tests
 *
 * Tests kiosk lock/unlock flow, PIN set/confirm/change, and cancel behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKioskLock } from '../useKioskLock';

// Mock logger
vi.mock('../../lib/logger', () => ({
  log: {
    kiosk: vi.fn(),
  },
  LogLevel: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
  },
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock kioskPin
const mockHasPinStored = vi.fn();
const mockStorePin = vi.fn();

vi.mock('../../lib/kioskPin', () => ({
  hasPinStored: () => mockHasPinStored(),
  storePin: (pin: string) => mockStorePin(pin),
}));

// Mock kiosk store
const mockKioskLock = vi.fn();
let mockIsLocked = false;

vi.mock('../../stores/kioskStore', () => ({
  useKioskStore: vi.fn(),
}));

// Mock settings store
const mockGetProfileSettings = vi.fn();
const mockUpdateProfileSettings = vi.fn();

vi.mock('../../stores/settings', () => ({
  useSettingsStore: vi.fn(),
}));

// Mock profile store
vi.mock('../../stores/profile', () => ({
  useProfileStore: vi.fn(),
}));

import { useKioskStore } from '../../stores/kioskStore';
import { useSettingsStore } from '../../stores/settings';
import { useProfileStore } from '../../stores/profile';

function setupStoreMocks(options?: { isLocked?: boolean; hasInsomnia?: boolean; profileId?: string }) {
  mockIsLocked = options?.isLocked ?? false;

  vi.mocked(useKioskStore).mockReturnValue({
    isLocked: mockIsLocked,
    lock: mockKioskLock,
  } as never);

  vi.mocked(useProfileStore).mockImplementation((selector) => {
    const state = { currentProfileId: options?.profileId ?? 'profile-1' };
    return (selector as (s: typeof state) => unknown)(state);
  });

  mockGetProfileSettings.mockReturnValue({
    insomnia: options?.hasInsomnia ?? false,
  });

  vi.mocked(useSettingsStore).mockReturnValue({
    getProfileSettings: mockGetProfileSettings,
    updateProfileSettings: mockUpdateProfileSettings,
  } as never);
}

describe('useKioskLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMocks();
  });

  describe('initial state', () => {
    it('starts with showSetPin false', () => {
      const { result } = renderHook(() => useKioskLock());
      expect(result.current.showSetPin).toBe(false);
    });

    it('starts with setPinMode set to "set"', () => {
      const { result } = renderHook(() => useKioskLock());
      expect(result.current.setPinMode).toBe('set');
    });

    it('starts with no pin error', () => {
      const { result } = renderHook(() => useKioskLock());
      expect(result.current.pinError).toBeNull();
    });

    it('reflects isLocked from kioskStore', () => {
      setupStoreMocks({ isLocked: true });
      const { result } = renderHook(() => useKioskLock());
      expect(result.current.isLocked).toBe(true);
    });
  });

  describe('handleLockToggle', () => {
    it('does nothing when already locked', async () => {
      setupStoreMocks({ isLocked: true });
      mockHasPinStored.mockResolvedValue(false);

      const { result } = renderHook(() => useKioskLock());

      await act(async () => {
        await result.current.handleLockToggle();
      });

      expect(mockHasPinStored).not.toHaveBeenCalled();
      expect(result.current.showSetPin).toBe(false);
    });

    it('shows PIN setup dialog when no PIN is stored', async () => {
      mockHasPinStored.mockResolvedValue(false);

      const { result } = renderHook(() => useKioskLock());

      await act(async () => {
        await result.current.handleLockToggle();
      });

      expect(result.current.showSetPin).toBe(true);
      expect(result.current.setPinMode).toBe('set');
      expect(result.current.pinError).toBeNull();
    });

    it('activates kiosk mode directly when PIN is already stored', async () => {
      mockHasPinStored.mockResolvedValue(true);

      const { result } = renderHook(() => useKioskLock());

      await act(async () => {
        await result.current.handleLockToggle();
      });

      expect(mockKioskLock).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({ title: 'kiosk.locked_toast' });
      expect(result.current.showSetPin).toBe(false);
    });

    it('calls onLocked callback when activating with stored PIN', async () => {
      mockHasPinStored.mockResolvedValue(true);
      const onLocked = vi.fn();

      const { result } = renderHook(() => useKioskLock({ onLocked }));

      await act(async () => {
        await result.current.handleLockToggle();
      });

      expect(onLocked).toHaveBeenCalled();
    });

    it('enables insomnia in profile settings when not already enabled', async () => {
      mockHasPinStored.mockResolvedValue(true);
      mockGetProfileSettings.mockReturnValue({ insomnia: false });

      const { result } = renderHook(() => useKioskLock());

      await act(async () => {
        await result.current.handleLockToggle();
      });

      expect(mockUpdateProfileSettings).toHaveBeenCalledWith('profile-1', { insomnia: true });
    });

    it('does not update insomnia setting when already enabled', async () => {
      mockHasPinStored.mockResolvedValue(true);
      mockGetProfileSettings.mockReturnValue({ insomnia: true });

      const { result } = renderHook(() => useKioskLock());

      await act(async () => {
        await result.current.handleLockToggle();
      });

      expect(mockUpdateProfileSettings).not.toHaveBeenCalled();
    });
  });

  describe('handleChangePin', () => {
    it('opens PIN setup dialog for change', () => {
      const { result } = renderHook(() => useKioskLock());

      act(() => {
        result.current.handleChangePin();
      });

      expect(result.current.showSetPin).toBe(true);
      expect(result.current.setPinMode).toBe('set');
      expect(result.current.pinError).toBeNull();
    });

    it('does nothing when locked', () => {
      setupStoreMocks({ isLocked: true });

      const { result } = renderHook(() => useKioskLock());

      act(() => {
        result.current.handleChangePin();
      });

      expect(result.current.showSetPin).toBe(false);
    });
  });

  describe('handleSetPinSubmit — first-time PIN set', () => {
    it('moves to confirm mode on first PIN entry', async () => {
      mockHasPinStored.mockResolvedValue(false);

      const { result } = renderHook(() => useKioskLock());

      // Open set-pin dialog
      await act(async () => {
        await result.current.handleLockToggle();
      });

      // Submit first PIN
      await act(async () => {
        await result.current.handleSetPinSubmit('1234');
      });

      expect(result.current.setPinMode).toBe('confirm');
      expect(result.current.pinError).toBeNull();
    });

    it('stores PIN and activates kiosk when confirmation matches', async () => {
      mockHasPinStored.mockResolvedValue(false);
      mockStorePin.mockResolvedValue(undefined);

      const { result } = renderHook(() => useKioskLock());

      await act(async () => {
        await result.current.handleLockToggle();
      });

      // Enter PIN
      await act(async () => {
        await result.current.handleSetPinSubmit('1234');
      });

      // Confirm matching PIN
      await act(async () => {
        await result.current.handleSetPinSubmit('1234');
      });

      expect(mockStorePin).toHaveBeenCalledWith('1234');
      expect(mockKioskLock).toHaveBeenCalled();
      expect(result.current.showSetPin).toBe(false);
    });

    it('shows pin_mismatch error and resets to set mode when confirmation fails', async () => {
      mockHasPinStored.mockResolvedValue(false);

      const { result } = renderHook(() => useKioskLock());

      await act(async () => {
        await result.current.handleLockToggle();
      });

      await act(async () => {
        await result.current.handleSetPinSubmit('1234');
      });

      // Submit a different PIN for confirmation
      await act(async () => {
        await result.current.handleSetPinSubmit('5678');
      });

      expect(result.current.pinError).toBe('kiosk.pin_mismatch');
      expect(result.current.setPinMode).toBe('set');
      expect(mockStorePin).not.toHaveBeenCalled();
    });

    it('shows error when storePin throws', async () => {
      mockHasPinStored.mockResolvedValue(false);
      mockStorePin.mockRejectedValue(new Error('storage error'));

      const { result } = renderHook(() => useKioskLock());

      await act(async () => {
        await result.current.handleLockToggle();
      });

      await act(async () => {
        await result.current.handleSetPinSubmit('1234');
      });

      await act(async () => {
        await result.current.handleSetPinSubmit('1234');
      });

      expect(result.current.pinError).toBe('common.unknown_error');
      expect(result.current.showSetPin).toBe(true);
    });
  });

  describe('handleSetPinSubmit — PIN change flow', () => {
    it('shows pin_changed toast instead of locking when changing PIN', async () => {
      mockStorePin.mockResolvedValue(undefined);

      const { result } = renderHook(() => useKioskLock());

      // Open change-pin dialog
      act(() => {
        result.current.handleChangePin();
      });

      await act(async () => {
        await result.current.handleSetPinSubmit('9999');
      });

      await act(async () => {
        await result.current.handleSetPinSubmit('9999');
      });

      expect(mockStorePin).toHaveBeenCalledWith('9999');
      expect(mockToast).toHaveBeenCalledWith({ title: 'kiosk.pin_changed' });
      // Should NOT lock when only changing PIN
      expect(mockKioskLock).not.toHaveBeenCalled();
      expect(result.current.showSetPin).toBe(false);
    });
  });

  describe('handleSetPinCancel', () => {
    it('closes the dialog and resets pin state', async () => {
      mockHasPinStored.mockResolvedValue(false);

      const { result } = renderHook(() => useKioskLock());

      await act(async () => {
        await result.current.handleLockToggle();
      });

      expect(result.current.showSetPin).toBe(true);

      act(() => {
        result.current.handleSetPinCancel();
      });

      expect(result.current.showSetPin).toBe(false);
      expect(result.current.pinError).toBeNull();
    });
  });

  describe('no active profile', () => {
    it('activateKioskMode does nothing when no profileId', async () => {
      mockHasPinStored.mockResolvedValue(true);

      vi.mocked(useProfileStore).mockImplementation((selector) => {
        const state = { currentProfileId: null };
        return (selector as (s: typeof state) => unknown)(state);
      });

      const { result } = renderHook(() => useKioskLock());

      await act(async () => {
        await result.current.handleLockToggle();
      });

      expect(mockKioskLock).not.toHaveBeenCalled();
    });
  });
});
