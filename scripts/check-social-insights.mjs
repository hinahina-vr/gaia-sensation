import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { discoverData } from '../statistics-discovery.js';
import { buildDatasets } from '../statistics-datasets.js';
import { buildAnnualStatisticsDataset } from '../src/exploration/annual-statistics.js';
import { JAPAN_SENSOR_OPEN_EXHIBITS } from '../src/exploration/japan-sensor-open-catalog.js';
import { JAPAN_POLLUTION_EXHIBITS } from '../src/exploration/japan-pollution-catalog.js';
import { PRTR_BIOLOGY_EXHIBITS } from '../src/exploration/prtr-biology-catalog.js';
import { MARINE_COD_EXHIBIT } from '../src/exploration/marine-cod-catalog.js';
import { FOOD_EXHIBITS, buildFoodStatisticsDataset } from '../src/exploration/food-catalog.js';
import { LIVE_EXHIBITS } from '../src/exploration/live-exhibit-catalog.js';
import { buildLiveStatistics } from '../src/exploration/live-statistics.js';
import { OBSERVATION_CITIES } from '../src/exploration/observation-cities.js';
import { buildSocialInsight, SOCIAL_PROFILES } from '../statistics-social-insights.js';
import { statisticsAiSnapshot, statisticsAiPrompt } from '../statistics-ai.js';
const out='artifacts/social-insights-20260913'; fs.mkdirSync(out,{recursive:true});
const read = f => JSON.parse(fs.readFileSync(f));
const part = f => JSON.parse(f.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(`data/${f}`)) : fs.readFileSync(`data/${f}`));
const checks=[], datasets=[];
function check(dataset, number, evidence='保存実データ・代表対象') {
  assert(dataset, `dataset ${number}`); const result=discoverData({dataset,rows:dataset.rows});
  assert(result.socialInsight.profileKey, `Unmapped: ${number} ${dataset.id} ${result.domain}`);
  assert(result.summary.includes('未検証'));
  assert.equal(result.findings.find(f=>f.kind==='meaning').body,result.summary);
  const ai = statisticsAiSnapshot({dataset, rows:dataset.rows, method:{label:'discovery',group:{name:'課題探索'}}, result:{kind:'discovery',dataInsight:result}});
  assert.equal(ai.socialHypothesis.summary,result.summary);
  assert(statisticsAiPrompt(ai,'概要').user.includes('## インサイト（検証仮説）'));
  for(const c of result.candidates) { assert(c.socialInsight.profileKey); assert(c.test.includes(c.socialInsight.need)); }
  checks.push({number,id:dataset.id,title:dataset.title,rows:dataset.rows.length,evidence,domain:result.domain,profile:result.socialInsight.profileKey,primary:result.primaryId,fact:result.findings[0].body,insight:result.summary,need:result.socialInsight.need,limit:result.caveat});
  datasets.push(dataset); return result;
}
const catalog=read('docs/design/map-editorial-20260907/copy.json').exhibits;
const manifest=read('data/runtime/gaia-manifest.json');
const snapshot={modes:manifest.chunks.map(c=>read(`data/runtime/${c.file}`))};
for(const dataset of buildDatasets(snapshot)) check(dataset,catalog.find(e=>e.id===dataset.modeId)?.number || `補助:${dataset.modeId}`);
for(const def of [MARINE_COD_EXHIBIT,...JAPAN_SENSOR_OPEN_EXHIBITS,...JAPAN_POLLUTION_EXHIBITS,...PRTR_BIOLOGY_EXHIBITS]) {
  const data=read(`data/${def.dataFile || 'japan-marine-cod.json'}`);
  const entry=data.periods.at(-1), period=data.schemaVersion===2?part(entry.file):entry;
  let selected;
  for(const point of period.stations) {
    const bucket=[...new TextEncoder().encode(point.id)].reduce((a,b)=>a+b,0)%64;
    const history=data.schemaVersion===2?part(data.historyShards[bucket].file)[point.id]:Object.fromEntries(data.periods.map(p=>[p.year,p.stations.find(s=>s.id===point.id)]));
    const dataset=buildAnnualStatisticsDataset({data,definition:def,selectedId:point.id,history,year:entry.year,period});
    if(dataset?.rows.length>=2){selected=dataset;break;}
  }
  check(selected,def.number);
}
for(const def of FOOD_EXHIBITS) {
  const data=read(`data/${def.dataFile}`);
  for(const series of data.series) {
    const country=data.countries.find(c=>buildFoodStatisticsDataset(data,def,series.id,c.id)?.rows.length>=2);
    check(buildFoodStatisticsDataset(data,def,series.id,country.id),def.number);
  }
}
// Controlled live adapter inputs test all six dispatch paths; not current observations.
for(const def of LIVE_EXHIBITS) {
  const field={source:'snapshot',points:OBSERVATION_CITIES.map((c,i)=>({id:c.id,observedAt:'2026-09-13T00:00:00Z',measurements:{[def.key]:i+1}}))};
  check(buildLiveStatistics(def,null,null,{weather:field,air:field}),def.number,'制御入力によるモデルアダプター試験（現在値ではない）');
}
for(const [id,domain,number] of [['planet-global-wind-pressure','wind',2],['planet-global-aerosol-light','aerosol',3],['planet-usgs-earthquake-ripples','quake-events',4],['planet-global-cloud-radiance','cloud',5],['nasa-firms-active-fire-24h','fire',1]]) {
  check({id,title:id,unit:'',rows:Array.from({length:12},(_,i)=>({id:String(i),label:`地点${i}`,value:i+1,x:i,provenance:'SOURCE'})),insightContext:{domain}},number,'制御入力による説明分岐試験（現在値ではない）');
}
for(const key of Object.keys(SOCIAL_PROFILES)) for(const id of ['flat-data','not-enough-comparison','pace-change','different-contexts']) {
  const r=buildSocialInsight({},key,{id}); assert(r.profileKey); if(id==='flat-data')assert(r.summary.includes('課題がない証拠ではありません')); if(id==='not-enough-comparison')assert(r.summary.includes('比較不足'));
}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
  await page.route('https://**',r=>r.abort());
  await page.goto('http://127.0.0.1:4492/#world-28');
  await page.waitForFunction(()=>globalThis.GaiaEstatExhibits?.getStatisticsDataset(),null,{timeout:60000});
  await page.locator('#gaia-boot').waitFor({state:'hidden'});
  for(let i=0;i<10;i++) {
    const dataset=await page.evaluate(async i=>{await GaiaEstatExhibits.select(i);GaiaEstatExhibits.pausePlayback();return GaiaEstatExhibits.getStatisticsDataset();},i);
    check(dataset,21+i,'ブラウザの実アダプター・保存実データ');
  }
  await page.evaluate(()=>GaiaModeLoader.load('statistics'));
  await page.waitForFunction(()=>globalThis.GaiaStatisticsLab);
  await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
  for(const number of ['28','32','46','67','71']) {
    const dataset=datasets[checks.findIndex(c=>String(c.number)===number)];
    await page.evaluate(async dataset=>{await GaiaStatisticsLab.open({dataset});await GaiaStatisticsLab.run('discovery');},dataset);
    await page.waitForFunction(()=>document.querySelector('#gaia-statistics-status')?.textContent==='解析済み');
    const summary=await page.locator('#gaia-statistics-takeaway').textContent();
    assert(summary.includes('未検証'));
    await page.locator('[data-stat-view="findings"]').click();
    assert((await page.locator('.dashboard-reading [data-kind="meaning"]').textContent()).includes('未検証'));
    assert((await page.locator('[data-kind="social-data"]').textContent()).includes('判断・検証に必要なデータ'));
    await page.screenshot({path:`${out}/desktop-${number}.png`});
  }
  const savedDatasetId=await page.evaluate(()=>GaiaStatisticsLab.getState().datasetId);
  await page.locator('#gaia-statistics-menu-toggle').click();
  await page.locator('.gaia-statistics-data-options > summary').click();
  await page.locator('#gaia-statistics-view-save').click();
  const savedId=await page.locator('#gaia-statistics-saved-view').inputValue();
  assert(savedId);
  await page.reload();
  await page.waitForFunction(()=>globalThis.GaiaEstatExhibits?.getStatisticsDataset(),null,{timeout:60000});
  await page.locator('#gaia-boot').waitFor({state:'hidden'});
  await page.evaluate(()=>GaiaModeLoader.load('statistics'));
  await page.waitForFunction(()=>globalThis.GaiaStatisticsLab);
  await page.evaluate(()=>{GaiaModeEntryGuide?.close('map',{restoreFocus:false});return GaiaStatisticsLab.open({dataset:GaiaEstatExhibits.getStatisticsDataset()});});
  await page.locator('#gaia-statistics-menu-toggle').click();
  await page.locator('.gaia-statistics-data-options > summary').click();
  await page.locator('#gaia-statistics-saved-view').selectOption(savedId);
  await page.locator('#gaia-statistics-view-apply').click();
  await page.waitForFunction(id=>GaiaStatisticsLab.getState().datasetId===id,savedDatasetId,{timeout:60000});
  assert((await page.evaluate(()=>GaiaStatisticsLab.run('discovery'))).dataInsight.socialInsight.profileKey==='food_import');
  await page.locator('#gaia-statistics-menu-close').click();
  await page.locator('[data-stat-view="findings"]').click();
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${out}/mobile.png`});
} finally { await browser.close(); }
assert.equal(new Set(checks.map(c=>Number(c.number)).filter(Number.isFinite)).size,71,'All 71 exhibition numbers must be audited');
const versions=Object.fromEntries(['statistics-social-insights.js','statistics-discovery.js','statistics-lab.js','statistics-refinement.css','statistics-ai.js','src/exploration/annual-statistics.js','src/exploration/food-catalog.js'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
fs.writeFileSync(`${out}/audit.json`,JSON.stringify({date:new Date().toISOString(),versions,checks},null,2));
fs.writeFileSync(`${out}/datasets.json`,JSON.stringify(datasets));
fs.writeFileSync(`${out}/REPORT.md`, `# 社会課題インサイト全指標監査\n\n${checks.length}データセット・系列を確認。保存実データは各展示の代表対象で確認し、全地点×全年の組合せ試験ではありません。LIVE・全球経路の制御入力試験は現在値や実配信の確認ではありません。社会的影響・介入効果を実証したものではなく、検証仮説として表示します。\n\n|展示|対象|指標別プロファイル|確認方法|\n|---|---|---|---|\n${checks.map(c=>`|${c.number}|${c.title.replaceAll('|','／')}|${c.profile}|${c.evidence}|`).join('\n')}\n\n## 全件の読み取り\n\n${checks.map(c=>`### ${c.number} ${c.title}\n\nファクト：${c.fact}\n\nインサイト：${c.insight}\n\n必要データ：${c.need}\n\n制約：${c.limit}\n`).join('\n')}\n\nローカルのみ。AIへの有料送信・本番公開は行っていません。\n`);
console.log(`PASS ${checks.length} dataset/series checks; ${Object.keys(SOCIAL_PROFILES).length} profiles; desktop/mobile UI. Report: ${out}/REPORT.md`);
