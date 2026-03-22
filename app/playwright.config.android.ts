import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'tests/features/**/*.feature',
  steps: 'tests/steps/**/*.steps.ts',
  featuresRoot: 'tests/features',
  tags: 'not @native and not @ios and not @ios-phone and not @ios-tablet and not @tauri and not @web',
});

export default defineConfig({
  testDir,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    trace: 'on',
    screenshot: 'on',
    viewport: { width: 412, height: 915 },
  },
  projects: [
    {
      name: 'android-phone',
    },
  ],
  reporter: [['html', { open: 'never' }]],
});
