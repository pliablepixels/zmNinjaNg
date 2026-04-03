/**
 * Region-based D-pad navigation for Android TV / Fire Stick.
 *
 * Navigation model:
 * - D-pad Up/Down: move between focusable elements within the current region
 * - D-pad Left/Right: jump between regions (e.g., sidebar ↔ main content)
 * - Enter/Center: activate the focused element
 *
 * Regions are marked with data-tv-region attributes on container elements.
 * The browser handles scrolling automatically when focusing elements.
 */

import { Platform } from './platform';

const REGION_ATTR = 'data-tv-region';
const REGION_ORDER = ['sidebar', 'main', 'setup-screen'];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="menuitem"]',
].join(', ');

/** Track the last focused element per region so we can restore it */
const lastFocusedPerRegion = new Map<string, WeakRef<HTMLElement>>();

function getVisibleFocusables(container: Element): HTMLElement[] {
  const all = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  const visible: HTMLElement[] = [];
  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden') {
      visible.push(el);
    }
  }
  return visible;
}

function getCurrentRegion(el: Element | null): Element | null {
  if (!el) return null;
  return el.closest(`[${REGION_ATTR}]`);
}

function getRegionName(region: Element): string {
  return region.getAttribute(REGION_ATTR) || '';
}

function getAllRegions(): Element[] {
  return Array.from(document.querySelectorAll(`[${REGION_ATTR}]`))
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    })
    .sort((a, b) => {
      const ai = REGION_ORDER.indexOf(getRegionName(a));
      const bi = REGION_ORDER.indexOf(getRegionName(b));
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
}

function focusInRegion(region: Element, direction: 'first' | 'last' | 'restore'): boolean {
  const name = getRegionName(region);

  // Try to restore last focused element
  if (direction === 'restore') {
    const ref = lastFocusedPerRegion.get(name);
    const el = ref?.deref();
    if (el && region.contains(el)) {
      el.focus();
      el.scrollIntoView({ block: 'nearest' });
      return true;
    }
    // Fall back to first
    direction = 'first';
  }

  const focusable = getVisibleFocusables(region);
  if (focusable.length === 0) return false;

  const target = direction === 'first' ? focusable[0] : focusable[focusable.length - 1];
  target.focus();
  target.scrollIntoView({ block: 'nearest' });
  return true;
}

function moveWithinRegion(region: Element, direction: 'next' | 'prev'): boolean {
  const focusable = getVisibleFocusables(region);
  if (focusable.length === 0) return false;

  const active = document.activeElement as HTMLElement;
  // Find current index — check both exact match and containment
  let currentIndex = focusable.indexOf(active);
  if (currentIndex === -1) {
    currentIndex = focusable.findIndex((el) => el.contains(active) || active.contains(el));
  }

  let nextIndex: number;
  if (currentIndex === -1) {
    nextIndex = direction === 'next' ? 0 : focusable.length - 1;
  } else if (direction === 'next') {
    nextIndex = currentIndex + 1;
    if (nextIndex >= focusable.length) return false; // at end of region
  } else {
    nextIndex = currentIndex - 1;
    if (nextIndex < 0) return false; // at start of region
  }

  focusable[nextIndex].focus();
  focusable[nextIndex].scrollIntoView({ block: 'nearest' });
  return true;
}

function moveHorizontally(region: Element, direction: 'left' | 'right'): boolean {
  const active = document.activeElement as HTMLElement;
  if (!active || active === document.body) return false;

  const focusable = getVisibleFocusables(region);
  const activeRect = active.getBoundingClientRect();
  const cy = (activeRect.top + activeRect.bottom) / 2;
  const cx = (activeRect.left + activeRect.right) / 2;

  // Find elements at roughly the same Y position
  let best: HTMLElement | null = null;
  let bestDist = Infinity;

  for (const el of focusable) {
    if (el === active) continue;
    const rect = el.getBoundingClientRect();
    const ey = (rect.top + rect.bottom) / 2;
    const ex = (rect.left + rect.right) / 2;

    // Must be within 30px vertically (same row)
    if (Math.abs(ey - cy) > 30) continue;

    // Must be in the correct direction
    if (direction === 'right' && ex <= cx) continue;
    if (direction === 'left' && ex >= cx) continue;

    const dist = Math.abs(ex - cx);
    if (dist < bestDist) {
      bestDist = dist;
      best = el;
    }
  }

  if (best) {
    best.focus();
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }
  return false;
}

function jumpToRegion(direction: 'left' | 'right'): boolean {
  const regions = getAllRegions();
  if (regions.length <= 1) return false;

  const currentRegion = getCurrentRegion(document.activeElement);
  let currentIndex = -1;
  if (currentRegion) {
    // Find by matching data-tv-region attribute value since indexOf needs same reference
    const currentName = getRegionName(currentRegion);
    currentIndex = regions.findIndex((r) => getRegionName(r) === currentName);
  }

  let targetIndex: number;
  if (direction === 'right') {
    targetIndex = currentIndex + 1;
    if (targetIndex >= regions.length) return false;
  } else {
    targetIndex = currentIndex - 1;
    if (targetIndex < 0) return false;
  }

  // Save current focus before jumping
  if (currentRegion && document.activeElement instanceof HTMLElement) {
    lastFocusedPerRegion.set(getRegionName(currentRegion), new WeakRef(document.activeElement));
  }

  return focusInRegion(regions[targetIndex], 'restore');
}

function handleDpadKey(e: KeyboardEvent): void {
  const active = document.activeElement as HTMLElement | null;
  const isTextInput = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA';

  switch (e.key) {
    case 'ArrowDown': {
      // In text input, let left/right work for cursor but up/down exits
      const region = getCurrentRegion(active);
      if (region) {
        if (moveWithinRegion(region, 'next')) {
          e.preventDefault();
        }
      } else {
        // No region — focus the first element in any visible region
        const regions = getAllRegions();
        for (const r of regions) {
          if (focusInRegion(r, 'first')) {
            e.preventDefault();
            break;
          }
        }
      }
      break;
    }

    case 'ArrowUp': {
      const region = getCurrentRegion(active);
      if (region) {
        if (moveWithinRegion(region, 'prev')) {
          e.preventDefault();
        }
      }
      break;
    }

    case 'ArrowRight': {
      if (isTextInput) return; // let cursor move in text
      const regionR = getCurrentRegion(active);
      // Try horizontal movement within the region first
      if (regionR && moveHorizontally(regionR, 'right')) {
        e.preventDefault();
      } else {
        jumpToRegion('right');
        e.preventDefault();
      }
      break;
    }

    case 'ArrowLeft': {
      if (isTextInput) return; // let cursor move in text
      const regionL = getCurrentRegion(active);
      // Try horizontal movement within the region first
      if (regionL && moveHorizontally(regionL, 'left')) {
        e.preventDefault();
      } else {
        jumpToRegion('left');
        e.preventDefault();
      }
      break;
    }

    case 'Enter': {
      if (active && active !== document.body) {
        e.preventDefault();
        active.click();
      }
      break;
    }

    case 'Escape':
    case 'Backspace': {
      // Back button on Fire Stick remote
      // Only go back if we have history, otherwise let the system handle it (exit app)
      if (window.history.length > 1) {
        e.preventDefault();
        window.history.back();
      }
      break;
    }
  }
}

let installed = false;

export function installDpadNavigator(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', handleDpadKey, { capture: true });
}

export function initTvNavigation(): void {
  if (Platform.isTVDevice) {
    installDpadNavigator();
    return;
  }

  if (Platform.isNative) {
    import('@capacitor/core').then(({ registerPlugin }) => {
      const TvDetector = registerPlugin<{ isTV: () => Promise<{ isTV: boolean }> }>('TvDetector');
      TvDetector.isTV().then((result) => {
        if (result.isTV) installDpadNavigator();
      }).catch(() => {});
    }).catch(() => {});
  }
}
