import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuickLookDock } from '../QuickLookDock';
import type { NotificationEvent } from '../../../stores/notifications';

let mockEvents: NotificationEvent[] = [];

vi.mock('../../../stores/notifications', () => ({
  useNotificationStore: (selector: (state: { profileEvents: Record<string, NotificationEvent[]> }) => unknown) =>
    selector({ profileEvents: { 'p1': mockEvents } }),
}));

vi.mock('../../../hooks/useCurrentProfile', () => ({
  useCurrentProfile: () => ({
    currentProfile: { id: 'p1', name: 'Home' },
    settings: {},
  }),
}));

vi.mock('../../../hooks/useDateTimeFormat', () => ({
  useDateTimeFormat: () => ({
    fmtTimeShort: (d: Date) => d.toISOString().slice(11, 16),
  }),
}));

const event = (overrides: Partial<NotificationEvent>): NotificationEvent => ({
  MonitorId: 1,
  MonitorName: 'Driveway',
  EventId: 100,
  Cause: 'Motion',
  Name: 'Event 100',
  receivedAt: Date.now(),
  read: false,
  source: 'websocket',
  ...overrides,
});

const renderDock = () =>
  render(
    <MemoryRouter>
      <QuickLookDock />
    </MemoryRouter>
  );

describe('QuickLookDock', () => {
  beforeEach(() => {
    mockEvents = [];
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true, writable: true });
  });

  afterEach(() => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  });

  it('renders the dock with empty state when no events exist', () => {
    renderDock();
    expect(screen.getByTestId('quicklook-dock')).toBeInTheDocument();
    expect(screen.getByTestId('quicklook-empty')).toBeInTheDocument();
  });

  it('renders up to 5 events sorted by receivedAt descending', () => {
    mockEvents = [
      event({ EventId: 1, MonitorName: 'Front', receivedAt: 1000 }),
      event({ EventId: 2, MonitorName: 'Side', receivedAt: 5000 }),
      event({ EventId: 3, MonitorName: 'Back', receivedAt: 3000 }),
      event({ EventId: 4, MonitorName: 'Garage', receivedAt: 4000 }),
      event({ EventId: 5, MonitorName: 'Porch', receivedAt: 2000 }),
      event({ EventId: 6, MonitorName: 'Office', receivedAt: 6000 }),
    ];
    renderDock();
    const buttons = screen.getAllByRole('button').filter((b) =>
      b.getAttribute('data-testid')?.startsWith('quicklook-event-')
    );
    expect(buttons).toHaveLength(5);
    expect(buttons[0].getAttribute('data-testid')).toBe('quicklook-event-6');
    // Oldest of the 5 visible (event 1 with receivedAt=1000 is sliced off).
    expect(buttons[4].getAttribute('data-testid')).toBe('quicklook-event-5');
  });

  it('hides the dock after dismiss for the session', () => {
    renderDock();
    fireEvent.click(screen.getByTestId('quicklook-dismiss'));
    expect(screen.queryByTestId('quicklook-dock')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('zmng-quicklook-dock-dismissed')).toBe('1');
  });

  it('stays hidden on subsequent mount within the same session', () => {
    sessionStorage.setItem('zmng-quicklook-dock-dismissed', '1');
    renderDock();
    expect(screen.queryByTestId('quicklook-dock')).not.toBeInTheDocument();
  });

  it('hides on viewports narrower than 480px', () => {
    Object.defineProperty(window, 'innerWidth', { value: 360, configurable: true, writable: true });
    renderDock();
    expect(screen.queryByTestId('quicklook-dock')).not.toBeInTheDocument();
  });
});
