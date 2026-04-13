/**
 * Hover Preview primitive.
 *
 * Desktop-only wrapper that opens an enlarged preview next to its children
 * after a short hover delay. The preview is rendered via a portal with
 * `pointer-events: none` so the underlying trigger remains clickable.
 *
 * The `renderPreview` render prop is only invoked while the preview is
 * open, so components mounted inside (e.g. live stream players) are
 * created on hover and torn down on leave.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const DEFAULT_HOVER_DELAY_MS = 400;
const DEFAULT_PREVIEW_WIDTH = 400;
const DEFAULT_DESKTOP_MIN_WIDTH = 768;
const EDGE_MARGIN = 12;

export interface HoverPreviewProps {
  /** Aspect ratio (width / height) used to size the preview box. */
  aspectRatio: number;
  /** Render prop called only while the preview is open. */
  renderPreview: () => ReactNode;
  /** Trigger element(s). */
  children: ReactNode;
  /** Width of the preview in pixels. Defaults to 400. */
  previewWidth?: number;
  /** Delay before opening, in ms. Defaults to 400. */
  hoverDelayMs?: number;
  /** Minimum viewport width considered "desktop". Defaults to 768. */
  desktopMinWidth?: number;
  /** data-testid on the preview portal root. */
  testId?: string;
  /** Extra className applied to the outer trigger wrapper. */
  className?: string;
}

export function HoverPreview({
  aspectRatio,
  renderPreview,
  children,
  previewWidth = DEFAULT_PREVIEW_WIDTH,
  hoverDelayMs = DEFAULT_HOVER_DELAY_MS,
  desktopMinWidth = DEFAULT_DESKTOP_MIN_WIDTH,
  testId,
  className = 'w-full h-full',
}: HoverPreviewProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= desktopMinWidth);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [desktopMinWidth]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const computePosition = () => {
    const anchor = anchorRef.current;
    if (!anchor) return null;
    const rect = anchor.getBoundingClientRect();
    const previewHeight = previewWidth / aspectRatio;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.right + EDGE_MARGIN;
    if (left + previewWidth > vw - EDGE_MARGIN) {
      left = rect.left - previewWidth - EDGE_MARGIN;
    }
    if (left < EDGE_MARGIN) left = EDGE_MARGIN;

    let top = rect.top + rect.height / 2 - previewHeight / 2;
    if (top + previewHeight > vh - EDGE_MARGIN) {
      top = vh - EDGE_MARGIN - previewHeight;
    }
    if (top < EDGE_MARGIN) top = EDGE_MARGIN;

    return { left, top };
  };

  const handleEnter = () => {
    if (!isDesktop) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      const pos = computePosition();
      if (pos) {
        setPosition(pos);
        setOpen(true);
      }
    }, hoverDelayMs);
  };

  const handleLeave = () => {
    clearTimer();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => {
      clearTimer();
      setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('wheel', close, { passive: true });
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('wheel', close);
    };
  }, [open]);

  useEffect(() => () => clearTimer(), []);

  const previewHeight = previewWidth / aspectRatio;

  return (
    <div
      ref={anchorRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={className}
    >
      {children}
      {open && position && createPortal(
        <div
          data-testid={testId}
          style={{
            position: 'fixed',
            left: position.left,
            top: position.top,
            width: previewWidth,
            height: previewHeight,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="rounded-md overflow-hidden shadow-2xl ring-1 ring-border bg-card"
        >
          {renderPreview()}
        </div>,
        document.body,
      )}
    </div>
  );
}
