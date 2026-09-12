import { mkdirSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const inputDir = join(root, 'src/assets');
const outputDir = join(root, 'src/assets');

const source = 'church-logo-512.webp';
const generatedWidths = [128, 256, 384];
const quality = 82;

mkdirSync(outputDir, { recursive: true });

const srcBuffer = await sharp(join(inputDir, source)).toBuffer();

for (const w of generatedWidths) {
  const out = join(outputDir, `church-logo-${w}.webp`);
  rmSync(out, { force: true });
  await sharp(srcBuffer)
    .resize({ width: w, height: w, fit: 'inside' })
    .webp({ quality, effort: 6 })
    .toFile(out);
  const kb = (await (await import('node:fs/promises')).stat(out)).size / 1024;
  console.log(`generated church-logo-${w}.webp  (${kb.toFixed(1)} KiB)`);
}

const stale = readdirSync(outputDir).filter(
  (f) =>
    /^church-logo-\d+\.webp$/.test(f) &&
    f !== source &&
    f !== 'church-logo-40.webp' &&
    !generatedWidths.some((w) => f === `church-logo-${w}.webp`),
);
for (const f of stale) {
  rmSync(join(outputDir, f), { force: true });
  console.log(`removed stale ${f}`);
}