import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Format conversion only. All composition changes are native Imagegen edits.
const sourceDirectory = path.resolve('artifacts/map-calm-repeat-2026-09-10/source');
const report = { mode: 'built-in Imagegen', operation: 'WebP encoding only; original pixels, dimensions and source PNGs retained', assets: [] };
for (const kind of ['live', 'time', 'discovery']) {
  const source = path.join(sourceDirectory, `${kind}.png`);
  const destination = `assets/modes/guide-map-${kind}-mizu-ame-v2.webp`;
  const input = await sharp(source).metadata();
  assert.equal(input.width, 1774);
  assert.equal(input.height, 887);
  const encoded = await sharp(source).webp({ quality: 92, effort: 6 }).toFile(destination);
  assert.equal(encoded.width, input.width);
  assert.equal(encoded.height, input.height);
  report.assets.push({ source, destination, width: encoded.width, height: encoded.height, bytes: encoded.size, sourceSha256: createHash('sha256').update(fs.readFileSync(source)).digest('hex'), sha256: createHash('sha256').update(fs.readFileSync(destination)).digest('hex') });
}
fs.writeFileSync(path.join(sourceDirectory, 'conversion-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
