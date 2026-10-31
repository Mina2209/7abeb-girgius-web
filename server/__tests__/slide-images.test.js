import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  createSlideImageGenerator,
  slideImageKeyForSource,
  slideImageMarkerKeyForSource,
  slideImagePrefixForSource,
  slideImageTemplateForSource,
} from '../services/slide-images.js';
import {
  previewKeyForOwnedSource,
  previewKeyForSource,
  PREVIEW_PIPELINE_VERSION,
} from '../services/ppsx-converter.js';

const SOURCE_KEY = 'Hymns/1712-99-Nice_Name.ppsx';
const PDF_BYTES = Buffer.from('%PDF-1.7 preview');
const AVAILABLE = async () => ({ available: true });
const UNAVAILABLE = async () => ({ available: false });
// Stand-in for sharp: keeps the tests offline and lets the assertions see which
// bytes would have been encoded.
const ENCODE_WEBP = async (buffer) => Buffer.from(`WEBP:${buffer.toString()}`);

async function listWorkDirs() {
  const names = await readdir(tmpdir());
  return names.filter((n) => n.startsWith('ppsx-slides-'));
}

// Leftover work dirs mean a finally-rm was skipped; every deck leaves multi-
// megabyte renders behind if it does not. Compared against a baseline rather
// than requiring an empty tmp, so a crashed earlier run on the same machine
// cannot make every later test fail.
let workDirBaseline = new Set();
beforeEach(async () => {
  workDirBaseline = new Set(await listWorkDirs());
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});
async function expectNoNewWorkDirs() {
  const leaked = (await listWorkDirs()).filter((n) => !workDirBaseline.has(n));
  expect(leaked).toEqual([]);
}

function createS3(initial = {}) {
  const objects = new Map(Object.entries(initial));
  return {
    objects,
    getObjectBuffer: vi.fn(async (key) => {
      if (!objects.has(key)) throw new Error(`not found: ${key}`);
      return objects.get(key);
    }),
    putObjectBuffer: vi.fn(async (key, body) => {
      objects.set(key, body);
    }),
    objectExists: vi.fn(async (key) => objects.has(key)),
  };
}

// The renderer shells out twice: pdfinfo (page count + geometry) then pdftoppm
// (the actual raster). This stub writes `pages` PNGs where pdftoppm would, using
// the out-prefix from the command it was handed.
function pdfInfoStdout(pages, widthPt = 960, heightPt = 540) {
  return `Title:          deck\nPages:          ${pages}\nPage size:      ${widthPt} x ${heightPt} pts\n`;
}

function createExecute({ pages = 3, calls = [] } = {}) {
  return vi.fn(async (bin, args) => {
    calls.push({ bin, args });
    if (bin === 'pdfinfo') return { stdout: pdfInfoStdout(pages) };
    if (bin === 'pdftoppm') {
      const outPrefix = args[args.length - 1];
      for (let n = 1; n <= pages; n += 1) {
        await mkdir(dirname(outPrefix), { recursive: true });
        await writeFile(`${outPrefix}-${n}.png`, `PNG${n}`);
      }
      return { stdout: '', stderr: '' };
    }
    throw new Error(`unexpected binary: ${bin}`);
  });
}

describe('slide-images – key and URL derivation', () => {
  it('derives the prefix from the same hash as the PDF preview key', () => {
    // The image set and the PDF must be traceable to one source object, so both
    // hashes have to stay in step. The PDF key gained a pipeline-version path
    // segment; the source hash itself is unchanged, so the two derivations still
    // share one hash.
    const hash = createHash('sha256').update(SOURCE_KEY).digest('hex').slice(0, 32);
    expect(slideImagePrefixForSource(SOURCE_KEY)).toBe(`previews-img/${hash}/`);
    expect(previewKeyForSource(SOURCE_KEY)).toBe(`previews/v${PREVIEW_PIPELINE_VERSION}/${hash}.pdf`);
  });

  it('uses ownership-aware prefixes for new image and presentation previews', () => {
    const imageSource = 'Images/deck.pptx';
    const imageOptions = { kind: 'image' };
    const fileOptions = { kind: 'file' };

    expect(slideImagePrefixForSource(imageSource, imageOptions)).toMatch(
      new RegExp(`^previews-image-img/v${PREVIEW_PIPELINE_VERSION}/[A-Za-z0-9_-]+/$`),
    );
    expect(slideImagePrefixForSource(SOURCE_KEY, fileOptions)).toMatch(
      new RegExp(`^previews-file-img/v${PREVIEW_PIPELINE_VERSION}/[a-f0-9]{32}/$`),
    );
    expect(slideImageKeyForSource(imageSource, 1, imageOptions)).toBe(
      `${slideImagePrefixForSource(imageSource, imageOptions)}1.webp`,
    );
    expect(slideImageTemplateForSource(imageSource, imageOptions)).toContain(
      encodeURIComponent(slideImagePrefixForSource(imageSource, imageOptions)),
    );
  });

  it('keeps the numbered objects under a new prefix, never colliding with the PDF', () => {
    expect(slideImageKeyForSource(SOURCE_KEY, 1)).toMatch(/^previews-img\/[a-f0-9]{32}\/1\.webp$/);
    expect(slideImageKeyForSource(SOURCE_KEY, 12)).not.toBe(previewKeyForSource(SOURCE_KEY));
  });

  it('places the completion marker beside the slides without changing the {n}.webp shape', () => {
    const marker = slideImageMarkerKeyForSource(SOURCE_KEY);
    expect(marker).toMatch(/^previews-img\/[a-f0-9]{32}\/complete\.json$/);
    // The client only ever asks for `{n}.webp`, so the marker can never be
    // mistaken for a slide.
    expect(marker.endsWith('.webp')).toBe(false);
    expect(marker.startsWith(slideImagePrefixForSource(SOURCE_KEY))).toBe(true);
  });

  it('produces one storable template with a literal {n} placeholder', () => {
    const template = slideImageTemplateForSource(SOURCE_KEY);
    expect(template).toBe(
      `/api/uploads/url?key=${encodeURIComponent(slideImagePrefixForSource(SOURCE_KEY))}{n}.webp`,
    );
    // The client substitutes {n}; if the key were fully encoded the placeholder
    // would arrive as %7Bn%7D and every slide would 404.
    const substituted = template.replace('{n}', '3');
    const key = new URL(substituted, 'http://localhost').searchParams.get('key');
    expect(key).toBe(`previews-img/${createHash('sha256').update(SOURCE_KEY).digest('hex').slice(0, 32)}/3.webp`);
    expect(template).not.toContain('%7B');
  });

  it('is independent of the API base so it can be absolutised on the client', () => {
    expect(slideImageTemplateForSource(SOURCE_KEY).startsWith('/api/')).toBe(true);
  });
});

describe('slide-images – generation from the stored preview PDF', () => {
  it('renders one WebP per page and uploads them under the derived prefix', async () => {
    const s3 = createS3({ [previewKeyForSource(SOURCE_KEY)]: PDF_BYTES });
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute: createExecute({ pages: 3 }),
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    const result = await generator.generate(SOURCE_KEY);

    expect(result).toMatchObject({
      template: slideImageTemplateForSource(SOURCE_KEY),
      pages: 3,
    });
    expect(result.template).not.toContain(tmpdir()); // the row stores a URL, not a path

    const uploads = s3.putObjectBuffer.mock.calls.map((c) => c[0]);
    // Slides first, in numeric order, then the completion marker written LAST.
    expect(uploads.slice(0, 3)).toEqual([
      slideImageKeyForSource(SOURCE_KEY, 1),
      slideImageKeyForSource(SOURCE_KEY, 2),
      slideImageKeyForSource(SOURCE_KEY, 3),
    ]);
    expect(uploads[3]).toBe(slideImageMarkerKeyForSource(SOURCE_KEY));
    // Content type and cache policy: the viewer fetches these as <img> forever.
    for (const call of s3.putObjectBuffer.mock.calls.filter((c) => c[0].endsWith('.webp'))) {
      expect(call[2]).toBe('image/webp');
      expect(call[3]).toMatchObject({ CacheControl: 'public, max-age=31536000, immutable' });
    }
    // Numeric order matters: sorted by name, "10.webp" would precede "2.webp".
    expect(s3.objects.get(slideImageKeyForSource(SOURCE_KEY, 3)).toString()).toBe('WEBP:PNG3');
    // The marker records the page count for cheap cache hits.
    expect(JSON.parse(s3.objects.get(slideImageMarkerKeyForSource(SOURCE_KEY)).toString())).toEqual({
      pages: 3,
    });
    await expectNoNewWorkDirs();
  });

  it('renders image-owned slides from the matching ownership-aware PDF key', async () => {
    const options = { kind: 'image' };
    const previewKey = previewKeyForOwnedSource(SOURCE_KEY, options);
    const s3 = createS3({ [previewKey]: PDF_BYTES });
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute: createExecute({ pages: 2 }),
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    const result = await generator.generate(SOURCE_KEY, options);

    expect(s3.getObjectBuffer).toHaveBeenCalledWith(previewKey);
    expect(result).toMatchObject({
      template: slideImageTemplateForSource(SOURCE_KEY, options),
      pages: 2,
    });
    const uploads = s3.putObjectBuffer.mock.calls.map((call) => call[0]);
    expect(uploads).toEqual([
      slideImageKeyForSource(SOURCE_KEY, 1, options),
      slideImageKeyForSource(SOURCE_KEY, 2, options),
      slideImageMarkerKeyForSource(SOURCE_KEY, options),
    ]);
  });

  it('renders from the stored PDF key, never re-downloading the source deck', async () => {
    const s3 = createS3({
      [SOURCE_KEY]: Buffer.from('PPSX_BYTES'),
      [previewKeyForSource(SOURCE_KEY)]: PDF_BYTES,
    });
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute: createExecute({ pages: 2 }),
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    await generator.generate(SOURCE_KEY);

    expect(s3.getObjectBuffer).toHaveBeenCalledTimes(1);
    expect(s3.getObjectBuffer).toHaveBeenCalledWith(previewKeyForSource(SOURCE_KEY));
    expect(s3.getObjectBuffer).not.toHaveBeenCalledWith(SOURCE_KEY);
    // The preview PDF itself must never be overwritten.
    expect(s3.putObjectBuffer.mock.calls.map((c) => c[0])).not.toContain(
      previewKeyForSource(SOURCE_KEY),
    );
    // The source object is left untouched.
    expect(s3.objects.get(SOURCE_KEY).toString()).toBe('PPSX_BYTES');
  });

  it('asks pdftoppm for PNG at exactly the slide width (dpi from the page geometry)', async () => {
    const s3 = createS3({ [previewKeyForSource(SOURCE_KEY)]: PDF_BYTES });
    const calls = [];
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute: createExecute({ pages: 1, calls }),
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    await generator.generate(SOURCE_KEY);

    // 1600px over a 960pt (13.33in) wide slide => 120dpi. PNG, never -webp:
    // some pdftoppm builds omit WebP output entirely.
    const render = calls.find((c) => c.bin === 'pdftoppm');
    expect(render.args).toEqual(expect.arrayContaining(['-png', '-r', '120', '-f', '1', '-l', '1']));
    expect(render.args).not.toContain('-webp');
  });

  it('rejects when nothing renders, without writing a partial set', async () => {
    const s3 = createS3({ [previewKeyForSource(SOURCE_KEY)]: PDF_BYTES });
    const execute = vi.fn(async (bin) => {
      // No page count available, so the empty render is caught by the file scan.
      if (bin === 'pdfinfo') throw new Error('pdfinfo not found');
      return { stdout: '' };
    });
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute,
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    await expect(generator.generate(SOURCE_KEY)).rejects.toThrow(/rendered no pages/);

    expect(s3.putObjectBuffer).not.toHaveBeenCalled();
    await expectNoNewWorkDirs();
  });

  it('rejects when fewer slides render than pdfinfo reported', async () => {
    const s3 = createS3({ [previewKeyForSource(SOURCE_KEY)]: PDF_BYTES });
    const execute = vi.fn(async (bin, args) => {
      if (bin === 'pdfinfo') return { stdout: pdfInfoStdout(3) };
      const outPrefix = args[args.length - 1];
      await writeFile(`${outPrefix}-1.png`, 'PNG1');
      await writeFile(`${outPrefix}-2.png`, 'PNG2');
      return { stdout: '' };
    });
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute,
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    await expect(generator.generate(SOURCE_KEY)).rejects.toThrow(/page mismatch/);
    expect(s3.putObjectBuffer).not.toHaveBeenCalled();
    await expectNoNewWorkDirs();
  });

  it('propagates an S3 read failure without attempting an upload', async () => {
    const s3 = createS3(); // no preview PDF stored
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute: createExecute({ pages: 1 }),
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    await expect(generator.generate(SOURCE_KEY)).rejects.toThrow('not found');
    expect(s3.putObjectBuffer).not.toHaveBeenCalled();
    await expectNoNewWorkDirs();
  });

  it('renders every page even when pdfinfo is missing (no -l bound, count from files)', async () => {
    const s3 = createS3({ [previewKeyForSource(SOURCE_KEY)]: PDF_BYTES });
    const calls = [];
    const execute = vi.fn(async (bin, args) => {
      calls.push({ bin, args });
      if (bin === 'pdfinfo') throw new Error('pdfinfo not found');
      const outPrefix = args[args.length - 1];
      for (let n = 1; n <= 4; n += 1) await writeFile(`${outPrefix}-${n}.png`, `PNG${n}`);
      return { stdout: '' };
    });
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute,
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    const result = await generator.generate(SOURCE_KEY);

    expect(result.pages).toBe(4);
    expect(calls.find((c) => c.bin === 'pdftoppm').args).not.toContain('-l');
    await expectNoNewWorkDirs();
  });
});

// A host without poppler must behave exactly like the app did before images
// existed: PDFs keep working, and no temp dirs or processes are created.
describe('slide-images – missing toolchain', () => {
  it('returns null without shelling out when the probe reports unavailable', async () => {
    const s3 = createS3({ [previewKeyForSource(SOURCE_KEY)]: PDF_BYTES });
    const execute = vi.fn();
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute,
      probe: UNAVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    expect(await generator.generate(SOURCE_KEY)).toBeNull();
    expect(await generator.peek(SOURCE_KEY)).toBeNull();
    expect(await generator.ensure(SOURCE_KEY)).toBeNull();
    expect(execute).not.toHaveBeenCalled();
    expect(s3.getObjectBuffer).not.toHaveBeenCalled();
    expect(s3.objectExists).not.toHaveBeenCalled();
  });
});

describe('slide-images – reuse', () => {
  it('reuses the set when the completion marker is present, and reports its pages', async () => {
    const s3 = createS3({
      [previewKeyForSource(SOURCE_KEY)]: PDF_BYTES,
      [slideImageKeyForSource(SOURCE_KEY, 1)]: Buffer.from('WEBP1'),
      [slideImageKeyForSource(SOURCE_KEY, 2)]: Buffer.from('WEBP2'),
      [slideImageMarkerKeyForSource(SOURCE_KEY)]: Buffer.from(JSON.stringify({ pages: 2 })),
    });
    const execute = vi.fn();
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute,
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    expect(await generator.ensure(SOURCE_KEY)).toEqual({
      template: slideImageTemplateForSource(SOURCE_KEY),
      pages: 2,
    });
    expect(execute).not.toHaveBeenCalled();
    // Only the tiny marker is read back — never the PDF.
    expect(s3.getObjectBuffer).toHaveBeenCalledWith(slideImageMarkerKeyForSource(SOURCE_KEY));
    expect(s3.getObjectBuffer).not.toHaveBeenCalledWith(previewKeyForSource(SOURCE_KEY));
    expect(s3.putObjectBuffer).not.toHaveBeenCalled();
  });

  it('probes exactly one object (the marker), not one per slide', async () => {
    const s3 = createS3();
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute: vi.fn(),
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    await generator.peek(SOURCE_KEY);

    expect(s3.objectExists).toHaveBeenCalledTimes(1);
    expect(s3.objectExists).toHaveBeenCalledWith(slideImageMarkerKeyForSource(SOURCE_KEY));
  });

  it('reuses the slides (without a page count) when the marker is unreadable', async () => {
    const s3 = createS3({
      [slideImageKeyForSource(SOURCE_KEY, 1)]: Buffer.from('WEBP1'),
      [slideImageMarkerKeyForSource(SOURCE_KEY)]: Buffer.from('not json'),
    });
    const execute = vi.fn();
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute,
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    expect(await generator.peek(SOURCE_KEY)).toEqual({
      template: slideImageTemplateForSource(SOURCE_KEY),
      pages: null,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('shares a single render between concurrent requests for the same deck', async () => {
    const s3 = createS3({ [previewKeyForSource(SOURCE_KEY)]: PDF_BYTES });
    const execute = createExecute({ pages: 2 });
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute,
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    const [a, b] = await Promise.all([
      generator.generate(SOURCE_KEY),
      generator.generate(SOURCE_KEY),
    ]);

    expect(a).toEqual(b);
    // One pdftoppm run, not two.
    expect(execute.mock.calls.filter((c) => c[0] === 'pdftoppm')).toHaveLength(1);
    await expectNoNewWorkDirs();
  });
});

// A render that is interrupted after some slides are uploaded must not be frozen
// as "complete": the completion marker is the only proof, so the next request
// re-renders the whole set (idempotently) instead of 404-ing on the missing tail.
describe('slide-images – partial-cache recovery', () => {
  it('does not treat a lone slide 1 as complete; re-renders the whole set', async () => {
    const s3 = createS3({
      [previewKeyForSource(SOURCE_KEY)]: PDF_BYTES,
      // A stale slide from an interrupted earlier run, but no marker.
      [slideImageKeyForSource(SOURCE_KEY, 1)]: Buffer.from('STALE1'),
    });
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute: createExecute({ pages: 2 }),
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    const result = await generator.ensure(SOURCE_KEY);

    expect(result).toMatchObject({
      template: slideImageTemplateForSource(SOURCE_KEY),
      pages: 2,
    });
    // The stale slide was overwritten and the missing one written.
    expect(s3.objects.get(slideImageKeyForSource(SOURCE_KEY, 1)).toString()).toBe('WEBP:PNG1');
    expect(s3.objects.has(slideImageKeyForSource(SOURCE_KEY, 2))).toBe(true);
    expect(s3.objects.has(slideImageMarkerKeyForSource(SOURCE_KEY))).toBe(true);
    await expectNoNewWorkDirs();
  });

  it('writes no marker when an upload fails part-way, and recovers on retry', async () => {
    const objects = new Map([[previewKeyForSource(SOURCE_KEY), PDF_BYTES]]);
    let failSlideTwoOnce = true;
    const s3 = {
      objects,
      getObjectBuffer: vi.fn(async (key) => {
        if (!objects.has(key)) throw new Error(`not found: ${key}`);
        return objects.get(key);
      }),
      putObjectBuffer: vi.fn(async (key, body) => {
        if (failSlideTwoOnce && key === slideImageKeyForSource(SOURCE_KEY, 2)) {
          failSlideTwoOnce = false;
          throw new Error('s3 write failed');
        }
        objects.set(key, body);
      }),
      objectExists: vi.fn(async (key) => objects.has(key)),
    };
    const generator = createSlideImageGenerator({
      s3Service: s3,
      execute: createExecute({ pages: 2 }),
      probe: AVAILABLE,
      encodeWebp: ENCODE_WEBP,
    });

    await expect(generator.generate(SOURCE_KEY)).rejects.toThrow('s3 write failed');
    // Slide 1 landed, but the set is not advertised as complete.
    expect(objects.has(slideImageKeyForSource(SOURCE_KEY, 1))).toBe(true);
    expect(objects.has(slideImageMarkerKeyForSource(SOURCE_KEY))).toBe(false);
    expect(await generator.peek(SOURCE_KEY)).toBeNull();

    // Retry rewrites the complete set and records the marker last.
    const result = await generator.ensure(SOURCE_KEY);
    expect(result).toMatchObject({
      template: slideImageTemplateForSource(SOURCE_KEY),
      pages: 2,
    });
    expect(JSON.parse(objects.get(slideImageMarkerKeyForSource(SOURCE_KEY)).toString())).toEqual({
      pages: 2,
    });
    await expectNoNewWorkDirs();
  });
});