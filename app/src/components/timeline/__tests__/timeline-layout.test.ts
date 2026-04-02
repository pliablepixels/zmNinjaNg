import { describe, it, expect } from 'vitest';
import {
  LAYOUT,
  MONITOR_COLORS,
  getMonitorColor,
  getRowY,
  timeToX,
  xToTime,
  canvasHeight,
} from '../timeline-layout';

describe('LAYOUT constants', () => {
  it('has expected default values', () => {
    expect(LAYOUT.headerHeight).toBe(40);
    expect(LAYOUT.rowHeight).toBe(48);
    expect(LAYOUT.eventPadding).toBe(6);
    expect(LAYOUT.eventMinWidth).toBe(4);
    expect(LAYOUT.labelWidth).toBe(120);
    expect(LAYOUT.minimapHeight).toBe(24);
    expect(LAYOUT.fontSize).toBe(12);
    expect(LAYOUT.fontFamily).toBeDefined();
  });

  it('has a 10-color palette', () => {
    expect(MONITOR_COLORS).toHaveLength(10);
  });
});

describe('getMonitorColor', () => {
  it('returns first color for index 0', () => {
    expect(getMonitorColor(0)).toBe(MONITOR_COLORS[0]);
  });

  it('returns correct color for index within range', () => {
    expect(getMonitorColor(3)).toBe(MONITOR_COLORS[3]);
  });

  it('wraps around when index exceeds palette length', () => {
    expect(getMonitorColor(10)).toBe(MONITOR_COLORS[0]);
    expect(getMonitorColor(13)).toBe(MONITOR_COLORS[3]);
    expect(getMonitorColor(25)).toBe(MONITOR_COLORS[5]);
  });
});

describe('getRowY', () => {
  it('returns headerHeight for row 0', () => {
    expect(getRowY(0)).toBe(LAYOUT.headerHeight);
  });

  it('returns correct Y for row 1', () => {
    expect(getRowY(1)).toBe(LAYOUT.headerHeight + LAYOUT.rowHeight);
  });

  it('returns correct Y for row 2', () => {
    expect(getRowY(2)).toBe(LAYOUT.headerHeight + 2 * LAYOUT.rowHeight);
  });
});

describe('timeToX', () => {
  const start = 1000;
  const end = 2000;
  const width = 500;

  it('returns 0 for viewStartMs', () => {
    expect(timeToX(start, start, end, width)).toBe(0);
  });

  it('returns canvasWidth for viewEndMs', () => {
    expect(timeToX(end, start, end, width)).toBe(width);
  });

  it('returns midpoint for middle timestamp', () => {
    expect(timeToX(1500, start, end, width)).toBe(250);
  });

  it('returns negative for time before view start', () => {
    expect(timeToX(500, start, end, width)).toBe(-250);
  });
});

describe('xToTime', () => {
  const start = 1000;
  const end = 2000;
  const width = 500;

  it('returns viewStartMs for x=0', () => {
    expect(xToTime(0, start, end, width)).toBe(start);
  });

  it('returns viewEndMs for x=canvasWidth', () => {
    expect(xToTime(width, start, end, width)).toBe(end);
  });

  it('returns midpoint time for middle x', () => {
    expect(xToTime(250, start, end, width)).toBe(1500);
  });

  it('is inverse of timeToX', () => {
    const time = 1337;
    const x = timeToX(time, start, end, width);
    expect(xToTime(x, start, end, width)).toBeCloseTo(time);
  });
});

describe('canvasHeight', () => {
  it('returns headerHeight for 0 rows', () => {
    expect(canvasHeight(0)).toBe(LAYOUT.headerHeight);
  });

  it('returns correct height for 3 rows', () => {
    expect(canvasHeight(3)).toBe(LAYOUT.headerHeight + 3 * LAYOUT.rowHeight);
  });
});
