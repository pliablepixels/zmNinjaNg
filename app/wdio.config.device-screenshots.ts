/**
 * WDIO config for device screenshot capture.
 *
 * Usage:
 *   npm run test:e2e:ios-tablet
 *   npm run test:e2e:ios-phone
 *   npm run test:e2e:android
 *
 * Pass --device=<name> to override the target device:
 *   npx wdio run wdio.config.device-screenshots.ts -- --device=ios-phone
 */

import dotenv from 'dotenv';
import path from 'path';
import type { Options } from '@wdio/types';
import { platformConfig } from './tests/platforms.config';
import { getAppiumCapabilities } from './tests/helpers/ios-launcher';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

type DeviceProfile = 'ios-phone' | 'ios-tablet' | 'android';

// Determine which device to target from CLI args or env
const deviceArg = process.argv.find((a) => a.startsWith('--device='));
const device: DeviceProfile = (deviceArg?.split('=')[1] as DeviceProfile)
  ?? (process.env.TEST_DEVICE as DeviceProfile)
  ?? 'ios-tablet';

function getCapabilities(dev: DeviceProfile): WebdriverIO.Capabilities {
  switch (dev) {
    case 'ios-phone':
      return {
        ...getAppiumCapabilities(platformConfig.ios.phone.simulator),
        maxInstances: 1,
      } as WebdriverIO.Capabilities;
    case 'ios-tablet':
      return {
        ...getAppiumCapabilities(platformConfig.ios.tablet.simulator),
        maxInstances: 1,
      } as WebdriverIO.Capabilities;
    case 'android':
      return {
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:deviceName': platformConfig.android.avdName,
        'appium:app': platformConfig.android.apkPath,
        'appium:autoWebview': true,
        'appium:noReset': true,
        'appium:autoGrantPermissions': true,
        ...(platformConfig.android.chromedriverPath
          ? { 'appium:chromedriverExecutable': platformConfig.android.chromedriverPath }
          : {}),
        maxInstances: 1,
      } as WebdriverIO.Capabilities;
    default:
      throw new Error(`Unknown device: ${dev}`);
  }
}

export const config: Options.Testrunner = {
  runner: 'local',
  port: device === 'android' ? 4724 : platformConfig.ios.appiumPort,
  specs: ['tests/device-screenshots/specs/**/*.spec.ts'],
  maxInstances: 1,
  capabilities: [getCapabilities(device)],
  services: [
    ['appium', {
      command: 'appium',
      args: {
        port: device === 'android' ? 4724 : platformConfig.ios.appiumPort,
      },
    }],
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    timeout: 300000, // 5 min total — plenty of time for all screens
  },
  baseUrl: 'http://localhost',
};
