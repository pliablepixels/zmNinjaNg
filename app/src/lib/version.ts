/**
 * App Version Utility
 *
 * Provides a centralized way to access the application version from package.json.
 * Ensures version is never hardcoded throughout the application.
 */

import packageJson from '../../package.json';

/**
 * Get the application version from package.json
 *
 * @returns Version string (e.g., "1.0.0")
 */
export function getAppVersion(): string {
  return packageJson.version;
}

