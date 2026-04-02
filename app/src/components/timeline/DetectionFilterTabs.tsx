/**
 * DetectionFilterTabs
 *
 * Horizontal row of filter buttons for detection categories.
 * Used above the timeline canvas to filter events by object type.
 */

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';

export type DetectionCategory = 'all' | 'person' | 'vehicle' | 'animal' | 'other';

interface DetectionFilterTabsProps {
  selected: DetectionCategory;
  onSelect: (category: DetectionCategory) => void;
  counts: Record<DetectionCategory, number>;
}

const CATEGORIES: DetectionCategory[] = ['all', 'person', 'vehicle', 'animal', 'other'];

const I18N_KEYS: Record<DetectionCategory, string> = {
  all: 'timeline.filter_all',
  person: 'timeline.filter_person',
  vehicle: 'timeline.filter_vehicle',
  animal: 'timeline.filter_animal',
  other: 'timeline.filter_other',
};

const PERSON_PATTERN = /\b(person|people|human|face)\b/i;
const VEHICLE_PATTERN = /\b(car|vehicle|truck|bus|motorcycle|bicycle)\b/i;
const ANIMAL_PATTERN = /\b(dog|cat|animal|bird|bear)\b/i;

export function categorizeEvent(notes: string | null): DetectionCategory {
  if (!notes) return 'other';
  if (PERSON_PATTERN.test(notes)) return 'person';
  if (VEHICLE_PATTERN.test(notes)) return 'vehicle';
  if (ANIMAL_PATTERN.test(notes)) return 'animal';
  return 'other';
}

export const DetectionFilterTabs = memo(function DetectionFilterTabs({
  selected,
  onSelect,
  counts,
}: DetectionFilterTabsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="detection-filter-tabs">
      {CATEGORIES.map((cat) => (
        <Button
          key={cat}
          variant={selected === cat ? 'default' : 'outline'}
          size="sm"
          className="text-xs h-7 px-3"
          onClick={() => onSelect(cat)}
          data-testid={`detection-tab-${cat}`}
        >
          {t(I18N_KEYS[cat])}
          <span className="text-[10px] tabular-nums ml-1 opacity-70">
            {counts[cat]}
          </span>
        </Button>
      ))}
    </div>
  );
});
