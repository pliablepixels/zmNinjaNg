import { test as base, chromium, type Page } from '@playwright/test';
import { platformConfig } from '../platforms.config';

export const test = base.extend<{ androidPage: Page }>({
  androidPage: async ({}, use) => {
    const cdpUrl = `http://localhost:${platformConfig.android.cdpPort}`;
    const browser = await chromium.connectOverCDP(cdpUrl);
    const defaultContext = browser.contexts()[0];
    const page = defaultContext?.pages()[0] ?? await defaultContext.newPage();
    await use(page);
    await browser.close();
  },
});
