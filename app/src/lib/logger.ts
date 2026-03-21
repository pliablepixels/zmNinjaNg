/**
 * Centralized Logging Utility
 * 
 * Provides a structured logging system with support for log levels, context, and sanitization.
 * Logs are output to the console and also persisted to an in-memory store (via useLogStore)
 * for display in the application's debug/logs view.
 * 
 * Features:
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - Automatic sanitization of sensitive data (passwords, tokens)
 * - Context-aware logging (component, action)
 * - Specialized helpers for common domains (API, Auth, Profile, Monitor)
 * - Supports log level preferences managed by profile settings
 */

import { useLogStore } from '../stores/logs';
import { sanitizeLogMessage, sanitizeObject, sanitizeLogArgs } from './log-sanitizer';
import { LogLevel } from './log-level';

interface LogContext {
  component?: string;
  action?: string;
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel;
  private isDev: boolean;

  constructor() {
    this.isDev = this.resolveIsDev();
    // Default to INFO in production to ensure logs are visible in simulator/device
    this.level = this.isDev ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private resolveIsDev(): boolean {
    if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.DEV === 'boolean') {
      return import.meta.env.DEV;
    }
    if (typeof process !== 'undefined' && process.env && typeof process.env.NODE_ENV === 'string') {
      return process.env.NODE_ENV !== 'production';
    }
    return false;
  }

  /**
   * Set the current log level.
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level.
   */
  getLevel(): LogLevel {
    return this.level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: string, context: LogContext, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toLocaleString();
    const contextStr = context.component ? `[${context.component}]` : '';
    const actionStr = context.action ? `{${context.action}}` : '';

    const prefix = `${timestamp} ${level} ${contextStr}${actionStr}`;

    // Sanitize before logging to console and store
    const sanitizedMessage = sanitizeLogMessage(message);
    const sanitizedContext = sanitizeObject(context) as LogContext;
    const sanitizedArgs = args.length > 0 ? sanitizeLogArgs(args) : [];

    // Prepare context for console (exclude component/action as they are in prefix)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { component, action, ...consoleContext } = sanitizedContext;
    const hasContext = Object.keys(consoleContext).length > 0;

    // Log sanitized data to console
    const consoleArgs: unknown[] = [prefix, sanitizedMessage];
    if (hasContext) {
      consoleArgs.push(consoleContext);
    }
    if (sanitizedArgs.length > 0) {
      consoleArgs.push(...sanitizedArgs);
    }

    console.log(...consoleArgs);

    // Add to store (rawTimestamp for display-time formatting)
    useLogStore.getState().addLog({
      timestamp,
      rawTimestamp: Date.now(),
      level,
      message: sanitizedMessage,
      context: sanitizedContext,
      args: sanitizedArgs.length > 0 ? sanitizedArgs : undefined,
    });
  }

  debug(message: string, context: LogContext = {}, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.formatMessage('DEBUG', context, message, ...args);
    }
  }

  info(message: string, context: LogContext = {}, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.formatMessage('INFO', context, message, ...args);
    }
  }

  warn(message: string, context: LogContext = {}, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.formatMessage('WARN', context, message, ...args);
    }
  }

  error(message: string, context: LogContext = {}, error?: Error | unknown, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.formatMessage('ERROR', context, message, error, ...args);
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    }
  }

  // Helper to check if details has meaningful content
  private hasDetails(details: unknown): boolean {
    if (details === undefined || details === null) return false;
    if (typeof details === 'object' && Object.keys(details as object).length === 0) return false;
    return true;
  }

  // Helper method to create component loggers
  private createComponentLogger(componentName: string, message: string, level: LogLevel, details?: unknown): void {
    if (level < LogLevel.DEBUG || level > LogLevel.ERROR) return;

    const context = { component: componentName };
    const hasDetailsArg = this.hasDetails(details);

    // Map log levels to their corresponding methods
    const levelMethods: Record<LogLevel, ((msg: string, ctx: LogContext, ...args: unknown[]) => void) | null> = {
      [LogLevel.DEBUG]: this.debug.bind(this),
      [LogLevel.INFO]: this.info.bind(this),
      [LogLevel.WARN]: this.warn.bind(this),
      [LogLevel.ERROR]: this.error.bind(this),
      [LogLevel.NONE]: null, // NONE level doesn't have a method
    };

    const logMethod = levelMethods[level];
    if (!logMethod) return;

    // Special handling for ERROR level with object details
    if (level === LogLevel.ERROR && hasDetailsArg && typeof details === 'object') {
      logMethod(message, context, JSON.stringify(details, null, 2));
    } else if (hasDetailsArg) {
      logMethod(message, context, details);
    } else {
      logMethod(message, context);
    }
  }

  // Component-specific loggers generated via factory pattern
  // Each method signature is explicitly defined for TypeScript autocomplete
  api = this.makeComponentLogger('API', LogLevel.DEBUG);
  app = this.makeComponentLogger('App');
  auth = this.makeComponentLogger('Auth', LogLevel.INFO);
  crypto = this.makeComponentLogger('Crypto');
  dashboard = this.makeComponentLogger('Dashboard');
  discovery = this.makeComponentLogger('Discovery');
  download = this.makeComponentLogger('Download');
  errorBoundary = this.makeComponentLogger('ErrorBoundary');
  eventCard = this.makeComponentLogger('EventCard');
  eventDetail = this.makeComponentLogger('EventDetail');
  eventMontage = this.makeComponentLogger('EventMontage');
  http = this.makeComponentLogger('HTTP');
  imageError = this.makeComponentLogger('ImageError');
  kiosk = this.makeComponentLogger('Kiosk');
  monitor = this.makeComponentLogger('Monitor', LogLevel.DEBUG);
  monitorCard = this.makeComponentLogger('MonitorCard');
  monitorDetail = this.makeComponentLogger('MonitorDetail');
  montageMonitor = this.makeComponentLogger('MontageMonitor');
  navigation = this.makeComponentLogger('Navigation');
  notificationHandler = this.makeComponentLogger('NotificationHandler');
  notifications = this.makeComponentLogger('Notifications');
  notificationSettings = this.makeComponentLogger('NotificationSettings');
  profile = this.makeComponentLogger('Profile', LogLevel.INFO);
  profileForm = this.makeComponentLogger('ProfileForm');
  profileService = this.makeComponentLogger('ProfileService');
  profileSwitcher = this.makeComponentLogger('ProfileSwitcher');
  push = this.makeComponentLogger('Push');
  queryCache = this.makeComponentLogger('QueryCache');
  secureImage = this.makeComponentLogger('SecureImage');
  secureStorage = this.makeComponentLogger('SecureStorage');
  server = this.makeComponentLogger('Server');
  time = this.makeComponentLogger('Time');
  videoMarkers = this.makeComponentLogger('VideoMarkers');
  videoPlayer = this.makeComponentLogger('VideoPlayer');
  sslTrust = this.makeComponentLogger('SSLTrust');
  zmsEventPlayer = this.makeComponentLogger('ZmsEventPlayer');

  // Factory method to create component loggers with optional default level
  private makeComponentLogger(componentName: string, defaultLevel?: LogLevel) {
    return (message: string, level?: LogLevel, details?: unknown): void => {
      const logLevel = level ?? defaultLevel;
      if (logLevel === undefined) {
        throw new Error(`Log level is required for ${componentName} logger`);
      }
      this.createComponentLogger(componentName, message, logLevel, details);
    };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience methods
export { LogLevel } from './log-level';

// Create component logger wrappers dynamically
const componentLoggers = [
  'api', 'app', 'auth', 'crypto', 'dashboard', 'discovery', 'download', 'errorBoundary',
  'eventCard', 'eventDetail', 'eventMontage', 'http', 'imageError', 'kiosk', 'monitor', 'monitorCard',
  'monitorDetail', 'montageMonitor', 'navigation', 'notificationHandler', 'notifications',
  'notificationSettings', 'profile', 'profileForm', 'profileService', 'profileSwitcher',
  'push', 'queryCache', 'secureImage', 'secureStorage', 'server', 'sslTrust', 'time', 'videoMarkers',
  'videoPlayer', 'zmsEventPlayer'
] as const;

type ComponentLoggerKey = typeof componentLoggers[number];
type ComponentLoggers = Record<ComponentLoggerKey, (message: string, level?: LogLevel, details?: unknown) => void>;

// Generate component logger methods dynamically
const generatedComponentLoggers = componentLoggers.reduce((acc, key) => {
  acc[key] = (message: string, level?: LogLevel, details?: unknown) =>
    (logger as any)[key](message, level, details);
  return acc;
}, {} as ComponentLoggers);

export const log = {
  debug: (message: string, context?: LogContext, ...args: unknown[]) =>
    logger.debug(message, context, ...args),
  info: (message: string, context?: LogContext, ...args: unknown[]) =>
    logger.info(message, context, ...args),
  warn: (message: string, context?: LogContext, ...args: unknown[]) =>
    logger.warn(message, context, ...args),
  error: (message: string, context?: LogContext, error?: Error | unknown, ...args: unknown[]) =>
    logger.error(message, context, error, ...args),

  // Component-specific loggers (generated dynamically)
  ...generatedComponentLoggers,
};
