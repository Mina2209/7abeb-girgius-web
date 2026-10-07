import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted: mocks referenced from vi.mock factories ────────────────────
const { prismaHymnMock, s3Mock, queuePpsxSpy, findUniqueFn } = vi.hoisted(() => {
  const findUniqueFn = vi.fn().mockResolvedValue(null);
  return {
    prismaHymnMock: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: findUniqueFn,
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    s3Mock: { deleteObject: vi.fn().mockResolvedValue({}) },
    queuePpsxSpy: vi.fn().mockResolvedValue(undefined),
    findUniqueFn,
  };
});

// ── Mocks ───────────────────────────────────────────────────────────────
vi.mock('../services/prisma.js', () => ({ prisma: { hymn: prismaHymnMock } }));
vi.mock('../services/s3.service.js', () => ({ default: s3Mock }));
vi.mock('../services/ppsx-converter.js', () => ({ queuePpsxPreviews: queuePpsxSpy }));

// ── Imports (after mocks) ───────────────────────────────────────────────
import { HymnService } from '../services/hymn.service.js';

const FILES = [
  {
    id: 'f1',
    type: 'POWERPOINT',
    fileUrl: '/api/uploads/url?key=Hymns%2Fsong.ppsx',
    previewUrl: null,
    originalName: 'song.ppsx',
  },
];

describe('HymnService – PPSX preview wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueFn.mockResolvedValue(null);
  });

  it('queues preview generation for the returned files on create', async () => {
    const result = { id: 'h1', title: 'تسبحة', files: FILES };
    prismaHymnMock.create.mockResolvedValueOnce(result);

    const created = await HymnService.create({ title: 'تسبحة', files: FILES });

    expect(created).toBe(result);
    expect(prismaHymnMock.create).toHaveBeenCalledOnce();
    expect(queuePpsxSpy).toHaveBeenCalledWith(FILES);
  });

  it('queues preview generation for the returned files on update', async () => {
    const result = { id: 'h1', title: 'تسبحة', files: FILES };
    prismaHymnMock.update.mockResolvedValueOnce(result);

    const updated = await HymnService.update('h1', { title: 'تسبحة', files: FILES });

    expect(updated).toBe(result);
    expect(prismaHymnMock.update).toHaveBeenCalledOnce();
    expect(queuePpsxSpy).toHaveBeenCalledWith(FILES);
  });

  it('deletes the cached preview object alongside the source file on hymn delete', async () => {
    prismaHymnMock.findUnique.mockResolvedValueOnce({
      id: 'h1',
      files: [
        {
          id: 'f1',
          type: 'POWERPOINT',
          fileUrl: '/api/uploads/url?key=Hymns%2Fsong.ppsx',
          previewUrl: '/api/uploads/url?key=previews%2Fh1-slide.pdf',
        },
      ],
    });
    prismaHymnMock.delete.mockResolvedValueOnce({ id: 'h1' });

    const result = await HymnService.delete('h1');

    expect(result).toEqual({ id: 'h1' });
    expect(s3Mock.deleteObject).toHaveBeenCalledWith('previews/h1-slide.pdf');
    expect(s3Mock.deleteObject).toHaveBeenCalledWith('Hymns/song.ppsx');
    expect(prismaHymnMock.delete).toHaveBeenCalledWith({ where: { id: 'h1' } });
  });

  it('returns null and never touches S3 when the hymn does not exist', async () => {
    const result = await HymnService.delete('missing');

    expect(result).toBeNull();
    expect(s3Mock.deleteObject).not.toHaveBeenCalled();
    expect(prismaHymnMock.delete).not.toHaveBeenCalled();
  });
});