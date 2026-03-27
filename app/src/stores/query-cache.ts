/**
 * Query Cache Manager
 *
 * Provides a global reference to the React Query client.
 * Allows clearing the cache from outside React components (e.g., in Zustand stores).
 *
 * This is critical for profile switching, where we need to ensure data from
 * one profile doesn't leak into another.
 */

import { QueryClient } from '@tanstack/react-query';
import { log, LogLevel } from '../lib/logger';

// Global query client instance
let queryClient: QueryClient | null = null;

/**
 * Set the global query client instance.
 * Should be called when the App initializes the QueryClientProvider.
 */
export function setQueryClient(client: QueryClient) {
  queryClient = client;
}

/**
 * Clear all query cache.
 * 
 * Used when switching profiles to remove all cached data (monitors, events, etc.)
 * ensuring the new profile starts with a clean slate.
 */
export function clearQueryCache() {
  if (queryClient) {
    const queriesCount = queryClient.getQueryCache().getAll().length;
    queryClient.clear();
    log.queryCache('Query cache cleared', LogLevel.INFO, { queriesCount });
  } else {
    log.queryCache('No query client to clear', LogLevel.WARN);
  }
}
