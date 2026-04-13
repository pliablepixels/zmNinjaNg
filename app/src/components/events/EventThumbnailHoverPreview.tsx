/**
 * Event Thumbnail Hover Preview
 *
 * Desktop-only wrapper that shows a larger preview of an event thumbnail
 * after a short hover delay. The preview is rendered via a portal with
 * `pointer-events: none` so the underlying thumbnail remains clickable.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EventThumbnail } from './EventThumbnail';

const HOVER_DELAY_MS = 400;
const PREVIEW_WIDTH = 400;
const DESKTOP_MIN_WIDTH = 768;
const EDGE_MARGIN = 12;

interface EventThumbnailHoverPreviewProps {
  urls: string[];
  cacheKey: string;
  alt?: string;
  aspectRatio: number;
  children: ReactNode;
}

export function EventThumbnailHoverPreview({
  urls,
  cacheKey,
  alt,
  aspectRatio,
  children,
}: EventThumbnailHoverPreviewProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= DESKTOP_MIN_WIDTH);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
    const previewHeight = PREVIEW_WIDTH / aspectRatio;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer placing to the right of the anchor
    let left = rect.right + EDGE_MARGIN;
    if (left + PREVIEW_WIDTH > vw - EDGE_MARGIN) {
      // Fall back to the left side
      left = rect.left - PREVIEW_WIDTH - EDGE_MARGIN;
    }
    if (left < EDGE_MARGIN) {
      left = EDGE_MARGIN;
    }

    let top = rect.top + rect.height / 2 - previewHeight / 2;
    if (top + previewHeight > vh - EDGE_MARGIN) {
      top = vh - EDGE_MARGIN - previewHeight;
    }
    if (top < EDGE_MARGIN) {
      top = EDGE_MARGIN;
    }

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
    }, HOVER_DELAY_MS);
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

  const previewHeight = PREVIEW_WIDTH / aspectRatio;

  return (
    <div
      ref={anchorRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="w-full h-full"
    >
      {children}
      {open && position && createPortal(
        <div
          data-testid="event-thumbnail-hover-preview"
          style={{
            position: 'fixed',
            left: position.left,
            top: position.top,
            width: PREVIEW_WIDTH,
            height: previewHeight,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="rounded-md overflow-hidden shadow-2xl ring-1 ring-border bg-card"
        >
          <EventThumbnail
            urls={urls}
            cacheKey={`${cacheKey}-hover-preview`}
            alt={alt}
            className="w-full h-full"
            objectFit="contain"
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
