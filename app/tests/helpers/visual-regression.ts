import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');
export const DEFAULT_THRESHOLD = 0.002;

export function screenshotPath(platform: string, name: string): string {
  return path.join(SCREENSHOT_DIR, platform, `${name}.png`);
}

export function diffPath(platform: string, name: string): string {
  return path.join(SCREENSHOT_DIR, platform, `${name}-diff.png`);
}
