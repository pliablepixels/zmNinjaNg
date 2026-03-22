import { execSync, spawn, type ChildProcess } from 'child_process';
import { platformConfig } from '../platforms.config';

let emulatorProcess: ChildProcess | null = null;

export async function launchAndroidEmulator(): Promise<void> {
  const { avdName, appId, apkPath, cdpPort } = platformConfig.android;

  // Check if emulator is already running
  const devices = execSync('adb devices').toString();
  const emulatorRunning = devices.includes('emulator-');

  if (!emulatorRunning) {
    process.stdout.write(`[android] Booting emulator: ${avdName}\n`);
    emulatorProcess = spawn('emulator', ['-avd', avdName, '-no-audio', '-no-window'], {
      stdio: 'ignore',
      detached: true,
    });
    emulatorProcess.unref();

    execSync('adb wait-for-device', { timeout: 60000 });
    let booted = false;
    for (let i = 0; i < 30; i++) {
      const prop = execSync('adb shell getprop sys.boot_completed').toString().trim();
      if (prop === '1') { booted = true; break; }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!booted) throw new Error('Emulator failed to boot within 60s');
  }

  process.stdout.write('[android] Installing APK...\n');
  execSync(`adb install -r ${apkPath}`, { timeout: 60000 });

  process.stdout.write('[android] Launching app...\n');
  execSync(`adb shell am start -n ${appId}/.MainActivity`);
  await new Promise((r) => setTimeout(r, 5000));

  // Find WebView debug socket and forward port
  const sockets = execSync('adb shell cat /proc/net/unix 2>/dev/null || true').toString();
  const match = sockets.match(/webview_devtools_remote_(\d+)/);
  if (!match) throw new Error('WebView debug socket not found. Is the app running?');

  const pid = match[1];
  process.stdout.write(`[android] Found WebView debug socket for PID ${pid}\n`);
  execSync(`adb forward tcp:${cdpPort} localabstract:webview_devtools_remote_${pid}`);
  process.stdout.write(`[android] CDP forwarded to localhost:${cdpPort}\n`);
}

export async function stopAndroidEmulator(): Promise<void> {
  try { execSync('adb emu kill', { timeout: 10000 }); } catch { /* may not be running */ }
  if (emulatorProcess) { emulatorProcess.kill(); emulatorProcess = null; }
}
