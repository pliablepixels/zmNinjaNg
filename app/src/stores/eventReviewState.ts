/**
 * Event Review-State Store
 *
 * Tracks which events the user has marked reviewed, per profile.
 * Reviewed-state is a primitive consumed by the Events list (visual dim,
 * "Show reviewed" toggle), the dashboard recent-events widget, and the
 * notification "Reviewed" action drain path.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { log, LogLevel } from '../lib/logger';

interface EventReviewState {
  // event-id sets per profile
  profileReviewed: Record<string, string[]>;

  isReviewed: (profileId: string, eventId: string) => boolean;
  markReviewed: (profileId: string, eventId: string) => void;
  markManyReviewed: (profileId: string, eventIds: string[]) => void;
  unmarkReviewed: (profileId: string, eventId: string) => void;
  toggleReviewed: (profileId: string, eventId: string) => void;
  getReviewed: (profileId: string) => string[];
  getReviewedCount: (profileId: string) => number;
  clearReviewed: (profileId: string) => void;
}

export const useEventReviewStateStore = create<EventReviewState>()(
  persist(
    (set, get) => ({
      profileReviewed: {},

      isReviewed: (profileId, eventId) => {
        const reviewed = get().profileReviewed[profileId] || [];
        return reviewed.includes(eventId);
      },

      markReviewed: (profileId, eventId) => {
        set((state) => {
          const reviewed = state.profileReviewed[profileId] || [];
          if (reviewed.includes(eventId)) return state;

          log.profile(`Event ${eventId} marked reviewed`, LogLevel.INFO, {
            profileId,
            eventId,
          });

          return {
            profileReviewed: {
              ...state.profileReviewed,
              [profileId]: [...reviewed, eventId],
            },
          };
        });
      },

      markManyReviewed: (profileId, eventIds) => {
        if (eventIds.length === 0) return;

        set((state) => {
          const existing = state.profileReviewed[profileId] || [];
          const existingSet = new Set(existing);
          const additions: string[] = [];
          for (const id of eventIds) {
            if (!existingSet.has(id)) {
              existingSet.add(id);
              additions.push(id);
            }
          }
          if (additions.length === 0) return state;

          log.profile(`Bulk marked reviewed`, LogLevel.INFO, {
            profileId,
            added: additions.length,
            requested: eventIds.length,
          });

          return {
            profileReviewed: {
              ...state.profileReviewed,
              [profileId]: [...existing, ...additions],
            },
          };
        });
      },

      unmarkReviewed: (profileId, eventId) => {
        set((state) => {
          const reviewed = state.profileReviewed[profileId] || [];
          if (!reviewed.includes(eventId)) return state;

          log.profile(`Event ${eventId} unmarked`, LogLevel.INFO, {
            profileId,
            eventId,
          });

          return {
            profileReviewed: {
              ...state.profileReviewed,
              [profileId]: reviewed.filter((id) => id !== eventId),
            },
          };
        });
      },

      toggleReviewed: (profileId, eventId) => {
        const state = get();
        if (state.isReviewed(profileId, eventId)) {
          state.unmarkReviewed(profileId, eventId);
        } else {
          state.markReviewed(profileId, eventId);
        }
      },

      getReviewed: (profileId) => get().profileReviewed[profileId] || [],

      getReviewedCount: (profileId) =>
        (get().profileReviewed[profileId] || []).length,

      clearReviewed: (profileId) => {
        set((state) => {
          log.profile(`Cleared reviewed events`, LogLevel.INFO, {
            profileId,
            count: state.profileReviewed[profileId]?.length || 0,
          });
          return {
            profileReviewed: {
              ...state.profileReviewed,
              [profileId]: [],
            },
          };
        });
      },
    }),
    {
      name: 'zmng-event-review-state-v1',
    }
  )
);
