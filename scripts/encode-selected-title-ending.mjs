import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

// Delivery-format conversion only: keep the selected compositions and dimensions.
const output = path.resolve('artifacts/selected-title-ending-2026-09-10');
fs.mkdirSync(output, {recursive: true});
const report = {operation: 'PNG to WebP only; source PNGs preserved, no crop, resize or repaint', assets: []};
for (const source of ['assets/title-candidates-20260909/01-starlit-observatory.png', 'assets/ending-candidates-20260909/01-turning-in-the-sunset.png']) {
  const destination = source.replace(/\.png$/, '.webp');
  const sourceBytes = fs.readFileSync(source);
  const metadata = await sharp(sourceBytes).metadata();
  const result = await sharp(sourceBytes).webp({quality: 92, effort: 6}).toFile(destination);
  assert.equal(result.width, metadata.width);
  assert.equal(result.height, metadata.height);
  assert.deepEqual(fs.readFileSync(source), sourceBytes);
  report.assets.push({source, destination, width: result.width, height: result.height, sourceBytes: sourceBytes.length, bytes: result.size,
    sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'), sha256: createHash('sha256').update(fs.readFileSync(destination)).digest('hex')});
}
fs.writeFileSync(path.join(output, 'conversion.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
