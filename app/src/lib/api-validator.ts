/**
 * API Response Validator
 *
 * Centralized utility for validating API responses using Zod schemas.
 * Provides consistent error handling and logging across all API calls.
 */

import { z, type ZodSchema } from 'zod';
import { log, LogLevel } from './logger';

export interface FormattedZodIssue {
  path: string;
  message: string;
  code: z.ZodIssue['code'];
  expected?: unknown;
  received?: unknown;
}

export class ApiValidationError extends Error {
  public readonly zodError: z.ZodError;
  public readonly formattedIssues: FormattedZodIssue[];
  public readonly rawData: unknown;

  constructor(
    message: string,
    zodError: z.ZodError,
    formattedIssues: FormattedZodIssue[],
    rawData: unknown
  ) {
    super(message);
    this.name = 'ApiValidationError';
    this.zodError = zodError;
    this.formattedIssues = formattedIssues;
    this.rawData = rawData;
  }
}

export function formatZodIssues(issues: z.ZodIssue[]): FormattedZodIssue[] {
  return issues.map(issue => ({
    path: issue.path.length ? issue.path.join('.') : '(root)',
    message: issue.message,
    code: issue.code,
    expected: 'expected' in issue ? (issue as { expected: unknown }).expected : undefined,
    received: 'received' in issue ? (issue as { received: unknown }).received : undefined,
  }));
}
/**
 * Validate API response data against a Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @param data - Raw data from API response
 * @param context - Additional context for logging
 * @returns Parsed and validated data
 * @throws ApiValidationError if validation fails
 *
 * @example
 * ```typescript
 * const data = await response.json();
 * const monitors = validateApiResponse(MonitorsSchema, data, { endpoint: '/monitors' });
 * ```
 */
export function validateApiResponse<T extends ZodSchema>(
  schema: T,
  data: unknown,
  context: { endpoint?: string; method?: string } = {}
): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = formatZodIssues(error.issues);

      // Safely stringify the response data for logging
      let responsePreview: string;
      try {
        const stringified = JSON.stringify(data);
        // Truncate very large responses to 500 chars
        responsePreview = stringified.length > 500
          ? stringified.substring(0, 500) + '...[truncated]'
          : stringified;
      } catch {
        responsePreview = String(data);
      }

      log.api('API response validation failed',
          LogLevel.ERROR,
          {
              endpoint: context.endpoint,
              method: context.method,
              errors: formattedErrors.map(e => ({
                  path: e.path,
                  message: e.message,
                  })),
              rawResponse: responsePreview,
          },
     );

      throw new ApiValidationError(
        `API response validation failed for ${context.method ?? 'UNKNOWN'} ${context.endpoint ?? 'unknown endpoint'}`,
            error,
            formattedErrors,
            data
      );
    }
    throw error;
  }
}

/**
 * Safely validate API response, returning null on failure instead of throwing.
 * Useful for optional data or when you want to handle validation errors gracefully.
 *
 * @param schema - Zod schema to validate against
 * @param data - Raw data from API response
 * @param context - Additional context for logging
 * @returns Parsed data or null if validation fails
 *
 * @example
 * ```typescript
 * const data = await response.json();
 * const config = safeValidateApiResponse(ConfigSchema, data);
 * if (!config) {
 *   // Handle missing/invalid config
 *   return defaultConfig;
 * }
 * ```
 */
export function safeValidateApiResponse<T extends ZodSchema>(
  schema: T,
  data: unknown,
  context: { endpoint?: string; method?: string } = {}
): z.infer<T> | null {
  try {
    return validateApiResponse(schema, data, context);
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return null;
    }
    throw error;
  }
}

/**
 * Validate an array of items, filtering out invalid entries.
 * Useful for partial data sets where some items may be malformed.
 *
 * @param itemSchema - Zod schema for individual items
 * @param data - Array of raw data
 * @param context - Additional context for logging
 * @returns Array of valid items (invalid items are filtered out)
 *
 * @example
 * ```typescript
 * const rawEvents = await response.json();
 * const validEvents = validateArrayItems(EventSchema, rawEvents.events);
 * // validEvents contains only successfully parsed events
 * ```
 */
export function validateArrayItems<T extends ZodSchema>(
  itemSchema: T,
  data: unknown[],
  context: { endpoint?: string; method?: string } = {}
): z.infer<T>[] {
  if (!Array.isArray(data)) {
    log.api('Expected array for validation', LogLevel.ERROR, { ...context,
      dataType: typeof data, });
    return [];
  }

  const results: z.infer<T>[] = [];
  const errors: Array<{ index: number; error: z.ZodError }> = [];

  data.forEach((item, index) => {
    try {
      results.push(itemSchema.parse(item));
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push({ index, error });
      }
    }
  });

  if (errors.length > 0) {
    log.api('Some array items failed validation', LogLevel.WARN, { ...context,
      failedCount: errors.length,
      totalCount: data.length,
      errors: errors.map(({ index, error }) => ({
        index,
        issues: error.issues,
      })),
    });
  }

  return results;
}
