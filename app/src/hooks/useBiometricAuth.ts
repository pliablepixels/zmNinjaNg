/**
 * Biometric Auth Hook
 *
 * Platform-aware biometric authentication:
 * - Tauri (macOS): calls native LAContext via custom Tauri command (Touch ID)
 * - Capacitor (iOS/Android): uses @aparajita/capacitor-biometric-auth
 * - Web: not supported, falls back to PIN
 */

import { log, LogLevel } from '../lib/logger';

interface BiometricResult {
  success: boolean;
  error?: string;
}

/**
 * Check if we're running in Tauri.
 */
async function isTauriEnv(): Promise<boolean> {
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    return isTauri();
  } catch (error) {
    log.secureStorage('Tauri env check failed', LogLevel.DEBUG, { error });
    return false;
  }
}

/**
 * Check if biometric authentication is available on the current device.
 */
export async function checkBiometricAvailability(): Promise<boolean> {
  // Try Tauri native command (macOS Touch ID)
  if (await isTauriEnv()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const available = await invoke<boolean>('check_biometric_available');
      log.auth('Tauri biometric check', LogLevel.DEBUG, { isAvailable: available });
      return available;
    } catch (err) {
      log.auth('Tauri biometric check failed', LogLevel.DEBUG, { error: err });
      return false;
    }
  }

  // Try Capacitor biometric plugin (iOS/Android)
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    const result = await BiometricAuth.checkBiometry();
    log.auth('Capacitor biometric check', LogLevel.DEBUG, {
      isAvailable: result.isAvailable,
      biometryType: result.biometryType,
    });
    return result.isAvailable;
  } catch {
    log.auth('No biometric auth available on this platform', LogLevel.DEBUG);
    return false;
  }
}

/**
 * Attempt biometric authentication.
 * Returns { success: true } if authenticated, { success: false, error } otherwise.
 */
export async function authenticateWithBiometrics(reason: string): Promise<BiometricResult> {
  // Try Tauri native command (macOS Touch ID)
  if (await isTauriEnv()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('authenticate_biometric', { reason });
      log.auth('Tauri biometric authentication succeeded', LogLevel.INFO);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.auth('Tauri biometric authentication failed', LogLevel.DEBUG, { error: message });
      return { success: false, error: message };
    }
  }

  // Try Capacitor biometric plugin (iOS/Android)
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Use PIN',
      allowDeviceCredential: false,
    });
    log.auth('Capacitor biometric authentication succeeded', LogLevel.INFO);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Biometric auth failed';
    log.auth('Biometric authentication failed', LogLevel.DEBUG, { error: message });
    return { success: false, error: message };
  }
}
