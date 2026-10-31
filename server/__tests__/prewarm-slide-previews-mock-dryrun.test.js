import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { runPrewarm } from '../scripts/prewarm-slide-previews.js';

function hash(s) {
  return createHash('sha256').update(s).digest('hex').slice(0, 32);
}

describe('prewarm-slide-previews mock dry-run (isolated)', () => {
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
    mockPrisma = { file: { findMany: vi.fn() } };
    mockS3 = { objectExists: vi.fn(), getObjectBuffer: vi.fn() };
    mockToolchain = vi.fn().mockResolvedValue({ available: true });
    mockPeek = vi.fn().mockResolvedValue(null);
    mockEnsure = vi.fn().mockResolvedValue({ template: 'x', pages: 5 });
  });

  it('isolated mock dry-run uses injected deps only; no writes/generation', async () => {
    const hA = hash('Hymns/a.pptx');
    const hB = hash('Hymns/b.pptx');
    const hC = hash('Hymns/c.pptx');
    const hD = hash('Hymns/d.pptx');

    mockPrisma.file.findMany.mockResolvedValue([
      { id: 'f1', type: 'POWERPOINT', originalName: 'a.pptx', fileUrl: `https://x/y?key=Hymns/a.pptx` },
      { id: 'f2', type: 'POWERPOINT', originalName: 'b.pptx', fileUrl: `https://x/y?key=Hymns/b.pptx` },
      { id: 'f3', type: 'POWERPOINT', originalName: 'c.pptx', fileUrl: `https://x/y?key=Hymns/c.pptx` },
      { id: 'f4', type: 'POWERPOINT', originalName: 'd.pptx', fileUrl: `https://x/y?key=Hymns/d.pptx` },
    ]);

    mockS3.objectExists.mockImplementation((key) => {
      // f1: legacy pdf exists + valid marker -> skip
      if (key === `previews/v2/${hA}.pdf`) return true;
      if (key.includes(hA) && key.includes('complete.json')) return true;
      // f2: no pdf -> skip
      // f3: pdf exists but invalid marker -> skip
      if (key === `previews/v2/${hC}.pdf`) return true;
      if (key.includes(hC) && key.includes('complete.json')) return true;
      // f4: pdf exists, no marker, peek null -> candidate
      if (key === `previews/v2/${hD}.pdf`) return true;
      return false;
    });
    mockS3.getObjectBuffer.mockImplementation((key) => {
      if (key.includes(hA) && key.includes('complete.json')) return Promise.resolve(Buffer.from(JSON.stringify({ pages: 12 })));
      if (key.includes(hC) && key.includes('complete.json')) return Promise.resolve(Buffer.from(JSON.stringify({ pages: 0 })));
      return Promise.resolve(Buffer.from('{}'));
    });
    mockPeek.mockResolvedValue(null);

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
    expect(mockS3.deleteObject).toBeUndefined();
    expect(result.toProcess.length).toBe(1);
    expect(result.toProcess[0].file.id).toBe('f4');
  });
});
