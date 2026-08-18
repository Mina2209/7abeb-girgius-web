import { describe, it, expect } from 'vitest';
import { isReadableKey } from '../controllers/upload.controller.js';

describe('isReadableKey – segment-safe prefix authorization', () => {
  const PREFIXES = ['Hymns/', 'Images/', 'thumbnails/'];

  it('allows keys that match a known prefix', () => {
    expect(isReadableKey('Hymns/123.mp3', PREFIXES)).toBe(true);
    expect(isReadableKey('Images/photo.jpg', PREFIXES)).toBe(true);
    expect(isReadableKey('thumbnails/abc.webp', PREFIXES)).toBe(true);
  });

  it('rejects key that shares a name prefix but differs in segment', () => {
    // 'HymnsEvil/' must NOT be authorized by 'Hymns/' prefix
    expect(isReadableKey('HymnsEvil/secret.mp3', PREFIXES)).toBe(false);
  });

  it('rejects key with no matching prefix', () => {
    expect(isReadableKey('Private/secret.pdf', PREFIXES)).toBe(false);
  });

  it('rejects null/undefined/empty key', () => {
    expect(isReadableKey(null, PREFIXES)).toBe(false);
    expect(isReadableKey(undefined, PREFIXES)).toBe(false);
    expect(isReadableKey('', PREFIXES)).toBe(false);
  });

  it('rejects non-string key', () => {
    expect(isReadableKey(123, PREFIXES)).toBe(false);
    expect(isReadableKey({}, PREFIXES)).toBe(false);
  });

  it('allows any key when prefix list is empty (legacy fallback)', () => {
    expect(isReadableKey('anything/at-all.mp3', [])).toBe(true);
  });

  it('allows any key when prefix list is null/undefined', () => {
    expect(isReadableKey('anything.mp3', null)).toBe(true);
    expect(isReadableKey('anything.mp3', undefined)).toBe(true);
  });

  it('handles prefix normalization – trailing slash prevents segment collision', () => {
    // Without the trailing slash fix, 'Hymns/' could match 'HymnsEvil/...'
    // With the fix (public prefixes always end in '/'), this is safe.
    expect(isReadableKey('Hymns/song.mp3', ['Hymns/'])).toBe(true);
    expect(isReadableKey('HymnsEvil/hack.mp3', ['Hymns/'])).toBe(false);
    expect(isReadableKey('Hymn/song.mp3', ['Hymns/'])).toBe(false);
  });

  it('handles deeply nested keys', () => {
    expect(isReadableKey('Hymns/folder/sub/song.mp3', PREFIXES)).toBe(true);
    expect(isReadableKey('Private/Hymns/song.mp3', PREFIXES)).toBe(false);
  });
});
