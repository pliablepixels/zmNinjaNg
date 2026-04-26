import { describe, expect, it } from 'vitest';
import {
  isMuteActive,
  isQuietHoursActive,
  matchesNoiseFilter,
  evaluateSuppression,
  matchesAnyNoiseFilter,
  entryAppliesToMonitor,
} from '../evaluators';
import {
  type MuteEntry,
  type QuietHoursEntry,
  type NoiseFilterEntry,
  type SuppressionEntry,
  MONITOR_ALL,
} from '../types';

const baseMute = (overrides: Partial<MuteEntry> = {}): MuteEntry => ({
  id: 'm1',
  kind: 'mute',
  profile_id: 'p1',
  monitor_id: 'mon-1',
  until: new Date(Date.now() + 60_000).toISOString(),
  created_at: new Date().toISOString(),
  ...overrides,
});

const baseQuiet = (overrides: Partial<QuietHoursEntry> = {}): QuietHoursEntry => ({
  id: 'q1',
  kind: 'quiet_hours',
  profile_id: 'p1',
  monitor_id_or_all: MONITOR_ALL,
  start_local_time: '22:00',
  end_local_time: '07:00',
  weekday_mask: 0b1111111, // every day
  label: 'Night',
  created_at: new Date().toISOString(),
  ...overrides,
});

const baseNoise = (overrides: Partial<NoiseFilterEntry> = {}): NoiseFilterEntry => ({
  id: 'n1',
  kind: 'noise_filter',
  profile_id: 'p1',
  monitor_id_or_all: MONITOR_ALL,
  min_alarm_score: 30,
  exclude_cause_patterns: [],
  mode: 'hide',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('isMuteActive', () => {
  it('returns true when until is in the future', () => {
    expect(isMuteActive(baseMute({ until: new Date(Date.now() + 5000).toISOString() }))).toBe(true);
  });

  it('returns false when until has passed', () => {
    expect(isMuteActive(baseMute({ until: new Date(Date.now() - 5000).toISOString() }))).toBe(false);
  });

  it('returns false for malformed until', () => {
    expect(isMuteActive(baseMute({ until: 'not-a-date' }))).toBe(false);
  });
});

describe('isQuietHoursActive', () => {
  // A Tuesday at 23:30
  const tueNight = new Date('2026-04-28T23:30:00');
  // A Saturday at 03:00 (Friday's window crossing midnight)
  const satEarly = new Date('2026-05-02T03:00:00');
  // A Wednesday at 09:00 — outside any 22:00-07:00 window
  const wedMorning = new Date('2026-04-29T09:00:00');

  it('matches a same-day window on a covered weekday', () => {
    const entry = baseQuiet({
      start_local_time: '21:00',
      end_local_time: '23:59',
      weekday_mask: 0b0000100, // Tuesday only (bit 2)
    });
    expect(isQuietHoursActive(entry, tueNight)).toBe(true);
  });

  it('does not match a same-day window outside its weekdays', () => {
    const entry = baseQuiet({
      start_local_time: '21:00',
      end_local_time: '23:59',
      weekday_mask: 0b0000010, // Monday only
    });
    expect(isQuietHoursActive(entry, tueNight)).toBe(false);
  });

  it('matches a midnight-crossing window — past start on the start day', () => {
    // 22:00-07:00, Mon-Fri. Tue 23:30 is within window starting Tue.
    const entry = baseQuiet({
      start_local_time: '22:00',
      end_local_time: '07:00',
      weekday_mask: 0b0111110, // Mon-Fri (bits 1..5)
    });
    expect(isQuietHoursActive(entry, tueNight)).toBe(true);
  });

  it('matches a midnight-crossing window — before end, weekday based on yesterday', () => {
    // 22:00-07:00 Mon-Fri. Saturday 03:00 belongs to Friday's window.
    const entry = baseQuiet({
      start_local_time: '22:00',
      end_local_time: '07:00',
      weekday_mask: 0b0111110, // Mon-Fri
    });
    expect(isQuietHoursActive(entry, satEarly)).toBe(true);
  });

  it('does not match a midnight-crossing window when yesterday is excluded', () => {
    // 22:00-07:00 Sat only. Saturday 03:00 — start day is Friday (excluded).
    const entry = baseQuiet({
      start_local_time: '22:00',
      end_local_time: '07:00',
      weekday_mask: 0b1000000, // Saturday only
    });
    expect(isQuietHoursActive(entry, satEarly)).toBe(false);
  });

  it('does not match outside the time range', () => {
    const entry = baseQuiet({
      start_local_time: '22:00',
      end_local_time: '07:00',
      weekday_mask: 0b1111111,
    });
    expect(isQuietHoursActive(entry, wedMorning)).toBe(false);
  });

  it('returns false for empty weekday mask', () => {
    expect(isQuietHoursActive(baseQuiet({ weekday_mask: 0 }), tueNight)).toBe(false);
  });

  it('returns false for malformed time', () => {
    expect(isQuietHoursActive(baseQuiet({ start_local_time: '99:99' }), tueNight)).toBe(false);
  });

  it('returns false for zero-length window', () => {
    expect(
      isQuietHoursActive(baseQuiet({ start_local_time: '06:00', end_local_time: '06:00' }), tueNight)
    ).toBe(false);
  });
});

describe('matchesNoiseFilter', () => {
  it('matches when score is below threshold', () => {
    expect(matchesNoiseFilter(baseNoise({ min_alarm_score: 30 }), { alarm_score: 12 })).toBe(true);
  });

  it('does not match when score equals threshold', () => {
    // strict inequality: 30 > 30 is false
    expect(matchesNoiseFilter(baseNoise({ min_alarm_score: 30 }), { alarm_score: 30 })).toBe(false);
  });

  it('does not match when score is above threshold', () => {
    expect(matchesNoiseFilter(baseNoise({ min_alarm_score: 30 }), { alarm_score: 80 })).toBe(false);
  });

  it('matches a cause-exclude pattern (case-insensitive)', () => {
    expect(
      matchesNoiseFilter(
        baseNoise({ min_alarm_score: 0, exclude_cause_patterns: ['Continuous'] }),
        { alarm_score: 100, cause_text: 'continuous recording' }
      )
    ).toBe(true);
  });

  it('does not match when cause_text is missing', () => {
    expect(
      matchesNoiseFilter(
        baseNoise({ min_alarm_score: 0, exclude_cause_patterns: ['Continuous'] }),
        { alarm_score: 100 }
      )
    ).toBe(false);
  });

  it('skips empty pattern strings', () => {
    expect(
      matchesNoiseFilter(
        baseNoise({ min_alarm_score: 0, exclude_cause_patterns: [''] }),
        { alarm_score: 100, cause_text: 'anything' }
      )
    ).toBe(false);
  });

  it('returns false when no input provided', () => {
    expect(matchesNoiseFilter(baseNoise({ min_alarm_score: 30 }), {})).toBe(false);
  });
});

describe('entryAppliesToMonitor', () => {
  it('matches the wildcard', () => {
    expect(entryAppliesToMonitor(MONITOR_ALL, 'mon-1')).toBe(true);
  });
  it('matches a specific id', () => {
    expect(entryAppliesToMonitor('mon-1', 'mon-1')).toBe(true);
  });
  it('does not match a different id', () => {
    expect(entryAppliesToMonitor('mon-1', 'mon-2')).toBe(false);
  });
});

describe('evaluateSuppression', () => {
  const ctx = {
    profile_id: 'p1',
    monitor_id: 'mon-1',
    now: new Date('2026-04-28T23:30:00'),
    alarm_score: 12,
    cause_text: 'continuous',
  };

  it('returns null when no entries match', () => {
    expect(evaluateSuppression(ctx, [])).toBeNull();
  });

  it('returns mute reason first (priority order)', () => {
    const entries: SuppressionEntry[] = [
      baseMute({ until: new Date(ctx.now.getTime() + 60_000).toISOString() }),
      baseQuiet({ start_local_time: '00:00', end_local_time: '23:59', weekday_mask: 0b1111111 }),
    ];
    expect(evaluateSuppression(ctx, entries)?.kind).toBe('mute');
  });

  it('returns quiet_hours when no mute matches', () => {
    const entries: SuppressionEntry[] = [
      baseQuiet({
        start_local_time: '22:00',
        end_local_time: '07:00',
        weekday_mask: 0b0111110, // Mon-Fri
      }),
    ];
    expect(evaluateSuppression(ctx, entries)?.kind).toBe('quiet_hours');
  });

  it('returns noise_filter only when mode is hide', () => {
    const dimEntries: SuppressionEntry[] = [
      baseNoise({ min_alarm_score: 30, mode: 'dim' }),
    ];
    expect(evaluateSuppression(ctx, dimEntries)).toBeNull();

    const hideEntries: SuppressionEntry[] = [
      baseNoise({ min_alarm_score: 30, mode: 'hide' }),
    ];
    expect(evaluateSuppression(ctx, hideEntries)?.kind).toBe('noise_filter');
  });

  it('respects profile boundary', () => {
    const entries: SuppressionEntry[] = [
      baseMute({
        profile_id: 'p2',
        until: new Date(ctx.now.getTime() + 60_000).toISOString(),
      }),
    ];
    expect(evaluateSuppression(ctx, entries)).toBeNull();
  });

  it('respects monitor boundary on monitor-specific entries', () => {
    const entries: SuppressionEntry[] = [
      baseQuiet({
        monitor_id_or_all: 'mon-7',
        start_local_time: '00:00',
        end_local_time: '23:59',
        weekday_mask: 0b1111111,
      }),
    ];
    expect(evaluateSuppression(ctx, entries)).toBeNull();
  });
});

describe('matchesAnyNoiseFilter', () => {
  it('matches dim-mode rules too', () => {
    const ctx = {
      profile_id: 'p1',
      monitor_id: 'mon-1',
      alarm_score: 5,
    };
    const entries: SuppressionEntry[] = [
      baseNoise({ min_alarm_score: 10, mode: 'dim' }),
    ];
    expect(matchesAnyNoiseFilter(ctx, entries)).not.toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(
      matchesAnyNoiseFilter(
        { profile_id: 'p1', monitor_id: 'mon-1', alarm_score: 90 },
        [baseNoise({ min_alarm_score: 10, mode: 'dim' })]
      )
    ).toBeNull();
  });
});
