/**
 * Virtual mouse cursor for Android TV / Fire Stick.
 *
 * D-pad arrows move a visible cursor. Center/Enter clicks under cursor.
 * Auto-scrolls near edges. Auto-detects TV devices.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from '../../lib/platform';

const CURSOR_SIZE = 24;
const SPEED_START = 4;     // px per frame initially
const SPEED_MAX = 16;      // px per frame at full speed
const RAMP_FRAMES = 20;    // frames to go from start to max (~333ms at 60fps)
const SCROLL_EDGE = 40;
const SCROLL_SPEED = 5;

export function TvCursor() {
  const [isTV, setIsTV] = useState(Platform.isTVDevice);
  const posRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [renderPos, setRenderPos] = useState(posRef.current);
  const [visible, setVisible] = useState(false);
  const keysHeld = useRef<Record<string, number>>({}); // key → frame count held
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (isTV || !Platform.isNative) return;
    import('@capacitor/core').then(({ registerPlugin }) => {
      const TvDetector = registerPlugin<{ isTV: () => Promise<{ isTV: boolean }> }>('TvDetector');
      TvDetector.isTV().then((r) => { if (r.isTV) setIsTV(true); }).catch(() => {});
    }).catch(() => {});
  }, [isTV]);

  const findScrollableAt = useCallback((x: number, y: number): HTMLElement | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    let node: HTMLElement | null = el;
    while (node) {
      const style = getComputedStyle(node);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }, []);

  const moveLoop = useCallback(() => {
    const held = keysHeld.current;
    let dx = 0;
    let dy = 0;
    let maxFrames = 0;

    if (held['ArrowLeft']) { dx -= 1; maxFrames = Math.max(maxFrames, held['ArrowLeft']); }
    if (held['ArrowRight']) { dx += 1; maxFrames = Math.max(maxFrames, held['ArrowRight']); }
    if (held['ArrowUp']) { dy -= 1; maxFrames = Math.max(maxFrames, held['ArrowUp']); }
    if (held['ArrowDown']) { dy += 1; maxFrames = Math.max(maxFrames, held['ArrowDown']); }

    if (dx !== 0 || dy !== 0) {
      // Increment frame counters, clear stale keys (>120 frames without refresh = ~2s)
      for (const key of Object.keys(held)) {
        held[key]++;
        if (held[key] > 60) delete held[key];
      }

      // Speed ramps from SPEED_START to SPEED_MAX over RAMP_FRAMES
      const t = Math.min(1, maxFrames / RAMP_FRAMES);
      const speed = SPEED_START + (SPEED_MAX - SPEED_START) * t * t; // ease-in

      const newX = Math.max(0, Math.min(window.innerWidth - 1, posRef.current.x + dx * speed));
      const newY = Math.max(0, Math.min(window.innerHeight - 1, posRef.current.y + dy * speed));
      posRef.current = { x: newX, y: newY };
      setRenderPos({ x: newX, y: newY });

      // Auto-scroll near edges (only in the direction being pressed)
      const scrollable = findScrollableAt(newX, newY);
      if (scrollable) {
        const rect = scrollable.getBoundingClientRect();
        if (dy > 0) {
          const d = rect.bottom - newY;
          if (d < SCROLL_EDGE) scrollable.scrollTop += SCROLL_SPEED * (1 - d / SCROLL_EDGE);
        }
        if (dy < 0) {
          const d = newY - rect.top;
          if (d < SCROLL_EDGE) scrollable.scrollTop -= SCROLL_SPEED * (1 - d / SCROLL_EDGE);
        }
        if (dx > 0) {
          const d = rect.right - newX;
          if (d < SCROLL_EDGE) scrollable.scrollLeft += SCROLL_SPEED * (1 - d / SCROLL_EDGE);
        }
        if (dx < 0) {
          const d = newX - rect.left;
          if (d < SCROLL_EDGE) scrollable.scrollLeft -= SCROLL_SPEED * (1 - d / SCROLL_EDGE);
        }
      }
    }

    rafId.current = requestAnimationFrame(moveLoop);
  }, [findScrollableAt]);

  useEffect(() => {
    if (!isTV) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (arrows.includes(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!visible) setVisible(true);

        // Clear opposite direction to prevent stuck cursor from missed keyup events
        const opposite: Record<string, string> = {
          ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft',
          ArrowUp: 'ArrowDown', ArrowDown: 'ArrowUp',
        };
        delete keysHeld.current[opposite[e.key]];

        // Set frame count; on key repeat, keep existing count (don't reset)
        if (!keysHeld.current[e.key]) {
          keysHeld.current[e.key] = 1;
        }
        // Mark as recently refreshed so stale detection doesn't clear it
        keysHeld.current[e.key] = Math.min(keysHeld.current[e.key], RAMP_FRAMES * 2);
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!visible) { setVisible(true); return; }

        // Hide cursor to get element underneath
        const cursorEl = document.getElementById('tv-cursor');
        if (cursorEl) cursorEl.style.display = 'none';
        const { x, y } = posRef.current;
        const target = document.elementFromPoint(x, y) as HTMLElement | null;
        if (cursorEl) cursorEl.style.display = '';

        if (target) {
          // Focus inputs
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
            target.focus();
          }

          // Find the closest interactive element (handles clicking on icon/span inside button)
          const interactive = target.closest('button, a, [role="button"], [role="switch"], [role="checkbox"], [role="tab"], [tabindex]') as HTMLElement | null;
          const clickTarget = interactive || target;

          clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
        }
      }

      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (window.history.length > 1) {
          e.preventDefault();
          window.history.back();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      delete keysHeld.current[e.key];
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    rafId.current = requestAnimationFrame(moveLoop);

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      cancelAnimationFrame(rafId.current);
    };
  }, [isTV, visible, moveLoop]);

  if (!isTV || !visible) return null;

  return (
    <div
      id="tv-cursor"
      style={{
        position: 'fixed',
        left: renderPos.x - CURSOR_SIZE / 2,
        top: renderPos.y - CURSOR_SIZE / 2,
        width: CURSOR_SIZE,
        height: CURSOR_SIZE,
        borderRadius: '50%',
        border: '3px solid #00a8ff',
        backgroundColor: 'rgba(0, 168, 255, 0.3)',
        pointerEvents: 'none',
        zIndex: 99999,
        boxShadow: '0 0 8px rgba(0, 168, 255, 0.5)',
      }}
    />
  );
}
