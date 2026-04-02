import { type TimelineEvent, LAYOUT, getRowY, timeToX } from './timeline-layout';

export interface HitTestViewport {
  startMs: number;
  endMs: number;
  canvasWidth: number;
}

/**
 * Returns the first TimelineEvent whose rendered bar contains the point (x, y),
 * or null if no event is hit.
 */
export function hitTest(
  x: number,
  y: number,
  events: TimelineEvent[],
  monitorIds: string[],
  viewport: HitTestViewport,
): TimelineEvent | null {
  // Build monitorId -> row index map
  const rowMap = new Map<string, number>();
  for (let i = 0; i < monitorIds.length; i++) {
    rowMap.set(monitorIds[i], i);
  }

  for (const event of events) {
    const rowIndex = rowMap.get(event.monitorId);
    if (rowIndex === undefined) continue;

    // Vertical bounds
    const rowTop = getRowY(rowIndex);
    const barTop = rowTop + LAYOUT.eventPadding;
    const barBottom = rowTop + LAYOUT.rowHeight - LAYOUT.eventPadding;

    if (y < barTop || y > barBottom) continue;

    // Horizontal bounds
    let barLeft = timeToX(event.startMs, viewport.startMs, viewport.endMs, viewport.canvasWidth);
    let barRight = timeToX(event.endMs, viewport.startMs, viewport.endMs, viewport.canvasWidth);

    // Enforce minimum width
    const barWidth = barRight - barLeft;
    if (barWidth < LAYOUT.eventMinWidth) {
      const center = (barLeft + barRight) / 2;
      barLeft = center - LAYOUT.eventMinWidth / 2;
      barRight = center + LAYOUT.eventMinWidth / 2;
    }

    if (x >= barLeft && x <= barRight) {
      return event;
    }
  }

  return null;
}
