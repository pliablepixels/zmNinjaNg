import { describe, expect, it, beforeEach } from 'vitest';
import { WebSuppressionStore } from '../web';
import type { MuteEntry, QuietHoursEntry, NoiseFilterEntry } from '../types';

function makeStore() {
  let counter = 0;
  const memory: Record<string, string> = {};
  const storage = {
    getItem: (k: string) => memory[k] ?? null,
    setItem: (k: string, v: string) => {
      memory[k] = v;
    },
    removeItem: (k: string) => {
      delete memory[k];
    },
  };
  const store = new WebSuppressionStore({
    storage,
    newId: () => `id-${++counter}`,
    now: () => '2026-04-28T12:00:00.000Z',
  });
  return { store, storage, raw: () => memory };
}

describe('WebSuppressionStore', () => {
  let helpers = makeStore();

  beforeEach(() => {
    helpers = makeStore();
  });

  it('returns empty list when nothing stored', () => {
    expect(helpers.store.list()).toEqual([]);
  });

  it('adds and lists entries with assigned id + created_at', () => {
    const entry = helpers.store.add({
      kind: 'mute',
      profile_id: 'p1',
      monitor_id: 'mon-1',
      until: '2026-04-29T00:00:00Z',
    } as Omit<MuteEntry, 'id' | 'created_at'>);

    expect(entry.id).toBe('id-1');
    expect(entry.created_at).toBe('2026-04-28T12:00:00.000Z');
    expect(helpers.store.list()).toEqual([entry]);
  });

  it('filters by profile_id and kind', () => {
    helpers.store.add({
      kind: 'mute',
      profile_id: 'p1',
      monitor_id: 'mon-1',
      until: '2026-04-29T00:00:00Z',
    } as Omit<MuteEntry, 'id' | 'created_at'>);
    helpers.store.add({
      kind: 'mute',
      profile_id: 'p2',
      monitor_id: 'mon-9',
      until: '2026-04-29T00:00:00Z',
    } as Omit<MuteEntry, 'id' | 'created_at'>);
    helpers.store.add({
      kind: 'noise_filter',
      profile_id: 'p1',
      monitor_id_or_all: '*',
      min_alarm_score: 30,
      exclude_cause_patterns: [],
      mode: 'hide',
    } as Omit<NoiseFilterEntry, 'id' | 'created_at'>);

    expect(helpers.store.list({ profile_id: 'p1' })).toHaveLength(2);
    expect(helpers.store.list({ kind: 'mute' })).toHaveLength(2);
    expect(helpers.store.list({ profile_id: 'p2', kind: 'mute' })).toHaveLength(1);
  });

  it('updates an entry', () => {
    const entry = helpers.store.add({
      kind: 'mute',
      profile_id: 'p1',
      monitor_id: 'mon-1',
      until: '2026-04-29T00:00:00Z',
    } as Omit<MuteEntry, 'id' | 'created_at'>);

    const updated = helpers.store.update(entry.id, { until: '2026-04-30T00:00:00Z' } as Partial<MuteEntry>);
    expect(updated && (updated as MuteEntry).until).toBe('2026-04-30T00:00:00Z');
    expect(updated?.created_at).toBe(entry.created_at);
  });

  it('rejects cross-kind updates and returns the unchanged entry', () => {
    const entry = helpers.store.add({
      kind: 'mute',
      profile_id: 'p1',
      monitor_id: 'mon-1',
      until: '2026-04-29T00:00:00Z',
    } as Omit<MuteEntry, 'id' | 'created_at'>);

    const result = helpers.store.update(entry.id, {
      kind: 'noise_filter' as 'mute',
    });
    expect(result?.kind).toBe('mute');
    expect(helpers.store.list()).toHaveLength(1);
  });

  it('returns null when updating an unknown id', () => {
    expect(helpers.store.update('does-not-exist', { until: '2026-01-01T00:00:00Z' })).toBeNull();
  });

  it('removes an entry by id', () => {
    const entry = helpers.store.add({
      kind: 'mute',
      profile_id: 'p1',
      monitor_id: 'mon-1',
      until: '2026-04-29T00:00:00Z',
    } as Omit<MuteEntry, 'id' | 'created_at'>);

    expect(helpers.store.remove(entry.id)).toBe(true);
    expect(helpers.store.list()).toEqual([]);
  });

  it('returns false when removing an unknown id', () => {
    expect(helpers.store.remove('nope')).toBe(false);
  });

  it('clears entries for a single profile only', () => {
    helpers.store.add({
      kind: 'mute',
      profile_id: 'p1',
      monitor_id: 'mon-1',
      until: '2026-04-29T00:00:00Z',
    } as Omit<MuteEntry, 'id' | 'created_at'>);
    helpers.store.add({
      kind: 'mute',
      profile_id: 'p2',
      monitor_id: 'mon-9',
      until: '2026-04-29T00:00:00Z',
    } as Omit<MuteEntry, 'id' | 'created_at'>);

    helpers.store.clearProfile('p1');
    expect(helpers.store.list().map((e) => e.profile_id)).toEqual(['p2']);
  });

  it('survives malformed JSON in storage by resetting', () => {
    const corrupted = makeStore();
    corrupted.storage.setItem('zmng-suppression-store-v1', '{not json');
    expect(corrupted.store.list()).toEqual([]);
  });

  it('round-trips entries via raw storage (persistence)', () => {
    helpers.store.add({
      kind: 'quiet_hours',
      profile_id: 'p1',
      monitor_id_or_all: '*',
      start_local_time: '22:00',
      end_local_time: '07:00',
      weekday_mask: 0b1111111,
      label: 'Night',
    } as Omit<QuietHoursEntry, 'id' | 'created_at'>);

    const serialized = helpers.raw()['zmng-suppression-store-v1'];
    expect(serialized).toBeTruthy();
    const reread = JSON.parse(serialized);
    expect(reread).toHaveLength(1);
    expect(reread[0].kind).toBe('quiet_hours');
  });
});
