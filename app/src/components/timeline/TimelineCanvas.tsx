/**
 * TimelineCanvas — main canvas component that wires together
 * the viewport, gestures, rendering, and hit-testing.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useTimelineViewport } from './useTimelineViewport';
import { useTimelineGestures } from './useTimelineGestures';
import { renderTimeline, type MonitorRow, type RenderViewport } from './timeline-renderer';
import { hitTest } from './timeline-hit-test';
import { canvasHeight, LAYOUT, getMonitorColor, type TimelineEvent } from './timeline-layout';

interface TimelineCanvasProps {
  monitors: MonitorRow[];
  events: TimelineEvent[];
  startMs: number;
  endMs: number;
  onEventClick: (event: TimelineEvent) => void;
  onEventHover: (event: TimelineEvent | null, x: number, y: number) => void;
}

const NOW_REFRESH_INTERVAL = 30_000;

const TimelineCanvasInner = ({
  monitors,
  events,
  startMs,
  endMs,
  onEventClick,
  onEventHover,
}: TimelineCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [, setNowTick] = useState(0);

  const viewport = useTimelineViewport({ startMs, endMs });

  // Track filter range changes and sync viewport
  const prevRangeRef = useRef(`${startMs}-${endMs}`);
  useEffect(() => {
    const key = `${startMs}-${endMs}`;
    if (key !== prevRangeRef.current) {
      prevRangeRef.current = key;
      viewport.setRange(startMs, endMs);
    }
  }, [startMs, endMs, viewport]);

  // Observe container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Current time refresh
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), NOW_REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const monitorIds = monitors.map((m) => m.id);
  const height = canvasHeight(monitors.length);

  // Gesture callbacks
  const handlePan = useCallback(
    (deltaPx: number) => viewport.pan(deltaPx, containerWidth),
    [viewport, containerWidth],
  );

  const handleZoom = useCallback(
    (factor: number, anchorNormX: number) => viewport.zoom(factor, anchorNormX),
    [viewport],
  );

  const handleHover = useCallback(
    (x: number, y: number) => {
      const hit = hitTest(x, y, events, monitorIds, {
        startMs: viewport.startMs,
        endMs: viewport.endMs,
        canvasWidth: containerWidth,
      });
      setHoveredEventId(hit?.id ?? null);
      onEventHover(hit, x, y);
    },
    [events, monitorIds, viewport.startMs, viewport.endMs, containerWidth, onEventHover],
  );

  const handleHoverEnd = useCallback(() => {
    setHoveredEventId(null);
    onEventHover(null, 0, 0);
  }, [onEventHover]);

  const handleClick = useCallback(
    (x: number, y: number) => {
      const hit = hitTest(x, y, events, monitorIds, {
        startMs: viewport.startMs,
        endMs: viewport.endMs,
        canvasWidth: containerWidth,
      });
      if (hit) onEventClick(hit);
    },
    [events, monitorIds, viewport.startMs, viewport.endMs, containerWidth, onEventClick],
  );

  const canvasRef = useTimelineGestures({
    onPan: handlePan,
    onZoom: handleZoom,
    onHover: handleHover,
    onHoverEnd: handleHoverEnd,
    onClick: handleClick,
  });

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderVp: RenderViewport = {
      startMs: viewport.startMs,
      endMs: viewport.endMs,
      width: containerWidth,
      height,
      dpr,
    };

    renderTimeline(ctx, canvas, monitors, events, monitorIds, renderVp, hoveredEventId);
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg border border-border bg-background"
    >
      <canvas
        ref={canvasRef}
        className="w-full"
        data-testid="timeline-canvas"
      />
      {/* Monitor name sidebar with gradient fade to avoid obscuring events */}
      <div
        className="absolute left-0 z-10 pointer-events-none"
        style={{ top: LAYOUT.headerHeight }}
        data-testid="timeline-monitor-labels"
      >
        {monitors.map((monitor, index) => (
          <div
            key={monitor.id}
            className="flex items-center gap-1.5 pl-2 pr-4 pointer-events-auto"
            style={{
              height: LAYOUT.rowHeight,
              background: 'linear-gradient(to right, hsl(var(--background)) 70%, transparent)',
            }}
            title={monitor.name}
          >
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: getMonitorColor(index) }}
            />
            <span className="text-xs font-medium text-foreground/80 truncate max-w-28">
              {monitor.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TimelineCanvas = memo(TimelineCanvasInner);
