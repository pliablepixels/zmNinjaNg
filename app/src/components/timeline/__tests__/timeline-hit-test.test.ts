import { describe, it, expect } from 'vitest';
import { hitTest } from '../timeline-hit-test';
import { type TimelineEvent, LAYOUT } from '../timeline-layout';

const makeEvent = (
  id: string,
  monitorId: string,
  startMs: number,
  endMs: number,
): TimelineEvent => ({
  id,
  monitorId,
  startMs,
  endMs,
  cause: 'Motion',
  alarmRatio: 0.5,
  notes: '',
});

describe('hitTest', () => {
  const viewport = { startMs: 0, endMs: 1000, canvasWidth: 1000 };
  const monitorIds = ['mon-1', 'mon-2'];

  it('returns the event when click is within its bar', () => {
    const event = makeEvent('e1', 'mon-1', 200, 400);
    const events = [event];

    // Click in the middle of the event bar, row 0
    const x = 300; // midpoint of 200..400 mapped 1:1
    const y = LAYOUT.headerHeight + LAYOUT.eventPadding + 5; // inside row 0 bar

    const result = hitTest(x, y, events, monitorIds, viewport);
    expect(result).toEqual(event);
  });

  it('returns null when click misses all events', () => {
    const event = makeEvent('e1', 'mon-1', 200, 400);
    const events = [event];

    // Click outside the event range (x=600, event ends at 400)
    const x = 600;
    const y = LAYOUT.headerHeight + LAYOUT.eventPadding + 5;

    const result = hitTest(x, y, events, monitorIds, viewport);
    expect(result).toBeNull();
  });

  it('returns null when click is in wrong row', () => {
    const event = makeEvent('e1', 'mon-1', 200, 400);
    const events = [event];

    // Click in row 1 area but event is on row 0
    const x = 300;
    const y = LAYOUT.headerHeight + LAYOUT.rowHeight + LAYOUT.eventPadding + 5;

    const result = hitTest(x, y, events, monitorIds, viewport);
    expect(result).toBeNull();
  });

  it('returns correct event on the second row', () => {
    const e1 = makeEvent('e1', 'mon-1', 100, 300);
    const e2 = makeEvent('e2', 'mon-2', 500, 700);
    const events = [e1, e2];

    // Click inside e2's bar, which is on row 1 (mon-2)
    const x = 600;
    const y = LAYOUT.headerHeight + LAYOUT.rowHeight + LAYOUT.eventPadding + 5;

    const result = hitTest(x, y, events, monitorIds, viewport);
    expect(result).toEqual(e2);
  });

  it('enforces eventMinWidth for narrow events', () => {
    // Event is only 1ms wide, which at 1:1 scale is 1px — less than eventMinWidth (4)
    const event = makeEvent('e1', 'mon-1', 500, 501);
    const events = [event];

    // Click at x=501, which is outside the 1px bar but within minWidth expansion
    const x = 501;
    const y = LAYOUT.headerHeight + LAYOUT.eventPadding + 5;

    const result = hitTest(x, y, events, monitorIds, viewport);
    expect(result).toEqual(event);
  });
});
