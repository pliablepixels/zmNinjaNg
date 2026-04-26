import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { isPipSupportedMock, enterPipMock } = vi.hoisted(() => ({
  isPipSupportedMock: vi.fn(),
  enterPipMock: vi.fn(),
}));

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: {
      isNativePlatform: () => false,
      getPlatform: () => 'web',
    },
    registerPlugin: () => ({
      isPipSupported: isPipSupportedMock,
      enterPip: enterPipMock,
    }),
  };
});

import { engageOnReady } from '../index';

function setBrowserPipEnabled(enabled: boolean) {
  Object.defineProperty(document, 'pictureInPictureEnabled', {
    value: enabled,
    configurable: true,
    writable: true,
  });
}

describe('engageOnReady', () => {
  beforeEach(() => {
    isPipSupportedMock.mockReset();
    enterPipMock.mockReset();
    setBrowserPipEnabled(false);
  });

  afterEach(() => {
    setBrowserPipEnabled(false);
  });

  it('returns without throwing when called with a null video element', async () => {
    await expect(engageOnReady(null)).resolves.toBeUndefined();
    expect(isPipSupportedMock).not.toHaveBeenCalled();
    expect(enterPipMock).not.toHaveBeenCalled();
  });

  it('falls back to browser PiP when native plugin reports unsupported', async () => {
    isPipSupportedMock.mockResolvedValue({ supported: false });
    setBrowserPipEnabled(true);

    const requestPiP = vi.fn().mockResolvedValue(undefined);
    const videoEl = {
      currentSrc: 'https://example.test/stream.m3u8',
      currentTime: 12,
      videoWidth: 1280,
      videoHeight: 720,
      requestPictureInPicture: requestPiP,
    } as unknown as HTMLVideoElement;

    await engageOnReady(videoEl);

    expect(isPipSupportedMock).toHaveBeenCalledOnce();
    expect(enterPipMock).not.toHaveBeenCalled();
    expect(requestPiP).toHaveBeenCalledOnce();
  });

  it('uses native PiP when supported and a stream URL is present', async () => {
    isPipSupportedMock.mockResolvedValue({ supported: true });
    enterPipMock.mockResolvedValue({ position: 0 });

    const videoEl = {
      currentSrc: 'https://example.test/stream.m3u8',
      currentTime: 7,
      videoWidth: 1920,
      videoHeight: 1080,
    } as unknown as HTMLVideoElement;

    await engageOnReady(videoEl, { eventId: 'evt-42' });

    expect(enterPipMock).toHaveBeenCalledWith({
      url: 'https://example.test/stream.m3u8',
      position: 7,
      aspectRatio: '1920:1080',
    });
  });

  it('does not throw when no PiP path is available', async () => {
    isPipSupportedMock.mockResolvedValue({ supported: false });
    // pictureInPictureEnabled left undefined; element has no requestPictureInPicture

    const videoEl = {
      currentSrc: '',
      currentTime: 0,
      videoWidth: 0,
      videoHeight: 0,
    } as unknown as HTMLVideoElement;

    await expect(engageOnReady(videoEl)).resolves.toBeUndefined();
  });

  it('swallows errors from native enterPip and continues to browser fallback', async () => {
    isPipSupportedMock.mockResolvedValue({ supported: true });
    enterPipMock.mockRejectedValue(new Error('boom'));
    setBrowserPipEnabled(true);

    const requestPiP = vi.fn().mockResolvedValue(undefined);
    const videoEl = {
      currentSrc: 'https://example.test/stream.m3u8',
      currentTime: 0,
      videoWidth: 640,
      videoHeight: 480,
      requestPictureInPicture: requestPiP,
    } as unknown as HTMLVideoElement;

    await expect(engageOnReady(videoEl)).resolves.toBeUndefined();
    expect(requestPiP).toHaveBeenCalledOnce();
  });
});
