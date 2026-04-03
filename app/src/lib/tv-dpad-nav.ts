/**
 * Global D-pad focus navigation for Android TV / Fire Stick.
 *
 * Handles arrow key events to move focus between focusable elements
 * based on their screen position. Works independently of WebView
 * spatial navigation and runs before any React profile is loaded.
 */

import { Platform } from './platform';

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

function getVisibleFocusableElements(): HTMLElement[] {
  const all = document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  const visible: HTMLElement[] = [];
  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden') {
      visible.push(el);
    }
  }
  return visible;
}

function getRect(el: HTMLElement): DOMRect {
  return el.getBoundingClientRect();
}

function findBestCandidate(
  current: DOMRect,
  candidates: HTMLElement[],
  direction: 'up' | 'down' | 'left' | 'right',
): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of candidates) {
    const rect = getRect(el);

    // Filter: must be in the correct direction
    const isInDirection =
      direction === 'up'    ? rect.bottom <= current.top + 2 :
      direction === 'down'  ? rect.top >= current.bottom - 2 :
      direction === 'left'  ? rect.right <= current.left + 2 :
      direction === 'right' ? rect.left >= current.right - 2 :
      false;

    if (!isInDirection) continue;

    // Score: distance from current center to candidate center
    const cx = (current.left + current.right) / 2;
    const cy = (current.top + current.bottom) / 2;
    const ex = (rect.left + rect.right) / 2;
    const ey = (rect.top + rect.bottom) / 2;

    // Weight: primary axis distance matters more than cross-axis
    const primary = direction === 'up' || direction === 'down'
      ? Math.abs(ey - cy)
      : Math.abs(ex - cx);
    const cross = direction === 'up' || direction === 'down'
      ? Math.abs(ex - cx)
      : Math.abs(ey - cy);

    const score = primary + cross * 0.3;

    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

function handleDpadKey(e: KeyboardEvent): void {
  const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  };

  const direction = dirMap[e.key];

  if (direction) {
    const active = document.activeElement as HTMLElement | null;
    const focusable = getVisibleFocusableElements();

    if (!active || active === document.body) {
      // Nothing focused — focus the first element
      if (focusable.length > 0) {
        focusable[0].focus();
        e.preventDefault();
      }
      return;
    }

    // Inside text inputs: left/right move cursor, up/down exit the field
    const isTextInput = active.tagName === 'INPUT' || active.tagName === 'TEXTAREA';
    if (isTextInput && (direction === 'left' || direction === 'right')) {
      return; // let the input handle cursor movement
    }

    const current = getRect(active);
    const others = focusable.filter((el) => el !== active);
    const next = findBestCandidate(current, others, direction);

    if (next) {
      // Blur the input first so keyboard dismisses
      if (isTextInput) {
        active.blur();
      }
      next.focus();
      next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      e.preventDefault();
    }
    return;
  }

  // Enter/Select: click the focused element if it's not a native button/input
  if (e.key === 'Enter') {
    const el = document.activeElement as HTMLElement | null;
    if (el && !['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
      e.preventDefault();
      el.click();
    }
  }
}

let installed = false;

/**
 * Install the global D-pad focus navigator.
 * Safe to call multiple times — only installs once.
 * Call this early in app startup on TV devices.
 */
export function installDpadNavigator(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', handleDpadKey, { capture: true });
}

/**
 * Auto-install on TV devices.
 * Called at module load time from the app entry point.
 */
export function initTvNavigation(): void {
  if (Platform.isTVDevice) {
    installDpadNavigator();
    return;
  }

  // Also check native plugin (async) for definitive detection
  if (Platform.isNative) {
    import('@capacitor/core').then(({ registerPlugin }) => {
      const TvDetector = registerPlugin<{ isTV: () => Promise<{ isTV: boolean }> }>('TvDetector');
      TvDetector.isTV().then((result) => {
        if (result.isTV) {
          installDpadNavigator();
        }
      }).catch(() => { /* not available */ });
    }).catch(() => { /* not on native */ });
  }
}
