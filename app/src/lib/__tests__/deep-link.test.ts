import { describe, expect, it } from 'vitest';
import { parseDeepLink, deepLinkToRoute } from '../deep-link';

describe('parseDeepLink', () => {
  it('returns null for empty input', () => {
    expect(parseDeepLink('')).toBeNull();
    expect(parseDeepLink(null)).toBeNull();
    expect(parseDeepLink(undefined)).toBeNull();
  });

  it('returns null for non-zmninja schemes', () => {
    expect(parseDeepLink('https://example.test/event/1')).toBeNull();
    expect(parseDeepLink('mailto:foo@bar')).toBeNull();
  });

  it('parses zmninja://event/<id>', () => {
    const result = parseDeepLink('zmninja://event/42');
    expect(result).toEqual(
      expect.objectContaining({ kind: 'event', eventId: '42', pipAuto: false })
    );
    expect(result?.profileId).toBeUndefined();
  });

  it('parses zmninja://monitor/<id>?pip=auto&profile_id=p1', () => {
    const result = parseDeepLink('zmninja://monitor/m1?pip=auto&profile_id=p1');
    expect(result).toMatchObject({
      kind: 'monitor',
      monitorId: 'm1',
      profileId: 'p1',
      pipAuto: true,
    });
  });

  it('treats pip without =auto as false', () => {
    const result = parseDeepLink('zmninja://monitor/m1?pip=on');
    expect(result?.pipAuto).toBe(false);
  });

  it('tolerates the host-empty encoding (zmninja:event/123)', () => {
    const result = parseDeepLink('zmninja:event/99');
    expect(result).toMatchObject({ kind: 'event', eventId: '99' });
  });

  it('tolerates trailing slash', () => {
    const result = parseDeepLink('zmninja://event/7/');
    expect(result).toMatchObject({ kind: 'event', eventId: '7' });
  });

  it('decodes URL-encoded ids', () => {
    const result = parseDeepLink('zmninja://event/abc%20def');
    expect(result).toMatchObject({ kind: 'event', eventId: 'abc def' });
  });

  it('returns null when host is unknown', () => {
    expect(parseDeepLink('zmninja://other/123')).toBeNull();
  });

  it('returns null when id is missing', () => {
    expect(parseDeepLink('zmninja://event/')).toBeNull();
    expect(parseDeepLink('zmninja://monitor')).toBeNull();
  });

  it('is case-insensitive on the scheme', () => {
    expect(parseDeepLink('ZMNINJA://event/1')).toMatchObject({ kind: 'event', eventId: '1' });
  });

  it('exposes the raw query for callers that need extra params', () => {
    const result = parseDeepLink('zmninja://monitor/m1?profile_id=p1&extra=foo');
    expect(result?.query.get('extra')).toBe('foo');
  });
});

describe('deepLinkToRoute', () => {
  it('routes events to /events/<id>', () => {
    const parsed = parseDeepLink('zmninja://event/42')!;
    expect(deepLinkToRoute(parsed)).toBe('/events/42');
  });

  it('routes monitors with pip=auto preserved', () => {
    const parsed = parseDeepLink('zmninja://monitor/m1?pip=auto&profile_id=p1')!;
    expect(deepLinkToRoute(parsed)).toBe('/monitors/m1?pip=auto');
  });

  it('omits pip query when pipAuto is false', () => {
    const parsed = parseDeepLink('zmninja://monitor/m1?profile_id=p1')!;
    expect(deepLinkToRoute(parsed)).toBe('/monitors/m1');
  });

  it('encodes ids with reserved characters', () => {
    const parsed = parseDeepLink('zmninja://event/abc%20def')!;
    expect(deepLinkToRoute(parsed)).toBe('/events/abc%20def');
  });
});
