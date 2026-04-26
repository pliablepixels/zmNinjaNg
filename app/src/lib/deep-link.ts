/**
 * zmninja:// deep-link parser.
 *
 * Supported shapes:
 *   zmninja://event/<event_id>?profile_id=<id>
 *   zmninja://monitor/<monitor_id>?profile_id=<id>&pip=auto
 *
 * Accepts both URL-style (zmninja://event/123) and host-empty (zmninja:event/123)
 * encodings. Trailing slashes and arbitrary query params are tolerated.
 */

export type ParsedDeepLink =
  | {
      kind: 'event';
      eventId: string;
      profileId?: string;
      pipAuto: boolean;
      query: URLSearchParams;
    }
  | {
      kind: 'monitor';
      monitorId: string;
      profileId?: string;
      pipAuto: boolean;
      query: URLSearchParams;
    };

const SCHEME = 'zmninja:';

export function parseDeepLink(raw: string | null | undefined): ParsedDeepLink | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith(SCHEME)) return null;

  // Normalize zmninja:event/123 → zmninja://event/123 so URL can parse it.
  let normalized = trimmed;
  if (!normalized.toLowerCase().startsWith('zmninja://')) {
    normalized = 'zmninja://' + normalized.slice(SCHEME.length);
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return null;
  }

  const host = url.host;
  // Path may be empty or "/<id>" or "/<id>/" etc.
  const segments = url.pathname.split('/').filter(Boolean);
  const id = segments[0];

  if (!id) return null;

  const query = url.searchParams;
  const profileId = query.get('profile_id') ?? undefined;
  const pipAuto = query.get('pip') === 'auto';

  if (host === 'event') {
    return { kind: 'event', eventId: decodeURIComponent(id), profileId, pipAuto, query };
  }
  if (host === 'monitor') {
    return { kind: 'monitor', monitorId: decodeURIComponent(id), profileId, pipAuto, query };
  }
  return null;
}

/**
 * Render the matching in-app route for a parsed deep link. The returned path
 * is suitable for HashRouter `navigate()` (no leading slash hash).
 */
export function deepLinkToRoute(parsed: ParsedDeepLink): string {
  switch (parsed.kind) {
    case 'event':
      return `/events/${encodeURIComponent(parsed.eventId)}`;
    case 'monitor': {
      const params = new URLSearchParams();
      if (parsed.pipAuto) params.set('pip', 'auto');
      const query = params.toString();
      return `/monitors/${encodeURIComponent(parsed.monitorId)}${query ? `?${query}` : ''}`;
    }
  }
}
