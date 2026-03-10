/**
 * Notification Profile Resolution
 *
 * Helpers to resolve which profile a push notification belongs to
 * and handle cross-profile notification taps with user confirmation.
 */

import type { Profile } from '../api/types';
import { useProfileStore } from '../stores/profile';
import { log, LogLevel } from './logger';

/**
 * Find a profile by name (case-insensitive).
 * Returns the profile or undefined if not found.
 */
export function findProfileByName(name: string): Profile | undefined {
  const { profiles } = useProfileStore.getState();
  return profiles.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Resolve the target profile ID for a notification.
 *
 * If the notification contains a `profile` field, attempts to match it
 * to a stored profile by name. Falls back to the current profile ID.
 *
 * Returns { targetProfileId, isCrossProfile } where isCrossProfile is true
 * when the notification belongs to a different profile than the active one.
 */
export function resolveProfileForNotification(
  dataProfile: string | undefined,
  currentProfileId: string | null
): { targetProfileId: string | null; isCrossProfile: boolean } {
  if (!dataProfile || !currentProfileId) {
    return { targetProfileId: currentProfileId, isCrossProfile: false };
  }

  const matchedProfile = findProfileByName(dataProfile);
  if (!matchedProfile) {
    log.push('Notification profile not found, using current profile', LogLevel.WARN, {
      notificationProfile: dataProfile,
    });
    return { targetProfileId: currentProfileId, isCrossProfile: false };
  }

  const isCrossProfile = matchedProfile.id !== currentProfileId;

  return { targetProfileId: matchedProfile.id, isCrossProfile };
}

/** Pending notification tap that requires a profile switch confirmation. */
export interface PendingProfileSwitch {
  targetProfileId: string;
  targetProfileName: string;
  eventId: string;
}

let _pendingSwitch: PendingProfileSwitch | null = null;
const _listeners: Set<(pending: PendingProfileSwitch) => void> = new Set();

/** Queue a profile switch confirmation for the UI to pick up. */
export function requestProfileSwitch(pending: PendingProfileSwitch): void {
  _pendingSwitch = pending;
  _listeners.forEach((cb) => cb(pending));
}

/** Subscribe to profile switch requests. Returns an unsubscribe function. */
export function onProfileSwitchRequest(
  callback: (pending: PendingProfileSwitch) => void
): () => void {
  _listeners.add(callback);
  // Fire immediately if there's already a pending request
  if (_pendingSwitch) {
    callback(_pendingSwitch);
  }
  return () => {
    _listeners.delete(callback);
  };
}

/** Clear the pending switch (after user confirms or dismisses). */
export function clearPendingProfileSwitch(): void {
  _pendingSwitch = null;
}
