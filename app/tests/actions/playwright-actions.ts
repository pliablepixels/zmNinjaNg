import { type Page, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { platformConfig } from '../platforms.config';
import type { PlatformProfile } from '../platforms.config.defaults';
import type { TestActions } from './types';

export class PlaywrightActions implements TestActions {
  private readonly page: Page;
  private readonly platformName: PlatformProfile;
  private readonly screenshotDir: string;

  constructor(page: Page, platformName: PlatformProfile, screenshotDir: string) {
    this.page = page;
    this.platformName = platformName;
    this.screenshotDir = screenshotDir;
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: 'networkidle' });
  }

  async click(testId: string): Promise<void> {
    await this.page.getByTestId(testId).click();
  }

  async clickByRole(role: string, name: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.page.getByRole(role as any, { name }).click();
  }

  async clickByText(text: string): Promise<void> {
    await this.page.getByText(text).click();
  }

  async fill(testId: string, value: string): Promise<void> {
    await this.page.getByTestId(testId).fill(value);
  }

  async getText(testId: string): Promise<string> {
    return (await this.page.getByTestId(testId).textContent()) ?? '';
  }

  async getAllTexts(testId: string): Promise<string[]> {
    return this.page.getByTestId(testId).allTextContents();
  }

  async isVisible(testId: string, timeout?: number): Promise<boolean> {
    try {
      await this.page.getByTestId(testId).waitFor({
        state: 'visible',
        timeout: timeout ?? platformConfig.timeouts.element,
      });
      return true;
    } catch {
      return false;
    }
  }

  async waitForVisible(testId: string, timeout?: number): Promise<void> {
    await this.page.getByTestId(testId).waitFor({
      state: 'visible',
      timeout: timeout ?? platformConfig.timeouts.element,
    });
  }

  async waitForHidden(testId: string, timeout?: number): Promise<void> {
    await this.page.getByTestId(testId).waitFor({
      state: 'hidden',
      timeout: timeout ?? platformConfig.timeouts.element,
    });
  }

  async getCount(testId: string): Promise<number> {
    return this.page.getByTestId(testId).count();
  }

  async getAttribute(testId: string, attr: string): Promise<string | null> {
    return this.page.getByTestId(testId).getAttribute(attr);
  }

  async hasClass(testId: string, className: string): Promise<boolean> {
    const classAttr = await this.page.getByTestId(testId).getAttribute('class');
    return classAttr?.split(' ').includes(className) ?? false;
  }

  async getCssValue(testId: string, property: string): Promise<string> {
    return this.page.getByTestId(testId).evaluate(
      (el, prop) => window.getComputedStyle(el).getPropertyValue(prop),
      property,
    );
  }

  async getBoundingBox(testId: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
    return this.page.getByTestId(testId).boundingBox();
  }

  async getViewportSize(): Promise<{ width: number; height: number }> {
    const size = this.page.viewportSize();
    return size ?? { width: 0, height: 0 };
  }

  async scrollTo(testId: string): Promise<void> {
    await this.page.getByTestId(testId).scrollIntoViewIfNeeded();
  }

  async screenshot(name: string): Promise<Buffer> {
    const dir = path.join(this.screenshotDir, this.platformName);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${name}.png`);
    const buffer = await this.page.screenshot();
    fs.writeFileSync(filePath, buffer);
    return buffer;
  }

  async compareScreenshot(name: string, threshold?: number): Promise<void> {
    const dir = path.join(this.screenshotDir, this.platformName);
    const baselinePath = path.join(dir, `${name}.png`);

    if (!fs.existsSync(baselinePath)) {
      fs.mkdirSync(dir, { recursive: true });
      const buffer = await this.page.screenshot();
      fs.writeFileSync(baselinePath, buffer);
      return;
    }

    await expect(this.page).toHaveScreenshot(`${name}.png`, {
      maxDiffPixelRatio: threshold ?? 0.01,
    });
  }

  async currentPath(): Promise<string> {
    return new URL(this.page.url()).pathname;
  }

  async waitForNavigation(timeout?: number): Promise<void> {
    await this.page.waitForLoadState('networkidle', {
      timeout: timeout ?? platformConfig.timeouts.navigation,
    });
  }

  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'networkidle' });
  }

  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  platform(): PlatformProfile {
    return this.platformName;
  }
}
