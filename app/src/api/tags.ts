/**
 * Tags API
 *
 * Handles fetching tags and event-tag mappings from ZoneMinder.
 * Tags are labels that can be assigned to events (e.g., "person", "car", "cat").
 * Not all ZoneMinder instances support tags - this module handles graceful degradation.
 */

import { getApiClient } from './client';
import type { TagsResponse, EventTagsResponse, Tag } from './types';
import { TagsResponseSchema, EventTagsResponseSchema } from './types';
import { safeValidateApiResponse, validateApiResponse } from '../lib/api-validator';
import { log, LogLevel } from '../lib/logger';
import { TAGS_BATCH_SIZE } from '../lib/zm-constants';
import type { HttpError } from '../lib/http';

/**
 * Get all available tags from the ZoneMinder server.
 *
 * The API returns each tag-event association as a separate entry,
 * so we need to deduplicate tags by ID.
 *
 * @returns Promise resolving to TagsResponse, or null if tags are not supported
 */
export async function getTags(): Promise<TagsResponse | null> {
  log.api('Fetching tags list', LogLevel.INFO);

  const client = getApiClient();

  try {
    const response = await client.get<TagsResponse>('/tags.json');

    // Validate response with Zod - use safe validation to handle unexpected formats
    const validated = safeValidateApiResponse(TagsResponseSchema, response.data, {
      endpoint: '/tags.json',
      method: 'GET',
    });

    if (!validated) {
      log.api('Tags response validation failed - tags may not be supported', LogLevel.WARN);
      return null;
    }

    log.api('Tags fetched successfully', LogLevel.DEBUG, {
      count: validated.tags.length,
    });

    return validated;
  } catch (error) {
    const httpError = error as HttpError;

    // 404 means tags are not supported on this ZM instance
    if (httpError.status === 404) {
      log.api('Tags endpoint returned 404 - tags not supported on this server', LogLevel.INFO);
      return null;
    }

    // 401/403 could mean permission denied - treat as not supported
    if (httpError.status === 401 || httpError.status === 403) {
      log.api('Tags endpoint returned auth error - tags may not be accessible', LogLevel.WARN, {
        status: httpError.status,
      });
      return null;
    }

    // Other errors should be logged and re-thrown
    log.api('Failed to fetch tags', LogLevel.ERROR, { error });
    throw error;
  }
}

/**
 * Extract unique tags from the API response.
 * The API returns each tag-event association as a separate entry,
 * so we need to deduplicate by tag ID.
 */
export function extractUniqueTags(response: TagsResponse): Tag[] {
  // Handle cases where response or tags array is missing/invalid
  if (!response?.tags || !Array.isArray(response.tags)) {
    return [];
  }

  const tagMap = new Map<string, Tag>();

  for (const mapping of response.tags) {
    if (mapping?.Tag?.Id && !tagMap.has(mapping.Tag.Id)) {
      tagMap.set(mapping.Tag.Id, mapping.Tag);
    }
  }

  return Array.from(tagMap.values());
}

/**
 * Get tags for specific events.
 *
 * Automatically batches requests to avoid URL length limits.
 * Returns a Map of eventId -> Tag[] for efficient lookup.
 *
 * @param eventIds - Array of event IDs to fetch tags for
 * @returns Promise resolving to Map of eventId -> Tag[], or null if tags not supported
 */
export async function getEventTags(
  eventIds: string[]
): Promise<Map<string, Tag[]> | null> {
  if (eventIds.length === 0) {
    return new Map();
  }

  log.api('Fetching event tags', LogLevel.INFO, { eventCount: eventIds.length });

  const client = getApiClient();
  const eventTagMap = new Map<string, Tag[]>();

  // Split event IDs into batches to avoid URL length limits
  const batches: string[][] = [];
  for (let i = 0; i < eventIds.length; i += TAGS_BATCH_SIZE) {
    batches.push(eventIds.slice(i, i + TAGS_BATCH_SIZE));
  }

  log.api('Processing event tags in batches', LogLevel.DEBUG, {
    totalEvents: eventIds.length,
    batchCount: batches.length,
    batchSize: TAGS_BATCH_SIZE,
  });

  try {
    // Process batches sequentially to avoid overwhelming the server
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const eventIdsParam = batch.join(',');

      // ZM API format: /tags/index/Events.Id:1,2,3.json
      const url = `/tags/index/Events.Id:${eventIdsParam}.json`;

      const response = await client.get<EventTagsResponse>(url);

      // Validate response
      const validated = validateApiResponse(EventTagsResponseSchema, response.data, {
        endpoint: url,
        method: 'GET',
      });

      // Build the event-to-tags mapping from the response
      // Response format: { tags: [{ Tag: {...}, Events_Tags: {EventId: "1"} }] }
      // Each tag-event association is a separate entry in the array
      for (const tagMapping of validated.tags) {
        const tag = tagMapping.Tag;
        const eventId = tagMapping.Events_Tags?.EventId;

        if (eventId) {
          const existingTags = eventTagMap.get(eventId) || [];
          // Only add if not already present (in case of duplicate responses)
          if (!existingTags.some(t => t.Id === tag.Id)) {
            existingTags.push({
              Id: tag.Id,
              Name: tag.Name,
              CreateDate: tag.CreateDate,
              CreatedBy: tag.CreatedBy,
              LastAssignedDate: tag.LastAssignedDate,
            });
            eventTagMap.set(eventId, existingTags);
          }
        }
      }

      log.api(`Processed event tags batch ${batchIndex + 1}/${batches.length}`, LogLevel.DEBUG, {
        batchEvents: batch.length,
        tagsFound: validated.tags.length,
      });
    }

    log.api('Event tags fetched successfully', LogLevel.DEBUG, {
      eventsWithTags: eventTagMap.size,
    });

    return eventTagMap;
  } catch (error) {
    const httpError = error as HttpError;

    // 404 means tags are not supported
    if (httpError.status === 404) {
      log.api('Event tags endpoint returned 404 - tags not supported', LogLevel.INFO);
      return null;
    }

    // 401/403 - permission denied
    if (httpError.status === 401 || httpError.status === 403) {
      log.api('Event tags endpoint returned auth error', LogLevel.WARN, {
        status: httpError.status,
      });
      return null;
    }

    log.api('Failed to fetch event tags', LogLevel.ERROR, { error });
    throw error;
  }
}

