/**
 * Platform Detection Utilities
 *
 * Centralized platform detection for consistent environment checks across the app.
 * Handles detection of development mode, native platforms (iOS/Android), Tauri desktop, and web.
 */

import { Capacitor } from '@capacitor/core';
import { isTauri } from '@tauri-apps/api/core';

/**
 * Platform detection utilities.
 * Use these constants instead of checking environment flags directly.
 * All properties use getters for lazy evaluation to ensure runtime is ready.
 */
export const Platform = {
  /** True if running in development mode (Vite dev server) */
  get isDev() {
    return import.meta.env.DEV;
  },

  /** True if running on native platform (iOS or Android via Capacitor) */
  get isNative() {
    return Capacitor.isNativePlatform();
  },

  /** True if running in Tauri desktop app */
  get isTauri() {
    return isTauri();
  },

  /**
   * True if running on desktop (Tauri) or web browser — i.e., not mobile native.
   * Handles the edge case where Capacitor misdetects Tauri's WKWebView as iOS.
   */
  get isDesktopOrWeb() {
    return !this.isNative || this.isTauri;
  },

  /**
   * True if running in web browser (not native or Tauri).
   */
  get isWeb() {
    return !this.isNative && !this.isTauri;
  },

  /**
   * True if should use development proxy server.
   * Only true in dev mode on web (not native platforms).
   */
  get shouldUseProxy() {
    return this.isDev && this.isWeb;
  },
};
