import type { PlatformProfile } from '../platforms.config.defaults';

export interface TestActions {
  goto(path: string): Promise<void>;
  click(testId: string): Promise<void>;
  clickByRole(role: string, name: string): Promise<void>;
  clickByText(text: string): Promise<void>;
  fill(testId: string, value: string): Promise<void>;
  getText(testId: string): Promise<string>;
  getAllTexts(testId: string): Promise<string[]>;
  isVisible(testId: string, timeout?: number): Promise<boolean>;
  waitForVisible(testId: string, timeout?: number): Promise<void>;
  waitForHidden(testId: string, timeout?: number): Promise<void>;
  getCount(testId: string): Promise<number>;
  getAttribute(testId: string, attr: string): Promise<string | null>;
  hasClass(testId: string, className: string): Promise<boolean>;
  getCssValue(testId: string, property: string): Promise<string>;
  getBoundingBox(testId: string): Promise<{ x: number; y: number; width: number; height: number } | null>;
  getViewportSize(): Promise<{ width: number; height: number }>;
  scrollTo(testId: string): Promise<void>;
  screenshot(name: string): Promise<Buffer>;
  compareScreenshot(name: string, threshold?: number): Promise<void>;
  currentPath(): Promise<string>;
  waitForNavigation(timeout?: number): Promise<void>;
  reload(): Promise<void>;
  wait(ms: number): Promise<void>;
  platform(): PlatformProfile;
}
