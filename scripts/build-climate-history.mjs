import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import { cycloneColumns, cycloneRecord, summarizeCyclones, parseCoral } from './lib/climate-history-data.mjs';

const root = resolve('data/climate-history'), cache = resolve('artifacts/climate-source-cache');
const retrievedAt = new Date().toISOString();
await mkdir(root, { recursive: true }); await mkdir(cache, { recursive: true });
const hash = text => createHash('sha256').update(text).digest('hex');
const save = async (path, data) => writeFile(path, JSON.stringify(data) + '\n');
async function request(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(180000) }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response; }
    catch (error) { if (attempt === 2) throw new Error(`${url}: ${error.message}`); }
  }
}
async function cyclones() {
  const url = 'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.since1980.list.v04r01.csv';
  const response = await request(url), digest = createHash('sha256');
  const source = Readable.fromWeb(response.body); source.on('data', chunk => digest.update(chunk));
  const lines = createInterface({ input: source, crlfDelay: Infinity });
  let columns; const seasons = new Map();
  for await (const line of lines) {
    if (!columns) { columns = cycloneColumns(line); continue; }
    const record = cycloneRecord(line, columns); if (!record) continue;
    const { year, id, name, basin, point } = record;
    if (!seasons.has(year)) seasons.set(year, new Map());
    const storms = seasons.get(year);
    if (!storms.has(id)) storms.set(id, { id, name, basin, points: [] });
    const storm = storms.get(id);
    if (storm.points.at(-1)?.[0] === point[0]) throw new Error(`Duplicate IBTrACS point: ${id} ${point[0]}`);
    storm.points.push(point);
  }
  const manifest = { schemaVersion: 1, retrievedAt, source: url, sha256: digest.digest('hex'),
    citation: 'Gahtan et al. (2024), IBTrACS version 4r01, NOAA NCEI, doi:10.25921/82ty-9e16; seasons 1980–2024, MAIN tracks.',
    selection: 'MAIN tracks only; source SEASON (not calendar year). USA_WIND in knots, 1-minute sustained wind; missing wind remains null. Archive positions include interpolated times. Basin is the first recorded basin.',
    pointColumns: ['utcEpochHours','latitude','longitude','usaWindKnots','wmoPressureHPa','usaAgency'], years: [] };
  await mkdir(resolve(root, 'cyclones'), { recursive: true });
  for (const [year, map] of [...seasons].sort((a,b) => a[0]-b[0])) {
    const storms = [...map.values()]; for (const storm of storms) storm.points.sort((a,b) => a[0]-b[0]);
    const basins = Object.fromEntries([...new Set(storms.map(s => s.basin))].map(b => [b, summarizeCyclones(storms.filter(s => s.basin === b))]));
    const payload = { schemaVersion: 1, year, storms }; const bytes = JSON.stringify(payload) + '\n';
    await writeFile(resolve(root, `cyclones/${year}.json`), bytes);
    manifest.years.push({ year, ...summarizeCyclones(storms), basins, sha256: hash(bytes) });
  }
  if (manifest.years.length !== 45) throw new Error('Incomplete IBTrACS season coverage');
  await save(resolve(root, 'cyclones.json'), manifest);
  console.log(`IBTrACS: ${manifest.years.length} seasons; ${manifest.years.reduce((n,y) => n+y.count,0)} tracks`);
}
async function coral() {
  const url = 'https://coralreefwatch.noaa.gov/product/vs/data.php';
  const html = await (await request(url)).text();
  const urls = [...new Set([...html.matchAll(/href=["']([^"']+\.txt)["']/g)].map(m => new URL(m[1], url).href))].filter(u => u.startsWith('https://coralreefwatch.noaa.gov/product/vs/data/'));
  if (urls.length < 200) throw new Error(`Incomplete CRW source listing (${urls.length})`);
  const regions = [], sources = []; let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < urls.length) {
      const source = urls[cursor++], id = new URL(source).pathname.split('/').at(-1).replace('.txt','');
      const path = resolve(cache, `${id}.txt`); let text;
      if (process.argv.includes('--reuse-source-cache')) try { text = await readFile(path, 'utf8'); } catch { /* fetch below */ }
      if (!text) { text = await (await request(source)).text(); await writeFile(path, text); }
      regions.push(parseCoral(text, id)); sources.push({ id, url: source, retrievedAt: (await stat(path)).mtime.toISOString(), sha256: hash(text) });
      if (regions.length % 25 === 0) console.log(`CRW: ${regions.length}/${urls.length}`);
    }
  }));
  regions.sort((a,b) => a.id.localeCompare(b.id)); sources.sort((a,b) => a.id.localeCompare(b.id));
  await save(resolve(root, 'coral.json'), { schemaVersion: 1, retrievedAt, source: url,
    attribution: 'NOAA Coral Reef Watch, Regional Virtual Stations, daily data aggregated by calendar year (1986–2025). Public domain; credit NOAA Coral Reef Watch.',
    method: 'DHW_from_90th_HS>1: 84-day accumulation of regional daily 90th-percentile HotSpot above 1°C, in °C-weeks. Regional reef pixels include a 20 km buffer. Coordinates are polygon midpoints, not point observations. Annual maxima and threshold-day counts use valid daily values; no spatial interpolation.',
    rights: 'https://coralreefwatch.noaa.gov/satellite/docs/recommendations_crw_citation.php', sources, regions });
  console.log(`CRW: ${regions.length} regions, ${regions.reduce((n,r) => n+r.years.length,0)} region-years`);
}
await Promise.all([cyclones(), coral()]);
