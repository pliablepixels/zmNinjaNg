/**
 * Pure suppression-rule evaluators.
 *
 * No I/O, no state — given an entry and a context, return a verdict. Used
 * by the push pipeline (native side will mirror this logic) and the
 * Events list filter.
 */

import {
  type MuteEntry,
  type QuietHoursEntry,
  type NoiseFilterEntry,
  type SuppressionContext,
  type SuppressionEntry,
  type SuppressionReason,
  MONITOR_ALL,
} from './types';

export function isMuteActive(entry: MuteEntry, now: Date = new Date()): boolean {
  const expiry = Date.parse(entry.until);
  if (Number.isNaN(expiry)) return false;
  return expiry > now.getTime();
}

/**
 * True when the current local time falls inside the window AND today's
 * weekday is set in `weekday_mask`. Windows that cross midnight are active
 * when current >= start OR current < end, with the weekday check applied to
 * whichever date the start belongs to.
 */
export function isQuietHoursActive(entry: QuietHoursEntry, now: Date = new Date()): boolean {
  const start = parseHHMM(entry.start_local_time);
  const end = parseHHMM(entry.end_local_time);
  if (start === null || end === null) return false;
  if (entry.weekday_mask === 0) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayBit = 1 << now.getDay();

  if (start === end) return false; // zero-length window

  if (start < end) {
    // Same-day window
    if (!(entry.weekday_mask & todayBit)) return false;
    return currentMinutes >= start && currentMinutes < end;
  }

  // Midnight-crossing window: active either after start today (if today is set)
  // or before end today (if yesterday — the start day — is set).
  if (currentMinutes >= start) {
    return Boolean(entry.weekday_mask & todayBit);
  }
  if (currentMinutes < end) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayBit = 1 << yesterday.getDay();
    return Boolean(entry.weekday_mask & yesterdayBit);
  }
  return false;
}

interface NoiseFilterTarget {
  alarm_score?: number;
  cause_text?: string;
}

export function matchesNoiseFilter(entry: NoiseFilterEntry, target: NoiseFilterTarget): boolean {
  if (typeof target.alarm_score === 'number' && entry.min_alarm_score > target.alarm_score) {
    return true;
  }
  if (target.cause_text && entry.exclude_cause_patterns.length > 0) {
    const haystack = target.cause_text.toLowerCase();
    for (const pattern of entry.exclude_cause_patterns) {
      if (!pattern) continue;
      if (haystack.includes(pattern.toLowerCase())) return true;
    }
  }
  return false;
}

export function entryAppliesToMonitor(
  scope: string,
  monitorId: string
): boolean {
  return scope === MONITOR_ALL || scope === monitorId;
}

/**
 * End-to-end decision for a single push or rendered event. Returns the
 * first matching reason in priority order: mute → quiet_hours → noise_filter (hide).
 * Noise-filter rules in `mode: dim` never suppress here — callers handle dim
 * separately (Events list rendering).
 */
export function evaluateSuppression(
  ctx: SuppressionContext,
  entries: SuppressionEntry[]
): SuppressionReason | null {
  const now = ctx.now ?? new Date();

  for (const entry of entries) {
    if (entry.kind !== 'mute') continue;
    if (entry.profile_id !== ctx.profile_id) continue;
    if (entry.monitor_id !== ctx.monitor_id) continue;
    if (isMuteActive(entry, now)) {
      return { kind: 'mute', entry };
    }
  }

  for (const entry of entries) {
    if (entry.kind !== 'quiet_hours') continue;
    if (entry.profile_id !== ctx.profile_id) continue;
    if (!entryAppliesToMonitor(entry.monitor_id_or_all, ctx.monitor_id)) continue;
    if (isQuietHoursActive(entry, now)) {
      return { kind: 'quiet_hours', entry };
    }
  }

  for (const entry of entries) {
    if (entry.kind !== 'noise_filter') continue;
    if (entry.mode !== 'hide') continue;
    if (entry.profile_id !== ctx.profile_id) continue;
    if (!entryAppliesToMonitor(entry.monitor_id_or_all, ctx.monitor_id)) continue;
    if (matchesNoiseFilter(entry, { alarm_score: ctx.alarm_score, cause_text: ctx.cause_text })) {
      return { kind: 'noise_filter', entry };
    }
  }

  return null;
}

/**
 * Returns `true` when any noise-filter rule (hide OR dim) matches the
 * event for the active profile/monitor — used by the Events list to apply
 * the dim treatment regardless of mode.
 */
export function matchesAnyNoiseFilter(
  ctx: SuppressionContext,
  entries: SuppressionEntry[]
): NoiseFilterEntry | null {
  for (const entry of entries) {
    if (entry.kind !== 'noise_filter') continue;
    if (entry.profile_id !== ctx.profile_id) continue;
    if (!entryAppliesToMonitor(entry.monitor_id_or_all, ctx.monitor_id)) continue;
    if (matchesNoiseFilter(entry, { alarm_score: ctx.alarm_score, cause_text: ctx.cause_text })) {
      return entry;
    }
  }
  return null;
}

function parseHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}
