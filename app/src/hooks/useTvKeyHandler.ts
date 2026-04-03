/**
 * D-pad key event router for TV mode.
 *
 * Screens register a map of key → handler. Unhandled keys pass through
 * to WebView spatial navigation. Enter on non-native elements synthesizes a click.
 */

import { useEffect, useRef } from 'react';
import { useTvMode } from './useTvMode';

type DpadKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Enter';

export type TvKeyMap = Partial<Record<DpadKey, () => void>>;

/** Elements that natively handle Enter — don't synthesize a click on these. */
const NATIVE_ENTER_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);

export function useTvKeyHandler(keyMap: TvKeyMap) {
  const { isTvMode } = useTvMode();
  const keyMapRef = useRef(keyMap);
  keyMapRef.current = keyMap;

  useEffect(() => {
    if (!isTvMode) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key as DpadKey;
      const handler = keyMapRef.current[key];

      if (handler) {
        e.preventDefault();
        handler();
        return;
      }

      // Enter fallback: synthesize click on focused non-native elements
      if (key === 'Enter') {
        const el = document.activeElement;
        if (el && !NATIVE_ENTER_TAGS.has(el.tagName)) {
          e.preventDefault();
          (el as HTMLElement).click();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTvMode]);
}
