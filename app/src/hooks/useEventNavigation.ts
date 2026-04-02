/**
 * Hook for event navigation in detail view
 *
 * Fetches adjacent events on demand using server-side filters
 * passed through router state. Provides prev/next callbacks
 * and slide animation state.
 */

import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAdjacentEvent, type EventFilters } from '../api/events';
import { log, LogLevel } from '../lib/logger';

interface UseEventNavigationOptions {
  currentEventId: string | undefined;
  currentStartDateTime: string | undefined;
}

interface UseEventNavigationReturn {
  goToPrevEvent: () => void;
  goToNextEvent: () => void;
  isLoadingPrev: boolean;
  isLoadingNext: boolean;
  slideDirection: 'left' | 'right' | null;
  hasFilters: boolean;
}

export function useEventNavigation({
  currentStartDateTime,
}: UseEventNavigationOptions): UseEventNavigationReturn {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoadingPrev, setIsLoadingPrev] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

  // Extract filters from navigation state (passed from Events page)
  const eventFilters = (location.state?.eventFilters as EventFilters) || undefined;
  const hasFilters = !!eventFilters;

  // Preserve the original referrer (e.g., '/timeline' or '/events') across prev/next navigation
  const originalFrom = (location.state?.from as string) || '/events';

  const navigateToEvent = useCallback(
    (eventId: string, direction: 'left' | 'right') => {
      setSlideDirection(direction);
      navigate(`/events/${eventId}`, {
        state: {
          from: originalFrom,
          eventFilters,
          slideDirection: direction,
        },
        replace: true,
      });
    },
    [navigate, eventFilters, originalFrom]
  );

  const goToPrevEvent = useCallback(async () => {
    if (!currentStartDateTime || isLoadingPrev) return;
    setIsLoadingPrev(true);
    try {
      const prev = await getAdjacentEvent('prev', currentStartDateTime, eventFilters);
      if (prev) {
        navigateToEvent(prev.Event.Id, 'right');
      }
    } catch (err) {
      log.eventDetail('Failed to fetch previous event', LogLevel.ERROR, { error: err });
    } finally {
      setIsLoadingPrev(false);
    }
  }, [currentStartDateTime, eventFilters, isLoadingPrev, navigateToEvent]);

  const goToNextEvent = useCallback(async () => {
    if (!currentStartDateTime || isLoadingNext) return;
    setIsLoadingNext(true);
    try {
      const next = await getAdjacentEvent('next', currentStartDateTime, eventFilters);
      if (next) {
        navigateToEvent(next.Event.Id, 'left');
      }
    } catch (err) {
      log.eventDetail('Failed to fetch next event', LogLevel.ERROR, { error: err });
    } finally {
      setIsLoadingNext(false);
    }
  }, [currentStartDateTime, eventFilters, isLoadingNext, navigateToEvent]);

  return {
    goToPrevEvent,
    goToNextEvent,
    isLoadingPrev,
    isLoadingNext,
    slideDirection,
    hasFilters,
  };
}
