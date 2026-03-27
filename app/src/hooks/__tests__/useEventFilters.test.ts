/**
 * useEventFilters Hook Tests
 *
 * Tests filter state management, URL sync, and settings persistence.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEventFilters, ALL_TAGS_FILTER_ID } from '../useEventFilters';

// Mock react-router-dom
const mockSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn();
const mockLocation = { state: null, pathname: '/events', search: '', hash: '', key: 'default' };

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  useLocation: () => mockLocation,
}));

// Mock logger
vi.mock('../../lib/logger', () => ({
  log: {
    time: vi.fn(),
  },
  LogLevel: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
  },
}));

// Mock useCurrentProfile
const mockCurrentProfile = { id: 'profile-1', name: 'Test', apiUrl: '', portalUrl: '', cgiUrl: '', isDefault: true, createdAt: 0 };
const mockGetProfileSettings = vi.fn();
const mockUpdateProfileSettings = vi.fn();

vi.mock('../useCurrentProfile', () => ({
  useCurrentProfile: vi.fn(),
}));

// Mock settings store
vi.mock('../../stores/settings', () => ({
  useSettingsStore: {
    getState: vi.fn(),
  },
}));

import { useCurrentProfile } from '../useCurrentProfile';
import { useSettingsStore } from '../../stores/settings';

const defaultEventsPageFilters = {
  monitorIds: [],
  tagIds: [],
  startDateTime: '',
  endDateTime: '',
  favoritesOnly: false,
  onlyDetectedObjects: false,
};

const mockProfileSettings = {
  defaultEventLimit: 100,
  eventsPageFilters: { ...defaultEventsPageFilters },
};

function setupMocks(overrides?: Partial<typeof mockProfileSettings>) {
  const settings = { ...mockProfileSettings, ...overrides };

  vi.mocked(useCurrentProfile).mockReturnValue({
    currentProfile: mockCurrentProfile,
    settings: settings as never,
    hasProfile: true,
  });

  mockGetProfileSettings.mockReturnValue(settings);
  mockUpdateProfileSettings.mockImplementation(() => {});

  vi.mocked(useSettingsStore.getState).mockReturnValue({
    getProfileSettings: mockGetProfileSettings,
    updateProfileSettings: mockUpdateProfileSettings,
  } as never);
}

describe('useEventFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset search params
    mockSearchParams.forEach((_, key) => mockSearchParams.delete(key));
    setupMocks();
  });

  describe('initial state', () => {
    it('returns empty filter values on first render', () => {
      const { result } = renderHook(() => useEventFilters());

      expect(result.current.selectedMonitorIds).toEqual([]);
      expect(result.current.selectedTagIds).toEqual([]);
      expect(result.current.startDateInput).toBe('');
      expect(result.current.endDateInput).toBe('');
      expect(result.current.favoritesOnly).toBe(false);
      expect(result.current.onlyDetectedObjects).toBe(false);
    });

    it('computes activeFilterCount as 0 when no filters set', () => {
      const { result } = renderHook(() => useEventFilters());
      expect(result.current.activeFilterCount).toBe(0);
    });

    it('returns default filters object with correct shape', () => {
      const { result } = renderHook(() => useEventFilters());

      expect(result.current.filters).toMatchObject({
        limit: 100,
        sort: 'StartDateTime',
        direction: 'desc',
      });
      expect(result.current.filters.monitorId).toBeUndefined();
      expect(result.current.filters.startDateTime).toBeUndefined();
      expect(result.current.filters.endDateTime).toBeUndefined();
    });

    it('exports ALL_TAGS_FILTER_ID sentinel constant', () => {
      expect(ALL_TAGS_FILTER_ID).toBe('__all_tags__');
    });
  });

  describe('setSelectedMonitorIds', () => {
    it('updates selectedMonitorIds state', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedMonitorIds(['1', '2']);
      });

      expect(result.current.selectedMonitorIds).toEqual(['1', '2']);
    });

    it('reflects monitor selection in derived filters.monitorId', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedMonitorIds(['3', '4']);
      });

      expect(result.current.filters.monitorId).toBe('3,4');
    });

    it('sets filters.monitorId to undefined when list is empty', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedMonitorIds(['1']);
      });
      act(() => {
        result.current.setSelectedMonitorIds([]);
      });

      expect(result.current.filters.monitorId).toBeUndefined();
    });

    it('persists to settings store when profile is present', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedMonitorIds(['5']);
      });

      expect(mockUpdateProfileSettings).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({
          eventsPageFilters: expect.objectContaining({ monitorIds: ['5'] }),
        }),
      );
    });
  });

  describe('setSelectedTagIds', () => {
    it('updates selectedTagIds state', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedTagIds(['tag-a', 'tag-b']);
      });

      expect(result.current.selectedTagIds).toEqual(['tag-a', 'tag-b']);
    });

    it('increments activeFilterCount for tag selection', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedTagIds(['tag-a']);
      });

      expect(result.current.activeFilterCount).toBe(1);
    });
  });

  describe('date range filters', () => {
    it('sets start date input', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setStartDateInput('2024-01-01T00:00');
      });

      expect(result.current.startDateInput).toBe('2024-01-01T00:00');
      expect(result.current.filters.startDateTime).toBe('2024-01-01T00:00');
    });

    it('sets end date input', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setEndDateInput('2024-12-31T23:59');
      });

      expect(result.current.endDateInput).toBe('2024-12-31T23:59');
      expect(result.current.filters.endDateTime).toBe('2024-12-31T23:59');
    });

    it('leaves startDateTime undefined in filters when empty', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setStartDateInput('');
      });

      expect(result.current.filters.startDateTime).toBeUndefined();
    });

    it('counts each date field separately in activeFilterCount', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setStartDateInput('2024-01-01T00:00');
        result.current.setEndDateInput('2024-12-31T23:59');
      });

      expect(result.current.activeFilterCount).toBe(2);
    });
  });

  describe('favoritesOnly filter', () => {
    it('toggles favoritesOnly on', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setFavoritesOnly(true);
      });

      expect(result.current.favoritesOnly).toBe(true);
      expect(result.current.activeFilterCount).toBe(1);
    });

    it('toggles favoritesOnly off', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setFavoritesOnly(true);
      });
      act(() => {
        result.current.setFavoritesOnly(false);
      });

      expect(result.current.favoritesOnly).toBe(false);
      expect(result.current.activeFilterCount).toBe(0);
    });
  });

  describe('onlyDetectedObjects filter', () => {
    it('enables onlyDetectedObjects and sets notesRegexp', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setOnlyDetectedObjects(true);
      });

      expect(result.current.onlyDetectedObjects).toBe(true);
      expect(result.current.filters.notesRegexp).toBe('detected:');
    });

    it('disables onlyDetectedObjects and clears notesRegexp', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setOnlyDetectedObjects(true);
      });
      act(() => {
        result.current.setOnlyDetectedObjects(false);
      });

      expect(result.current.filters.notesRegexp).toBeUndefined();
    });
  });

  describe('toggleMonitorSelection', () => {
    it('adds a monitor ID that is not yet selected', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.toggleMonitorSelection('7');
      });

      expect(result.current.selectedMonitorIds).toContain('7');
    });

    it('removes a monitor ID that is already selected', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedMonitorIds(['7', '8']);
      });
      act(() => {
        result.current.toggleMonitorSelection('7');
      });

      expect(result.current.selectedMonitorIds).not.toContain('7');
      expect(result.current.selectedMonitorIds).toContain('8');
    });
  });

  describe('toggleTagSelection', () => {
    it('adds a tag ID not yet selected', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.toggleTagSelection('tag-x');
      });

      expect(result.current.selectedTagIds).toContain('tag-x');
    });

    it('removes a tag ID already selected', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedTagIds(['tag-x', 'tag-y']);
      });
      act(() => {
        result.current.toggleTagSelection('tag-x');
      });

      expect(result.current.selectedTagIds).not.toContain('tag-x');
      expect(result.current.selectedTagIds).toContain('tag-y');
    });
  });

  describe('clearFilters', () => {
    it('resets all filter state to empty', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedMonitorIds(['1', '2']);
        result.current.setSelectedTagIds(['tag-a']);
        result.current.setStartDateInput('2024-01-01T00:00');
        result.current.setEndDateInput('2024-12-31T23:59');
        result.current.setFavoritesOnly(true);
        result.current.setOnlyDetectedObjects(true);
      });

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.selectedMonitorIds).toEqual([]);
      expect(result.current.selectedTagIds).toEqual([]);
      expect(result.current.startDateInput).toBe('');
      expect(result.current.endDateInput).toBe('');
      expect(result.current.favoritesOnly).toBe(false);
      expect(result.current.onlyDetectedObjects).toBe(false);
      expect(result.current.activeFilterCount).toBe(0);
    });

    it('calls setSearchParams on clear to remove URL params', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.clearFilters();
      });

      expect(mockSetSearchParams).toHaveBeenCalled();
    });
  });

  describe('applyFilters', () => {
    it('calls setSearchParams with current filter state', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedMonitorIds(['3']);
      });
      act(() => {
        result.current.applyFilters();
      });

      expect(mockSetSearchParams).toHaveBeenCalled();
      const [newParams] = mockSetSearchParams.mock.calls[mockSetSearchParams.mock.calls.length - 1];
      expect(newParams.get('monitorId')).toBe('3');
    });

    it('sets default sort and direction params if absent', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.applyFilters();
      });

      const [newParams] = mockSetSearchParams.mock.calls[mockSetSearchParams.mock.calls.length - 1];
      expect(newParams.get('sort')).toBe('StartDateTime');
      expect(newParams.get('direction')).toBe('desc');
    });

    it('removes monitorId from URL when monitor list is cleared', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedMonitorIds([]);
        result.current.applyFilters();
      });

      const [newParams] = mockSetSearchParams.mock.calls[mockSetSearchParams.mock.calls.length - 1];
      expect(newParams.get('monitorId')).toBeNull();
    });
  });

  describe('activeFilterCount', () => {
    it('counts each active filter type once', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedMonitorIds(['1', '2']); // counts as 1
        result.current.setSelectedTagIds(['tag-a']);      // counts as 1
        result.current.setFavoritesOnly(true);            // counts as 1
      });

      expect(result.current.activeFilterCount).toBe(3);
    });

    it('counts up to 6 at maximum (all filter types active)', () => {
      const { result } = renderHook(() => useEventFilters());

      act(() => {
        result.current.setSelectedMonitorIds(['1']);
        result.current.setSelectedTagIds(['tag-a']);
        result.current.setStartDateInput('2024-01-01T00:00');
        result.current.setEndDateInput('2024-12-31T23:59');
        result.current.setFavoritesOnly(true);
        result.current.setOnlyDetectedObjects(true);
      });

      expect(result.current.activeFilterCount).toBe(6);
    });
  });

  describe('no profile', () => {
    it('does not crash when currentProfile is null', () => {
      vi.mocked(useCurrentProfile).mockReturnValue({
        currentProfile: null,
        settings: mockProfileSettings as never,
        hasProfile: false,
      });

      const { result } = renderHook(() => useEventFilters());

      // Should not throw; state setters should still work
      act(() => {
        result.current.setSelectedMonitorIds(['1']);
      });

      expect(result.current.selectedMonitorIds).toEqual(['1']);
      // Settings store should NOT be called because there is no profile ID
      expect(mockUpdateProfileSettings).not.toHaveBeenCalled();
    });
  });
});
