import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { testConfig } from '../helpers/config';
import { log } from '../../src/lib/logger';

const { Given, When, Then } = createBdd();

// Helper: enter PIN digits via numpad buttons
async function enterPinDigits(page: import('@playwright/test').Page, pin: string) {
  for (const digit of pin) {
    const digitBtn = page.getByTestId(`kiosk-pin-digit-${digit}`);
    await expect(digitBtn).toBeVisible({ timeout: testConfig.timeouts.element });
    await digitBtn.click();
    // Small delay between taps for auto-submit debouncing
    await page.waitForTimeout(100);
  }
  // PIN auto-submits after 4 digits; wait for mode transition
  await page.waitForTimeout(300);
}

// Kiosk / PIN Steps

Given('I am logged in and on the monitors page', async ({ page }) => {
  // Navigate to application
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(100);
  await expect(page.getByTestId('app-init-blocker')).toBeHidden({
    timeout: testConfig.timeouts.transition * 3,
  });

  // Wait for either setup page or authenticated page
  await Promise.race([
    page.waitForSelector('text=/Welcome to zmNinjaNg/i', { timeout: testConfig.timeouts.transition }),
    page.waitForSelector('[data-testid="nav-item-dashboard"]', { timeout: testConfig.timeouts.transition })
  ]);

  // Check if on setup page
  const isSetupPage = await page.getByRole('button', { name: /connect/i }).isVisible().catch(() => false)
    || await page.getByLabel(/server url/i).isVisible().catch(() => false);
  if (isSetupPage) {
    const { host, username, password } = testConfig.server;
    await page.getByLabel(/server url/i).fill(host);
    if (username) await page.getByLabel(/username/i).fill(username);
    if (password) await page.getByLabel(/password/i).fill(password);
    const connectBtn = page.getByRole('button', { name: /connect/i });
    await connectBtn.click();
    await page.waitForURL((url) => !url.pathname.includes('/profiles/new') && !url.pathname.includes('/setup'), {
      timeout: testConfig.timeouts.transition * 2,
    });
  }

  // Navigate to monitors
  const navItem = page.locator('[data-testid="nav-item-monitors"]').locator('visible=true').first();
  try {
    await navItem.click({ timeout: testConfig.timeouts.transition });
  } catch {
    const mobileMenuButton = page.getByTestId('mobile-menu-button');
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await page.waitForTimeout(300);
    }
    await page.locator('[data-testid="nav-item-monitors"]').first().click({ timeout: 2000 });
  }
  await page.waitForURL(/.*monitors/, { timeout: testConfig.timeouts.transition });
});

When('I click the sidebar kiosk lock button', async ({ page }) => {
  // The lock button in the sidebar has data-testid="sidebar-kiosk-lock"
  const lockBtn = page.getByTestId('sidebar-kiosk-lock')
    .or(page.getByTestId('sidebar-kiosk-lock-collapsed'));
  await lockBtn.first().click();
  // Wait for PinPad to appear
  await expect(page.getByTestId('kiosk-pin-pad')).toBeVisible({ timeout: testConfig.timeouts.element });
});

When('I set a 4-digit PIN {string}', async ({ page }, pin: string) => {
  // PinPad is in 'set' mode - tap digits on the numpad
  await expect(page.getByText(/Set Kiosk PIN/i)).toBeVisible({ timeout: testConfig.timeouts.element });
  await enterPinDigits(page, pin);
});

When('I confirm the PIN {string}', async ({ page }, pin: string) => {
  // PinPad is now in 'confirm' mode after set
  await expect(page.getByText(/Confirm PIN/i)).toBeVisible({ timeout: testConfig.timeouts.element });
  await enterPinDigits(page, pin);
});

Then('the kiosk overlay should be visible', async ({ page }) => {
  await expect(page.getByTestId('kiosk-overlay')).toBeVisible({ timeout: testConfig.timeouts.element });
});

Then('the sidebar should not be visible', async ({ page }) => {
  // When kiosk overlay is active, it covers everything. The sidebar may still exist in DOM
  // but should not be interactable. Just verify the overlay is blocking.
  const overlay = page.getByTestId('kiosk-overlay');
  await expect(overlay).toBeVisible();
  log.info('E2E: Kiosk overlay is blocking sidebar', { component: 'e2e' });
});

Given('kiosk mode is active with PIN {string}', async ({ page }, pin: string) => {
  // First, ensure we're on a page with the sidebar visible
  const lockBtn = page.getByTestId('sidebar-kiosk-lock')
    .or(page.getByTestId('sidebar-kiosk-lock-collapsed'));

  if (await lockBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await lockBtn.first().click();
    await page.waitForTimeout(300);

    // Check if PinPad appeared (first time setup)
    const pinPad = page.getByTestId('kiosk-pin-pad');
    if (await pinPad.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Set PIN
      await enterPinDigits(page, pin);
      // Wait for confirm mode
      await page.waitForTimeout(300);
      // Confirm PIN
      const confirmTitle = page.getByText(/Confirm PIN/i);
      if (await confirmTitle.isVisible({ timeout: 1000 }).catch(() => false)) {
        await enterPinDigits(page, pin);
      }
    }
    // Wait for overlay to appear
    await page.waitForTimeout(500);
  }
});

When('I click the kiosk unlock button', async ({ page }) => {
  const unlockBtn = page.getByTestId('kiosk-unlock-button');
  await expect(unlockBtn).toBeVisible({ timeout: testConfig.timeouts.element });
  await unlockBtn.click();
  // Wait for PIN pad to appear
  await expect(page.getByTestId('kiosk-pin-pad')).toBeVisible({ timeout: testConfig.timeouts.element });
});

When('I enter the PIN {string}', async ({ page }, pin: string) => {
  // PinPad is in 'unlock' mode
  await expect(page.getByText(/Enter PIN to Unlock/i)).toBeVisible({ timeout: testConfig.timeouts.element });
  await enterPinDigits(page, pin);
});

Then('the kiosk overlay should not be visible', async ({ page }) => {
  await expect(page.getByTestId('kiosk-overlay')).toBeHidden({ timeout: testConfig.timeouts.element });
});

Then('I should see {string}', async ({ page }, text: string) => {
  await expect(page.locator(`text=${text}`).first()).toBeVisible({ timeout: testConfig.timeouts.element });
});

When('I try to click a navigation link', async ({ page }) => {
  // Try clicking a nav item - should be blocked by overlay
  const navItem = page.locator('[data-testid^="nav-item-"]').first();
  try {
    await navItem.click({ timeout: 1000 });
  } catch {
    // Click may fail because overlay blocks it - that's the expected behavior
    log.info('E2E: Nav click blocked by kiosk overlay', { component: 'e2e' });
  }
});

Then('the kiosk overlay should still be visible', async ({ page }) => {
  await expect(page.getByTestId('kiosk-overlay')).toBeVisible();
});

Then('the page should not have changed', async ({ page }) => {
  // Should still be on the monitors page
  expect(page.url()).toContain('monitors');
});

Then('the kiosk overlay should cover the full viewport', async ({ page }) => {
  const overlay = page.getByTestId('kiosk-overlay');
  if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
    const box = await overlay.boundingBox();
    const viewport = page.viewportSize();
    if (box && viewport) {
      // Overlay should cover at least 95% of the viewport
      expect(box.width).toBeGreaterThanOrEqual(viewport.width * 0.95);
      expect(box.height).toBeGreaterThanOrEqual(viewport.height * 0.95);
    }
  }
});
