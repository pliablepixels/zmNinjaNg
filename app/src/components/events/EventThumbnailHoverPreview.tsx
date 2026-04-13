/**
 * Event Thumbnail Hover Preview
 *
 * Desktop-only wrapper that shows a larger preview of an event thumbnail
 * after a short hover delay.
 */

import type { ReactNode } from 'react';
import { HoverPreview } from '../ui/hover-preview';
import { EventThumbnail } from './EventThumbnail';

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
  return (
    <HoverPreview
      aspectRatio={aspectRatio}
      testId="event-thumbnail-hover-preview"
      renderPreview={() => (
        <EventThumbnail
          urls={urls}
          cacheKey={`${cacheKey}-hover-preview`}
          alt={alt}
          className="w-full h-full"
          objectFit="contain"
        />
      )}
    >
      {children}
    </HoverPreview>
  );
}
