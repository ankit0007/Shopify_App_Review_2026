import {describe, expect, it} from 'vitest';
import {decodeOpaqueCursor, encodeOpaqueCursor} from '../../lib/shopify-signatures.server';
import {cursorMatchesQuery, cursorPayload, parseListQuery, readCursorPayload} from './public-list';

describe('public review list query', () => {
  it('accepts newest, highest, and lowest with an optional star filter', () => {
    expect(parseListQuery(null, null)).toEqual({ok: true, sort: 'newest', rating: null});
    expect(parseListQuery('highest', '4')).toEqual({ok: true, sort: 'highest', rating: 4});
    expect(parseListQuery('sideways', null).ok).toBe(false);
    expect(parseListQuery('newest', '6').ok).toBe(false);
  });

  it('rejects a cursor that was issued for a different sort or filter', () => {
    const secret = 'test-secret';
    const cursor = encodeOpaqueCursor(cursorPayload('newest', null, 'cm1234567890123456789012'), secret);
    const payload = readCursorPayload(decodeOpaqueCursor(cursor, secret) ?? '');
    expect(payload?.id).toBe('cm1234567890123456789012');
    expect(cursorMatchesQuery(payload!, {sort: 'newest', rating: null})).toBe(true);
    expect(cursorMatchesQuery(payload!, {sort: 'highest', rating: null})).toBe(false);
    expect(cursorMatchesQuery(payload!, {sort: 'newest', rating: 4})).toBe(false);
    expect(readCursorPayload('not-a-cursor')).toBeNull();
  });
});
