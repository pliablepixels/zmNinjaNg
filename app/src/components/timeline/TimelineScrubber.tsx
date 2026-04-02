/**
 * TimelineScrubber
 *
 * A draggable scrubber bar below the timeline canvas. Dragging the handle
 * moves a playhead through the timeline and shows thumbnail previews of
 * all events overlapping the playhead time.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { VideoOff } from 'lucide-react';
import { getEventImageUrl } from '../../api/events';
import { useCurrentProfile } from '../../hooks/useCurrentProfile';
import { useAuthStore } from '../../stores/auth';
import type { TimelineEvent } from './timeline-layout';
import type { MonitorRow } from './timeline-renderer';

interface TimelineScrubberProps {
  events: TimelineEvent[];
  monitors: MonitorRow[];
  viewStartMs: number;
  viewEndMs: number;
  onPlayheadChange: (timeMs: number | null) => void;
  /** Where to show thumbnails relative to the scrubber bar. */
  thumbnailPosition?: 'above' | 'below';
}

/**
 * Find events near a timestamp. Tolerance scales with zoom level so that
 * the scrubber "snaps" to events even when bars are visually thin.
 * At minimum 30s tolerance, plus 1% of the visible range.
 */
function eventsNearTime(
  events: TimelineEvent[],
  timeMs: number,
  viewDurationMs: number,
): TimelineEvent[] {
  // 1% of visible range or 30s, whichever is larger
  const tolerance = Math.max(30_000, viewDurationMs * 0.01);
  return events.filter(
    (ev) => ev.startMs <= timeMs + tolerance && ev.endMs >= timeMs - tolerance,
  );
}

function ScrubberThumbnail({
  event,
  monitorName,
}: {
  event: TimelineEvent;
  monitorName: string;
}) {
  const navigate = useNavigate();
  const { currentProfile } = useCurrentProfile();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [failed, setFailed] = useState(false);

  const portalUrl = currentProfile?.portalUrl ?? '';
  const imageUrl = getEventImageUrl(portalUrl, event.id, 'alarm', {
    token: accessToken ?? undefined,
  });

  return (
    <button
      type="button"
      className="relative shrink-0 w-24 h-16 rounded overflow-hidden bg-black border border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/events/${event.id}`)}
      title={`${monitorName} · #${event.id}`}
      data-testid={`scrubber-thumb-${event.id}`}
    >
      {failed ? (
        <div className="w-full h-full flex items-center justify-center bg-muted/30">
          <VideoOff className="h-4 w-4 text-muted-foreground/40" />
        </div>
      ) : (
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
      <span className="absolute bottom-0 left-0 right-0 text-[8px] text-white bg-black/70 px-1 truncate">
        {monitorName}
      </span>
    </button>
  );
}

function TimelineScrubberComponent({
  events,
  monitors,
  viewStartMs,
  viewEndMs,
  onPlayheadChange,
  thumbnailPosition = 'above',
}: TimelineScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [handleNorm, setHandleNorm] = useState(0.5); // 0-1 position
  const [activeEvents, setActiveEvents] = useState<TimelineEvent[]>([]);

  const monitorNameMap = new Map(monitors.map((m) => [m.id, m.name]));

  const normToTime = useCallback(
    (norm: number) => viewStartMs + norm * (viewEndMs - viewStartMs),
    [viewStartMs, viewEndMs],
  );

  // Debounce event lookup to reduce server load from thumbnail fetches
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const updateScrub = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const norm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setHandleNorm(norm);
      const timeMs = normToTime(norm);
      // Playhead line updates immediately
      onPlayheadChange(timeMs);
      // Debounce thumbnail lookup (150ms)
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setActiveEvents(eventsNearTime(events, timeMs, viewEndMs - viewStartMs));
      }, 150);
    },
    [events, normToTime, onPlayheadChange, viewStartMs, viewEndMs],
  );

  // Mouse handlers
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setScrubbing(true);
      updateScrub(e.clientX);
    },
    [updateScrub],
  );

  useEffect(() => {
    if (!scrubbing) return;

    const onMouseMove = (e: MouseEvent) => updateScrub(e.clientX);
    const onMouseUp = () => setScrubbing(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [scrubbing, updateScrub]);

  // Touch handlers
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setScrubbing(true);
      updateScrub(e.touches[0].clientX);
    },
    [updateScrub],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (scrubbing) updateScrub(e.touches[0].clientX);
    },
    [scrubbing, updateScrub],
  );

  const onTouchEnd = useCallback(() => {
    setScrubbing(false);
  }, []);

  // Dismiss thumbnails when tapping outside
  const dismissThumbnails = useCallback(() => {
    setActiveEvents([]);
    onPlayheadChange(null);
  }, [onPlayheadChange]);

  const playheadTime = normToTime(handleNorm);

  const below = thumbnailPosition === 'below';

  const thumbnailStrip = activeEvents.length > 0 && (
    <div
      className={`absolute ${below ? 'top-full mt-2' : 'bottom-full mb-2'} pointer-events-auto z-20`}
      style={{
        left: `${handleNorm * 100}%`,
        transform: 'translateX(-50%)',
        maxWidth: '90%',
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="flex gap-1.5 p-2 rounded-lg bg-popover/95 border border-border shadow-xl backdrop-blur-sm overflow-x-auto"
        style={{ touchAction: 'pan-x' }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {activeEvents.map((ev) => (
          <ScrubberThumbnail
            key={ev.id}
            event={ev}
            monitorName={monitorNameMap.get(ev.monitorId) ?? ''}
          />
        ))}
      </div>
    </div>
  );

  const timeLabel = (scrubbing || activeEvents.length > 0) && (
    <div
      className={`absolute ${below ? 'top-full mt-1' : 'bottom-full mb-1'} text-[10px] text-muted-foreground bg-popover border border-border rounded px-1.5 py-0.5 -translate-x-1/2 pointer-events-none z-10`}
      style={{ left: `${handleNorm * 100}%` }}
    >
      {format(new Date(playheadTime), 'MMM d, HH:mm:ss')}
    </div>
  );

  return (
    <div className="relative" data-testid="timeline-scrubber">
      {/* Backdrop to dismiss thumbnails when tapping outside */}
      {!scrubbing && activeEvents.length > 0 && (
        <div className="fixed inset-0 z-10" onClick={dismissThumbnails} />
      )}

      {/* Time label + thumbnails — position depends on prop */}
      {timeLabel}
      {thumbnailStrip}

      {/* Scrubber track — taller touch target */}
      <div
        ref={trackRef}
        className="relative h-8 cursor-pointer select-none touch-none"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        data-testid="scrubber-track"
      >
        {/* Track background */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-border/50" />

        {/* Event density markers */}
        {events.map((ev) => {
          const left = ((ev.startMs - viewStartMs) / (viewEndMs - viewStartMs)) * 100;
          const right = ((ev.endMs - viewStartMs) / (viewEndMs - viewStartMs)) * 100;
          const width = Math.max(right - left, 0.3);
          if (left > 100 || right < 0) return null;
          return (
            <div
              key={ev.id}
              className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-primary/30"
              style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(width, 100 - left)}%` }}
            />
          );
        })}

        {/* Draggable handle — bigger for easier grabbing */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-primary border-2 border-background shadow-lg transition-transform"
          style={{
            left: `${handleNorm * 100}%`,
            transform: `translate(-50%, -50%) scale(${scrubbing ? 1.25 : 1})`,
          }}
        />
      </div>
    </div>
  );
}

export const TimelineScrubber = memo(TimelineScrubberComponent);
