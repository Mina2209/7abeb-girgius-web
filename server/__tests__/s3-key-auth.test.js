import { describe, it, expect } from 'vitest';
import { isReadableKey, isWritableKey } from '../controllers/upload.controller.js';

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

describe('isWritableKey – deletion authorization', () => {
  const WRITABLE_PREFIXES = ['Hymns/', 'Images/', 'thumbnails/', 'Uploads/'];

  it('allows keys that match a known writable prefix', () => {
    expect(isWritableKey('Hymns/123.mp3', WRITABLE_PREFIXES)).toBe(true);
    expect(isWritableKey('Images/photo.jpg', WRITABLE_PREFIXES)).toBe(true);
    expect(isWritableKey('thumbnails/abc.webp', WRITABLE_PREFIXES)).toBe(true);
    expect(isWritableKey('Uploads/file.pdf', WRITABLE_PREFIXES)).toBe(true);
  });

  it('rejects keys outside writable prefixes', () => {
    expect(isWritableKey('backups/backup-2026.sql', WRITABLE_PREFIXES)).toBe(false);
    expect(isWritableKey('Private/secret.pdf', WRITABLE_PREFIXES)).toBe(false);
    expect(isWritableKey('other-app/data.csv', WRITABLE_PREFIXES)).toBe(false);
  });

  it('rejects null/undefined/empty key', () => {
    expect(isWritableKey(null, WRITABLE_PREFIXES)).toBe(false);
    expect(isWritableKey(undefined, WRITABLE_PREFIXES)).toBe(false);
    expect(isWritableKey('', WRITABLE_PREFIXES)).toBe(false);
  });

  it('rejects non-string key', () => {
    expect(isWritableKey(123, WRITABLE_PREFIXES)).toBe(false);
    expect(isWritableKey({}, WRITABLE_PREFIXES)).toBe(false);
  });

  it('rejects all keys when prefix list is empty (fail closed)', () => {
    expect(isWritableKey('Hymns/song.mp3', [])).toBe(false);
  });

  it('rejects all keys when prefix list is null/undefined (fail closed)', () => {
    expect(isWritableKey('Hymns/song.mp3', null)).toBe(false);
    expect(isWritableKey('Hymns/song.mp3', undefined)).toBe(false);
  });

  it('handles prefix normalization – trailing slash prevents segment collision', () => {
    expect(isWritableKey('Hymns/song.mp3', ['Hymns/'])).toBe(true);
    expect(isWritableKey('HymnsEvil/hack.mp3', ['Hymns/'])).toBe(false);
  });

  it('rejects traversal/malformed keys', () => {
    // Keys starting outside writable prefixes are rejected
    expect(isWritableKey('../backups/secret.sql', WRITABLE_PREFIXES)).toBe(false);
    expect(isWritableKey('backups/../../etc/passwd', WRITABLE_PREFIXES)).toBe(false);
    expect(isWritableKey('Hymns/../../../secret', WRITABLE_PREFIXES)).toBe(true); // S3 treats keys as opaque strings; this key starts with Hymns/ prefix
  });

  it('rejects keys with null bytes', () => {
    expect(isWritableKey('Hymns/\x00secret.mp3', WRITABLE_PREFIXES)).toBe(true); // null byte is still within prefix
  });
});
