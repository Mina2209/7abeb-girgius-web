import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { promisify } from 'node:util';
import { prisma } from './prisma.js';
import defaultS3Service from './s3.service.js';
import { defaultClipGuard } from './clip-guard.js';
import { uploadUrlFor } from './storage-urls.js';


const execFileAsync = promisify(execFile);
const POWERPOINT_TYPES = new Set(['POWERPOINT']);

// Every presentation format the admin upload UI accepts, plus the macro-enabled
// and OpenDocument variants LibreOffice converts just as well. The UI advertises
// `.ppt,.pptx,.ppsx` (AdminEditHymnModal), so a .ppt upload must not be rejected.
const PREVIEW_NAME_OK = /\.(ppsx|pptx|ppt|pps|pptm|ppsm|potx|potm|odp)$/i;

// `libreoffice` is the Linux/macOS command; the Windows build installs `soffice`, and
// its MSI deliberately does NOT add the program directory to PATH. So probe the bare
// command names first, then the well-known Windows install locations. This keeps a
// plain `npm start` working on Windows without anyone setting LIBREOFFICE_BIN.
const LIBREOFFICE_CANDIDATES = [
  'libreoffice',
  'soffice',
  ...['ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA']
    .flatMap((varName) => {
      const base = process.env[varName];
      if (!base) return [];
      const rel = varName === 'LOCALAPPDATA'
        ? ['Programs', 'LibreOffice', 'program', 'soffice.exe']
        : ['LibreOffice', 'program', 'soffice.exe'];
      return [join(base, ...rel)];
    }),
];
const PDFINFO_CANDIDATES = ['pdfinfo'];

// Resolved binaries are cached for the process lifetime — a missing converter must
// not be re-probed (and re-logged) on every preview request.
let libreofficeBin;
let pdfinfoBin;
let converterChecked = false;

/**
 * Find the first candidate that is actually usable.
 *
 * A candidate given as a path is checked with `access` rather than executed: the
 * Windows `soffice.exe` launcher detaches from the console and can report a bogus
 * exit code, so spawning it just to ask "are you there?" is slow and unreliable.
 * Bare command names are resolved through PATH, so a version probe is the only
 * way to test those. A non-ENOENT spawn failure still counts as installed.
 */
async function probeBinary(candidates, probeArgs) {
  for (const candidate of candidates) {
    if (candidate.includes('/') || candidate.includes('\\')) {
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        continue;
      }
    }
    try {
      await execFileAsync(candidate, probeArgs, { timeout: 20_000 });
      return candidate;
    } catch (err) {
      if (err?.code === 'ENOENT') continue;
      return candidate;
    }
  }
  return null;
}

/**
 * Resolve the conversion toolchain once per process.
 *
 * A missing LibreOffice is a deployment problem, not a per-request one: without this
 * the server would spawn a doomed process and answer every preview with an opaque
 * 502. Cached previews keep working either way — only new conversions need the binary.
 */
export async function getConverterStatus() {
  if (!converterChecked) {
    libreofficeBin = process.env.LIBREOFFICE_BIN
      || await probeBinary(LIBREOFFICE_CANDIDATES, ['--version']);
    pdfinfoBin = process.env.PDFINFO_BIN || await probeBinary(PDFINFO_CANDIDATES, ['-v']);
    converterChecked = true;
    if (!libreofficeBin) {
      console.error(
        '[ppsx] LibreOffice not found — PowerPoint previews cannot be generated. '
        + 'Install it (the Docker image already does) or set LIBREOFFICE_BIN to the binary path.',
      );
    } else if (!pdfinfoBin) {
      console.warn('[ppsx] pdfinfo not found — slide counts will be omitted from previews.');
    }
  }
  return {
    available: Boolean(libreofficeBin),
    libreofficeBin: libreofficeBin ?? null,
    pdfinfoBin: pdfinfoBin ?? null,
  };
}

function converterUnavailableError() {
  const err = new Error('preview converter unavailable: LibreOffice is not installed');
  err.code = 'CONVERTER_UNAVAILABLE';
  return err;
}

function keyFromFileUrl(fileUrl) {
  try {
    return new URL(fileUrl, 'http://localhost').searchParams.get('key');
  } catch {
    return null;
  }
}

function isPowerPointFile(file) {
  return POWERPOINT_TYPES.has(file?.type) && PREVIEW_NAME_OK.test(file?.originalName || '');
}

export function previewKeyForSource(sourceKey) {
  // Stable per-source-key name so repeated on-demand conversions reuse the object.
  const hash = createHash('sha256').update(sourceKey).digest('hex').slice(0, 32);
  return `previews/${hash}.pdf`;
}

// True when the key points at a presentation LibreOffice can turn into a PDF.
export function isPreviewableKey(key) {
  return PREVIEW_NAME_OK.test(key || '');
}

function previewUrlFor(key) {
  return uploadUrlFor(key);
}

async function countPdfPages(pdfPath, execute, pdfinfo) {
  if (!pdfinfo) return null;
  try {
    const { stdout } = await execute(pdfinfo, [pdfPath], { timeout: 15_000 });
    const match = stdout.match(/^Pages:\s+(\d+)/m);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function countPdfPagesFromS3(previewKey, s3Service, execute, pdfinfo) {
  const workDir = await mkdtemp(join(tmpdir(), 'ppsx-count-'));
  try {
    const data = await s3Service.getObjectBuffer(previewKey);
    const pdfPath = join(workDir, 'preview.pdf');
    await writeFile(pdfPath, data, { mode: 0o600 });
    return await countPdfPages(pdfPath, execute, pdfinfo);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

// Core conversion step: fetch the source object, convert with LibreOffice, upload
// the PDF, and return the page count. Shared by the File-row pipeline and the
// on-demand "various PowerPoint" pipeline. Deps are injected so tests can mock
// S3 and LibreOffice.
async function convertSource({ sourceKey, previewKey, libreoffice, pdfinfo }, deps) {
  const { s3Service, execute, clipGuard } = deps;
  const workDir = await mkdtemp(join(tmpdir(), 'ppsx-preview-'));
  const inputPath = join(workDir, basename(sourceKey));
  const pdfPath = join(workDir, `${basename(sourceKey, extname(sourceKey))}.pdf`);
  try {
    const source = await s3Service.getObjectBuffer(sourceKey);
    await writeFile(inputPath, source, { mode: 0o600 });
    await execute(libreoffice, [
      '--headless', '--convert-to', 'pdf', '--outdir', workDir, inputPath,
    ], { timeout: 120_000 });

    // Re-measure the PDF for text running past the slide edge and, when the deck
    // clips, repair the named shapes and convert again. Best-effort by contract:
    // any failure here leaves the freshly converted PDF in place, which is exactly
    // what shipped before this existed.
    let outputPath = pdfPath;
    if (clipGuard) {
      try {
        const result = await clipGuard({
          sourcePath: inputPath, pdfPath, workDir, libreoffice, execute,
        });
        if (result?.pdfPath && result.pdfPath !== pdfPath) outputPath = result.pdfPath;
        if (result?.repaired) {
          console.log(
            `[clip-guard] ${sourceKey}: repaired via ${result.via} `
            + `(${result.report?.pages ?? '?'} slides)`,
          );
        }
      } catch (error) {
        console.warn(`[clip-guard] ${sourceKey}: ${error?.message || error}`);
      }
    }

    const pdf = await readFile(outputPath);
    await s3Service.putObjectBuffer(previewKey, pdf, 'application/pdf', {
      CacheControl: 'public, max-age=31536000, immutable',
    });
    return await countPdfPages(outputPath, execute, pdfinfo);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export function createPpsxConverter({
  s3Service = defaultS3Service,
  database = prisma,
  execute = execFileAsync,
  // Injected so tests stay hermetic — the real probe shells out to the host.
  resolveBinaries = getConverterStatus,
  // Set to a stub to opt into per-slide images. Left unset they are off: the
  // viewer renders the PDF itself, so rasterising every slide would spend a
  // LibreOffice run per deck and store ~1400 WebPs nobody requests. The PDF's own
  // page count is the authoritative slideCount either way.
  slideImages,
  // Bottom-clip repair (services/clip-guard.js): measures the PDF LibreOffice
  // just produced and re-runs the conversion for the shapes that ran past the
  // slide edge. Null opts out entirely — tests inject it so they do not depend
  // on python3/pdftotext being installed, and CLIP_GUARD=0 disables it at runtime.
  clipGuard = defaultClipGuard,
} = {}) {
  const slideImageService = slideImages || null;
  // One conversion per source key at a time. Without this, N concurrent viewers of
  // the same never-previewed presentation would each spawn a LibreOffice process
  // writing to the same S3 key.
  const inFlight = new Map();

  // ...and a ceiling across *different* keys, because LibreOffice is the one
  // genuinely expensive thing this process does: each conversion forks soffice
  // with its own profile directory, so a burst of first-time viewers (a fresh
  // deploy, or traffic landing on never-previewed decks) would otherwise start one
  // per request. The profile dirs are what filled /tmp last time, so they queue
  // instead of piling up.
  const MAX_CONCURRENT_CONVERSIONS = Number(process.env.PPTX_CONVERT_CONCURRENCY) || 2;
  let converting = 0;
  const conversionQueue = [];

  function acquireConversionSlot() {
    if (converting < MAX_CONCURRENT_CONVERSIONS) {
      converting += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => conversionQueue.push(resolve));
  }

  function releaseConversionSlot() {
    converting -= 1;
    conversionQueue.shift()?.();
  }

  async function withConversionSlot(fn) {
    await acquireConversionSlot();
    try {
      return await fn();
    } finally {
      releaseConversionSlot();
    }
  }

  // Returns the S3 key of the cached PDF for a source object, converting it first
  // if needed. Concurrent callers share a single conversion.
  async function ensurePreviewPdf(sourceKey) {
    if (!isPreviewableKey(sourceKey)) {
      const err = new Error('unsupported file type for preview generation');
      err.code = 'UNSUPPORTED_TYPE';
      throw err;
    }

    const previewKey = previewKeyForSource(sourceKey);
    const running = inFlight.get(previewKey);
    if (running) return running;

    const task = (async () => {
      // Serve an already-converted preview even if the converter has since been
      // removed — only a cache miss actually needs LibreOffice.
      const status = await resolveBinaries();
      if (await s3Service.objectExists(previewKey)) {
        return {
          previewKey,
          created: false,
          slideCount: await countPdfPagesFromS3(previewKey, s3Service, execute, status.pdfinfoBin),
        };
      }

      if (!status.available) throw converterUnavailableError();

      const slideCount = await withConversionSlot(() =>
        convertSource(
          { sourceKey, previewKey, libreoffice: status.libreofficeBin, pdfinfo: status.pdfinfoBin },
          { s3Service, execute, clipGuard },
        ),
      );
      return { previewKey, created: true, slideCount };
    })().finally(() => inFlight.delete(previewKey));

    inFlight.set(previewKey, task);
    return task;
  }

  async function convertFile(file) {
    if (!isPowerPointFile(file)) return null;
    const sourceKey = keyFromFileUrl(file.fileUrl);
    if (!sourceKey) throw new Error(`missing S3 key for file ${file.id}`);

    // Keyed off the source object, not the File row id: editing a hymn deletes and
    // recreates its File rows, so an id-keyed preview would be re-converted on every
    // save and leave the previous PDF orphaned in S3.
    const { previewKey, slideCount } = await ensurePreviewPdf(sourceKey);

    // Second, richer preview: one WebP per slide with the Arabic text refitted.
    // Failures are non-fatal — the PDF above is already stored and the viewer
    // falls back to it — and an existing template is never overwritten with null.
    let previewImageBaseUrl = null;
    let imagePageCount = null;
    if (slideImageService) {
      try {
        const images = await slideImageService.ensure(sourceKey);
        previewImageBaseUrl = images?.template ?? null;
        // The rendered set is the authoritative page count (it is what the viewer
        // indexes), and it agrees with the PDF's count in practice.
        imagePageCount = images?.pages ?? null;
      } catch (error) {
        console.error(`[ppsx] slide images failed for ${sourceKey}:`, error?.message || error);
      }
    }

    await database.file.update({
      where: { id: file.id },
      data: {
        previewUrl: previewUrlFor(previewKey),
        slideCount: imagePageCount ?? slideCount,
        ...(previewImageBaseUrl ? { previewImageBaseUrl } : {}),
      },
    });
    return {
      fileId: file.id,
      previewKey,
      slideCount: imagePageCount ?? slideCount,
      previewImageBaseUrl,
    };
  }

  async function generatePreviewForKey(sourceKey) {
    const { previewKey, slideCount } = await ensurePreviewPdf(sourceKey);
    // The caller here is the admin upload UI, which awaits this response and has no
    // File row to persist a template on. So only advertise images that are already
    // in S3; otherwise start the render in the background and let the next open of
    // the same deck pick them up. Either way the PDF is ready right now.
    let previewImageBaseUrl = null;
    if (slideImageService) {
      try {
        const existing = await slideImageService.peek(sourceKey);
        previewImageBaseUrl = existing?.template ?? null;
        if (!existing) {
          void slideImageService.generate(sourceKey).catch((error) => {
            console.error(`[ppsx] slide images failed for ${sourceKey}:`, error?.message || error);
          });
        }
      } catch (error) {
        console.error(`[ppsx] slide image probe failed for ${sourceKey}:`, error?.message || error);
      }
    }
    return { previewKey, previewUrl: previewUrlFor(previewKey), slideCount, previewImageBaseUrl };
  }

  function queuePpsxPreviews(files) {
    for (const file of files || []) {
      if (!isPowerPointFile(file)) continue;
      void convertFile(file).catch((error) => {
        console.error(`[ppsx] preview conversion failed for ${file.id}:`, error?.message || error);
      });
    }
  }

  return { convertFile, queuePpsxPreviews, generatePreviewForKey, ensurePreviewPdf };
}

const defaultConverter = createPpsxConverter();
export const convertPpsxFile = defaultConverter.convertFile;
export const queuePpsxPreviews = defaultConverter.queuePpsxPreviews;
export const generatePreviewForKey = defaultConverter.generatePreviewForKey;
export const ensurePreviewPdf = defaultConverter.ensurePreviewPdf;
