/**
 * Proxy URL Utilities
 *
 * Shared helpers for wrapping URLs with dev proxy to handle CORS.
 * Used across monitors, events, downloads, and HTTP client.
 */

import { Platform } from './platform';

/**
 * Wrap a URL with the image proxy if proxy mode is enabled.
 * Used for images, videos, and downloadable content that needs CORS handling.
 *
 * @param url - The URL to potentially wrap
 * @returns The original URL or proxied URL
 *
 * @example
 * ```ts
 * const imageUrl = wrapWithImageProxy('https://example.com/image.jpg');
 * // Returns: 'http://localhost:3001/image-proxy?url=https%3A%2F%2Fexample.com%2Fimage.jpg'
 * ```
 */
export function wrapWithImageProxy(url: string): string {
  if (!Platform.shouldUseProxy) {
    return url;
  }

  return `http://localhost:3001/image-proxy?url=${encodeURIComponent(url)}`;
}

// Check if a URL should be proxied (starts with http:// or https://)
function shouldProxyUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Wrap a URL with the image proxy if proxy mode is enabled and URL is external.
 * Convenience method that combines shouldProxyUrl check.
 *
 * @param url - The URL to potentially wrap
 * @returns The original URL or proxied URL
 */
export function wrapWithImageProxyIfNeeded(url: string): string {
  if (!Platform.shouldUseProxy || !shouldProxyUrl(url)) {
    return url;
  }

  return wrapWithImageProxy(url);
}
