import {
  format,
  startOfHour,
  startOfDay,
  addMinutes,
  addHours,
  addDays,
} from 'date-fns';

import {
  LAYOUT,
  getRowY,
  getMonitorColor,
  timeToX,
  type TimelineEvent,
} from './timeline-layout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderViewport {
  startMs: number;
  endMs: number;
  width: number; // CSS pixels
  height: number;
  dpr: number; // devicePixelRatio — all drawing multiplied by dpr
}

export interface MonitorRow {
  id: string;
  name: string;
}

export interface TickMark {
  timeMs: number;
  label: string;
  isMajor: boolean;
}

interface ThemeColors {
  bg: string;
  fg: string;
  muted: string;
  mutedFg: string;
  border: string;
  accent: string;
  destructive: string;
}

// ---------------------------------------------------------------------------
// Theme colors
// ---------------------------------------------------------------------------

const DARK_DEFAULTS: ThemeColors = {
  bg: 'hsl(222.2 84% 4.9%)',
  fg: 'hsl(210 40% 98%)',
  muted: 'hsl(217.2 32.6% 17.5%)',
  mutedFg: 'hsl(215 20.2% 65.1%)',
  border: 'hsl(217.2 32.6% 17.5%)',
  accent: 'hsl(217.2 32.6% 17.5%)',
  destructive: 'hsl(0 62.8% 30.6%)',
};

function readCssVar(style: CSSStyleDeclaration, name: string): string | null {
  const v = style.getPropertyValue(name).trim();
  return v || null;
}

export function getThemeColors(el: HTMLElement): ThemeColors {
  const style = getComputedStyle(el);
  const wrap = (name: string, fallback: string): string => {
    const v = readCssVar(style, name);
    return v ? `hsl(${v})` : fallback;
  };
  return {
    bg: wrap('--background', DARK_DEFAULTS.bg),
    fg: wrap('--foreground', DARK_DEFAULTS.fg),
    muted: wrap('--muted', DARK_DEFAULTS.muted),
    mutedFg: wrap('--muted-foreground', DARK_DEFAULTS.mutedFg),
    border: wrap('--border', DARK_DEFAULTS.border),
    accent: wrap('--accent', DARK_DEFAULTS.accent),
    destructive: wrap('--destructive', DARK_DEFAULTS.destructive),
  };
}

// ---------------------------------------------------------------------------
// Tick computation
// ---------------------------------------------------------------------------

interface TickInterval {
  maxRange: number;
  step: (d: Date) => Date;
  start: (d: Date) => Date;
  labelFn: (d: Date) => string;
  majorTest: (d: Date) => boolean;
  majorLabel?: (d: Date) => string;
}

const ONE_MIN = 60_000;
const ONE_HOUR = 60 * ONE_MIN;
const ONE_DAY = 24 * ONE_HOUR;

const TICK_INTERVALS: TickInterval[] = [
  {
    maxRange: ONE_HOUR,
    step: (d) => addMinutes(d, 5),
    start: (d) => startOfHour(d),
    labelFn: (d) => format(d, 'HH:mm'),
    majorTest: (d) => d.getMinutes() === 0,
  },
  {
    maxRange: 6 * ONE_HOUR,
    step: (d) => addMinutes(d, 30),
    start: (d) => startOfHour(d),
    labelFn: (d) => format(d, 'HH:mm'),
    majorTest: (d) => d.getMinutes() === 0,
  },
  {
    maxRange: 48 * ONE_HOUR,
    step: (d) => addHours(d, 1),
    start: (d) => startOfDay(d),
    labelFn: (d) => format(d, 'HH:mm'),
    majorTest: (d) => d.getHours() === 0,
    majorLabel: (d) => format(d, 'EEE MMM d'),
  },
  {
    maxRange: 14 * ONE_DAY,
    step: (d) => addHours(d, 6),
    start: (d) => startOfDay(d),
    labelFn: (d) => format(d, 'HH:mm'),
    majorTest: (d) => d.getHours() === 0,
    majorLabel: (d) => format(d, 'EEE MMM d'),
  },
  {
    maxRange: Infinity,
    step: (d) => addDays(d, 1),
    start: (d) => startOfDay(d),
    labelFn: (d) => format(d, 'MMM d'),
    majorTest: (d) => d.getDay() === 1, // Monday
    majorLabel: (d) => format(d, 'EEE MMM d'),
  },
];

const MIN_TICK_SPACING_PX = 80;

export function computeTicks(
  startMs: number,
  endMs: number,
  widthPx: number,
): TickMark[] {
  const range = endMs - startMs;
  const interval = TICK_INTERVALS.find((i) => range <= i.maxRange)!;

  const maxTicks = Math.max(1, Math.floor(widthPx / MIN_TICK_SPACING_PX));
  const ticks: TickMark[] = [];

  let cursor = interval.start(new Date(startMs));
  // Walk from the aligned start until we pass the end
  while (cursor.getTime() <= endMs && ticks.length < maxTicks * 2) {
    const t = cursor.getTime();
    if (t >= startMs) {
      const isMajor = interval.majorTest(cursor);
      const label =
        isMajor && interval.majorLabel
          ? interval.majorLabel(cursor)
          : interval.labelFn(cursor);
      ticks.push({ timeMs: t, label, isMajor });
    }
    cursor = interval.step(cursor);
  }

  // If we have too many ticks, thin them keeping majors
  if (ticks.length > maxTicks) {
    const step = Math.ceil(ticks.length / maxTicks);
    const thinned: TickMark[] = [];
    for (let i = 0; i < ticks.length; i++) {
      if (ticks[i].isMajor || i % step === 0) {
        thinned.push(ticks[i]);
      }
    }
    return thinned;
  }

  return ticks;
}

// ---------------------------------------------------------------------------
// Drawing: time axis
// ---------------------------------------------------------------------------

export function drawTimeAxis(
  ctx: CanvasRenderingContext2D,
  viewport: RenderViewport,
  colors: ThemeColors,
): void {
  const { dpr, startMs, endMs, width, height } = viewport;
  const headerH = LAYOUT.headerHeight * dpr;
  const ticks = computeTicks(startMs, endMs, width);

  ctx.save();

  for (const tick of ticks) {
    const x = timeToX(tick.timeMs, startMs, endMs, width) * dpr;
    // Grid line
    ctx.strokeStyle = tick.isMajor
      ? colors.border
      : withAlpha(colors.border, 0.4);
    ctx.lineWidth = tick.isMajor ? 1 * dpr : 0.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(x, headerH);
    ctx.lineTo(x, height * dpr);
    ctx.stroke();

    // Label
    ctx.fillStyle = tick.isMajor ? colors.fg : colors.mutedFg;
    ctx.font = `${tick.isMajor ? 'bold ' : ''}${LAYOUT.fontSize * dpr}px ${LAYOUT.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tick.label, x, headerH / 2);
  }

  // Header bottom border
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.moveTo(0, headerH);
  ctx.lineTo(width * dpr, headerH);
  ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Drawing: swimlanes
// ---------------------------------------------------------------------------

export function drawSwimlanes(
  ctx: CanvasRenderingContext2D,
  monitors: MonitorRow[],
  viewport: RenderViewport,
  colors: ThemeColors,
): void {
  const { dpr, width } = viewport;
  const rowH = LAYOUT.rowHeight * dpr;

  ctx.save();

  for (let i = 0; i < monitors.length; i++) {
    const y = getRowY(i) * dpr;

    // Alternating background
    if (i % 2 === 1) {
      ctx.fillStyle = withAlpha(colors.muted, 0.15);
      ctx.fillRect(0, y, width * dpr, rowH);
    }

    // Row bottom border
    ctx.strokeStyle = withAlpha(colors.border, 0.3);
    ctx.lineWidth = 0.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, y + rowH);
    ctx.lineTo(width * dpr, y + rowH);
    ctx.stroke();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Drawing: events
// ---------------------------------------------------------------------------

/**
 * Convert a color string to a semi-transparent version.
 * Handles both "#hex" and "hsl(...)" formats.
 */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const hex = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0');
    // Strip existing alpha suffix if present (8-char hex)
    const base = color.length === 9 ? color.slice(0, 7) : color;
    return `${base}${hex}`;
  }
  // hsl(H S% L%) → hsla(H, S%, L%, alpha) for canvas compatibility
  const inner = color.replace(/^hsl\(/, '').replace(/\)$/, '');
  return `hsla(${inner.replace(/\s+/g, ', ')}, ${alpha})`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

export function drawEvents(
  ctx: CanvasRenderingContext2D,
  events: TimelineEvent[],
  monitorIds: string[],
  viewport: RenderViewport,
  hoveredEventId: string | null,
): void {
  const { dpr, startMs, endMs, width } = viewport;
  const rowH = LAYOUT.rowHeight * dpr;
  const pad = LAYOUT.eventPadding * dpr;
  const minW = LAYOUT.eventMinWidth * dpr;
  const cornerRadius = 3 * dpr;

  ctx.save();

  const monitorIndexMap = new Map<string, number>();
  for (let i = 0; i < monitorIds.length; i++) {
    monitorIndexMap.set(monitorIds[i], i);
  }

  for (const event of events) {
    // Skip events fully outside viewport
    if (event.endMs < startMs || event.startMs > endMs) continue;

    const rowIdx = monitorIndexMap.get(event.monitorId);
    if (rowIdx === undefined) continue;

    const x1 = Math.max(
      0,
      timeToX(event.startMs, startMs, endMs, width) * dpr,
    );
    const x2 = Math.min(
      width * dpr,
      timeToX(event.endMs, startMs, endMs, width) * dpr,
    );
    let barW = x2 - x1;
    if (barW < minW) barW = minW;

    const rowTop = getRowY(rowIdx) * dpr;
    const barY = rowTop + pad;
    const barH = rowH - pad * 2;

    const color = getMonitorColor(rowIdx);
    const isHovered = event.id === hoveredEventId;
    const isHighPriority = event.alarmRatio > 0.5;

    // Hovered: shadow
    if (isHovered) {
      ctx.shadowColor = 'rgba(255,255,255,0.4)';
      ctx.shadowBlur = 8 * dpr;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // High priority: amber glow
    if (isHighPriority && !isHovered) {
      ctx.shadowColor = 'rgba(245,158,11,0.5)';
      ctx.shadowBlur = 6 * dpr;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Bar fill
    drawRoundedRect(ctx, x1, barY, barW, barH, cornerRadius);
    ctx.fillStyle = isHovered ? color : withAlpha(color, 0.7);
    ctx.fill();

    // High priority: amber border
    if (isHighPriority) {
      drawRoundedRect(ctx, x1, barY, barW, barH, cornerRadius);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
    }

    // Hovered: white outline
    if (isHovered) {
      drawRoundedRect(ctx, x1, barY, barW, barH, cornerRadius);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Cause label if bar is wide enough
    const labelMinWidth = 40 * dpr;
    if (barW > labelMinWidth && event.cause) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${(LAYOUT.fontSize - 1) * dpr}px ${LAYOUT.fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const maxTextW = barW - 6 * dpr;
      const text = truncateText(ctx, event.cause, maxTextW);
      ctx.fillText(text, x1 + 3 * dpr, barY + barH / 2);
    }
  }

  ctx.restore();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1) {
    truncated = truncated.slice(0, -1);
    if (ctx.measureText(truncated + '…').width <= maxWidth) {
      return truncated + '…';
    }
  }
  return '…';
}

// ---------------------------------------------------------------------------
// Drawing: current time marker
// ---------------------------------------------------------------------------

export function drawCurrentTime(
  ctx: CanvasRenderingContext2D,
  viewport: RenderViewport,
  colors: ThemeColors,
): void {
  const { dpr, startMs, endMs, width, height } = viewport;
  const now = Date.now();
  if (now < startMs || now > endMs) return;

  const x = timeToX(now, startMs, endMs, width) * dpr;
  const headerH = LAYOUT.headerHeight * dpr;

  ctx.save();

  // Dashed red line
  ctx.strokeStyle = colors.destructive;
  ctx.lineWidth = 1.5 * dpr;
  ctx.setLineDash([4 * dpr, 4 * dpr]);
  ctx.beginPath();
  ctx.moveTo(x, headerH);
  ctx.lineTo(x, height * dpr);
  ctx.stroke();
  ctx.setLineDash([]);

  // "NOW" pill at top
  const pillW = 30 * dpr;
  const pillH = 16 * dpr;
  const pillX = x - pillW / 2;
  const pillY = (headerH - pillH) / 2;

  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = colors.destructive;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${10 * dpr}px ${LAYOUT.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NOW', x, pillY + pillH / 2);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function renderTimeline(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  monitors: MonitorRow[],
  events: TimelineEvent[],
  monitorIds: string[],
  viewport: RenderViewport,
  hoveredEventId: string | null,
): void {
  const { dpr, width, height } = viewport;
  const w = width * dpr;
  const h = height * dpr;

  // Clear and fill background
  ctx.clearRect(0, 0, w, h);

  const colors = getThemeColors(canvas);

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);

  // Draw layers in order
  drawSwimlanes(ctx, monitors, viewport, colors);
  drawTimeAxis(ctx, viewport, colors);
  drawEvents(ctx, events, monitorIds, viewport, hoveredEventId);
  drawCurrentTime(ctx, viewport, colors);
}
