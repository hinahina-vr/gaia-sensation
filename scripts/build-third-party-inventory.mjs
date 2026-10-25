import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {ATLAS_EXHIBITS} from '../src/exploration/atlas-history-model.js';
const root = path.resolve(import.meta.dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const dependencies = ["package-lock.json", "sensor-platform/package-lock.json"].flatMap(file => {
  const lock = JSON.parse(read(file));
  return Object.entries(lock.packages || {}).filter(([name]) => name).map(([name, pkg]) => ({ lockfile: file, path: name, version: pkg.version || null, license: pkg.license || "not-declared", dev: Boolean(pkg.dev), resolved: pkg.resolved || null }));
});
const html = ["index.html", "sensors/index.html", "concept/index.html"].map(read).join("\n");
const hostedFonts = [...new Set(html.match(/https:\/\/fonts\.googleapis\.com\/[^"'\s<]+/g) || [])];
const snapshot = JSON.parse(read("data/gaia-signals.json"));
const dataSources = snapshot.modes.flatMap(mode => mode.datasets.map(dataset => ({ modeId: mode.id, id: dataset.id, title: dataset.title, organisation: dataset.organisation, sourceUrl: dataset.url, termsUrl: dataset.termsUrl || null, retrievedAt: dataset.retrievedAt || null, transformation: dataset.transformation || null, usageSurfaces: ["on-screen transformed display", "directly served bundled JSON", "participant-selected analysis fields may be sent to BYOK AI after consent"] })));
for (const name of ['balances', 'security']) {
  const data = JSON.parse(read(`data/fao-food-${name}.json`));
  dataSources.push({ modeId: `food-${name}`, id: `fao-food-${name}`, title: data.source.name, organisation: 'FAO',
    sourceUrl: data.source.catalogUrl, bulkUrl: data.source.url, termsUrl: data.termsUrl, retrievedAt: data.retrievedAt,
    license: data.license, sourceSha256: data.source.sha256,
    transformation: name === 'balances' ? '2010–2023, 9 commodity groups; original production/import/export quantities and flags; SSR derived without stock variation; missing and invalid quantities not zero-filled.' : 'Two FAO-published three-year-average indicators and original flags; no annual interpolation.',
    usageSurfaces: ['on-screen transformed display', 'directly served bundled JSON', 'participant-selected analysis fields may be sent to BYOK AI after consent'] });
}
const storyTemperature = JSON.parse(read('data/story-temperature-annual.json'));
for (const id of ['cyclones', 'coral']) {
  const data = JSON.parse(read(`data/climate-history/${id}.json`));
  dataSources.push({ modeId: id, id: `noaa-${id}`, title: id === 'cyclones' ? 'IBTrACS v4r01 MAIN tracks' : 'Coral Reef Watch Regional Virtual Stations annual summaries',
    organisation: id === 'cyclones' ? 'NOAA NCEI' : 'NOAA Coral Reef Watch', sourceUrl: data.source,
    termsUrl: data.rights || 'https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncdc:C01552',
    retrievedAt: data.retrievedAt, sourceSha256: data.sha256 || null, transformation: data.selection || data.method,
    usageSurfaces: ['on-screen transformed display', 'directly served bundled JSON', 'participant-selected analysis fields may be sent to BYOK AI after consent'] });
}
for(const d of ATLAS_EXHIBITS){
  const data=JSON.parse(read(`data/atlas-history/${d.id}.json`));
  dataSources.push({modeId:d.id,id:`atlas-${d.id}`,title:d.signalLabel,organisation:d.organisation,sourceUrl:d.source,
    termsUrl:d.termsUrl||(d.code?'https://datacatalog.worldbank.org/public-licenses':d.id==='waterstore'?'https://grace.jpl.nasa.gov/about/how-to-cite/':'https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/LSA_productspolicy.php'),
    retrievedAt:data.retrievedAt,transformation:data.method,citation:data.citation||d.organisation,rawSourceHashes:d.rawManifest||'data/atlas-history/sources.json',
    usageSurfaces:['on-screen transformed display','directly served bundled JSON','participant-selected analysis fields may be sent to BYOK AI after consent']});
}
const lakes=JSON.parse(read('data/surface-water/lakes.json'));
dataSources.push({modeId:'lakes',id:'jrc-lakes',title:'湖周辺の年次水域分類',organisation:'EC JRC / Google',sourceUrl:'https://global-surface-water.appspot.com/download',termsUrl:'https://global-surface-water.appspot.com/download',retrievedAt:lakes.retrievedAt,transformation:lakes.method,rawSourceHashes:'data/surface-water/lakes.json',usageSurfaces:['on-screen transformed display','directly served bundled JSON','participant-selected analysis fields may be sent to BYOK AI after consent']});
const waterGrid=JSON.parse(read('data/atlas-history/waterstore-grid.json'));
dataSources.push({modeId:'waterstore',id:'waterstore-grid',title:'陸水量偏差の0.5度配布格子',organisation:'NASA JPL / GRACE・GRACE-FO',sourceUrl:'https://grace.jpl.nasa.gov/data/get-data/jpl_global_mascons/',termsUrl:'https://grace.jpl.nasa.gov/about/how-to-cite/',retrievedAt:waterGrid.retrievedAt,transformation:waterGrid.method,rawSourceHashes:'data/atlas-history/waterstore-grid.json#sources',usageSurfaces:['on-screen transformed display','directly served bundled JSON','participant-selected analysis fields may be sent to BYOK AI after consent']});
dataSources.push({modeId: 'story-map01-temperature', id: 'nasa-gistemp-regional-annual',
  title: storyTemperature.dataset, organisation: storyTemperature.provider,
  sourceUrl: storyTemperature.sourceUrl, documentationUrl: storyTemperature.documentationUrl,
  retrievedAt: storyTemperature.retrievedAt, sourceSha256: storyTemperature.sourceSha256,
  transformation: storyTemperature.method, caveat: storyTemperature.caveat,
  usageSurfaces: ['story temperature map', 'directly served derived annual binary and metadata']});
const payload = { schemaVersion: 1, generatedBy: "scripts/build-third-party-inventory.mjs", note: "ロックファイルの宣言と収録データ出典を列挙。ライセンス本文や公開許諾の代わりではない。利用者OSに存在するシステムフォントを優先し、フォント本体は収録していない。", hostedFonts, dependencies, dataSources };
const content = `${JSON.stringify(payload, null, 2)}\n`;
const target = path.join(root, "docs/THIRD_PARTY_INVENTORY.json");
if (process.argv.includes("--check")) assert.equal(fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n"), content);
else fs.writeFileSync(target, content);
console.log(JSON.stringify({ status: "passed", dependencies: dependencies.length, hostedFonts: hostedFonts.length }));
