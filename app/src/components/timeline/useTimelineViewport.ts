/**
 * Timeline viewport state hook.
 *
 * Manages a visible time range (startMs, endMs) with pan, zoom,
 * and conversion utilities for the Canvas-based timeline.
 */

import { useState, useCallback, useRef } from 'react';

const ONE_MINUTE = 60_000;
const NINETY_DAYS = 90 * 86_400_000;

interface UseTimelineViewportOptions {
  startMs: number;
  endMs: number;
  minDurationMs?: number;
  maxDurationMs?: number;
}

interface TimelineViewport {
  startMs: number;
  endMs: number;
  durationMs: number;
  pan: (deltaPx: number, canvasWidthPx: number) => void;
  zoom: (factor: number, anchorNorm: number) => void;
  setRange: (startMs: number, endMs: number) => void;
  timeToNorm: (timeMs: number) => number;
  normToTime: (norm: number) => number;
}

export function useTimelineViewport({
  startMs: initialStart,
  endMs: initialEnd,
  minDurationMs = ONE_MINUTE,
  maxDurationMs = NINETY_DAYS,
}: UseTimelineViewportOptions): TimelineViewport {
  const [range, setRangeState] = useState({ startMs: initialStart, endMs: initialEnd });
  const limitsRef = useRef({ minDurationMs, maxDurationMs });
  limitsRef.current = { minDurationMs, maxDurationMs };

  const clampDuration = useCallback(
    (newStart: number, newEnd: number): { startMs: number; endMs: number } => {
      const { minDurationMs: minD, maxDurationMs: maxD } = limitsRef.current;
      let duration = newEnd - newStart;
      const center = (newStart + newEnd) / 2;

      if (duration < minD) {
        duration = minD;
        return { startMs: center - duration / 2, endMs: center + duration / 2 };
      }
      if (duration > maxD) {
        duration = maxD;
        return { startMs: center - duration / 2, endMs: center + duration / 2 };
      }
      return { startMs: newStart, endMs: newEnd };
    },
    [],
  );

  const pan = useCallback(
    (deltaPx: number, canvasWidthPx: number) => {
      setRangeState((prev) => {
        const duration = prev.endMs - prev.startMs;
        const deltaMs = (deltaPx / canvasWidthPx) * duration;
        return { startMs: prev.startMs + deltaMs, endMs: prev.endMs + deltaMs };
      });
    },
    [],
  );

  const zoom = useCallback(
    (factor: number, anchorNorm: number) => {
      setRangeState((prev) => {
        const duration = prev.endMs - prev.startMs;
        const anchorMs = prev.startMs + anchorNorm * duration;
        const newDuration = duration * factor;
        const newStart = anchorMs - anchorNorm * newDuration;
        const newEnd = newStart + newDuration;
        return clampDuration(newStart, newEnd);
      });
    },
    [clampDuration],
  );

  const setRange = useCallback(
    (startMs: number, endMs: number) => {
      setRangeState({ startMs, endMs });
    },
    [],
  );

  const durationMs = range.endMs - range.startMs;

  const timeToNorm = useCallback(
    (timeMs: number) => (timeMs - range.startMs) / durationMs,
    [range.startMs, durationMs],
  );

  const normToTime = useCallback(
    (norm: number) => range.startMs + norm * durationMs,
    [range.startMs, durationMs],
  );

  return {
    startMs: range.startMs,
    endMs: range.endMs,
    durationMs,
    pan,
    zoom,
    setRange,
    timeToNorm,
    normToTime,
  };
}
