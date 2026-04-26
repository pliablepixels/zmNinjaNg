/**
 * Suppression-store entry types.
 *
 * The store is the single source of truth consumed by:
 *   - the iOS Service Extension and Android FCM service before display
 *   - the in-app Events list filter
 *   - the Triage Center management UI
 *
 * Entries are profile-scoped and persisted across app kill / reboot.
 * See specs/notification-mute-store/spec.md for the full contract.
 */

export const MONITOR_ALL = '*' as const;

export interface MuteEntry {
  id: string;
  kind: 'mute';
  profile_id: string;
  monitor_id: string;
  /** Absolute ISO 8601 timestamp at which the mute expires. */
  until: string;
  created_at: string;
}

export interface QuietHoursEntry {
  id: string;
  kind: 'quiet_hours';
  profile_id: string;
  /** Specific monitor_id or `"*"` for "all monitors in this profile". */
  monitor_id_or_all: string;
  /** Local-time start, format `"HH:MM"` (24h). */
  start_local_time: string;
  /** Local-time end, format `"HH:MM"` (24h). End may be earlier than start (midnight crossing). */
  end_local_time: string;
  /** Bitfield. Bit 0 = Sunday … bit 6 = Saturday. */
  weekday_mask: number;
  label: string;
  created_at: string;
}

export interface NoiseFilterEntry {
  id: string;
  kind: 'noise_filter';
  profile_id: string;
  monitor_id_or_all: string;
  /** Strict threshold: rule matches when `min_alarm_score > event.alarm_score`. */
  min_alarm_score: number;
  /** Substrings (case-insensitive) tested against `event.cause_text`. */
  exclude_cause_patterns: string[];
  mode: 'hide' | 'dim';
  created_at: string;
}

export type SuppressionEntry = MuteEntry | QuietHoursEntry | NoiseFilterEntry;
export type SuppressionEntryKind = SuppressionEntry['kind'];

export type SuppressionReason =
  | { kind: 'mute'; entry: MuteEntry }
  | { kind: 'quiet_hours'; entry: QuietHoursEntry }
  | { kind: 'noise_filter'; entry: NoiseFilterEntry };

/** Inputs to an end-to-end suppression decision. */
export interface SuppressionContext {
  profile_id: string;
  monitor_id: string;
  /** Optional — quiet-hours evaluation needs a clock. */
  now?: Date;
  /** Optional — noise-filter evaluation needs the event's score. */
  alarm_score?: number;
  cause_text?: string;
}
