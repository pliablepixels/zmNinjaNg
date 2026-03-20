import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DebugSettings } from '../DebugSettings';

const { mockUpdateSettings, mockUseSettingsStore, mockUseCurrentProfile } = vi.hoisted(() => ({
  mockUpdateSettings: vi.fn(),
  mockUseSettingsStore: vi.fn(),
  mockUseCurrentProfile: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../hooks/useCurrentProfile', () => ({
  useCurrentProfile: mockUseCurrentProfile,
}));

vi.mock('../../../stores/settings', () => ({
  DEFAULT_SETTINGS: {
    viewMode: 'snapshot',
    displayMode: 'normal',
    theme: 'light',
    disableLogRedaction: false,
  },
  useSettingsStore: mockUseSettingsStore,
}));

describe('DebugSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation for useCurrentProfile
    mockUseCurrentProfile.mockReturnValue({
      currentProfile: { id: 'profile-1', name: 'Test Profile' },
      settings: { disableLogRedaction: false },
      hasProfile: true,
    });

    // Default mock implementation for updateProfileSettings
    mockUseSettingsStore.mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector({
          updateProfileSettings: mockUpdateSettings,
        });
      }
      return mockUpdateSettings;
    });
  });

  it('should render debug settings card', () => {
    render(<DebugSettings />);

    expect(screen.getByText('settings.debug_settings')).toBeInTheDocument();
    expect(screen.getByText('settings.debug_settings_desc')).toBeInTheDocument();
  });

  it('should render log redaction switch', () => {
    render(<DebugSettings />);

    const toggle = screen.getByTestId('settings-log-redaction-switch');
    expect(toggle).toBeInTheDocument();
  });

  it('should update settings when log redaction toggled', async () => {
    const user = userEvent.setup();
    render(<DebugSettings />);

    const toggle = screen.getByTestId('settings-log-redaction-switch');
    await user.click(toggle);

    expect(mockUpdateSettings).toHaveBeenCalledWith('profile-1', {
      disableLogRedaction: true,
    });
  });

});
