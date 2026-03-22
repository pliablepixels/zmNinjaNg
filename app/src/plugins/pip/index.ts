import { registerPlugin } from '@capacitor/core';
import type { PipPlugin } from './definitions';

const Pip = registerPlugin<PipPlugin>('Pip', {
  web: () => import('./web').then((m) => new m.PipWeb()),
});

export * from './definitions';
export { Pip };
