/**
 * Shared date/time formatting utility.
 *
 * All user-facing date/time display should use these functions
 * to respect the user's chosen format from Settings.
 */

import { format as dateFnsFormat } from 'date-fns';
import type { DateFormatPreset, TimeFormatPreset } from '../stores/settings';
import { log, LogLevel } from './logger';

interface FormatSettings {
  dateFormat: DateFormatPreset;
  timeFormat: TimeFormatPreset;
  customDateFormat: string;
  customTimeFormat: string;
}

/** Resolve the date-fns format string for dates */
function resolveDatePattern(s: FormatSettings): string {
  if (s.dateFormat === 'custom') return s.customDateFormat || 'MMM d';
  return s.dateFormat || 'MMM d';
}

/** Resolve the date-fns format string for times */
function resolveTimePattern(s: FormatSettings): string {
  if (s.timeFormat === 'custom') return s.customTimeFormat || 'h:mm a';
  return (s.timeFormat || '12h') === '12h' ? 'h:mm:ss a' : 'HH:mm:ss';
}

/** Resolve time pattern without seconds */
function resolveTimePatternShort(s: FormatSettings): string {
  if (s.timeFormat === 'custom') return s.customTimeFormat || 'h:mm a';
  return (s.timeFormat || '12h') === '12h' ? 'h:mm a' : 'HH:mm';
}

/** Format a date (no time) according to user settings */
export function formatAppDate(date: Date, settings: FormatSettings): string {
  try {
    return dateFnsFormat(date, resolveDatePattern(settings));
  } catch (error) {
    log.time('Format failed, using fallback', LogLevel.DEBUG, { error });
    return dateFnsFormat(date, 'MMM d');
  }
}

/** Format time only (with seconds) according to user settings */
export function formatAppTime(date: Date, settings: FormatSettings): string {
  try {
    return dateFnsFormat(date, resolveTimePattern(settings));
  } catch (error) {
    log.time('Format failed, using fallback', LogLevel.DEBUG, { error });
    return dateFnsFormat(date, 'HH:mm:ss');
  }
}

/** Format time only (without seconds) according to user settings */
export function formatAppTimeShort(date: Date, settings: FormatSettings): string {
  try {
    return dateFnsFormat(date, resolveTimePatternShort(settings));
  } catch (error) {
    log.time('Format failed, using fallback', LogLevel.DEBUG, { error });
    return dateFnsFormat(date, 'HH:mm');
  }
}

/** Format date + time according to user settings */
export function formatAppDateTime(date: Date, settings: FormatSettings): string {
  try {
    const d = resolveDatePattern(settings);
    const t = resolveTimePattern(settings);
    return dateFnsFormat(date, `${d}, ${t}`);
  } catch (error) {
    log.time('Format failed, using fallback', LogLevel.DEBUG, { error });
    return dateFnsFormat(date, 'MMM d, HH:mm:ss');
  }
}

/** Format date + time (short, no seconds) according to user settings */
export function formatAppDateTimeShort(date: Date, settings: FormatSettings): string {
  try {
    const d = resolveDatePattern(settings);
    const t = resolveTimePatternShort(settings);
    return dateFnsFormat(date, `${d}, ${t}`);
  } catch (error) {
    log.time('Format failed, using fallback', LogLevel.DEBUG, { error });
    return dateFnsFormat(date, 'MMM d, HH:mm');
  }
}

/**
 * Validate a custom format string.
 * Returns the formatted preview string, or null if invalid.
 */
export function validateFormatString(pattern: string | undefined | null): string | null {
  if (!pattern || !pattern.trim()) return null;
  try {
    return dateFnsFormat(new Date(), pattern);
  } catch (error) {
    log.time('Format validation failed', LogLevel.DEBUG, { pattern, error });
    return null;
  }
}
