// Download public FAO source tables verbatim. The app serves processed JSON,
// never contacts the provider at runtime, and never rewrites these raw files.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'artifacts/fao-food-sources-2026-09-09');
await fs.mkdir(output, { recursive: true });
const manifestFile = path.join(output, 'manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8').catch(() => '{"sources":[]}'));
async function download(file, url) {
  const previous = manifest.sources.find(item => item.file === file);
  if (previous && previous.url !== url) throw new Error(`Source URL changed: ${file}`);
  if (previous) {
    const bytes = await fs.readFile(path.join(output, file));
    if (createHash('sha256').update(bytes).digest('hex') !== previous.sha256) throw new Error(`Modified raw source: ${file}`);
    return bytes;
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > (file === 'FoodBalanceSheetsHistoric.zip' ? 85 : 60) * 1024 * 1024) throw new Error(`${file}: unexpectedly large response`);
  await fs.writeFile(path.join(output, file), bytes, { flag: 'wx' });
  manifest.sources.push({ file, url, retrievedAt: new Date().toISOString(), bytes: bytes.length,
    contentType: response.headers.get('content-type'), sha256: createHash('sha256').update(bytes).digest('hex') });
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2));
  console.log(`Downloaded ${file}: ${bytes.length} bytes`);
  return bytes;
}
const domains = {
  FBS: { id: '2f264bb6-1238-459a-bf8b-0e2d0a16804a', query: 'https://data.apps.fao.org/catalog/dataset/5c00a4e6-0ec8-4191-a0c0-a7cd5fda3674/resource/91b9d43c-55c4-4a2a-9b25-78f2fabba28b/download/fct-fbs-food-balances.query.sql' },
  FS: { id: '955d6564-40a9-48b4-b51b-f19d65bb3539', query: 'https://data.apps.fao.org/catalog/dataset/ca2d4c71-d1e8-46b8-9a4f-588a0604e195/resource/efe51d5d-51e1-4293-9042-75a5826af7c8/download/food-security-indicators-fs-query.sql' },
};
if (process.argv.includes('--bulk')) {
  await download('datasets_E.json', 'https://bulks-faostat.fao.org/production/datasets_E.json');
  for (const name of ['FoodBalanceSheets', 'Food_Security_Data']) {
    await download(`${name}.zip`, `https://bulks-faostat.fao.org/production/${name}_E_All_Data_(Normalized).zip`);
  }
}
if (process.argv.includes('--historic')) {
  await download('FoodBalanceSheetsHistoric.zip', 'https://bulks-faostat.fao.org/production/FoodBalanceSheetsHistoric_E_All_Data_(Normalized).zip');
}
if (process.argv.includes('--metadata')) {
  for (const [key, domain] of Object.entries(domains)) {
    const payload = JSON.parse(await download(`${key}-catalog.json`, `https://data.fao.org/catalog/api/3/action/package_show?id=${domain.id}`));
    if (!payload.success) throw new Error(`Missing catalog ${key}`);
    for (const resource of payload.result.resources) {
      console.log(key, resource.name, resource.url);
      if (/schema/i.test(resource.name) && /schema.*json$/i.test(resource.url)) {
        await download(`${key}-schema.json`, resource.url.replace('https://data.apps.fao.org/catalog/', 'https://data.fao.org/catalog/'));
      }
    }
  }
  await download('FS-Descriptions_and_Metadata.xlsx', 'https://files-faostat.fao.org/production/FS/Descriptions_and_Metadata.xlsx');
}
for (const arg of process.argv.slice(2)) {
  const match = /^(FBS|FS):(\d+(?:,\d+)*)$/.exec(arg);
  if (!match) continue;
  const [, key, codes] = match;
  for (const code of codes.split(',')) {
    const url = new URL('https://api.data.apps.fao.org/api/v2/bigquery');
    url.search = new URLSearchParams({ download: 'true', item_code: code, sql_url: domains[key].query });
    const bytes = await download(`${key}-${code}.csv`, url.href);
    console.log(bytes.toString('utf8').split('\n').slice(0, 2).map(line => line.slice(0, 240)).join('\n'));
  }
}
