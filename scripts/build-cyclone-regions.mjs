import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { REGIONS, RADIUS_KM, MAX_INTERVAL_HOURS, summarizeRegion } from './lib/cyclone-regional-data.mjs';

const root = path.resolve(import.meta.dirname, '../data/climate-history');
const rawManifest = fs.readFileSync(path.join(root, 'cyclones.json'));
const manifest = JSON.parse(rawManifest);
const digest = value => createHash('sha256').update(value).digest('hex');
assert.deepEqual(manifest.years.map(row => row.year), Array.from({length:45}, (_, i) => 1980+i));
const regions = REGIONS.map(region => ({...region, years: []}));
for (const item of manifest.years) {
  const raw = fs.readFileSync(path.join(root, `cyclones/${item.year}.json`));
  assert.equal(digest(raw), item.sha256, `Source changed: ${item.year}`);
  const season = JSON.parse(raw); assert.equal(season.year, item.year);
  for (const region of regions) region.years.push(summarizeRegion(season.storms, region, season.year));
}
const result = { schemaVersion: 1, radiusKm: RADIUS_KM, maxIntervalHours: MAX_INTERVAL_HOURS,
  source: manifest.source, sourceRetrievedAt: manifest.retrievedAt, citation: manifest.citation,
  sourceManifestSha256: digest(rawManifest),
  sourceSeasons: manifest.years.map(({year, sha256}) => ({year, sha256})),
  method: 'MAIN tracks with a recorded centre within 300 km of the named city coordinate; one count per SID per SEASON. Month is the closest recorded approach in UTC, earliest in a tie. Wind is the maximum USA_WIND inside the circle (1-minute mean). Translation speed is summed great-circle segment distance / summed hours, using adjacent points both inside the circle, with intervals <=6 hours. Interpolated source positions are retained. All basins, no status or intensity threshold. Zero counts retained; unavailable wind/speed remain null.',
  regions };
const target = path.join(root, 'cyclone-regions.json'), serialized = JSON.stringify(result)+'\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(target,'utf8'), serialized, 'Regional summary is stale; run npm run build:cyclone-regions');
else fs.writeFileSync(target, serialized);
console.log(JSON.stringify({status:process.argv.includes('--check')?'passed':'generated', regions:regions.length, seasons:45, bytes:Buffer.byteLength(serialized)}));
