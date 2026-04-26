/**
 * Quick-Search Filter Bar
 *
 * Sticky bar above the events list exposing the highest-traffic filters
 * inline so users don't have to crack open the popover. Session-scoped
 * state (resets on profile switch / app restart). Coexists with the
 * existing EventsFilterPopover — popover filters AND with bar filters.
 *
 * Phase-A MVP surfaces three new client-side filters:
 *   - cause / notes / monitor-name "contains" text
 *   - alarm-score minimum slider
 *   - "Today's high-score events" one-tap preset
 *
 * Class-chip multiselect and the full date-range bar are deferred to a
 * follow-up; the existing QuickDateRangeButtons live just below.
 */

import { useTranslation } from 'react-i18next';
import { Search, X, Star } from 'lucide-react';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export interface QuickSearchFilterBarProps {
  causeContains: string;
  onCauseContainsChange: (value: string) => void;
  scoreMin: number;
  onScoreMinChange: (value: number) => void;
  /** Apply the "today's high-score" preset (date range = today, score >= 50). */
  onApplyTodaysHighScore: () => void;
  /** Clear inline filter state (cause + score). Does NOT touch popover filters. */
  onClearInline: () => void;
  className?: string;
}

export function QuickSearchFilterBar({
  causeContains,
  onCauseContainsChange,
  scoreMin,
  onScoreMinChange,
  onApplyTodaysHighScore,
  onClearInline,
  className,
}: QuickSearchFilterBarProps) {
  const { t } = useTranslation();
  const hasInline = causeContains.length > 0 || scoreMin > 0;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center gap-2 py-2',
        className
      )}
      data-testid="quick-search-bar"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={causeContains}
            onChange={(e) => onCauseContainsChange(e.target.value)}
            placeholder={t('events.quick_search.cause_placeholder')}
            className="pl-7 h-8 text-sm"
            data-testid="quick-search-cause-input"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onApplyTodaysHighScore}
          className="shrink-0 h-8"
          data-testid="quick-search-todays-hs"
        >
          <Star className="h-3.5 w-3.5 mr-1 fill-yellow-500 stroke-yellow-500" />
          <span className="hidden sm:inline">{t('events.quick_search.todays_hs')}</span>
          <span className="sm:hidden">{t('events.quick_search.todays_hs_short')}</span>
        </Button>
        {hasInline && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearInline}
            aria-label={t('events.quick_search.clear')}
            className="shrink-0 h-8 w-8"
            data-testid="quick-search-clear"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 sm:w-56" data-testid="quick-search-score-row">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {t('events.quick_search.score_min', { value: scoreMin })}
        </span>
        <Slider
          value={[scoreMin]}
          onValueChange={(v) => onScoreMinChange(v[0] ?? 0)}
          min={0}
          max={100}
          step={5}
          className="flex-1"
          data-testid="quick-search-score-slider"
          aria-label={t('events.quick_search.score_min_label')}
        />
      </div>
    </div>
  );
}
