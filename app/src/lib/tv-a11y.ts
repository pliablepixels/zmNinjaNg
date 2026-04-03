/**
 * Accessibility utilities for TV/keyboard navigation.
 */

import type { KeyboardEvent } from 'react';

/**
 * onKeyDown handler that triggers onClick on Enter or Space.
 * Use on any non-button element that has an onClick handler.
 */
export function handleKeyClick(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    (e.currentTarget as HTMLElement).click();
  }
}

/**
 * Props to spread on any div/span that acts as a button.
 * Adds tabindex, role, and keyboard handler.
 */
export function clickableProps() {
  return {
    tabIndex: 0,
    role: 'button' as const,
    onKeyDown: handleKeyClick,
  };
}
