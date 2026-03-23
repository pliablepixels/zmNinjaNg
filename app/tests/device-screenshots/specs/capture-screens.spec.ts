/**
 * Device Screenshot Capture
 *
 * Logs into the app, navigates to every screen, and captures
 * portrait + landscape screenshots. That's it.
 *
 * Run: npm run test:e2e:ios-tablet (or ios-phone, android)
 */

import * as fs from 'fs';
import * as path from 'path';
import { testConfig } from '../../helpers/config';

const SCREENS = [
  { name: 'dashboard', route: 'dashboard' },
  { name: 'monitors', route: 'monitors' },
  { name: 'montage', route: 'montage' },
  { name: 'events', route: 'events' },
  { name: 'timeline', route: 'timeline' },
  { name: 'notifications', route: 'notifications' },
  { name: 'profiles', route: 'profiles' },
  { name: 'settings', route: 'settings' },
  { name: 'server-info', route: 'server' },
  { name: 'logs', route: 'logs' },
];

// Device name from capabilities for folder naming
function getDeviceName(): string {
  const caps = browser.capabilities as Record<string, unknown>;
  const deviceName = (caps['appium:deviceName'] as string)
    ?? (caps['deviceName'] as string)
    ?? process.env.TEST_DEVICE
    ?? 'unknown-device';
  return deviceName.replace(/\s+/g, '-').toLowerCase();
}

function getOutputDir(): string {
  const deviceName = getDeviceName();
  const timestamp = new Date().toISOString().split('T')[0];
  const dir = path.resolve(process.cwd(), 'tests', 'screenshots', 'devices', `${deviceName}-${timestamp}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function ensureWebviewContext(): Promise<void> {
  const ctx = await browser.getContext();
  if (typeof ctx === 'string' && ctx.includes('WEBVIEW')) return;
  const contexts = await browser.getContexts();
  const webview = contexts.find((c) => c.toString().includes('WEBVIEW'));
  if (webview) await browser.switchContext(webview.toString());
}

async function saveScreenshot(outputDir: string, name: string): Promise<void> {
  await browser.pause(1500); // Let animations settle
  const buffer = Buffer.from(await browser.takeScreenshot(), 'base64');
  const filePath = path.join(outputDir, `${name}.png`);
  fs.writeFileSync(filePath, buffer);
}

async function setOrientation(orientation: 'PORTRAIT' | 'LANDSCAPE'): Promise<void> {
  try {
    await browser.setOrientation(orientation);
    await browser.pause(1000); // Let layout reflow
  } catch {
    // Orientation change may not be supported in some contexts
  }
}

async function login(): Promise<void> {
  await ensureWebviewContext();
  await browser.url('/');
  await browser.pause(3000);

  // Wait for app init blocker to disappear
  try {
    const blocker = await $('[data-testid="app-init-blocker"]');
    await blocker.waitForDisplayed({ timeout: 30000, reverse: true });
  } catch {
    // Already gone or doesn't exist
  }

  await browser.pause(2000);

  // Check if already logged in
  const navVisible = await $('[data-testid="nav-item-dashboard"]')
    .isDisplayed().catch(() => false);

  if (navVisible) return;

  // Fill login form
  const { host, username, password } = testConfig.server;

  // Try by input ID first, then by placeholder
  let serverInput = await $('#portal');
  if (!(await serverInput.isDisplayed().catch(() => false))) {
    serverInput = await $('input[placeholder*="demo.zoneminder"]');
  }

  if (await serverInput.isDisplayed().catch(() => false)) {
    await serverInput.clearValue();
    await serverInput.setValue(host);

    if (username) {
      const userInput = await $('#username');
      if (await userInput.isDisplayed().catch(() => false)) {
        await userInput.clearValue();
        await userInput.setValue(username);
      }
    }

    if (password) {
      const passInput = await $('#password');
      if (await passInput.isDisplayed().catch(() => false)) {
        await passInput.clearValue();
        await passInput.setValue(password);
      }
    }

    let connectBtn = await $('[data-testid="connect-button"]');
    if (!(await connectBtn.isDisplayed().catch(() => false))) {
      connectBtn = await $('button*=Connect');
    }
    await connectBtn.click();

    // Wait for login to complete
    await browser.waitUntil(
      async () => {
        const nav = await $('[data-testid^="nav-item-"]');
        return nav.isDisplayed().catch(() => false);
      },
      { timeout: 30000 },
    );
  }
}

describe('Device Screenshot Capture', () => {
  let outputDir: string;

  before(async () => {
    outputDir = getOutputDir();
    await login();
    process.stdout.write(`\n[screenshots] Saving to: ${outputDir}\n`);
  });

  for (const screen of SCREENS) {
    it(`captures ${screen.name} in portrait and landscape`, async () => {
      // Navigate via hash
      await browser.execute((r: string) => {
        window.location.hash = `#/${r}`;
      }, screen.route);
      await browser.pause(3000); // Let page fully load

      // Portrait
      await setOrientation('PORTRAIT');
      await saveScreenshot(outputDir, `${screen.name}-portrait`);

      // Landscape
      await setOrientation('LANDSCAPE');
      await saveScreenshot(outputDir, `${screen.name}-landscape`);

      // Reset to portrait for next screen
      await setOrientation('PORTRAIT');
    });
  }

  after(async () => {
    const count = fs.readdirSync(outputDir).filter((f) => f.endsWith('.png')).length;
    process.stdout.write(`\n[screenshots] Captured ${count} screenshots for ${getDeviceName()}\n`);
    process.stdout.write(`[screenshots] Output: ${outputDir}\n`);
  });
});
