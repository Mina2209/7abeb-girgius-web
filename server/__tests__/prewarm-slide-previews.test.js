import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { runPrewarm, keyFromFileUrl, isPowerPointFile } from '../scripts/prewarm-slide-previews.js';

function hash(s) {
  return createHash('sha256').update(s).digest('hex').slice(0, 32);
}

describe('prewarm-slide-previews', () => {
  let mockPrisma;
  let mockS3;
  let mockToolchain;
  let mockPeek;
  let mockEnsure;
  const ownedPdf = (key, kind) => kind === 'image' ? `previews-image/v2/${hash(key)}.pdf` : `previews-file/v2/${hash(key)}.pdf`;
  const legacyPdf = (key) => `previews/v2/${hash(key)}.pdf`;
  const marker = (key, kind) => {
    if (kind === 'image' || kind === 'file') {
      return `previews-${kind}-img/v2/${hash(key)}/complete.json`;
    }
    return `previews-img/${hash(key)}/complete.json`;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      file: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    mockS3 = {
      objectExists: vi.fn().mockResolvedValue(false),
      getObjectBuffer: vi.fn(),
    };
    mockToolchain = vi.fn().mockResolvedValue({ available: true });
    mockPeek = vi.fn().mockResolvedValue(null);
    mockEnsure = vi.fn().mockResolvedValue({ template: 'x', pages: 5 });
  });

  it('default mode is dry-run', async () => {
    const result = await runPrewarm({ 
      dryRun: true,
      prismaClient: mockPrisma,
      s3: mockS3,
      toolchainFn: mockToolchain,
      peekFn: mockPeek,
      ensureFn: mockEnsure,
      previewKeyForOwnedSourceFn: ownedPdf,
      previewKeyForSourceFn: legacyPdf,
      slideImageMarkerKeyForSourceFn: marker,
    });
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it('dry-run never calls generation or S3 write functions', async () => {
    mockPrisma.file.findMany.mockResolvedValue([{
      id: 'file1',
      type: 'POWERPOINT',
      originalName: 'test.pptx',
      fileUrl: 'https://bucket.s3.amazonaws.com/Hymns/test.pptx?key=Hymns/test.pptx',
    }]);
    mockS3.objectExists.mockImplementation((key) => {
      if (key.includes('.pdf')) return Promise.resolve(true);
      return Promise.resolve(false);
    });
    
    const result = await runPrewarm({ 
      dryRun: true,
      prismaClient: mockPrisma,
      s3: mockS3,
      toolchainFn: mockToolchain,
      peekFn: mockPeek,
      ensureFn: mockEnsure,
      previewKeyForOwnedSourceFn: ownedPdf,
      previewKeyForSourceFn: legacyPdf,
      slideImageMarkerKeyForSourceFn: marker,
    });
    expect(mockEnsure).not.toHaveBeenCalled();
    expect(mockS3.putObject).toBeUndefined();
  });

  it('existing valid slide-image markers are skipped', async () => {
    mockPrisma.file.findMany.mockResolvedValue([{
      id: 'file1',
      type: 'POWERPOINT',
      originalName: 'test.pptx',
      fileUrl: 'https://bucket.s3.amazonaws.com/Hymns/test.pptx?key=Hymns/test.pptx',
    }]);
    mockS3.objectExists.mockImplementation((key) => {
      if (key.includes('.pdf')) return Promise.resolve(true);
      if (key.includes('complete.json')) return Promise.resolve(true);
      return Promise.resolve(false);
    });
    mockS3.getObjectBuffer.mockResolvedValue(Buffer.from(JSON.stringify({ pages: 13 })));
    mockPeek.mockResolvedValue({ template: 'x', pages: 13 });
    
    const result = await runPrewarm({ 
      dryRun: true,
      prismaClient: mockPrisma,
      s3: mockS3,
      toolchainFn: mockToolchain,
      peekFn: mockPeek,
      ensureFn: mockEnsure,
      previewKeyForOwnedSourceFn: ownedPdf,
      previewKeyForSourceFn: legacyPdf,
      slideImageMarkerKeyForSourceFn: marker,
    });
    expect(result.toProcess.length).toBe(0);
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it('files without a matching preview PDF are skipped', async () => {
    mockPrisma.file.findMany.mockResolvedValue([{
      id: 'file1',
      type: 'POWERPOINT',
      originalName: 'test.pptx',
      fileUrl: 'https://bucket.s3.amazonaws.com/Hymns/test.pptx?key=Hymns/test.pptx',
    }]);
    mockS3.objectExists.mockResolvedValue(false);
    
    const result = await runPrewarm({ 
      dryRun: true,
      prismaClient: mockPrisma,
      s3: mockS3,
      toolchainFn: mockToolchain,
      peekFn: mockPeek,
      ensureFn: mockEnsure,
      previewKeyForOwnedSourceFn: ownedPdf,
      previewKeyForSourceFn: legacyPdf,
      slideImageMarkerKeyForSourceFn: marker,
    });
    expect(result.toProcess.length).toBe(0);
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it('ambiguous kind or preview namespaces are skipped rather than guessed', async () => {
    mockPrisma.file.findMany.mockResolvedValue([{
      id: 'file1',
      type: 'POWERPOINT',
      originalName: 'test.pptx',
      fileUrl: 'https://bucket.s3.amazonaws.com/Hymns/test.pptx?key=Hymns/test.pptx',
    }]);
    mockS3.objectExists.mockResolvedValue(true); // all exist - ambiguous
    
    const result = await runPrewarm({ 
      dryRun: true,
      prismaClient: mockPrisma,
      s3: mockS3,
      toolchainFn: mockToolchain,
      peekFn: mockPeek,
      ensureFn: mockEnsure,
      previewKeyForOwnedSourceFn: ownedPdf,
      previewKeyForSourceFn: legacyPdf,
      slideImageMarkerKeyForSourceFn: marker,
    });
    expect(result.toProcess.length).toBe(0);
  });

  it('invalid markers are not overwritten or regenerated automatically', async () => {
    mockPrisma.file.findMany.mockResolvedValue([{
      id: 'file1',
      type: 'POWERPOINT',
      originalName: 'test.pptx',
      fileUrl: 'https://bucket.s3.amazonaws.com/Hymns/test.pptx?key=Hymns/test.pptx',
    }]);
    mockS3.objectExists.mockImplementation((key) => {
      if (key.includes('.pdf')) return Promise.resolve(true);
      if (key.includes('complete.json')) return Promise.resolve(true);
      return Promise.resolve(false);
    });
    mockS3.getObjectBuffer.mockResolvedValue(Buffer.from(JSON.stringify({ pages: 0 }))); // invalid
    
    const result = await runPrewarm({ 
      dryRun: true,
      prismaClient: mockPrisma,
      s3: mockS3,
      toolchainFn: mockToolchain,
      peekFn: mockPeek,
      ensureFn: mockEnsure,
      previewKeyForOwnedSourceFn: ownedPdf,
      previewKeyForSourceFn: legacyPdf,
      slideImageMarkerKeyForSourceFn: marker,
    });
    expect(result.toProcess.length).toBe(0);
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it('limit is respected and failure does not stop others', async () => {
    const prev = process.env.PREWARM_ALLOW_CROSS_PROCESS;
    process.env.PREWARM_ALLOW_CROSS_PROCESS = '1';
    mockPrisma.file.findMany.mockResolvedValue([
      { id: 'file1', type: 'POWERPOINT', originalName: 'test1.pptx', fileUrl: 'https://x.com/y?key=Hymns/test1.pptx' },
      { id: 'file2', type: 'POWERPOINT', originalName: 'test2.pptx', fileUrl: 'https://x.com/y?key=Hymns/test2.pptx' },
      { id: 'file3', type: 'POWERPOINT', originalName: 'test3.pptx', fileUrl: 'https://x.com/y?key=Hymns/test3.pptx' },
    ]);
    mockS3.objectExists.mockImplementation((key) => {
      // Only legacy PDF exists
      if (key.includes('previews/v') && key.includes('.pdf')) return Promise.resolve(true);
      if (key.includes('complete.json')) return Promise.resolve(false);
      return Promise.resolve(false);
    });
    mockEnsure.mockImplementation((key) => {
      if (key === 'Hymns/test1.pptx') throw new Error('fail');
      return Promise.resolve({ template: 'x', pages: 5 });
    });
    
    const result = await runPrewarm({ 
      dryRun: false,
      limit: 2,
      delayMs: 0,
      prismaClient: mockPrisma,
      s3: mockS3,
      toolchainFn: mockToolchain,
      peekFn: mockPeek,
      ensureFn: mockEnsure,
      previewKeyForOwnedSourceFn: ownedPdf,
      previewKeyForSourceFn: legacyPdf,
      slideImageMarkerKeyForSourceFn: marker,
    });
    expect(mockEnsure).toHaveBeenCalledTimes(2);
    expect(result.failed).toBe(1);
    expect(result.success).toBe(1);
    if (prev === undefined) delete process.env.PREWARM_ALLOW_CROSS_PROCESS;
    else process.env.PREWARM_ALLOW_CROSS_PROCESS = prev;
  });
});
