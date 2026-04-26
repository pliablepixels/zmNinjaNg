/**
 * Triage Center
 *
 * Single in-app screen to manage all suppression-store entries: ad-hoc
 * mutes, recurring quiet-hours, per-monitor priority (native-only — shown
 * as a placeholder for now), and noise-filter rules. See
 * specs/snooze-management-screen/spec.md for the full contract.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BellOff, Moon, ShieldAlert, Filter, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import {
  type MuteEntry,
  type QuietHoursEntry,
  type NoiseFilterEntry,
  MONITOR_ALL,
  useSuppressionEntries,
  addSuppressionEntry,
  updateSuppressionEntry,
  removeSuppressionEntry,
} from '../plugins/suppression-store';
import { useDateTimeFormat } from '../hooks/useDateTimeFormat';

const WEEKDAY_BITS = [
  { bit: 0, key: 'common.weekday.sun' },
  { bit: 1, key: 'common.weekday.mon' },
  { bit: 2, key: 'common.weekday.tue' },
  { bit: 3, key: 'common.weekday.wed' },
  { bit: 4, key: 'common.weekday.thu' },
  { bit: 5, key: 'common.weekday.fri' },
  { bit: 6, key: 'common.weekday.sat' },
] as const;

export default function TriageCenter() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentProfile } = useCurrentProfile();
  const entries = useSuppressionEntries(currentProfile?.id);

  const mutes = useMemo(
    () => entries.filter((e): e is MuteEntry => e.kind === 'mute'),
    [entries]
  );
  const quietHours = useMemo(
    () => entries.filter((e): e is QuietHoursEntry => e.kind === 'quiet_hours'),
    [entries]
  );
  const noiseRules = useMemo(
    () => entries.filter((e): e is NoiseFilterEntry => e.kind === 'noise_filter'),
    [entries]
  );

  return (
    <div className="container mx-auto p-4 max-w-3xl" data-testid="triage-center">
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/notifications')}
          aria-label={t('common.back')}
          data-testid="triage-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{t('triage.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('triage.subtitle')}</p>
        </div>
      </div>

      <Tabs defaultValue="mutes">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mutes" data-testid="triage-tab-mutes">
            <BellOff className="h-4 w-4 mr-1" />
            {t('triage.tab.mutes')}
          </TabsTrigger>
          <TabsTrigger value="quiet" data-testid="triage-tab-quiet">
            <Moon className="h-4 w-4 mr-1" />
            {t('triage.tab.quiet_hours')}
          </TabsTrigger>
          <TabsTrigger value="noise" data-testid="triage-tab-noise">
            <Filter className="h-4 w-4 mr-1" />
            {t('triage.tab.noise')}
          </TabsTrigger>
          <TabsTrigger value="priority" data-testid="triage-tab-priority">
            <ShieldAlert className="h-4 w-4 mr-1" />
            {t('triage.tab.priority')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mutes">
          <MutesSection mutes={mutes} />
        </TabsContent>
        <TabsContent value="quiet">
          <QuietHoursSection
            entries={quietHours}
            profileId={currentProfile?.id}
          />
        </TabsContent>
        <TabsContent value="noise">
          <NoiseFilterSection
            entries={noiseRules}
            profileId={currentProfile?.id}
          />
        </TabsContent>
        <TabsContent value="priority">
          <PriorityPlaceholder />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MutesSection({ mutes }: { mutes: MuteEntry[] }) {
  const { t } = useTranslation();
  const { fmtDateTimeShort } = useDateTimeFormat();

  if (mutes.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground" data-testid="triage-mutes-empty">
        {t('triage.mutes.empty')}
      </Card>
    );
  }

  const sorted = [...mutes].sort((a, b) => Date.parse(a.until) - Date.parse(b.until));

  return (
    <div className="space-y-2" data-testid="triage-mutes-list">
      {sorted.map((m) => {
        const until = new Date(m.until);
        return (
          <Card key={m.id} className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{t('triage.mutes.monitor', { id: m.monitor_id })}</div>
              <div className="text-xs text-muted-foreground">
                {t('triage.mutes.until', { time: fmtDateTimeShort(until) })}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateSuppressionEntry(m.id, {
                    until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                  })
                }
                data-testid={`triage-mute-extend-${m.id}`}
              >
                {t('triage.mutes.extend_1h')}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeSuppressionEntry(m.id)}
                aria-label={t('common.clear')}
                data-testid={`triage-mute-clear-${m.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function QuietHoursSection({
  entries,
  profileId,
}: {
  entries: QuietHoursEntry[];
  profileId: string | undefined;
}) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-3">
      {entries.length === 0 && !showAdd && (
        <Card className="p-6 text-center text-sm text-muted-foreground" data-testid="triage-quiet-empty">
          {t('triage.quiet_hours.empty')}
        </Card>
      )}

      {entries.map((e) => (
        <Card key={e.id} className="p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium truncate">{e.label || t('triage.quiet_hours.unnamed')}</div>
            <div className="text-xs text-muted-foreground">
              {e.start_local_time}–{e.end_local_time} · {weekdayLabel(e.weekday_mask, t)}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeSuppressionEntry(e.id)}
            aria-label={t('common.clear')}
            data-testid={`triage-quiet-delete-${e.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </Card>
      ))}

      {showAdd ? (
        <QuietHoursAddForm
          profileId={profileId}
          onCancel={() => setShowAdd(false)}
          onSaved={() => setShowAdd(false)}
        />
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowAdd(true)}
          disabled={!profileId}
          data-testid="triage-quiet-add"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('triage.quiet_hours.add')}
        </Button>
      )}
    </div>
  );
}

function QuietHoursAddForm({
  profileId,
  onCancel,
  onSaved,
}: {
  profileId: string | undefined;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [start, setStart] = useState('22:00');
  const [end, setEnd] = useState('07:00');
  const [mask, setMask] = useState(0b1111111);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!profileId) return;
    if (mask === 0) {
      setError(t('triage.quiet_hours.error_no_weekdays'));
      return;
    }
    if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) {
      setError(t('triage.quiet_hours.error_time_format'));
      return;
    }
    addSuppressionEntry({
      kind: 'quiet_hours',
      profile_id: profileId,
      monitor_id_or_all: MONITOR_ALL,
      start_local_time: start,
      end_local_time: end,
      weekday_mask: mask,
      label: label.trim(),
    } as Omit<QuietHoursEntry, 'id' | 'created_at'>);
    onSaved();
  };

  return (
    <Card className="p-3 space-y-3" data-testid="triage-quiet-form">
      <div>
        <Label htmlFor="qh-label">{t('triage.quiet_hours.label_field')}</Label>
        <Input
          id="qh-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('triage.quiet_hours.label_placeholder')}
          data-testid="triage-quiet-label"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="qh-start">{t('triage.quiet_hours.start')}</Label>
          <Input
            id="qh-start"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            data-testid="triage-quiet-start"
          />
        </div>
        <div>
          <Label htmlFor="qh-end">{t('triage.quiet_hours.end')}</Label>
          <Input
            id="qh-end"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            data-testid="triage-quiet-end"
          />
        </div>
      </div>
      <div>
        <Label className="block mb-1">{t('triage.quiet_hours.weekdays')}</Label>
        <div className="flex gap-1 flex-wrap">
          {WEEKDAY_BITS.map(({ bit, key }) => {
            const active = (mask & (1 << bit)) !== 0;
            return (
              <Button
                key={bit}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMask(mask ^ (1 << bit))}
                data-testid={`triage-quiet-weekday-${bit}`}
              >
                {t(key)}
              </Button>
            );
          })}
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel} data-testid="triage-quiet-cancel">
          {t('common.cancel')}
        </Button>
        <Button onClick={save} disabled={!profileId} data-testid="triage-quiet-save">
          {t('common.save')}
        </Button>
      </div>
    </Card>
  );
}

function NoiseFilterSection({
  entries,
  profileId,
}: {
  entries: NoiseFilterEntry[];
  profileId: string | undefined;
}) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-3">
      {entries.length === 0 && !showAdd && (
        <Card className="p-6 text-center text-sm text-muted-foreground" data-testid="triage-noise-empty">
          {t('triage.noise.empty')}
        </Card>
      )}

      {entries.map((e) => (
        <Card key={e.id} className="p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium">
              {t('triage.noise.row_summary', {
                score: e.min_alarm_score,
                mode: t(`triage.noise.mode_${e.mode}`),
              })}
            </div>
            {e.exclude_cause_patterns.length > 0 && (
              <div className="text-xs text-muted-foreground truncate">
                {t('triage.noise.exclude_summary', {
                  patterns: e.exclude_cause_patterns.join(', '),
                })}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeSuppressionEntry(e.id)}
            aria-label={t('common.clear')}
            data-testid={`triage-noise-delete-${e.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </Card>
      ))}

      {showAdd ? (
        <NoiseFilterAddForm
          profileId={profileId}
          onCancel={() => setShowAdd(false)}
          onSaved={() => setShowAdd(false)}
        />
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowAdd(true)}
          disabled={!profileId}
          data-testid="triage-noise-add"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('triage.noise.add')}
        </Button>
      )}
    </div>
  );
}

function NoiseFilterAddForm({
  profileId,
  onCancel,
  onSaved,
}: {
  profileId: string | undefined;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [score, setScore] = useState('30');
  const [mode, setMode] = useState<'hide' | 'dim'>('dim');
  const [excludeText, setExcludeText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!profileId) return;
    const parsedScore = Number(score);
    if (Number.isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      setError(t('triage.noise.error_score_range'));
      return;
    }
    const patterns = excludeText
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    addSuppressionEntry({
      kind: 'noise_filter',
      profile_id: profileId,
      monitor_id_or_all: MONITOR_ALL,
      min_alarm_score: parsedScore,
      exclude_cause_patterns: patterns,
      mode,
    } as Omit<NoiseFilterEntry, 'id' | 'created_at'>);
    onSaved();
  };

  return (
    <Card className="p-3 space-y-3" data-testid="triage-noise-form">
      <div>
        <Label htmlFor="nf-score">{t('triage.noise.min_score')}</Label>
        <Input
          id="nf-score"
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          data-testid="triage-noise-score"
        />
      </div>
      <div>
        <Label htmlFor="nf-mode">{t('triage.noise.mode')}</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as 'hide' | 'dim')}>
          <SelectTrigger id="nf-mode" data-testid="triage-noise-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dim">{t('triage.noise.mode_dim')}</SelectItem>
            <SelectItem value="hide">{t('triage.noise.mode_hide')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="nf-exclude">{t('triage.noise.exclude_label')}</Label>
        <Input
          id="nf-exclude"
          value={excludeText}
          onChange={(e) => setExcludeText(e.target.value)}
          placeholder={t('triage.noise.exclude_placeholder')}
          data-testid="triage-noise-exclude"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel} data-testid="triage-noise-cancel">
          {t('common.cancel')}
        </Button>
        <Button onClick={save} disabled={!profileId} data-testid="triage-noise-save">
          {t('common.save')}
        </Button>
      </div>
    </Card>
  );
}

function PriorityPlaceholder() {
  const { t } = useTranslation();
  return (
    <Card className="p-6 text-sm text-muted-foreground" data-testid="triage-priority-placeholder">
      {t('triage.priority.placeholder')}
    </Card>
  );
}

function weekdayLabel(mask: number, t: (k: string) => string): string {
  if (mask === 0b1111111) return t('triage.quiet_hours.every_day');
  return WEEKDAY_BITS.filter(({ bit }) => mask & (1 << bit))
    .map(({ key }) => t(key))
    .join(' · ');
}
