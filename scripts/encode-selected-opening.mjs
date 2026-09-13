import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Format conversion only: retain the selected original PNG, no crop or repaint.
const sourceRoot = process.argv[2];
if (!sourceRoot) throw new Error('Usage: node scripts/encode-selected-opening.mjs <generated-image-directory>');
const output = new URL('../assets/opening-selected-20260912/', import.meta.url);
const selections = [
  ['prologue', '初対面1：潮風と振り返り', 'exec-c7791342-85d1-4470-8570-94354c30a686.png'],
  ['mizu', 'みず1：群青の窓辺', 'exec-31c5ca6e-d362-4d0a-b1ae-52fb62af13b1.png'],
  ['ame', 'あめ1：夜明けの天球儀', 'exec-88227541-52af-4252-b3d8-2d7c37a7407d.png'],
];
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
await fs.mkdir(output, { recursive: true });
const assets = [];
for (const [id, title, sourceFile] of selections) {
  const original = await fs.readFile(path.join(sourceRoot, sourceFile));
  const stem = `opening-${id}-01`;
  const target = new URL(`${stem}.png`, output);
  try { assert.equal(hash(await fs.readFile(target)), hash(original), `Refuse to overwrite a different selected original: ${stem}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; await fs.writeFile(target, original, { flag: 'wx' }); }
  const metadata = await sharp(original).metadata();
  assert.deepEqual([metadata.width, metadata.height], [1672, 941]);
  const variants = [];
  const quality = id === 'prologue' ? 84 : 92;
  for (const width of [1672, 834]) {
    const file = `${stem}${width === 834 ? '-834' : ''}.webp`;
    const buffer = await sharp(original).resize({ width }).webp({ quality, smartSubsample: true }).toBuffer();
    await fs.writeFile(new URL(file, output), buffer);
    const encoded = await sharp(buffer).metadata();
    variants.push({ file, quality, width: encoded.width, height: encoded.height, bytes: buffer.length, sha256: hash(buffer) });
  }
  assets.push({ id, title, sourceFile, original: `${stem}.png`, sha256: hash(original), variants });
}
await fs.writeFile(new URL('selection.json', output), `${JSON.stringify({ selectedOn: '2026-09-12', status: 'local-only', processing: 'PNG originals unchanged; WebP quality 84 (prologue) / 92 (characters), full frame, no crop or repaint. Compact variants resized proportionally to 834px width.', assets }, null, 2)}\n`);
console.log(JSON.stringify({ status: 'encoded', assets }, null, 2));
