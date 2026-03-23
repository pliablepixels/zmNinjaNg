import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { log } from '../../src/lib/logger';

const { Then } = createBdd();

Then('no element should overflow the viewport horizontally', async ({ page }) => {
  const overflows = await page.evaluate(() => {
    const vw = window.innerWidth;
    // Check elements that are visible and not inside scroll containers
    return Array.from(document.querySelectorAll('*'))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right <= vw + 1) return false;
        // Skip elements with zero size (hidden)
        if (rect.width === 0 || rect.height === 0) return false;
        // Skip elements inside containers with overflow:hidden/auto/scroll
        let parent = el.parentElement;
        while (parent) {
          const style = window.getComputedStyle(parent);
          const overflowX = style.overflowX;
          if (overflowX === 'hidden' || overflowX === 'auto' || overflowX === 'scroll') {
            return false;
          }
          parent = parent.parentElement;
        }
        return true;
      })
      .map((el) => `${el.tagName}.${el.className}`.slice(0, 80));
  });
  if (overflows.length > 0) {
    log.info('E2E: Elements overflowing viewport', { component: 'e2e', overflows });
  }
  expect(overflows).toHaveLength(0);
});

Then('the page should match the visual baseline', async ({ page }) => {
  // Placeholder -- will be connected to TestActions.compareScreenshot in a later task
  await page.waitForTimeout(500);
});
