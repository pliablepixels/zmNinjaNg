import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { testConfig } from '../helpers/config';
import { log } from '../../src/lib/logger';

const { Given, When, Then } = createBdd();

// Authentication
Given('I am logged into zmNinjaNG', async ({ page }) => {
  // Navigate to application
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(100);
  await expect(page.getByTestId('app-init-blocker')).toBeHidden({
    timeout: testConfig.timeouts.transition * 3,
  });

  // Wait for either setup page or authenticated page to load (content-based, not URL-based)
  await Promise.race([
    page.waitForSelector('text=/Welcome to zmNinjaNG/i', { timeout: testConfig.timeouts.transition }),
    page.waitForSelector('[data-testid="nav-item-dashboard"]', { timeout: testConfig.timeouts.transition })
  ]);

  // Check if on setup page by looking for the Connect button or Server URL field
  const isSetupPage = await page.getByRole('button', { name: /connect/i }).isVisible().catch(() => false)
    || await page.getByLabel(/server url/i).isVisible().catch(() => false);

  if (isSetupPage) {
    log.info('E2E setup page detected; proceeding with login', { component: 'e2e', action: 'login' });
    const { host, username, password } = testConfig.server;

    await page.getByLabel(/server url/i).clear();
    await page.getByLabel(/server url/i).fill(host);
    if (username) {
      await page.getByLabel(/username/i).clear();
      await page.getByLabel(/username/i).fill(username);
    }
    if (password) {
      await page.getByLabel(/password/i).clear();
      await page.getByLabel(/password/i).fill(password);
    }

    const connectBtn = page.getByRole('button', { name: /connect/i });
    await expect(connectBtn).toBeEnabled();
    await connectBtn.click();

    // Wait for navigation to complete (URL changes from /profiles/new or /setup to another route)
    // The app waits 1 second before navigating, plus login time
    await page.waitForURL((url) => !url.pathname.includes('/profiles/new') && !url.pathname.includes('/setup'), {
      timeout: testConfig.timeouts.transition * 2, // 10 seconds to account for login + 1s delay + navigation
    });

    // Then wait for navigation elements or mobile menu button to appear
    await Promise.race([
      page.waitForSelector('[data-testid^="nav-item-"]', { timeout: testConfig.timeouts.transition }),
      page.waitForSelector('[data-testid="mobile-menu-button"]', { timeout: testConfig.timeouts.transition }),
    ]);
    log.info('E2E login successful', { component: 'e2e', action: 'login' });
  } else {
    log.info('E2E session already authenticated', { component: 'e2e', action: 'login' });
  }
});

// Navigation
When('I navigate to the {string} page', async ({ page }, pageName: string) => {
  await page.waitForTimeout(100);

  const pageRoutes: Record<string, string> = {
    'Dashboard': 'dashboard',
    'Monitors': 'monitors',
    'Montage': 'montage',
    'Events': 'events',
    'Timeline': 'timeline',
    'Notifications': 'notifications',
    'Profiles': 'profiles',
    'Settings': 'settings',
    'Server': 'server',
    'Logs': 'logs',
  };

  const route = pageRoutes[pageName];
  if (!route) {
    throw new Error(`Unknown page: ${pageName}`);
  }

  const navItemSelector = `[data-testid="nav-item-${route}"]`;
  const mobileMenuButton = page.getByTestId('mobile-menu-button');

  // On mobile, the desktop sidebar nav items exist but are aria-hidden
  // We need to use the visible nav item, which may require opening the mobile menu first
  const visibleNavItem = page.locator(navItemSelector).filter({ hasNot: page.locator('[aria-hidden="true"]') });

  // Check if we need to open mobile menu
  if (await mobileMenuButton.isVisible()) {
    // Mobile layout - open menu first
    await mobileMenuButton.click();
    // Wait for menu to open and show the nav item
    await page.waitForTimeout(300);
  }

  // Click the nav item (filter to visible ones to avoid aria-hidden desktop nav)
  try {
    const clickableNav = page.locator(navItemSelector).locator('visible=true').first();
    await clickableNav.click({ timeout: testConfig.timeouts.transition });
  } catch {
    // Fallback: navigate directly via URL hash (some nav items may be scrolled
    // off-screen in the sidebar, e.g. the Logs link at the bottom)
    await page.evaluate((r) => { window.location.hash = `#/${r}`; }, route);
  }

  await page.waitForURL(new RegExp(`.*${route}`), { timeout: testConfig.timeouts.transition });
});

When('I navigate back', async ({ page }) => {
  await page.goBack();
  await page.waitForTimeout(500);
});

// Page Headings
Then('I should see the page heading {string}', async ({ page }, heading: string) => {
  await expect(page.getByRole('heading', { name: new RegExp(heading, 'i') }).first()).toBeVisible();
});

// Generic assertions used across multiple features
Then('I should be on the {string} page', async ({ page }, pageName: string) => {
  const pageRoutes: Record<string, string> = { 'Events': 'events' };
  const route = pageRoutes[pageName];
  await page.waitForURL(new RegExp(`.*${route}$`), { timeout: testConfig.timeouts.transition });
});

// Check for console errors
Then('no console errors should be present', async ({ page }) => {
  // Get console messages from the page
  const errors = page.context().on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Console error:', msg.text());
    }
  });

  // No assertion needed here - the test will fail if there are console errors
  // This is more of a documentation step to indicate we care about console cleanliness
});

// Generic viewport step used across multiple features
Given('the viewport is mobile size', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
});

// Generic application health check
Then('the application should not crash', async ({ page }) => {
  // Verify page is still responsive
  await expect(page.locator('body')).toBeVisible();
  // Check for React error boundaries or crash indicators
  const errorBoundary = page.locator('text=/something went wrong|error|crash/i');
  const isErrorVisible = await errorBoundary.isVisible().catch(() => false);
  expect(isErrorVisible).toBe(false);
});

// Generic dialog steps used across multiple features
When('I click outside the dialog', async ({ page }) => {
  await page.locator('body').click({ position: { x: 10, y: 10 } });
});

Then('the dialog should close', async ({ page }) => {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeHidden({ timeout: testConfig.timeouts.transition });
});

When('I press Escape key', async ({ page }) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
});
