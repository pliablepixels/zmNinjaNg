const ROTATE_PREFIX = 'ROTATE_';

export type MonitorRotation =
  | { kind: 'none' }
  | { kind: 'degrees'; degrees: number }
  | { kind: 'flip_horizontal' }
  | { kind: 'flip_vertical' }
  | { kind: 'unknown' };

export function parseMonitorRotation(orientation?: string | null): MonitorRotation {
  const value = orientation?.trim();

  if (!value) {
    return { kind: 'none' };
  }

  const normalized = value.toUpperCase();

  if (normalized === 'FLIP_HORI') {
    return { kind: 'flip_horizontal' };
  }

  if (normalized === 'FLIP_VERT') {
    return { kind: 'flip_vertical' };
  }

  const rotationValue = normalized.startsWith(ROTATE_PREFIX)
    ? normalized.slice(ROTATE_PREFIX.length)
    : normalized;
  const degrees = Number.parseInt(rotationValue, 10);

  if (Number.isNaN(degrees)) {
    return { kind: 'unknown' };
  }

  if (degrees % 360 === 0) {
    return { kind: 'none' };
  }

  return { kind: 'degrees', degrees };
}

export function getOrientedResolution(
  width: string | number | undefined,
  height: string | number | undefined,
  orientation: string | undefined | null
): string {
  const w = Number(width);
  const h = Number(height);

  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return `${width ?? ''}${width ? 'x' : ''}${height ?? ''}`;
  }

  const rotation = parseMonitorRotation(orientation);
  if (rotation.kind === 'degrees') {
    const normalized = ((rotation.degrees % 360) + 360) % 360;
    if (normalized === 90 || normalized === 270) {
      return `${h}x${w}`;
    }
  }

  return `${w}x${h}`;
}

export function getMonitorAspectRatio(
  width?: string | number | null,
  height?: string | number | null,
  orientation?: string | null
): string | undefined {
  const w = Number(width);
  const h = Number(height);

  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return undefined;
  }

  const rotation = parseMonitorRotation(orientation);
  let orientedWidth = w;
  let orientedHeight = h;

  if (rotation.kind === 'degrees') {
    const normalized = ((rotation.degrees % 360) + 360) % 360;
    if (normalized === 90 || normalized === 270) {
      orientedWidth = h;
      orientedHeight = w;
    }
  }

  return `${orientedWidth} / ${orientedHeight}`;
}
