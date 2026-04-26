/**
 * useMontageGrid hook tests
 *
 * Covers the layout-restoration race that breaks "default custom layout"
 * application on platforms where persisted settings hydrate after the
 * Montage container has measured its width (notably Windows Tauri).
 * See GitHub #127.
 */

import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Layout } from 'react-grid-layout';
import { useMontageGrid } from '../useMontageGrid';
import type { MonitorData } from '../../../../api/types';
import type { Profile } from '../../../../api/types';
import {
  useSettingsStore,
  DEFAULT_SETTINGS,
  type ProfileSettings,
} from '../../../../stores/settings';

vi.mock('../../../../stores/settings', async () => {
  const actual = await vi.importActual<typeof import('../../../../stores/settings')>(
    '../../../../stores/settings'
  );
  return {
    ...actual,
    useSettingsStore: vi.fn(),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockProfile: Profile = {
  id: 'profile-1',
  name: 'Home',
  apiUrl: 'http://localhost/api',
  portalUrl: 'http://localhost',
  cgiUrl: 'http://localhost/cgi-bin',
  isDefault: true,
  createdAt: Date.now(),
};

const monitor = (id: string): MonitorData => ({
  Monitor: {
    Id: id,
    Name: `mon-${id}`,
    Width: '1920',
    Height: '1080',
    Orientation: '0',
  } as MonitorData['Monitor'],
});

const buildSettings = (overrides: Partial<ProfileSettings> = {}): ProfileSettings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});

const installSettingsStoreMock = () => {
  const updateProfileSettings = vi.fn();
  const saveMontageLayout = vi.fn();
  const state = { updateProfileSettings, saveMontageLayout };
  // The hook calls useSettingsStore((s) => s.updateProfileSettings) etc.
  vi.mocked(useSettingsStore).mockImplementation(
    ((selector: (s: typeof state) => unknown) => selector(state)) as never
  );
  return { updateProfileSettings, saveMontageLayout };
};

describe('useMontageGrid — saved layout restoration', () => {
  it('applies persisted montageLayouts.lg even when it hydrates after width is measured (issue #127)', () => {
    installSettingsStoreMock();

    const monitors = [monitor('1'), monitor('2'), monitor('3')];
    // A single-column stack — impossible to produce from buildDefaultLayout
    // with the default montageGridCols of 2 (which yields w=6 tiles).
    const savedLayout: Layout[] = [
      { i: '1', x: 0, y: 0, w: 12, h: 8 },
      { i: '2', x: 0, y: 8, w: 12, h: 8 },
      { i: '3', x: 0, y: 16, w: 12, h: 10 },
    ];

    // Initial settings: store hasn't hydrated yet, so montageLayouts is the
    // empty default. This mirrors the cold-start state on Windows Tauri,
    // where the settings store rehydrates asynchronously.
    let settings = buildSettings({ montageLayouts: {} });

    const { result, rerender } = renderHook(
      ({ settings: s }) =>
        useMontageGrid({
          monitors,
          currentProfile: mockProfile,
          settings: s,
          isEditMode: false,
        }),
      { initialProps: { settings } }
    );

    // Container measures its width before the settings store hydrates —
    // this triggers the restore effect with empty montageLayouts and
    // falls through to buildDefaultLayout.
    act(() => {
      result.current.handleWidthChange(1200);
    });

    // Sanity: with default cols=2, the fallback layout uses w=6 tiles, not
    // the saved w=12 stack.
    expect(result.current.layout.every((item) => item.w === 12)).toBe(false);

    // Settings store hydrates: persisted montageLayouts.lg becomes available.
    settings = buildSettings({ montageLayouts: { lg: savedLayout } });
    rerender({ settings });

    // After hydration the restore effect must re-fire and apply the
    // persisted positions for every saved monitor id.
    const applied = new Map(result.current.layout.map((item) => [item.i, item]));
    for (const saved of savedLayout) {
      const got = applied.get(saved.i);
      expect(got, `monitor ${saved.i} missing from applied layout`).toBeDefined();
      expect(got!.x).toBe(saved.x);
      expect(got!.w).toBe(saved.w);
    }
  });
});
