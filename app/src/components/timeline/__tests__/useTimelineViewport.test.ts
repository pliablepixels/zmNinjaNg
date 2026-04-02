import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimelineViewport } from '../useTimelineViewport';

const HOUR = 3_600_000;
const DAY = 86_400_000;
const MIN = 60_000;

describe('useTimelineViewport', () => {
  const defaultStart = Date.now() - 4 * HOUR;
  const defaultEnd = Date.now();

  it('initializes with the given range', () => {
    const { result } = renderHook(() =>
      useTimelineViewport({ startMs: defaultStart, endMs: defaultEnd }),
    );
    expect(result.current.startMs).toBe(defaultStart);
    expect(result.current.endMs).toBe(defaultEnd);
    expect(result.current.durationMs).toBe(defaultEnd - defaultStart);
  });

  describe('pan', () => {
    it('shifts the range proportionally to pixel drag', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({ startMs: 0, endMs: 1000 }),
      );
      // drag 100px on a 1000px canvas = 10% of duration = 100ms
      act(() => result.current.pan(100, 1000));

      expect(result.current.startMs).toBe(100);
      expect(result.current.endMs).toBe(1100);
      expect(result.current.durationMs).toBe(1000);
    });

    it('negative deltaPx pans left', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({ startMs: 500, endMs: 1500 }),
      );
      act(() => result.current.pan(-250, 1000));

      expect(result.current.startMs).toBe(250);
      expect(result.current.endMs).toBe(1250);
    });
  });

  describe('zoom', () => {
    it('zooms in centered on anchor', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({ startMs: 0, endMs: 4 * HOUR }),
      );
      // factor 0.5 = zoom in 2x, anchor at center (0.5)
      act(() => result.current.zoom(0.5, 0.5));

      expect(result.current.durationMs).toBe(2 * HOUR);
      expect(result.current.startMs).toBe(1 * HOUR);
      expect(result.current.endMs).toBe(3 * HOUR);
    });

    it('zooms in anchored at left edge', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({ startMs: 0, endMs: 4 * HOUR }),
      );
      act(() => result.current.zoom(0.5, 0));

      expect(result.current.durationMs).toBe(2 * HOUR);
      expect(result.current.startMs).toBe(0);
      expect(result.current.endMs).toBe(2 * HOUR);
    });

    it('zooms in anchored at right edge', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({ startMs: 0, endMs: 4 * HOUR }),
      );
      act(() => result.current.zoom(0.5, 1));

      expect(result.current.durationMs).toBe(2 * HOUR);
      expect(result.current.startMs).toBe(2 * HOUR);
      expect(result.current.endMs).toBe(4 * HOUR);
    });

    it('zooms out', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({ startMs: HOUR, endMs: 3 * HOUR }),
      );
      // factor 2 = zoom out 2x, anchor at center
      act(() => result.current.zoom(2, 0.5));

      expect(result.current.durationMs).toBe(4 * HOUR);
      expect(result.current.startMs).toBe(0);
      expect(result.current.endMs).toBe(4 * HOUR);
    });
  });

  describe('clamping', () => {
    it('clamps to minimum duration (default 1 minute)', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({ startMs: 0, endMs: 2 * MIN }),
      );
      // try to zoom in way past min
      act(() => result.current.zoom(0.01, 0.5));

      expect(result.current.durationMs).toBe(MIN);
    });

    it('clamps to maximum duration (default 90 days)', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({ startMs: 0, endMs: 30 * DAY }),
      );
      // try to zoom out way past max
      act(() => result.current.zoom(100, 0.5));

      expect(result.current.durationMs).toBe(90 * DAY);
    });

    it('respects custom min/max duration', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({
          startMs: 0,
          endMs: 10_000,
          minDurationMs: 5_000,
          maxDurationMs: 20_000,
        }),
      );

      // zoom in past custom min
      act(() => result.current.zoom(0.01, 0.5));
      expect(result.current.durationMs).toBe(5_000);

      // zoom out past custom max
      act(() => result.current.zoom(100, 0.5));
      expect(result.current.durationMs).toBe(20_000);
    });
  });

  describe('setRange', () => {
    it('replaces the viewport range', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({ startMs: 0, endMs: 1000 }),
      );
      act(() => result.current.setRange(5000, 10000));

      expect(result.current.startMs).toBe(5000);
      expect(result.current.endMs).toBe(10000);
      expect(result.current.durationMs).toBe(5000);
    });
  });

  describe('conversion utilities', () => {
    it('timeToNorm converts time to normalized position', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({ startMs: 100, endMs: 200 }),
      );
      expect(result.current.timeToNorm(100)).toBe(0);
      expect(result.current.timeToNorm(150)).toBe(0.5);
      expect(result.current.timeToNorm(200)).toBe(1);
    });

    it('normToTime converts normalized position to time', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({ startMs: 100, endMs: 200 }),
      );
      expect(result.current.normToTime(0)).toBe(100);
      expect(result.current.normToTime(0.5)).toBe(150);
      expect(result.current.normToTime(1)).toBe(200);
    });

    it('round-trips correctly', () => {
      const { result } = renderHook(() =>
        useTimelineViewport({ startMs: 1000, endMs: 5000 }),
      );
      const time = 3000;
      const norm = result.current.timeToNorm(time);
      expect(result.current.normToTime(norm)).toBe(time);
    });
  });
});
