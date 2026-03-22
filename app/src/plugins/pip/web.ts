import { WebPlugin } from '@capacitor/core';
import type { PipPlugin } from './definitions';

export class PipWeb extends WebPlugin implements PipPlugin {
  async isPipSupported(): Promise<{ supported: boolean }> {
    // On web, PiP is handled by the browser API via PipContext — not this plugin
    return { supported: false };
  }

  async enterPip(_options: {
    url: string;
    position?: number;
    aspectRatio?: string;
  }): Promise<{ position: number }> {
    throw new Error('Native PiP is not available on web');
  }
}
