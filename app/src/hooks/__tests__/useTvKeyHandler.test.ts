import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let mockTvMode = true;
vi.mock('../useTvMode', () => ({
  useTvMode: () => ({ isTvMode: mockTvMode }),
}));

describe('useTvKeyHandler', () => {
  beforeEach(() => {
    mockTvMode = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls handler when matching key is pressed in TV mode', async () => {
    const { useTvKeyHandler } = await import('../useTvKeyHandler');
    const leftHandler = vi.fn();
    renderHook(() => useTvKeyHandler({ ArrowLeft: leftHandler }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(leftHandler).toHaveBeenCalledTimes(1);
  });

  it('does not call handler when TV mode is off', async () => {
    mockTvMode = false;
    const { useTvKeyHandler } = await import('../useTvKeyHandler');
    const leftHandler = vi.fn();
    renderHook(() => useTvKeyHandler({ ArrowLeft: leftHandler }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(leftHandler).not.toHaveBeenCalled();
  });

  it('does not intercept keys without a handler', async () => {
    const { useTvKeyHandler } = await import('../useTvKeyHandler');
    const leftHandler = vi.fn();
    renderHook(() => useTvKeyHandler({ ArrowLeft: leftHandler }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(leftHandler).not.toHaveBeenCalled();
  });

  it('synthesizes click on Enter when focused element has no native handler', async () => {
    const { useTvKeyHandler } = await import('../useTvKeyHandler');
    renderHook(() => useTvKeyHandler({}));

    const div = document.createElement('div');
    const clickHandler = vi.fn();
    div.addEventListener('click', clickHandler);
    div.setAttribute('tabindex', '0');
    document.body.appendChild(div);
    div.focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(clickHandler).toHaveBeenCalledTimes(1);

    document.body.removeChild(div);
  });

  it('does not synthesize click on Enter for native button elements', async () => {
    const { useTvKeyHandler } = await import('../useTvKeyHandler');
    renderHook(() => useTvKeyHandler({}));

    const button = document.createElement('button');
    const clickHandler = vi.fn();
    button.addEventListener('click', clickHandler);
    document.body.appendChild(button);
    button.focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(clickHandler).not.toHaveBeenCalled();

    document.body.removeChild(button);
  });

  it('cleans up listener on unmount', async () => {
    const { useTvKeyHandler } = await import('../useTvKeyHandler');
    const handler = vi.fn();
    const { unmount } = renderHook(() => useTvKeyHandler({ ArrowLeft: handler }));

    unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(handler).not.toHaveBeenCalled();
  });
});
