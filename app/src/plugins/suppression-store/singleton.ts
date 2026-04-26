/**
 * App-wide singleton wrapper around `WebSuppressionStore`.
 *
 * Adds a tiny pub/sub layer so React components can subscribe via
 * `useSyncExternalStore`. Mutations are wrapped to notify subscribers.
 */

import { useSyncExternalStore } from 'react';
import { WebSuppressionStore } from './web';
import type { SuppressionEntry } from './types';

const store = new WebSuppressionStore();
const listeners = new Set<() => void>();

let snapshot: SuppressionEntry[] = store.list();
function refreshSnapshot() {
  snapshot = store.list();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SuppressionEntry[] {
  return snapshot;
}

/** Read all entries (synchronous; reflects last mutation). */
export function listSuppressionEntries(filter?: {
  profile_id?: string;
  kind?: SuppressionEntry['kind'];
}): SuppressionEntry[] {
  return store.list(filter);
}

export function addSuppressionEntry(
  entry: Parameters<WebSuppressionStore['add']>[0]
): SuppressionEntry {
  const result = store.add(entry);
  refreshSnapshot();
  return result;
}

export function updateSuppressionEntry(
  id: string,
  patch: Parameters<WebSuppressionStore['update']>[1]
): SuppressionEntry | null {
  const result = store.update(id, patch);
  refreshSnapshot();
  return result;
}

export function removeSuppressionEntry(id: string): boolean {
  const result = store.remove(id);
  refreshSnapshot();
  return result;
}

export function clearProfileSuppression(profile_id: string): void {
  store.clearProfile(profile_id);
  refreshSnapshot();
}

/**
 * React hook returning all suppression entries for the current profile,
 * subscribed to the singleton — re-renders on any mutation.
 */
export function useSuppressionEntries(profileId: string | undefined): SuppressionEntry[] {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!profileId) return [];
  return all.filter((e) => e.profile_id === profileId);
}
