import { describe, it, expect, vi } from 'vitest';
import { access, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import * as ppsxConverter from '../services/ppsx-converter.js';
import { createPpsxConverter } from '../services/ppsx-converter.js';

const SOURCE_KEY = 'PowerPoints/hymn.ppsx';
const SOURCE_BYTES = Buffer.from('PPSX_BYTES');

// Route tests mock this module wholesale, so nothing else would catch a named export
// that controllers import but the module forgets to provide — a failure that only
// shows up as an ESM link error when the server boots.
describe('ppsx-converter – module surface', () => {
  it('exports every symbol the upload controller imports', () => {
    for (const name of ['ensurePreviewPdf', 'generatePreviewForKey', 'isPreviewableKey']) {
      expect(typeof ppsxConverter[name], `missing export: ${name}`).toBe('function');
    }
    expect(typeof ppsxConverter.queuePpsxPreviews).toBe('function');
    expect(typeof ppsxConverter.previewKeyForSource).toBe('function');
  });

  it('the default converter exposes the same callables it exports', () => {
    expect(ppsxConverter.ensurePreviewPdf).toBeTypeOf('function');
    expect(ppsxConverter.isPreviewableKey('PowerPoints/a.pptx')).toBe(true);
    expect(ppsxConverter.isPreviewableKey('Hymns/a.mp3')).toBe(false);
  });
});

// Any leftover "ppsx-*" work dirs under the OS tmp dir mean a finally-rm was skipped.
async function listPpsxWorkDirs() {
  const names = await readdir(tmpdir());
  return names.filter((n) => n.startsWith('ppsx-preview-') || n.startsWith('ppsx-count-'));
}

async function expectRemoved(dir) {
  await expect(access(dir)).rejects.toThrow();
}

// The whole point of the feature: pushes go only to previews/, and the source object
// stored in the mock S3 map is byte-for-byte unchanged by any operation.
function expectSourceUntouched(s3Service, objects) {
  for (const call of s3Service.putObjectBuffer.mock.calls) {
    expect(call[0]).not.toBe(SOURCE_KEY);
    expect(call[0]).toMatch(/^previews\//);
  }
  expect(objects.get(SOURCE_KEY).toString()).toBe(SOURCE_BYTES.toString());
}

function createMocks({ slideImages = false, clipGuard = null, probeCsFont = async () => 'Tajawal Regular' } = {}) {
  const objects = new Map();
  const outdirs = [];
  const s3Service = {
    getObjectBuffer: vi.fn(async (key) => {
      if (!objects.has(key)) throw new Error(`not found: ${key}`);
      return objects.get(key);
    }),
    putObjectBuffer: vi.fn(async (key, body) => {
      objects.set(key, body);
    }),
    objectExists: vi.fn(async (key) => objects.has(key)),
  };
  const libreofficeCalls = { count: 0 };
  // Mirrors promisified execFile: (cmd, args). LibreOffice writes the converted PDF
  // into --outdir next to the input; pdfinfo returns a page count.
  const execute = vi.fn(async (cmd, args = []) => {
    if (cmd.toLowerCase().endsWith('pdfinfo')) {
      return { stdout: 'Pages: 3\n' };
    }
    libreofficeCalls.count += 1;
    const outIndex = args.indexOf('--outdir');
    const outdir = args[outIndex + 1];
    outdirs.push(outdir);
    const input = args[args.length - 1];
    const outName = `${basename(input, extname(input))}.pdf`;
    await writeFile(join(outdir, outName), 'FAKE_PDF');
    return { stdout: '' };
  });
  const database = { file: { update: vi.fn(async () => undefined) } };
  const converter = createPpsxConverter({
    s3Service,
    database,
    execute,
    // Pretend LibreOffice + poppler are installed; the real probe shells out to the
    // host, which would make these tests depend on the developer's machine.
    resolveBinaries: async () => ({
      available: true,
      libreofficeBin: 'libreoffice',
      pdfinfoBin: 'pdfinfo',
    }),
    // Per-slide images are off unless a test asks for them: the real generator
    // shells out to python3/poppler, which would make these PDF tests depend on
    // whatever toolchain the developer happens to have installed.
    slideImages,
    // Same reasoning for the clip guard — the real one shells out to python3 and
    // pdftotext and would add LibreOffice runs of its own. Tests that exercise it
    // pass a fake instead of leaving this default in place.
    clipGuard,
    // Arabic CS-font self-check: stubbed so tests never shell out to the host's
    // fontconfig. Defaults to the correct Tajawal mapping (silent); a self-check
    // test overrides it to drive the warn / fail paths.
    probeCsFont,
  });
  return { objects, s3Service, outdirs, execute, database, libreofficeCalls, converter };
}

describe('ppsx-converter – on-demand preview generation', () => {
  it('converts a .ppsx source to a stable preview key and reports the page count', async () => {
    const { objects, s3Service, outdirs, libreofficeCalls, converter } = createMocks();
    objects.set(SOURCE_KEY, SOURCE_BYTES);

    const result = await converter.generatePreviewForKey(SOURCE_KEY);

    expect(result.previewKey).toMatch(/^previews\/[a-f0-9]{32}\.pdf$/);
    expect(result.previewUrl).toContain(encodeURIComponent(result.previewKey));
    expect(result.slideCount).toBe(3);
    expect(libreofficeCalls.count).toBe(1);
    expect(objects.has(result.previewKey)).toBe(true);
    expect(s3Service.putObjectBuffer.mock.calls[0][1].toString()).toBe('FAKE_PDF');
    expect(s3Service.putObjectBuffer.mock.calls[0][2]).toBe('application/pdf');
    expect(s3Service.putObjectBuffer.mock.calls[0][3]).toMatchObject({
      CacheControl: 'public, max-age=31536000, immutable',
    });
    expectSourceUntouched(s3Service, objects);
    expect(outdirs.length).toBe(1);
    await expectRemoved(outdirs[0]);
    expect(await listPpsxWorkDirs()).toEqual([]);
  });

  it('reuses an existing cached preview instead of re-converting', async () => {
    const { objects, s3Service, libreofficeCalls, converter } = createMocks();
    objects.set(SOURCE_KEY, SOURCE_BYTES);

    await converter.generatePreviewForKey(SOURCE_KEY); // first call converts
    const second = await converter.generatePreviewForKey(SOURCE_KEY); // second is cached
    const third = await converter.generatePreviewForKey(SOURCE_KEY);

    expect(libreofficeCalls.count).toBe(1);
    expect(s3Service.putObjectBuffer).toHaveBeenCalledTimes(1);
    expect(second.slideCount).toBe(3);
    expect(third.slideCount).toBe(3);
    expectSourceUntouched(s3Service, objects);
  });

  it('rejects non-presentation keys', async () => {
    const { converter } = createMocks();

    await expect(converter.generatePreviewForKey('PowerPoints/doc.pdf')).rejects.toMatchObject({
      code: 'UNSUPPORTED_TYPE',
    });
    await expect(converter.generatePreviewForKey('Hymns/song.mp3')).rejects.toMatchObject({
      code: 'UNSUPPORTED_TYPE',
    });
  });

  // The admin upload UI advertises `.ppt,.pptx,.ppsx`; rejecting .ppt left those
  // uploads permanently without a preview.
  it.each(['ppt', 'pptx', 'ppsx', 'pps', 'pptm', 'potx', 'odp'])(
    'accepts .%s sources',
    async (ext) => {
      const { objects, s3Service, libreofficeCalls, converter } = createMocks();
      const key = `PowerPoints/hymn.${ext}`;
      objects.set(key, SOURCE_BYTES);

      const result = await converter.generatePreviewForKey(key);

      expect(result.previewKey).toMatch(/^previews\/[a-f0-9]{32}\.pdf$/);
      expect(libreofficeCalls.count).toBe(1);
      expect(s3Service.putObjectBuffer.mock.calls[0][0]).toMatch(/^previews\//);
    },
  );

  it('dedupes concurrent conversions of the same source into a single LibreOffice run', async () => {
    const { objects, s3Service, libreofficeCalls, converter } = createMocks();
    objects.set(SOURCE_KEY, SOURCE_BYTES);

    const results = await Promise.all([
      converter.generatePreviewForKey(SOURCE_KEY),
      converter.generatePreviewForKey(SOURCE_KEY),
      converter.generatePreviewForKey(SOURCE_KEY),
    ]);

    expect(libreofficeCalls.count).toBe(1);
    expect(s3Service.putObjectBuffer).toHaveBeenCalledTimes(1);
    expect(new Set(results.map((r) => r.previewKey)).size).toBe(1);
  });

  it('does not leave a failed conversion blocking later retries', async () => {
    const { objects, s3Service, execute, converter } = createMocks();
    objects.set(SOURCE_KEY, SOURCE_BYTES);
    execute.mockImplementationOnce(async () => {
      throw new Error('soffice exited with status 1');
    });

    await expect(converter.generatePreviewForKey(SOURCE_KEY)).rejects.toThrow('status 1');
    // The in-flight entry must have been cleared, so a retry can succeed.
    const retry = await converter.generatePreviewForKey(SOURCE_KEY);

    expect(retry.slideCount).toBe(3);
    expect(objects.has(retry.previewKey)).toBe(true);
  });
});

describe('ppsx-converter – failure paths', () => {
  it('rejects when LibreOffice conversion fails (corrupt PPSX) and never writes anything', async () => {
    const { objects, s3Service, outdirs, execute, converter } = createMocks();
    objects.set(SOURCE_KEY, SOURCE_BYTES);
    execute.mockImplementationOnce(async (cmd, args = []) => {
      const outIndex = args.indexOf('--outdir');
      if (outIndex > -1) outdirs.push(args[outIndex + 1]);
      throw new Error('soffice exited with status 1');
    });

    await expect(converter.generatePreviewForKey(SOURCE_KEY)).rejects.toThrow('soffice exited with status 1');

    expect(s3Service.putObjectBuffer).not.toHaveBeenCalled();
    expectSourceUntouched(s3Service, objects);
    expect(outdirs.length).toBe(1);
    await expectRemoved(outdirs[0]);
    expect(await listPpsxWorkDirs()).toEqual([]);
  });

  it('rejects when the source object cannot be read from S3 (missing/corrupt S3 read)', async () => {
    const { objects, s3Service, outdirs, converter } = createMocks();
    // objects deliberately has NO SOURCE_KEY — the "not found" path.

    await expect(converter.generatePreviewForKey(SOURCE_KEY)).rejects.toThrow('not found');

    expect(s3Service.putObjectBuffer).not.toHaveBeenCalled();
    expect(s3Service.objectExists).toHaveBeenCalledTimes(1);
    expect(outdirs.length).toBe(0); // execute never ran
    expect(await listPpsxWorkDirs()).toEqual([]);
  });

  it('rejects when writing the preview object fails and leaves the source untouched', async () => {
    const { objects, s3Service, outdirs, libreofficeCalls, converter } = createMocks();
    objects.set(SOURCE_KEY, SOURCE_BYTES);
    s3Service.putObjectBuffer.mockRejectedValueOnce(new Error('S3 write denied'));

    await expect(converter.generatePreviewForKey(SOURCE_KEY)).rejects.toThrow('S3 write denied');

    expect(libreofficeCalls.count).toBe(1); // conversion actually ran before the write failed
    expectSourceUntouched(s3Service, objects);
    expect(outdirs.length).toBe(1);
    await expectRemoved(outdirs[0]);
    expect(await listPpsxWorkDirs()).toEqual([]);
  });

  it('treats an objectExists probe failure safely: rejects, never converts, source preserved', async () => {
    const { objects, s3Service, libreofficeCalls, converter } = createMocks();
    objects.set(SOURCE_KEY, SOURCE_BYTES);
    s3Service.objectExists.mockRejectedValueOnce(new Error('S3 head failed'));

    await expect(converter.generatePreviewForKey(SOURCE_KEY)).rejects.toThrow('S3 head failed');

    expect(libreofficeCalls.count).toBe(0); // no conversion attempt on a failed probe
    expect(s3Service.putObjectBuffer).not.toHaveBeenCalled();
    expectSourceUntouched(s3Service, objects);
  });
});

// The per-slide WebP preview is a second, additive layer on top of the PDF. The PDF
// must keep working whether or not the fitter succeeds, so every image failure mode
// is asserted to leave the PDF preview in place.
describe('ppsx-converter – per-slide images', () => {
  const TEMPLATE = '/api/uploads/url?key=previews-img%2Fabc%2F{n}.webp';

  function stubImages(overrides = {}) {
    return {
      peek: vi.fn(async () => null),
      generate: vi.fn(async () => null),
      ensure: vi.fn(async () => ({ template: TEMPLATE, pages: 3 })),
      ...overrides,
    };
  }

  const FILE = {
    id: 'file-1',
    type: 'POWERPOINT',
    originalName: 'hymn.ppsx',
    fileUrl: `/api/uploads/url?key=${encodeURIComponent(SOURCE_KEY)}`,
  };

  it('stores the image template and the rendered page count on the File row', async () => {
    const slideImages = stubImages();
    const { objects, database, converter } = createMocks({ slideImages });
    objects.set(SOURCE_KEY, SOURCE_BYTES);

    const result = await converter.convertFile(FILE);

    expect(result.previewImageBaseUrl).toBe(TEMPLATE);
    expect(database.file.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: {
        previewUrl: expect.stringContaining(
          encodeURIComponent(ppsxConverter.previewKeyForSource(SOURCE_KEY)),
        ),
        slideCount: 3,
        previewImageBaseUrl: TEMPLATE,
      },
    });
  });

  it('keeps the PDF preview and omits the column entirely when the fitter throws', async () => {
    const slideImages = stubImages({
      ensure: vi.fn(async () => {
        throw new Error('fitter crashed');
      }),
    });
    const { objects, database, converter } = createMocks({ slideImages });
    objects.set(SOURCE_KEY, SOURCE_BYTES);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await converter.convertFile(FILE);

    expect(result.previewImageBaseUrl).toBeNull();
    const data = database.file.update.mock.calls[0][0].data;
    expect(data.previewUrl).toContain(encodeURIComponent(ppsxConverter.previewKeyForSource(SOURCE_KEY)));
    // Absent, not null: clearing the column would throw away a previously good set.
    expect('previewImageBaseUrl' in data).toBe(false);
    expect(data.slideCount).toBe(3);
  });

  it('falls back to the PDF page count when no images were produced', async () => {
    const slideImages = stubImages({ ensure: vi.fn(async () => null) });
    const { objects, database, converter } = createMocks({ slideImages });
    objects.set(SOURCE_KEY, SOURCE_BYTES);

    const result = await converter.convertFile(FILE);

    expect(result.slideCount).toBe(3);
    expect(result.previewImageBaseUrl).toBeNull();
    expect('previewImageBaseUrl' in database.file.update.mock.calls[0][0].data).toBe(false);
  });

  // The admin upload UI awaits this response and has no File row to persist a
  // template on, so it may only advertise images that are really in S3.
  it('advertises a template only for images already uploaded, and renders the rest in the background', async () => {
    const slideImages = stubImages({ peek: vi.fn(async () => ({ template: TEMPLATE })) });
    const { objects, converter } = createMocks({ slideImages });
    objects.set(SOURCE_KEY, SOURCE_BYTES);

    const result = await converter.generatePreviewForKey(SOURCE_KEY);

    expect(result.previewImageBaseUrl).toBe(TEMPLATE);
    expect(slideImages.generate).not.toHaveBeenCalled();
  });

  it('returns a null template and starts a background render on a first-time upload', async () => {
    const slideImages = stubImages({
      peek: vi.fn(async () => null),
      generate: vi.fn(async () => ({ template: TEMPLATE, pages: 3 })),
    });
    const { objects, converter } = createMocks({ slideImages });
    objects.set(SOURCE_KEY, SOURCE_BYTES);

    const result = await converter.generatePreviewForKey(SOURCE_KEY);

    expect(result.previewImageBaseUrl).toBeNull();
    expect(slideImages.generate).toHaveBeenCalledWith(SOURCE_KEY);
  });

  it('never spawns the fitter for a non-presentation file', async () => {
    const slideImages = stubImages();
    const { converter } = createMocks({ slideImages });

    await expect(converter.convertFile({ ...FILE, originalName: 'song.mp3' })).resolves.toBeNull();

    expect(slideImages.ensure).not.toHaveBeenCalled();
    expect(slideImages.generate).not.toHaveBeenCalled();
  });
});

// A missing LibreOffice is a deployment problem. It must surface as a distinct,
// non-retryable signal instead of an opaque generic failure.
describe('ppsx-converter – missing converter', () => {  function createUnavailableMocks() {
    const objects = new Map([[SOURCE_KEY, SOURCE_BYTES]]);
    const execute = vi.fn();
    const s3Service = {
      getObjectBuffer: vi.fn(async (key) => {
        if (!objects.has(key)) throw new Error(`not found: ${key}`);
        return objects.get(key);
      }),
      putObjectBuffer: vi.fn(async (key, body) => objects.set(key, body)),
      objectExists: vi.fn(async (key) => objects.has(key)),
    };
    const converter = createPpsxConverter({
      s3Service,
      database: {},
      execute,
      resolveBinaries: async () => ({
        available: false,
        libreofficeBin: null,
        pdfinfoBin: null,
      }),
    });
    return { objects, s3Service, execute, converter };
  }

  it('rejects with CONVERTER_UNAVAILABLE and never spawns a conversion', async () => {
    const { s3Service, execute, converter } = createUnavailableMocks();

    await expect(converter.generatePreviewForKey(SOURCE_KEY)).rejects.toMatchObject({
      code: 'CONVERTER_UNAVAILABLE',
    });

    expect(execute).not.toHaveBeenCalled();
    expect(s3Service.putObjectBuffer).not.toHaveBeenCalled();
  });

  it('still serves an already-cached preview after the converter disappears', async () => {
    const { objects, s3Service, converter } = createUnavailableMocks();
    const cached = ppsxConverter.previewKeyForSource(SOURCE_KEY);
    objects.set(cached, Buffer.from('CACHED_PDF'));

    const result = await converter.ensurePreviewPdf(SOURCE_KEY);

    expect(result.previewKey).toBe(cached);
    expect(result.created).toBe(false);
    expect(s3Service.putObjectBuffer).not.toHaveBeenCalled();
  });
});

// The clip guard re-measures the PDF LibreOffice just produced and may replace it
// with a repaired conversion. Its contract is deliberately one-sided: it may swap
// the bytes that get published, and it may never make the upload fail.
describe('ppsx-converter – clip guard wiring', () => {
  // Stands in for clip-guard.js: writes a file in the converter's own work dir and
  // reports it as the PDF to publish, exactly as the real one does after a repair.
  function repairedGuard(marker = 'REPAIRED_PDF') {
    const guard = vi.fn(async ({ workDir }) => {
      const pdfPath = join(workDir, 'clip-rebind-0.pdf');
      await writeFile(pdfPath, marker);
      return {
        pdfPath,
        repaired: true,
        via: 'rebind:Ara Hamah Homs',
        report: { ok: true, pages: 3, repair: [] },
        attempts: [],
      };
    });
    return guard;
  }

  it('publishes the repaired PDF when a repair is verified clean', async () => {
    const clipGuard = repairedGuard();
    const { objects, s3Service, libreofficeCalls, converter } = createMocks({ clipGuard });
    objects.set(SOURCE_KEY, SOURCE_BYTES);

    const result = await converter.generatePreviewForKey(SOURCE_KEY);

    expect(libreofficeCalls.count).toBe(1);
    expect(objects.get(result.previewKey).toString()).toBe('REPAIRED_PDF');
    expect(result.slideCount).toBe(3);
    expectSourceUntouched(s3Service, objects);
  });

  it('hands the guard everything it needs to re-measure and re-convert', async () => {
    const clipGuard = repairedGuard();
    const { objects, converter } = createMocks({ clipGuard });
    objects.set(SOURCE_KEY, SOURCE_BYTES);

    await converter.generatePreviewForKey(SOURCE_KEY);

    expect(clipGuard).toHaveBeenCalledTimes(1);
    const arg = clipGuard.mock.calls[0][0];
    expect(arg.sourcePath).toMatch(/hymn\.ppsx$/);
    expect(arg.pdfPath).toMatch(/hymn\.pdf$/);
    expect(arg.libreoffice).toBe('libreoffice');
    expect(arg.execute).toBeTypeOf('function');
    // The work dir the guard writes into is the one the converter cleans up.
    expect(arg.workDir).toMatch(/ppsx-preview-/);
    await expectRemoved(arg.workDir);
  });

  it('keeps the original conversion when the guard throws', async () => {
    const clipGuard = vi.fn(async () => {
      throw new Error('clipfit exploded');
    });
    const { objects, converter } = createMocks({ clipGuard });
    objects.set(SOURCE_KEY, SOURCE_BYTES);

    const result = await converter.generatePreviewForKey(SOURCE_KEY);

    expect(objects.get(result.previewKey).toString()).toBe('FAKE_PDF');
    expect(result.slideCount).toBe(3);
  });

  it('keeps the original conversion when the guard declines to repair', async () => {
    const clipGuard = vi.fn(async ({ pdfPath }) => ({
      pdfPath, repaired: false, reason: 'unrepaired', report: null, attempts: [],
    }));
    const { objects, converter } = createMocks({ clipGuard });
    objects.set(SOURCE_KEY, SOURCE_BYTES);

    const result = await converter.generatePreviewForKey(SOURCE_KEY);

    expect(clipGuard).toHaveBeenCalledTimes(1);
    expect(objects.get(result.previewKey).toString()).toBe('FAKE_PDF');
  });

  it('is not consulted for a preview that is already cached', async () => {
    const clipGuard = repairedGuard();
    const { objects, converter } = createMocks({ clipGuard });
    objects.set(SOURCE_KEY, SOURCE_BYTES);

    await converter.generatePreviewForKey(SOURCE_KEY);
    await converter.generatePreviewForKey(SOURCE_KEY);

    expect(clipGuard).toHaveBeenCalledTimes(1);
  });

  it('never runs when there is no converter to produce a PDF to measure', async () => {
    const objects = new Map([[SOURCE_KEY, SOURCE_BYTES]]);
    const clipGuard = vi.fn();
    const converter = createPpsxConverter({
      s3Service: {
        getObjectBuffer: vi.fn(async (key) => objects.get(key)),
        putObjectBuffer: vi.fn(async (key, body) => objects.set(key, body)),
        objectExists: vi.fn(async (key) => objects.has(key)),
      },
      database: {},
      execute: vi.fn(),
      resolveBinaries: async () => ({ available: false, libreofficeBin: null, pdfinfoBin: null }),
      clipGuard,
    });

    await expect(converter.generatePreviewForKey(SOURCE_KEY)).rejects.toMatchObject({
      code: 'CONVERTER_UNAVAILABLE',
    });
    expect(clipGuard).not.toHaveBeenCalled();
  });
});

describe('ppsx-converter – Arabic CS font self-check', () => {
  // The decks' Arabic runs declare cs="Times New Roman" (not embedded). When the
  // host has no alias to Tajawal, fontconfig substitutes Noto Naskh Arabic and
  // freshly converted previews come out with disconnected glyphs. The self-check
  // must report that substitution loudly, stay silent when it is correct, and
  // never fail a conversion either way.
  function captureWarn() {
    const calls = [];
    const spy = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      calls.push(args.join(' '));
    });
    return { calls, restore: () => spy.mockRestore() };
  }

  it('warns but still converts when fc-match resolves to Noto instead of Tajawal', async () => {
    const { objects, converter } = createMocks({ probeCsFont: async () => 'Noto Naskh Arabic' });
    objects.set(SOURCE_KEY, SOURCE_BYTES);
    const { calls, restore } = captureWarn();
    try {
      const result = await converter.ensurePreviewPdf(SOURCE_KEY);
      expect(result.created).toBe(true);
      expect(calls.join('\n')).toContain('not Tajawal');
    } finally {
      restore();
    }
  });

  it('stays silent when fc-match already resolves to Tajawal', async () => {
    const { objects, converter } = createMocks();
    objects.set(SOURCE_KEY, SOURCE_BYTES);
    const { calls, restore } = captureWarn();
    try {
      await converter.generatePreviewForKey(SOURCE_KEY);
      expect(calls).toEqual([]);
    } finally {
      restore();
    }
  });

  it('never crashes and never warns when fc-match itself fails (no fontconfig)', async () => {
    // A failing probe (no fc-match on the host) must be swallowed: the conversion
    // still succeeds and nothing is logged.
    const { objects, converter } = createMocks({
      probeCsFont: async () => {
        throw new Error('ENOENT: fc-match');
      },
    });
    objects.set(SOURCE_KEY, SOURCE_BYTES);
    const { calls, restore } = captureWarn();
    try {
      const result = await converter.ensurePreviewPdf(SOURCE_KEY);
      expect(result.created).toBe(true);
      expect(calls).toEqual([]);
    } finally {
      restore();
    }
  });
});
