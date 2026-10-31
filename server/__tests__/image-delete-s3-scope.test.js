import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { prismaImageMock, s3Mock } = vi.hoisted(() => ({
  prismaImageMock: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  s3Mock: {
    deleteObject: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../services/prisma.js', () => ({
  prisma: { image: prismaImageMock },
}));

vi.mock('../services/s3.service.js', () => ({
  default: s3Mock,
}));

import { ImageService } from '../services/image.service.js';
import { getImageDeletePrefixes } from '../services/image-s3-key.js';

const IMAGE_ID = 'image-1';
const IMAGE_ROW = { id: IMAGE_ID, title: 'Image', imageUrl: null };
const DEFAULT_FOLDER_MAP = JSON.stringify({ image: 'Images' });

function queueImage(imageUrl) {
  prismaImageMock.findUnique.mockResolvedValueOnce({ ...IMAGE_ROW, imageUrl });
}

describe('ImageService.delete - S3 image scope', () => {
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('S3_KEY_PREFIX', '');
    vi.stubEnv('AWS_S3_PREFIX', '');
    vi.stubEnv('S3_FOLDER_MAP', DEFAULT_FOLDER_MAP);
    vi.stubEnv('S3_ALLOWED_FOLDERS', 'Hymns,Images,PowerPoints');
    vi.stubEnv('S3_LEGACY_IMAGE_PREFIXES', '');

    prismaImageMock.findUnique.mockResolvedValue({ ...IMAGE_ROW });
    prismaImageMock.delete.mockResolvedValue({ id: IMAGE_ID });
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('deletes an image from the actual Images upload path', async () => {
    queueImage('https://api.example.test/api/uploads/url?key=Images%2Fphoto.jpg');

    const result = await ImageService.delete(IMAGE_ID);

    expect(result).toEqual({ id: IMAGE_ID });
    expect(s3Mock.deleteObject).toHaveBeenCalledWith('Images/photo.jpg');
    expect(prismaImageMock.delete).toHaveBeenCalledWith({ where: { id: IMAGE_ID } });
  });

  it('deletes an image from the default Uploads/Images path', async () => {
    vi.stubEnv('S3_KEY_PREFIX', 'Uploads/');
    queueImage('/api/uploads/url?key=Uploads%2FImages%2Fphoto.jpg');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).toHaveBeenCalledWith('Uploads/Images/photo.jpg');
    expect(prismaImageMock.delete).toHaveBeenCalledWith({ where: { id: IMAGE_ID } });
  });

  it('uses the proven Images folder when S3_FOLDER_MAP is absent', async () => {
    vi.stubEnv('S3_FOLDER_MAP', '');
    queueImage('/api/uploads/url?key=Images%2Fphoto.jpg');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).toHaveBeenCalledWith('Images/photo.jpg');
  });

  it('does not expand the scope when S3_FOLDER_MAP.image is Hymns', async () => {
    vi.stubEnv('S3_FOLDER_MAP', JSON.stringify({ image: 'Hymns' }));
    vi.stubEnv('S3_ALLOWED_FOLDERS', 'Hymns,Images,PowerPoints');
    queueImage('/api/uploads/url?key=Hymns%2Fsong.ppsx');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
    expect(prismaImageMock.delete).toHaveBeenCalledWith({ where: { id: IMAGE_ID } });
  });

  it('fails closed for the real Images path when the image mapping conflicts', async () => {
    vi.stubEnv('S3_FOLDER_MAP', JSON.stringify({ image: 'Hymns' }));
    queueImage('/api/uploads/url?key=Images%2Fphoto.jpg');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
    expect(prismaImageMock.delete).toHaveBeenCalledWith({ where: { id: IMAGE_ID } });
  });

  it('does not expand the scope when S3_FOLDER_MAP.image is PowerPoints', async () => {
    vi.stubEnv('S3_FOLDER_MAP', JSON.stringify({ image: 'PowerPoints' }));
    vi.stubEnv('S3_ALLOWED_FOLDERS', 'Hymns,Images,PowerPoints');
    queueImage('/api/uploads/url?key=PowerPoints%2Fdeck.pptx');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
  });

  it('fails closed when the literal Images upload is redirected elsewhere', async () => {
    vi.stubEnv('S3_FOLDER_MAP', JSON.stringify({ image: 'Images', Images: 'Hymns' }));
    vi.stubEnv('S3_ALLOWED_FOLDERS', 'Hymns,Images,PowerPoints');

    queueImage('/api/uploads/url?key=Hymns%2Fsong.ppsx');
    await ImageService.delete(IMAGE_ID);
    expect(s3Mock.deleteObject).not.toHaveBeenCalled();

    queueImage('/api/uploads/url?key=Images%2Fphoto.jpg');
    await ImageService.delete(IMAGE_ID);
    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
  });

  it('fails closed when S3_FOLDER_MAP is malformed', async () => {
    vi.stubEnv('S3_FOLDER_MAP', '{invalid');
    queueImage('/api/uploads/url?key=Images%2Fphoto.jpg');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
  });

  it('fails closed when S3_FOLDER_MAP.image is empty', async () => {
    vi.stubEnv('S3_FOLDER_MAP', JSON.stringify({ image: '' }));
    queueImage('/api/uploads/url?key=Images%2Fphoto.jpg');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
  });

  it('keeps S3_ALLOWED_FOLDERS independent from the image scope', async () => {
    vi.stubEnv('S3_ALLOWED_FOLDERS', 'backups');

    queueImage('/api/uploads/url?key=backups%2F2026-10-26.sql');
    await ImageService.delete(IMAGE_ID);
    expect(s3Mock.deleteObject).not.toHaveBeenCalled();

    queueImage('/api/uploads/url?key=Images%2Fphoto.jpg');
    await ImageService.delete(IMAGE_ID);
    expect(s3Mock.deleteObject).toHaveBeenCalledWith('Images/photo.jpg');
  });

  it('does not add the historical Uploads/Images prefix automatically', async () => {
    queueImage('/api/uploads/url?key=Uploads%2FImages%2Fold.jpg');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
    expect(prismaImageMock.delete).toHaveBeenCalledWith({ where: { id: IMAGE_ID } });
  });

  it('allows an explicitly configured legacy image prefix', async () => {
    vi.stubEnv('S3_LEGACY_IMAGE_PREFIXES', 'Uploads/Images/');
    queueImage('/api/uploads/url?key=Uploads%2FImages%2Fold.jpg');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).toHaveBeenCalledWith('Uploads/Images/old.jpg');
  });

  it('uses the exact nested image prefix without allowing its parent', async () => {
    vi.stubEnv('S3_KEY_PREFIX', 'Uploads/Images/');

    queueImage('/api/uploads/url?key=Uploads%2FImages%2FImages%2Fphoto.jpg');
    await ImageService.delete(IMAGE_ID);
    expect(s3Mock.deleteObject).toHaveBeenCalledWith('Uploads/Images/Images/photo.jpg');

    s3Mock.deleteObject.mockClear();
    queueImage('/api/uploads/url?key=Uploads%2FImages%2Fparent.jpg');
    await ImageService.delete(IMAGE_ID);
    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
  });

  it('fails closed when an explicit legacy prefix is a parent of the current prefix', async () => {
    vi.stubEnv('S3_KEY_PREFIX', 'Uploads/Images/');
    vi.stubEnv('S3_LEGACY_IMAGE_PREFIXES', 'Uploads/Images/');
    queueImage('/api/uploads/url?key=Uploads%2FImages%2FImages%2Fphoto.jpg');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
  });

  it('rejects a legacy prefix that is not the image folder', async () => {
    vi.stubEnv('S3_LEGACY_IMAGE_PREFIXES', 'Hymns/');
    queueImage('/api/uploads/url?key=Hymns%2Fsong.ppsx');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
  });

  it('rejects a prefix that only looks similar to the image prefix', async () => {
    queueImage('/api/uploads/url?key=ImagesEvil%2Fphoto.jpg');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
  });

  it.each([
    'Images/backups/db.sql',
    'Images/previews/photo.pdf',
    'Images/previews-img/photo.webp',
    'Images/thumbnails/photo.jpg',
    'Images/Thumbnails/photo.jpg',
  ])('rejects reserved namespace inside the image prefix: %s', async (key) => {
    queueImage(`/api/uploads/url?key=${encodeURIComponent(key)}`);

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
  });

  it('fails closed when the base prefix lands in a reserved namespace', async () => {
    vi.stubEnv('S3_KEY_PREFIX', 'backups/');
    queueImage('/api/uploads/url?key=backups%2FImages%2Fphoto.jpg');

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-upload URL', 'https://example.test/collect?key=Images%2Fphoto.jpg'],
    ['a raw key', 'Images/photo.jpg'],
    ['a missing key', '/api/uploads/url'],
    ['an empty key', '/api/uploads/url?key='],
    ['a duplicate key parameter', '/api/uploads/url?key=Images%2Fphoto.jpg&key=backups%2Fdb.sql'],
    ['a traversal attempt', '/api/uploads/url?key=Images%2F..%2Fbackups%2Fdb.sql'],
    ['another upload endpoint', '/api/uploads/thumb?key=Images%2Fphoto.jpg'],
  ])('does not delete S3 for %s', async (_label, imageUrl) => {
    queueImage(imageUrl);

    await ImageService.delete(IMAGE_ID);

    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
    expect(prismaImageMock.delete).toHaveBeenCalledWith({ where: { id: IMAGE_ID } });
  });

  it('returns null and does nothing when the image does not exist', async () => {
    prismaImageMock.findUnique.mockResolvedValueOnce(null);

    const result = await ImageService.delete('missing');

    expect(result).toBeNull();
    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
    expect(prismaImageMock.delete).not.toHaveBeenCalled();
  });

  it('still removes the row when S3 deletion fails', async () => {
    queueImage('/api/uploads/url?key=Images%2Fphoto.jpg');
    s3Mock.deleteObject.mockRejectedValueOnce(new Error('S3 unavailable'));

    const result = await ImageService.delete(IMAGE_ID);

    expect(result).toEqual({ id: IMAGE_ID });
    expect(prismaImageMock.delete).toHaveBeenCalledWith({ where: { id: IMAGE_ID } });
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('image delete prefix configuration', () => {
  const baseEnv = {
    S3_KEY_PREFIX: '',
    AWS_S3_PREFIX: '',
    S3_FOLDER_MAP: DEFAULT_FOLDER_MAP,
    S3_ALLOWED_FOLDERS: 'Hymns,Images,PowerPoints',
    S3_LEGACY_IMAGE_PREFIXES: '',
  };

  function env(overrides = {}) {
    return { ...baseEnv, ...overrides };
  }

  it('derives only the exact current image prefix', () => {
    const prefixes = getImageDeletePrefixes(env({
      S3_KEY_PREFIX: 'Media/',
      S3_ALLOWED_FOLDERS: 'Hymns,PowerPoints',
    }));

    expect(prefixes).toEqual(['Media/Images/']);
    expect(prefixes).not.toContain('Images/');
    expect(prefixes).not.toContain('Uploads/Images/');
  });

  it('uses the default Uploads/ base prefix when none is configured', () => {
    const prefixes = getImageDeletePrefixes({
      S3_FOLDER_MAP: DEFAULT_FOLDER_MAP,
    });

    expect(prefixes).toEqual(['Uploads/Images/']);
  });

  it('keeps an explicitly empty S3_KEY_PREFIX', () => {
    const prefixes = getImageDeletePrefixes(env({ S3_KEY_PREFIX: '' }));

    expect(prefixes).toEqual(['Images/']);
  });

  it('uses S3_KEY_PREFIX before AWS_S3_PREFIX', () => {
    const prefixes = getImageDeletePrefixes(env({
      S3_KEY_PREFIX: '',
      AWS_S3_PREFIX: 'Media/',
    }));

    expect(prefixes).toEqual(['Images/']);
  });

  it('falls back to AWS_S3_PREFIX when S3_KEY_PREFIX is absent', () => {
    const prefixes = getImageDeletePrefixes({
      S3_FOLDER_MAP: DEFAULT_FOLDER_MAP,
      AWS_S3_PREFIX: 'Media/',
    });

    expect(prefixes).toEqual(['Media/Images/']);
  });

  it('does not allow a parent prefix when the base already contains Images', () => {
    const prefixes = getImageDeletePrefixes(env({
      S3_KEY_PREFIX: 'Uploads/Images/',
    }));

    expect(prefixes).toEqual(['Uploads/Images/Images/']);
    expect(prefixes).not.toContain('Uploads/Images/');
  });

  it('ignores absolute markers on the actual Images upload mapping only when they still target Images', () => {
    const prefixes = getImageDeletePrefixes(env({
      S3_FOLDER_MAP: JSON.stringify({ image: 'Images', Images: '!Images' }),
      S3_KEY_PREFIX: 'Media/',
    }));

    expect(prefixes).toEqual(['Images/']);
  });

  it('fails closed when S3_FOLDER_MAP.image is Hymns', () => {
    expect(getImageDeletePrefixes(env({
      S3_FOLDER_MAP: JSON.stringify({ image: 'Hymns' }),
    }))).toEqual([]);
  });

  it('fails closed when S3_FOLDER_MAP.image is PowerPoints', () => {
    expect(getImageDeletePrefixes(env({
      S3_FOLDER_MAP: JSON.stringify({ image: 'PowerPoints' }),
    }))).toEqual([]);
  });

  it('fails closed when the literal Images upload is redirected', () => {
    expect(getImageDeletePrefixes(env({
      S3_FOLDER_MAP: JSON.stringify({ image: 'Images', Images: 'Hymns' }),
    }))).toEqual([]);
  });

  it('fails closed on malformed or non-object S3_FOLDER_MAP', () => {
    expect(getImageDeletePrefixes(env({ S3_FOLDER_MAP: '{invalid' }))).toEqual([]);
    expect(getImageDeletePrefixes(env({ S3_FOLDER_MAP: '[]' }))).toEqual([]);
    expect(getImageDeletePrefixes(env({ S3_FOLDER_MAP: 'null' }))).toEqual([]);
  });

  it('fails closed when S3_FOLDER_MAP.image is missing or invalid', () => {
    expect(getImageDeletePrefixes(env({
      S3_FOLDER_MAP: JSON.stringify({ image: '' }),
    }))).toEqual([]);
    expect(getImageDeletePrefixes(env({
      S3_FOLDER_MAP: JSON.stringify({ image: null }),
    }))).toEqual([]);
    expect(getImageDeletePrefixes(env({
      S3_FOLDER_MAP: JSON.stringify({ image: 123 }),
    }))).toEqual([]);
  });

  it('does not use S3_ALLOWED_FOLDERS as an image scope', () => {
    const prefixes = getImageDeletePrefixes(env({
      S3_ALLOWED_FOLDERS: 'backups',
    }));

    expect(prefixes).toEqual(['Images/']);
  });

  it('fails closed when the base prefix is reserved', () => {
    expect(getImageDeletePrefixes(env({
      S3_KEY_PREFIX: 'backups/',
    }))).toEqual([]);
  });

  it('allows an explicit legacy image prefix', () => {
    const prefixes = getImageDeletePrefixes(env({
      S3_LEGACY_IMAGE_PREFIXES: 'Uploads/Images/',
    }));

    expect(prefixes).toEqual(['Images/', 'Uploads/Images/']);
  });

  it('rejects an explicit legacy parent prefix', () => {
    const prefixes = getImageDeletePrefixes(env({
      S3_KEY_PREFIX: 'Uploads/Images/',
      S3_LEGACY_IMAGE_PREFIXES: 'Uploads/Images/',
    }));

    expect(prefixes).toEqual([]);
  });

  it('rejects legacy prefixes that are not image folders or are reserved', () => {
    expect(getImageDeletePrefixes(env({
      S3_LEGACY_IMAGE_PREFIXES: 'Hymns/',
    }))).toEqual([]);
    expect(getImageDeletePrefixes(env({
      S3_LEGACY_IMAGE_PREFIXES: 'PowerPoints/',
    }))).toEqual([]);
    expect(getImageDeletePrefixes(env({
      S3_LEGACY_IMAGE_PREFIXES: 'backups/Images/',
    }))).toEqual([]);
  });

  it('deduplicates an explicit legacy prefix equal to the current prefix', () => {
    const prefixes = getImageDeletePrefixes(env({
      S3_KEY_PREFIX: '',
      S3_LEGACY_IMAGE_PREFIXES: 'Images/',
    }));

    expect(prefixes).toEqual(['Images/']);
  });
});
