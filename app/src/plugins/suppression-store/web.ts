/**
 * Web/foreground implementation of the suppression store.
 *
 * Backed by `localStorage` under a versioned key. The Capacitor WebView on
 * iOS/Android also reads this storage during foreground operation, but the
 * native iOS Service Extension and Android FCM service must read from
 * App Group / SharedPreferences instead — those bridges live in §4.2 / §4.3
 * (deferred).
 */

import type { SuppressionEntry } from './types';
import { log, LogLevel } from '../../lib/logger';

const STORAGE_KEY = 'zmng-suppression-store-v1';

type Storage = Pick<typeof localStorage, 'getItem' | 'setItem' | 'removeItem'>;

export interface WebSuppressionStoreOptions {
  /** Override for tests. Defaults to `globalThis.localStorage`. */
  storage?: Storage;
  /** Override for tests / determinism. Defaults to `crypto.randomUUID()`. */
  newId?: () => string;
  /** Override for tests / determinism. Defaults to `() => new Date().toISOString()`. */
  now?: () => string;
}

export class WebSuppressionStore {
  private readonly storage: Storage;
  private readonly newId: () => string;
  private readonly now: () => string;

  constructor(opts: WebSuppressionStoreOptions = {}) {
    this.storage = opts.storage ?? globalThis.localStorage;
    this.newId = opts.newId ?? defaultNewId;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  list(filter?: {
    profile_id?: string;
    kind?: SuppressionEntry['kind'];
  }): SuppressionEntry[] {
    const all = this.readAll();
    if (!filter) return all;
    return all.filter((e) => {
      if (filter.profile_id && e.profile_id !== filter.profile_id) return false;
      if (filter.kind && e.kind !== filter.kind) return false;
      return true;
    });
  }

  add(
    entry: Omit<SuppressionEntry, 'id' | 'created_at'>
  ): SuppressionEntry {
    const created: SuppressionEntry = {
      ...entry,
      id: this.newId(),
      created_at: this.now(),
    } as SuppressionEntry;
    const all = this.readAll();
    all.push(created);
    this.writeAll(all);
    return created;
  }

  update(id: string, patch: Partial<SuppressionEntry>): SuppressionEntry | null {
    const all = this.readAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const existing = all[idx];
    if (patch.kind && patch.kind !== existing.kind) {
      log.notifications('suppression-store: rejected cross-kind update', LogLevel.WARN, {
        id,
        from: existing.kind,
        to: patch.kind,
      });
      return existing;
    }
    const merged = { ...existing, ...patch, id: existing.id, kind: existing.kind } as SuppressionEntry;
    all[idx] = merged;
    this.writeAll(all);
    return merged;
  }

  remove(id: string): boolean {
    const all = this.readAll();
    const next = all.filter((e) => e.id !== id);
    if (next.length === all.length) return false;
    this.writeAll(next);
    return true;
  }

  clearProfile(profile_id: string): void {
    const next = this.readAll().filter((e) => e.profile_id !== profile_id);
    this.writeAll(next);
  }

  private readAll(): SuppressionEntry[] {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as SuppressionEntry[];
    } catch (err) {
      log.notifications('suppression-store: parse failed; resetting', LogLevel.ERROR, {
        error: (err as Error)?.message,
      });
      this.storage.removeItem(STORAGE_KEY);
      return [];
    }
  }

  private writeAll(entries: SuppressionEntry[]): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

function defaultNewId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback for environments without crypto.randomUUID
  return 'sup-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}
