// Bottom-clip repair for LibreOffice PPTX/PPSX -> PDF output.
//
// These decks declare their Arabic complex-script face as a font the conversion
// host does not have (typically "Times New Roman"). fontconfig then substitutes
// Noto Naskh Arabic, whose advance widths are larger; every paragraph re-wraps
// onto an extra line, the top-anchored block runs past the shape and past the
// 540pt slide edge, and LibreOffice stops painting it - the last verse line
// disappears, or glyphs are cut in half by the page boundary.
//
// clipfit.py measures that against the PDF it just produced (a word that reaches
// the page edge, or source characters absent from the text layer) and names the
// shapes responsible. Repair is scoped to exactly those shapes, and every
// candidate is verified by re-measuring the deck it produced:
//
//   1. rebind   - point the shapes' <a:cs> at a face the deck carries inside
//                 itself (p:embeddedFontLst), so layout no longer depends on
//                 what fonts the host happens to have.
//   2. chain    - rebind, re-measure, then autofit only the shapes that are
//                 STILL broken. The stages have to see each other's output:
//                 each one alone leaves decks the other would have finished.
//   3. autofit  - the same fallback applied to the original deck, for shapes
//                 with no embedded face to bind to.
//
// A deck that measures clean is published at once. When no candidate clears the
// defect outright, the best-scoring one is kept instead of being thrown away:
// requiring a perfect score is what left decks unrepaired. Scoring is fewest
// dropped glyphs first, then fewest slides still clipping, and a deck whose
// page count changed ranks last - a conversion that drops a slide is not usable
// no matter how its text measures.
//
// Everything is best-effort. If python3/pdftotext are absent, clipfit errors, or
// no candidate improves on the deck, the caller gets back the PDF it already had
// and the deck renders exactly as it does today. Nothing is ever published that
// has not been re-measured.

import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SCRIPT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'python', 'pptx_fit');
const CLIPFIT = join(SCRIPT_DIR, 'clipfit.py');

// A rebind that does not help must not eat the whole conversion budget: two
// embedded faces plus the autofit fallback is the most a single deck may spend.
// Every deck that actually reaches this far carries at most two embedded faces.
const MAX_FACE_TRIES = 2;
const RUN_TIMEOUT_MS = 60_000;
const RUN_MAX_BUFFER = 4 * 1024 * 1024;

// Unbeatable score: the deck as LibreOffice already rendered it.
const UNRANKABLE = [9999, 9999, 9999];

let toolchainPromise;

/**
 * Probe the repair toolchain once per process. clipfit needs an interpreter,
 * fitlib (same directory), and poppler's pdftotext; LibreOffice is already a
 * hard requirement of the conversion itself.
 */
export function clipGuardToolchain() {
  if (!toolchainPromise) {
    toolchainPromise = (async () => {
      try {
        await execFileAsync('python3', ['-c', 'import clipfit'], {
          cwd: SCRIPT_DIR,
          timeout: 30_000,
        });
        await execFileAsync('pdftotext', ['-v'], { timeout: 15_000 });
        return { available: true };
      } catch (error) {
        console.warn(
          '[clip-guard] unavailable, decks render as before:',
          error?.message || error,
        );
        return { available: false };
      }
    })();
  }
  return toolchainPromise;
}

// clipfit prints exactly one JSON object; anything else on stdout is commentary.
function parseClipfitJson(stdout) {
  const line = String(stdout || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{'))
    .pop();
  if (!line) throw new Error('clipfit produced no JSON result');
  return JSON.parse(line);
}

async function runClipfit(args, { execute, cwd }) {
  const { stdout } = await execute('python3', [CLIPFIT, ...args], {
    timeout: RUN_TIMEOUT_MS,
    maxBuffer: RUN_MAX_BUFFER,
    cwd,
  });
  return parseClipfitJson(stdout);
}

/** LibreOffice writes <input basename>.pdf into --outdir; return that path. */
async function convertToPdf(deckPath, workDir, libreoffice, execute) {
  await execute(libreoffice, [
    '--headless', '--convert-to', 'pdf', '--outdir', workDir, deckPath,
  ], { timeout: 120_000 });
  return join(workDir, `${basename(deckPath, extname(deckPath))}.pdf`);
}

function unchanged(pdfPath, report, reason, attempts = []) {
  return { pdfPath, repaired: false, report: report ?? null, reason, attempts };
}

/**
 * Rank a measured candidate: fewest dropped glyphs first, then fewest slides
 * still clipped or truncated. `pages` is the count the deck started with, so a
 * conversion that dropped or invented a slide cannot win on text alone.
 */
function scoreReport(report, pages) {
  if (!report?.ok) return UNRANKABLE;
  const missing = (report.slides || []).reduce((n, s) => n + (s.missing_chars || 0), 0);
  const broken = (report.repair || []).length;
  const drifted = report.pages === pages ? 0 : 1000;
  return [missing, broken, broken + drifted];
}

/** True when `a` beats `b` on scoreReport's ranking, ties going to `b`. */
function outranks(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/**
 * Measure a freshly converted PDF and repair it if the deck clips.
 *
 * Returns `{ pdfPath, repaired, ... }` where `pdfPath` is always a file the
 * caller may publish: a candidate that measured clean, the best-scoring
 * candidate when none did, or the original when no candidate improved on it.
 */
export function createClipGuard({ probe = clipGuardToolchain } = {}) {
  return async function clipGuard({ sourcePath, pdfPath, workDir, libreoffice, execute }) {
    // Ops kill-switch: one env var turns every deck back into a plain
    // LibreOffice conversion without a deploy.
    if (process.env.CLIP_GUARD === '0') return unchanged(pdfPath, null, 'disabled');
    if (!execute) return unchanged(pdfPath, null, 'no execute');

    const status = await probe();
    if (!status?.available) return unchanged(pdfPath, null, 'toolchain');

    let report;
    try {
      report = await runClipfit(['detect', pdfPath, sourcePath], { execute, cwd: SCRIPT_DIR });
    } catch (error) {
      return unchanged(pdfPath, null, `detect: ${error?.message || error}`);
    }
    if (!report?.ok) return unchanged(pdfPath, report, `detect: ${report?.error || 'failed'}`);
    if (!report.repair?.length) return unchanged(pdfPath, report, 'clean');

    const pages = report.pages;
    const attempts = [];
    const planPath = join(workDir, 'clip-plan.json');
    await writeFile(planPath, JSON.stringify(report.shapes || {}), 'utf8');

    const isClean = (after) => Boolean(after?.ok)
      && after.repair?.length === 0
      && after.pages === pages;

    // Best candidate so far. It starts as the deck we were handed, so a repair
    // that measures worse than the original is never published instead of it.
    let best = { pdfPath, report, score: scoreReport(report, pages), via: null };
    const weigh = (candidate, after, via) => {
      const score = scoreReport(after, pages);
      if (outranks(score, best.score)) best = { pdfPath: candidate, report: after, score, via };
    };
    const cleanResult = (candidate, after, via) =>
      ({ pdfPath: candidate, repaired: true, report: after, via, attempts });

    // Stage 1: rebind to a face embedded in the deck, and stage 2 chained onto
    // its output - re-measured first, so autofit is applied to exactly the
    // shapes stage 1 did not finish. A face that does not actually fit (Tajawal
    // on "2 ابريل" still clips) must not be published just because the patch
    // itself succeeded.
    const faces = (report.faces || []).slice(0, MAX_FACE_TRIES);
    let chainIndex = 0;
    for (const face of faces) {
      const deck = join(workDir, `clip-rebind-${attempts.length}.ppsx`);
      try {
        const patched = await runClipfit(
          ['patch', sourcePath, deck, planPath, '--mode', 'rebind', '--face', face],
          { execute, cwd: SCRIPT_DIR },
        );
        if (!patched?.ok) {
          attempts.push({ mode: 'rebind', face, error: patched?.error || 'patch failed' });
          continue;
        }
        const candidate = await convertToPdf(deck, workDir, libreoffice, execute);
        const after = await runClipfit(['detect', candidate, sourcePath], { execute, cwd: SCRIPT_DIR });
        if (isClean(after)) return cleanResult(candidate, after, `rebind:${face}`);
        weigh(candidate, after, `rebind:${face}`);
        attempts.push({ mode: 'rebind', face, remaining: after?.repair?.length ?? null, error: after?.error });

        if (!after?.ok || !after.repair?.length || !after.shapes) continue;
        const id = chainIndex;
        chainIndex += 1;
        const chained = join(workDir, `clip-chain-${id}.ppsx`);
        const chainPlan = join(workDir, `clip-plan-chain-${id}.json`);
        try {
          await writeFile(chainPlan, JSON.stringify(after.shapes), 'utf8');
          const patchedChain = await runClipfit(
            ['patch', deck, chained, chainPlan, '--mode', 'autofit'],
            { execute, cwd: SCRIPT_DIR },
          );
          if (!patchedChain?.ok) {
            attempts.push({ mode: 'chain', face, error: patchedChain?.error || 'patch failed' });
            continue;
          }
          const chainedPdf = await convertToPdf(chained, workDir, libreoffice, execute);
          const chainedAfter = await runClipfit(
            ['detect', chainedPdf, sourcePath], { execute, cwd: SCRIPT_DIR },
          );
          if (isClean(chainedAfter)) return cleanResult(chainedPdf, chainedAfter, `rebind:${face}->autofit`);
          weigh(chainedPdf, chainedAfter, `rebind:${face}->autofit`);
          attempts.push({
            mode: 'chain', face, remaining: chainedAfter?.repair?.length ?? null,
            error: chainedAfter?.error,
          });
        } catch (error) {
          attempts.push({ mode: 'chain', face, error: error?.message || String(error) });
        }
      } catch (error) {
        attempts.push({ mode: 'rebind', face, error: error?.message || String(error) });
      }
    }

    // Stage 3: autofit the original deck. This is the only option for a shape
    // with no embedded face to bind to, and it can win outright where every
    // rebind made the substitution worse.
    try {
      const deck = join(workDir, 'clip-autofit.ppsx');
      const patched = await runClipfit(
        ['patch', sourcePath, deck, planPath, '--mode', 'autofit'],
        { execute, cwd: SCRIPT_DIR },
      );
      if (patched?.ok) {
        const candidate = await convertToPdf(deck, workDir, libreoffice, execute);
        const after = await runClipfit(['detect', candidate, sourcePath], { execute, cwd: SCRIPT_DIR });
        if (isClean(after)) return cleanResult(candidate, after, 'autofit');
        weigh(candidate, after, 'autofit');
        attempts.push({ mode: 'autofit', remaining: after?.repair?.length ?? null, error: after?.error });
      } else {
        attempts.push({ mode: 'autofit', error: patched?.error || 'patch failed' });
      }
    } catch (error) {
      attempts.push({ mode: 'autofit', error: error?.message || String(error) });
    }

    if (!best.via) {
      console.warn(
        `[clip-guard] ${sourcePath}: ${report.repair.length} clipped slide(s) left unrepaired `
        + `(${attempts.map((a) => `${a.mode}${a.face ? `/${a.face}` : ''}: ${a.error || `${a.remaining} left`}`).join('; ')})`,
      );
      return unchanged(pdfPath, report, 'unrepaired', attempts);
    }

    // Nothing reached a perfect score, but this candidate measures better than
    // the deck we started with - and it was re-measured, so publishing it is no
    // more of a guess than publishing the original.
    return { pdfPath: best.pdfPath, repaired: true, report: best.report, via: best.via, attempts };
  };
}

export const defaultClipGuard = createClipGuard();
export { unchanged as clipGuardUnchanged };
