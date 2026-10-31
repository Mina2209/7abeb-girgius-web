import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { runPrewarm } from '../scripts/prewarm-slide-previews.js';

function hash(s) { return createHash('sha256').update(s).digest('hex').slice(0, 32); }
const ownedPdf = (key, kind) => kind === 'image' ? `previews-image/v2/${hash(key)}.pdf` : `previews-file/v2/${hash(key)}.pdf`;
const legacyPdf = (key) => `previews/v2/${hash(key)}.pdf`;
const marker = (key, kind) => kind === 'image' || kind === 'file' ? `previews-${kind}-img/v2/${hash(key)}/complete.json` : `previews-img/${hash(key)}/complete.json`;

describe('prewarm targeting', () => {
  let mockPrisma, mockS3, mockToolchain, mockPeek, mockEnsure;
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = { file: { findMany: vi.fn(), findUnique: vi.fn() } };
    mockS3 = { objectExists: vi.fn(), getObjectBuffer: vi.fn() };
    mockToolchain = vi.fn().mockResolvedValue({ available: true });
    mockPeek = vi.fn().mockResolvedValue(null);
    mockEnsure = vi.fn().mockResolvedValue({ template: 'x', pages: 5 });
  });

  it('queries only target file by id when --file-id provided', async () => {
    mockPrisma.file.findUnique.mockResolvedValue({ id: 'f1', type: 'POWERPOINT', originalName: 'a.pptx', fileUrl: 'https://x/y?key=Hymns/a.pptx' });
    mockS3.objectExists.mockImplementation((k) => k.includes('previews/v2/') && k.includes('.pdf'));
    const res = await runPrewarm({ dryRun: true, fileId: 'f1', prismaClient: mockPrisma, s3: mockS3, toolchainFn: mockToolchain, peekFn: mockPeek, ensureFn: mockEnsure, previewKeyForOwnedSourceFn: ownedPdf, previewKeyForSourceFn: legacyPdf, slideImageMarkerKeyForSourceFn: marker });
    expect(mockPrisma.file.findUnique).toHaveBeenCalledWith({ where: { id: 'f1' }, include: { hymn: { select: { id: true, title: true } } } });
    expect(mockPrisma.file.findMany).not.toHaveBeenCalled();
    expect(res.toProcess.length).toBe(1);
  });

  it('missing file throws error without broad scan', async () => {
    mockPrisma.file.findUnique.mockResolvedValue(null);
    await expect(runPrewarm({ dryRun: true, fileId: 'bad', prismaClient: mockPrisma, s3: mockS3, toolchainFn: mockToolchain, peekFn: mockPeek, ensureFn: mockEnsure, previewKeyForOwnedSourceFn: ownedPdf, previewKeyForSourceFn: legacyPdf, slideImageMarkerKeyForSourceFn: marker })).rejects.toThrow(/File not found/);
    expect(mockPrisma.file.findMany).not.toHaveBeenCalled();
  });

  it('unsupported file skips without broad scan', async () => {
    mockPrisma.file.findUnique.mockResolvedValue({ id: 'f1', type: 'IMAGE', originalName: 'x.jpg', fileUrl: 'https://x/y?key=Hymns/x.jpg' });
    const res = await runPrewarm({ dryRun: true, fileId: 'f1', prismaClient: mockPrisma, s3: mockS3, toolchainFn: mockToolchain, peekFn: mockPeek, ensureFn: mockEnsure, previewKeyForOwnedSourceFn: ownedPdf, previewKeyForSourceFn: legacyPdf, slideImageMarkerKeyForSourceFn: marker });
    expect(res.toProcess.length).toBe(0);
    expect(mockPrisma.file.findMany).not.toHaveBeenCalled();
  });

  it('dry-run with file-id never calls ensure or writes', async () => {
    mockPrisma.file.findUnique.mockResolvedValue({ id: 'f1', type: 'POWERPOINT', originalName: 'a.pptx', fileUrl: 'https://x/y?key=Hymns/a.pptx' });
    mockS3.objectExists.mockImplementation((k) => k.includes('previews/v2/') && k.includes('.pdf'));
    const res = await runPrewarm({ dryRun: true, fileId: 'f1', prismaClient: mockPrisma, s3: mockS3, toolchainFn: mockToolchain, peekFn: mockPeek, ensureFn: mockEnsure, previewKeyForOwnedSourceFn: ownedPdf, previewKeyForSourceFn: legacyPdf, slideImageMarkerKeyForSourceFn: marker });
    expect(mockEnsure).not.toHaveBeenCalled();
    expect(mockS3.putObject).toBeUndefined();
  });

  it('apply refuses without PREWARM_ALLOW_CROSS_PROCESS=1', async () => {
    const prev = process.env.PREWARM_ALLOW_CROSS_PROCESS;
    delete process.env.PREWARM_ALLOW_CROSS_PROCESS;
    mockPrisma.file.findUnique.mockResolvedValue({ id: 'f1', type: 'POWERPOINT', originalName: 'a.pptx', fileUrl: 'https://x/y?key=Hymns/a.pptx' });
    mockS3.objectExists.mockImplementation((k) => k.includes('previews/v2/') && k.includes('.pdf'));
    await expect(runPrewarm({ dryRun: false, fileId: 'f1', prismaClient: mockPrisma, s3: mockS3, toolchainFn: mockToolchain, peekFn: mockPeek, ensureFn: mockEnsure, previewKeyForOwnedSourceFn: ownedPdf, previewKeyForSourceFn: legacyPdf, slideImageMarkerKeyForSourceFn: marker })).rejects.toThrow(/PREWARM_ALLOW_CROSS_PROCESS/);
    if (prev === undefined) delete process.env.PREWARM_ALLOW_CROSS_PROCESS; else process.env.PREWARM_ALLOW_CROSS_PROCESS = prev;
  });

  it('apply with opt-in calls ensure only for targeted file', async () => {
    const prev = process.env.PREWARM_ALLOW_CROSS_PROCESS;
    process.env.PREWARM_ALLOW_CROSS_PROCESS = '1';
    mockPrisma.file.findUnique.mockResolvedValue({ id: 'f1', type: 'POWERPOINT', originalName: 'a.pptx', fileUrl: 'https://x/y?key=Hymns/a.pptx' });
    mockS3.objectExists.mockImplementation((k) => k.includes('previews/v2/') && k.includes('.pdf'));
    const res = await runPrewarm({ dryRun: false, fileId: 'f1', delayMs: 0, prismaClient: mockPrisma, s3: mockS3, toolchainFn: mockToolchain, peekFn: mockPeek, ensureFn: mockEnsure, previewKeyForOwnedSourceFn: ownedPdf, previewKeyForSourceFn: legacyPdf, slideImageMarkerKeyForSourceFn: marker });
    expect(mockEnsure).toHaveBeenCalledTimes(1);
    expect(mockEnsure).toHaveBeenCalledWith('Hymns/a.pptx', {});
    expect(res.success).toBe(1);
    if (prev === undefined) delete process.env.PREWARM_ALLOW_CROSS_PROCESS; else process.env.PREWARM_ALLOW_CROSS_PROCESS = prev;
  });
});
