#!/usr/bin/env node
/**
 * Prewarm PowerPoint slide image previews for existing files.
 * 
 * SAFE BY DEFAULT: --dry-run is true. Does not generate, upload, modify DB, or delete.
 * Only uses existing PDF previews - does NOT create PDFs.
 * Respects existing inFlight deduplication in slide-images service.
 */
// Real dependencies are loaded lazily in main() to avoid side effects in mock/test mode
let prisma;
let defaultS3Service;
let slideImagePeek;
let ensureSlideImages;
let slideImageToolchain;
let slideImageMarkerKeyForSource;
let previewKeyForOwnedSource;
let previewKeyForSource;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function keyFromFileUrl(fileUrl) {
  try {
    return new URL(fileUrl, 'http://localhost').searchParams.get('key');
  } catch {
    return null;
  }
}

export function isPowerPointFile(file) {
  const POWERPOINT_TYPES = new Set(['POWERPOINT', 'VIDEO_POWERPOINT']);
  const PREVIEW_NAME_OK = /\.(ppsx|pptx|ppt|pps|pptm|ppsm|potx|potm|odp)$/i;
  return POWERPOINT_TYPES.has(file?.type) && PREVIEW_NAME_OK.test(file?.originalName || '');
}

export function determineKind(sourceKey, file) {
  // Do NOT guess - return null if unknown
  return null;
}

import { createHash } from 'node:crypto';

export function getPreviewPdfKey(sourceKey, kind) {
  if (kind === 'image') {
    if (typeof previewKeyForOwnedSource === 'function') {
      return previewKeyForOwnedSource(sourceKey, { kind: 'image' });
    }
    // Cannot guarantee key without real dependencies; skip by returning null to force skip
    return null;
  } else if (kind === 'file') {
    if (typeof previewKeyForOwnedSource === 'function') {
      return previewKeyForOwnedSource(sourceKey, { kind: 'file' });
    }
    return null;
  } else {
    // Legacy
    if (typeof previewKeyForSource === 'function') {
      return previewKeyForSource(sourceKey);
    }
    return null;
  }
}

export async function checkPreviewPdfExists(s3Service, sourceKey, kind) {
  const previewKey = getPreviewPdfKey(sourceKey, kind);
  if (!previewKey) {
    return false;
  }
  try {
    return await s3Service.objectExists(previewKey);
  } catch {
    return false;
  }
}

export async function checkCompleteMarkerValid(s3Service, sourceKey, kind) {
  let markerKey;
  if (typeof slideImageMarkerKeyForSource === 'function') {
    markerKey = slideImageMarkerKeyForSource(sourceKey, { kind: kind || undefined });
  } else {
    return { exists: false, valid: false };
  }
  try {
    if (!(await s3Service.objectExists(markerKey))) {
      return { exists: false, valid: false };
    }
    const marker = JSON.parse((await s3Service.getObjectBuffer(markerKey)).toString('utf8'));
    if (Number.isInteger(marker?.pages) && marker.pages > 0) {
      return { exists: true, valid: true, pages: marker.pages };
    }
    return { exists: true, valid: false };
  } catch {
    return { exists: true, valid: false };
  }
}

export async function runPrewarm(options = {}) {
  const {
    dryRun = true,
    limit = null,
    delayMs = 2000,
    verbose = false,
    fileId = null,
    prismaClient = options.prismaClient !== undefined ? options.prismaClient : prisma,
    s3 = options.s3 !== undefined ? options.s3 : defaultS3Service,
    toolchainFn = options.toolchainFn !== undefined ? options.toolchainFn : slideImageToolchain,
    peekFn = options.peekFn !== undefined ? options.peekFn : slideImagePeek,
    ensureFn = options.ensureFn !== undefined ? options.ensureFn : ensureSlideImages,
    previewKeyForOwnedSourceFn = options.previewKeyForOwnedSourceFn !== undefined ? options.previewKeyForOwnedSourceFn : previewKeyForOwnedSource,
    previewKeyForSourceFn = options.previewKeyForSourceFn !== undefined ? options.previewKeyForSourceFn : previewKeyForSource,
    slideImageMarkerKeyForSourceFn = options.slideImageMarkerKeyForSourceFn !== undefined ? options.slideImageMarkerKeyForSourceFn : slideImageMarkerKeyForSource,
  } = options;
  // Temporarily override module-scoped vars for this call
  const _prevOwned = previewKeyForOwnedSource;
  const _prevSource = previewKeyForSource;
  const _prevMarker = slideImageMarkerKeyForSource;
  if (previewKeyForOwnedSourceFn !== undefined) previewKeyForOwnedSource = previewKeyForOwnedSourceFn;
  if (previewKeyForSourceFn !== undefined) previewKeyForSource = previewKeyForSourceFn;
  if (slideImageMarkerKeyForSourceFn !== undefined) slideImageMarkerKeyForSource = slideImageMarkerKeyForSourceFn;

  // Check toolchain
  const toolchain = await toolchainFn();
  if (!toolchain.available) {
    throw new Error('pdftoppm/pdfinfo not available');
  }

  // Fetch PowerPoint files
  let files = [];
  if (fileId) {
    const file = await prismaClient.file.findUnique({
      where: { id: fileId },
      include: { hymn: { select: { id: true, title: true } } },
    });
    if (!file) {
      previewKeyForOwnedSource = _prevOwned;
      previewKeyForSource = _prevSource;
      slideImageMarkerKeyForSource = _prevMarker;
      throw new Error(`File not found: ${fileId}`);
    }
    if (!isPowerPointFile(file)) {
      previewKeyForOwnedSource = _prevOwned;
      previewKeyForSource = _prevSource;
      slideImageMarkerKeyForSource = _prevMarker;
      return { toProcess: [], processed: 0, success: 0, failed: 0, skipped: [{ fileId, reason: 'unsupported' }] };
    }
    files = [file];
  } else {
    files = await prismaClient.file.findMany({
      where: {
        type: { in: ['POWERPOINT', 'VIDEO_POWERPOINT'] },
      },
      include: { hymn: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  let toProcess = [];
  for (const file of files) {
    if (!isPowerPointFile(file)) {
      continue;
    }

    const sourceKey = keyFromFileUrl(file.fileUrl);
    if (!sourceKey) {
      continue;
    }

    // Determine kind - be conservative
    let kind = determineKind(sourceKey, file);
    
    const legacyPdfExists = await checkPreviewPdfExists(s3, sourceKey, null);
    const filePdfExists = await checkPreviewPdfExists(s3, sourceKey, 'file');
    const imagePdfExists = await checkPreviewPdfExists(s3, sourceKey, 'image');
    
    const existingCount = [legacyPdfExists, filePdfExists, imagePdfExists].filter(Boolean).length;
    if (existingCount === 0) {
      continue; // no PDF
    }
    if (existingCount > 1) {
      continue; // ambiguous
    }
    
    if (filePdfExists && !imagePdfExists && !legacyPdfExists) {
      kind = 'file';
    } else if (imagePdfExists && !filePdfExists && !legacyPdfExists) {
      kind = 'image';
    } else if (legacyPdfExists && !filePdfExists && !imagePdfExists) {
      kind = null; // legacy
    } else {
      continue;
    }

    const markerCheck = await checkCompleteMarkerValid(s3, sourceKey, kind);
    if (markerCheck.exists && markerCheck.valid) {
      continue;
    } else if (markerCheck.exists && !markerCheck.valid) {
      continue; // don't auto-regenerate invalid
    }

    try {
      const existing = await peekFn(sourceKey, kind ? { kind } : {});
      if (existing && existing.template && existing.pages) {
        continue;
      }
    } catch (e) {
      // ignore
    }

    toProcess.push({ file, sourceKey, kind });
  }

  if (limit) {
    toProcess = toProcess.slice(0, limit);
  }

  if (dryRun) {
    previewKeyForOwnedSource = _prevOwned;
    previewKeyForSource = _prevSource;
    slideImageMarkerKeyForSource = _prevMarker;
    return { toProcess, processed: 0, success: 0, failed: 0 };
  }

  if (process.env.PREWARM_ALLOW_CROSS_PROCESS !== '1') {
    previewKeyForOwnedSource = _prevOwned;
    previewKeyForSource = _prevSource;
    slideImageMarkerKeyForSource = _prevMarker;
    throw new Error('PREWARM_ALLOW_CROSS_PROCESS=1 required (bypass gate only, not a lock). Manually ensure no other preview generation is running for this file.');
  }

  let success = 0;
  let failed = 0;
  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    try {
      await ensureFn(item.sourceKey, item.kind ? { kind: item.kind } : {});
      success++;
    } catch (err) {
      failed++;
    }
    if (i < toProcess.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  previewKeyForOwnedSource = _prevOwned;
  previewKeyForSource = _prevSource;
  slideImageMarkerKeyForSource = _prevMarker;
  return { toProcess, processed: toProcess.length, success, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const limitIdx = args.indexOf('--limit');
  let limit = null;
  if (limitIdx >= 0 && args[limitIdx + 1]) {
    const parsed = parseInt(args[limitIdx + 1], 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      limit = parsed;
    }
  }
  const delayIdx = args.indexOf('--delay');
  let delayMs = 2000;
  if (delayIdx >= 0 && args[delayIdx + 1]) {
    const parsed = parseInt(args[delayIdx + 1], 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      delayMs = parsed;
    }
  }
  const fileIdIdx = args.indexOf('--file-id');
  if (fileIdIdx >= 0 && (args[fileIdIdx + 1] === undefined || args[fileIdIdx + 1].startsWith('-'))) {
    console.error('[prewarm] Error: --file-id requires a value');
    process.exit(1);
  }
  const fileIdValues = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file-id') {
      if (args[i + 1]) fileIdValues.push(args[i + 1]);
    }
  }
  if (fileIdValues.length > 1) {
    console.error('[prewarm] Error: duplicate --file-id arguments not allowed');
    process.exit(1);
  }
  const fileId = fileIdValues.length === 1 ? fileIdValues[0] : null;
  const verbose = args.includes('--verbose');
  const help = args.includes('--help');

  if (help) {
    console.log(`Usage: node scripts/prewarm-slide-previews.js [options]

Options:
  --dry-run              Default: true (safe, no generation/write)
  --apply                Enable generation (disables dry-run)
  --file-id <id>         Target exactly one File record (no broad scan). Required for controlled one-file runs.
  --limit N              Max files to process (positive integer)
  --delay MS             Delay between files in ms (default: 2000, >= 0)
  --verbose              Verbose logging
  --help                 Show this help

Safety:
  PREWARM_ALLOW_CROSS_PROCESS=1 is ONLY a bypass gate, NOT a lock.
  You must manually coordinate to ensure no other preview generation is running for the same file.
  The script cannot reliably detect cross-process generation.`);
    process.exit(0);
  }

  // Lazy load real dependencies only in real execution path
  try {
    const prismaMod = await import('../services/prisma.js');
    prisma = prismaMod.prisma || prismaMod.default;
    const s3Mod = await import('../services/s3.service.js');
    defaultS3Service = s3Mod.default || s3Mod;
    const slideMod = await import('../services/slide-images.js');
    slideImagePeek = slideMod.slideImagePeek;
    ensureSlideImages = slideMod.ensureSlideImages;
    slideImageToolchain = slideMod.slideImageToolchain;
    slideImageMarkerKeyForSource = slideMod.slideImageMarkerKeyForSource;
    const ppsxMod = await import('../services/ppsx-converter.js');
    previewKeyForOwnedSource = ppsxMod.previewKeyForOwnedSource;
    previewKeyForSource = ppsxMod.previewKeyForSource;
  } catch (err) {
    console.error('[prewarm] Error loading dependencies:', err.message);
    process.exit(1);
  }

  try {
    const result = await runPrewarm({ dryRun, limit, delayMs, verbose, fileId });
    if (dryRun) {
      console.log(`[DRY-RUN] Would process: ${result.toProcess.length} files`);
      if (verbose) {
        for (const item of result.toProcess) {
          console.log(`  - ${item.file.id} (${item.sourceKey}, kind=${item.kind ?? 'legacy'})`);
        }
      }
    } else {
      console.log(`[APPLY] Complete: ${result.success} success, ${result.failed} failed`);
    }
  } catch (err) {
    console.error('[prewarm] Error:', err.message);
    process.exit(1);
  }
}

// Only run main if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
