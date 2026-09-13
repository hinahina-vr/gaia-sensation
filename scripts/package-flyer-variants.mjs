// Preserve generated originals and build a local comparison gallery; no deployment.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'output/flyers/20260913-varied');
const { jobs } = JSON.parse(fs.readFileSync(path.join(dir, 'prompts.json')));
const results = JSON.parse(fs.readFileSync(path.join(dir, 'results.json')));
const manifest = [];
for (const row of results) {
  if (!row.source || row.error) continue;
  if (!/^(vertical|horizontal)-\d{2}$/.test(row.id)) throw new Error('Invalid flyer ID');
  const source = path.resolve(row.source);
  if (!source.toLowerCase().startsWith('e:\\codexdata\\home\\generated_images\\')) throw new Error('Unexpected image source');
  const target = path.join(dir, row.id + '.png');
  if (!fs.existsSync(target)) fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  const bytes = fs.readFileSync(target), original = fs.readFileSync(source);
  if (!bytes.equals(original)) throw new Error('Saved flyer differs from original');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (row.id.startsWith('vertical') ? height <= width : width <= height) throw new Error('Wrong orientation: ' + row.id);
  manifest.push({ id: row.id, file: row.id + '.png', width, height, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), source });
}
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const cards = jobs.map(job => {
  const file = manifest.find(m => m.id === job.id);
  return `<article><h2>${escape(job.id)} · ${escape(job.name)}</h2><p>${escape(job.headline)}</p>${file ? `<a href="${file.file}" target="_blank"><img src="${file.file}" loading="lazy" alt="${escape(job.headline)}"></a><small>${file.width} × ${file.height} · PNG</small>` : '<p>生成待ち</p>'}</article>`;
}).join('\n');
fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>惑星の放課後｜チラシ20案</title><style>body{margin:0;padding:32px;background:#eeeae3;color:#172c36;font:16px/1.6 sans-serif}h1{margin:0}header{max-width:1000px;margin:0 auto 32px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;max-width:1500px;margin:auto}article{background:white;padding:20px;border-radius:10px}h2{font-size:18px}img{width:100%;max-height:850px;object-fit:contain;background:#f4f4f4}small{color:#567}@media(max-width:700px){.grid{grid-template-columns:1fr}body{padding:16px}}</style><header><h1>惑星の放課後｜チラシ20案</h1><p>縦10・横10。画像をクリックすると原寸PNGを開きます。</p><p>販促用のデザイン案です。UI・地図は実画面を参考に再構成したもので、実スクリーンショットや観測値の保証ではありません。生成文字・地理形状の細部は採用案決定後の校正対象です。</p></header><main class="grid">${cards}</main></html>`);
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ status: manifest.length === 20 ? 'complete' : 'partial', images: manifest.length, directory: dir }));
