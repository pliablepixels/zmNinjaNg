import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EventThumbnail, __resetThumbnailCache } from '../EventThumbnail';

describe('EventThumbnail', () => {
  beforeEach(() => {
    __resetThumbnailCache();
    cleanup();
  });

  it('renders the first URL initially and hides until loaded', () => {
    render(
      <EventThumbnail
        urls={['https://example.test/a.jpg', 'https://example.test/b.jpg']}
        cacheKey="evt-1"
        alt="thumb"
      />
    );
    const img = screen.getByAltText('thumb') as HTMLImageElement;
    expect(img.src).toBe('https://example.test/a.jpg');
    expect(img.style.opacity).toBe('0');
    expect(img.getAttribute('data-thumbnail-state')).toBe('loading');
  });

  it('shows image at opacity 1 after load', () => {
    render(
      <EventThumbnail
        urls={['https://example.test/a.jpg']}
        cacheKey="evt-1"
        alt="thumb"
      />
    );
    const img = screen.getByAltText('thumb') as HTMLImageElement;
    fireEvent.load(img);
    expect(img.style.opacity).toBe('1');
    expect(img.getAttribute('data-thumbnail-state')).toBe('loaded');
  });

  it('advances to next URL on error', () => {
    render(
      <EventThumbnail
        urls={['https://example.test/a.jpg', 'https://example.test/b.jpg']}
        cacheKey="evt-1"
        alt="thumb"
      />
    );
    const img = screen.getByAltText('thumb') as HTMLImageElement;
    fireEvent.error(img);
    const next = screen.getByAltText('thumb') as HTMLImageElement;
    expect(next.src).toBe('https://example.test/b.jpg');
  });

  it('shows placeholder when chain exhausted', () => {
    render(
      <EventThumbnail
        urls={['https://example.test/a.jpg']}
        cacheKey="evt-1"
        alt="thumb"
      />
    );
    const img = screen.getByAltText('thumb') as HTMLImageElement;
    fireEvent.error(img);
    const placeholder = screen.getByLabelText('thumb');
    expect(placeholder.getAttribute('data-thumbnail-state')).toBe('placeholder');
    expect(placeholder.tagName).toBe('DIV');
    expect(placeholder.querySelector('svg')).not.toBeNull();
  });

  it('renders placeholder directly for empty chain', () => {
    render(<EventThumbnail urls={[]} cacheKey="evt-1" alt="thumb" />);
    const placeholder = screen.getByLabelText('thumb');
    expect(placeholder.getAttribute('data-thumbnail-state')).toBe('placeholder');
    expect(placeholder.querySelector('svg')).not.toBeNull();
  });

  it('caches winning index and reuses on remount', () => {
    const urls = ['https://example.test/a.jpg', 'https://example.test/b.jpg'];
    const { unmount } = render(
      <EventThumbnail urls={urls} cacheKey="evt-1" alt="thumb" />
    );
    let img = screen.getByAltText('thumb') as HTMLImageElement;
    fireEvent.error(img); // skip a.jpg
    img = screen.getByAltText('thumb') as HTMLImageElement;
    fireEvent.load(img); // b.jpg loads — cache index 1
    unmount();

    render(<EventThumbnail urls={urls} cacheKey="evt-1" alt="thumb" />);
    const remounted = screen.getByAltText('thumb') as HTMLImageElement;
    expect(remounted.src).toBe('https://example.test/b.jpg');
  });

  it('resets index when cacheKey changes', () => {
    const urls = ['https://example.test/a.jpg', 'https://example.test/b.jpg'];
    const { rerender } = render(
      <EventThumbnail urls={urls} cacheKey="evt-1" alt="thumb" />
    );
    fireEvent.error(screen.getByAltText('thumb'));
    rerender(<EventThumbnail urls={urls} cacheKey="evt-2" alt="thumb" />);
    const img = screen.getByAltText('thumb') as HTMLImageElement;
    expect(img.src).toBe('https://example.test/a.jpg');
  });
});
