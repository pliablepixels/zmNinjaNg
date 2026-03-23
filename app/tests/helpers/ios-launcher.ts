import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { platformConfig } from '../platforms.config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildIosApp(): void {
  process.stdout.write('[ios] Building app for simulator...\n');
  execSync(
    'xcodebuild -workspace ../ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -configuration Debug -derivedDataPath ../ios/App/DerivedData build',
    { cwd: __dirname, stdio: 'inherit', timeout: 300000 },
  );
}

export function bootSimulator(deviceName: string): string {
  const list = execSync('xcrun simctl list devices booted --json').toString();
  const booted = JSON.parse(list) as { devices: Record<string, Array<{ name: string; udid: string; state: string }>> };
  const allDevices = Object.values(booted.devices).flat();
  const existing = allDevices.find((d) => d.name === deviceName && d.state === 'Booted');

  if (existing) {
    process.stdout.write(`[ios] Simulator "${deviceName}" already booted: ${existing.udid}\n`);
    return existing.udid;
  }

  process.stdout.write(`[ios] Booting simulator: ${deviceName}\n`);
  execSync(`xcrun simctl boot "${deviceName}"`, { timeout: 60000 });

  const listAll = execSync('xcrun simctl list devices --json').toString();
  const all = JSON.parse(listAll) as { devices: Record<string, Array<{ name: string; udid: string }>> };
  const allAfter = Object.values(all.devices).flat();
  const device = allAfter.find((d) => d.name === deviceName);
  if (!device) throw new Error(`Simulator "${deviceName}" not found`);
  return device.udid;
}

export function getAppiumCapabilities(deviceName: string): Record<string, unknown> {
  return {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': deviceName,
    'appium:app': platformConfig.ios.appPath,
    'appium:bundleId': platformConfig.ios.appBundleId,
    'appium:autoWebview': true,
    'appium:webviewConnectTimeout': platformConfig.timeouts.webviewSwitch,
    'appium:noReset': true,
    'appium:autoAcceptAlerts': true,
  };
}
