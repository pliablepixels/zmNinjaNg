import { describe, expect, it, beforeEach } from 'vitest';
import { useEventReviewStateStore } from '../eventReviewState';

describe('EventReviewState Store', () => {
  beforeEach(() => {
    useEventReviewStateStore.setState({ profileReviewed: {} });
    localStorage.clear();
  });

  describe('isReviewed', () => {
    it('returns false for unreviewed event', () => {
      const { isReviewed } = useEventReviewStateStore.getState();
      expect(isReviewed('profile-1', 'event-123')).toBe(false);
    });

    it('returns true for reviewed event', () => {
      const { markReviewed, isReviewed } = useEventReviewStateStore.getState();
      markReviewed('profile-1', 'event-123');
      expect(isReviewed('profile-1', 'event-123')).toBe(true);
    });

    it('returns false for event reviewed in different profile', () => {
      const { markReviewed, isReviewed } = useEventReviewStateStore.getState();
      markReviewed('profile-1', 'event-123');
      expect(isReviewed('profile-2', 'event-123')).toBe(false);
    });
  });

  describe('markReviewed', () => {
    it('marks event reviewed', () => {
      const { markReviewed, getReviewed } = useEventReviewStateStore.getState();
      markReviewed('profile-1', 'event-123');
      expect(getReviewed('profile-1')).toEqual(['event-123']);
    });

    it('does not duplicate if event already reviewed', () => {
      const { markReviewed, getReviewed } = useEventReviewStateStore.getState();
      markReviewed('profile-1', 'event-123');
      markReviewed('profile-1', 'event-123');
      expect(getReviewed('profile-1')).toEqual(['event-123']);
    });

    it('keeps reviewed sets isolated per profile', () => {
      const { markReviewed, getReviewed } = useEventReviewStateStore.getState();
      markReviewed('profile-1', 'event-123');
      markReviewed('profile-2', 'event-456');

      expect(getReviewed('profile-1')).toEqual(['event-123']);
      expect(getReviewed('profile-2')).toEqual(['event-456']);
    });
  });

  describe('markManyReviewed', () => {
    it('marks all provided events reviewed in a single batched write', () => {
      const { markManyReviewed, getReviewed } = useEventReviewStateStore.getState();
      markManyReviewed('profile-1', ['e1', 'e2', 'e3']);
      expect(getReviewed('profile-1')).toEqual(['e1', 'e2', 'e3']);
    });

    it('skips already-reviewed events without duplicating', () => {
      const { markReviewed, markManyReviewed, getReviewed } = useEventReviewStateStore.getState();
      markReviewed('profile-1', 'e2');
      markManyReviewed('profile-1', ['e1', 'e2', 'e3']);
      expect(getReviewed('profile-1')).toEqual(['e2', 'e1', 'e3']);
    });

    it('handles empty input as a no-op', () => {
      const { markManyReviewed, getReviewed } = useEventReviewStateStore.getState();
      markManyReviewed('profile-1', []);
      expect(getReviewed('profile-1')).toEqual([]);
    });

    it('does not affect other profiles', () => {
      const { markReviewed, markManyReviewed, getReviewed } = useEventReviewStateStore.getState();
      markReviewed('profile-2', 'e9');
      markManyReviewed('profile-1', ['e1', 'e2']);

      expect(getReviewed('profile-1')).toEqual(['e1', 'e2']);
      expect(getReviewed('profile-2')).toEqual(['e9']);
    });

    it('completes a 500-item batch quickly', () => {
      const { markManyReviewed, getReviewedCount } = useEventReviewStateStore.getState();
      const ids = Array.from({ length: 500 }, (_, i) => `e${i}`);
      const start = performance.now();
      markManyReviewed('profile-1', ids);
      const elapsedMs = performance.now() - start;
      expect(getReviewedCount('profile-1')).toBe(500);
      // The bulk action SHALL not block the UI for more than 100ms (spec)
      expect(elapsedMs).toBeLessThan(100);
    });
  });

  describe('unmarkReviewed', () => {
    it('removes event from reviewed set', () => {
      const { markReviewed, unmarkReviewed, getReviewed } = useEventReviewStateStore.getState();
      markReviewed('profile-1', 'event-123');
      unmarkReviewed('profile-1', 'event-123');
      expect(getReviewed('profile-1')).toEqual([]);
    });

    it('does not error if unmarking unreviewed event', () => {
      const { unmarkReviewed, getReviewed } = useEventReviewStateStore.getState();
      unmarkReviewed('profile-1', 'event-123');
      expect(getReviewed('profile-1')).toEqual([]);
    });

    it('only removes the specified event', () => {
      const { markManyReviewed, unmarkReviewed, getReviewed } = useEventReviewStateStore.getState();
      markManyReviewed('profile-1', ['a', 'b', 'c']);
      unmarkReviewed('profile-1', 'b');
      expect(getReviewed('profile-1')).toEqual(['a', 'c']);
    });

    it('does not affect other profiles', () => {
      const { markReviewed, unmarkReviewed, getReviewed } = useEventReviewStateStore.getState();
      markReviewed('profile-1', 'e1');
      markReviewed('profile-2', 'e1');

      unmarkReviewed('profile-1', 'e1');

      expect(getReviewed('profile-1')).toEqual([]);
      expect(getReviewed('profile-2')).toEqual(['e1']);
    });
  });

  describe('toggleReviewed', () => {
    it('marks if not reviewed', () => {
      const { toggleReviewed, isReviewed } = useEventReviewStateStore.getState();
      toggleReviewed('profile-1', 'e1');
      expect(isReviewed('profile-1', 'e1')).toBe(true);
    });

    it('unmarks if already reviewed', () => {
      const { markReviewed, toggleReviewed, isReviewed } = useEventReviewStateStore.getState();
      markReviewed('profile-1', 'e1');
      toggleReviewed('profile-1', 'e1');
      expect(isReviewed('profile-1', 'e1')).toBe(false);
    });
  });

  describe('clearReviewed', () => {
    it('clears all reviewed events for a profile', () => {
      const { markManyReviewed, clearReviewed, getReviewed } = useEventReviewStateStore.getState();
      markManyReviewed('profile-1', ['a', 'b', 'c']);
      clearReviewed('profile-1');
      expect(getReviewed('profile-1')).toEqual([]);
    });

    it('does not affect other profiles', () => {
      const { markReviewed, clearReviewed, getReviewed } = useEventReviewStateStore.getState();
      markReviewed('profile-1', 'e1');
      markReviewed('profile-2', 'e2');

      clearReviewed('profile-1');

      expect(getReviewed('profile-1')).toEqual([]);
      expect(getReviewed('profile-2')).toEqual(['e2']);
    });

    it('does not error if clearing empty set', () => {
      const { clearReviewed, getReviewed } = useEventReviewStateStore.getState();
      clearReviewed('profile-1');
      expect(getReviewed('profile-1')).toEqual([]);
    });
  });

  describe('getReviewedCount', () => {
    it('returns 0 for profile with nothing reviewed', () => {
      const { getReviewedCount } = useEventReviewStateStore.getState();
      expect(getReviewedCount('profile-1')).toBe(0);
    });

    it('returns the size of the reviewed set', () => {
      const { markManyReviewed, getReviewedCount } = useEventReviewStateStore.getState();
      markManyReviewed('profile-1', ['a', 'b', 'c']);
      expect(getReviewedCount('profile-1')).toBe(3);
    });

    it('updates after unmark', () => {
      const { markManyReviewed, unmarkReviewed, getReviewedCount } = useEventReviewStateStore.getState();
      markManyReviewed('profile-1', ['a', 'b']);
      unmarkReviewed('profile-1', 'a');
      expect(getReviewedCount('profile-1')).toBe(1);
    });
  });
});
