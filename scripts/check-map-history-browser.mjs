import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {readAnnualPart} from './lib/annual-snapshot.mjs';
import {foodValue, foodFormat, foodRowSource} from '../src/exploration/food-catalog.js';
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const out = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/map-history-20260912/browser');
fs.mkdirSync(out, {recursive:true});
const report = {scope:'Installed Chrome, real local files, desktop/mobile emulation. External services blocked; not production or physical-device evidence.', checks:[], errors:[]};
const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
 for (const [width,height] of (process.env.HISTORY_VIEWPORTS || '1440x900,390x844').split(',').map(v=>v.split('x').map(Number))) {
  const context = await browser.newContext({viewport:{width,height},isMobile:width<901,hasTouch:width<901,reducedMotion:'reduce'});
  await enforceBrowserSecurity(context,base);
  await context.route('https://**',r=>r.abort());
  page = await context.newPage(); page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/?exhibit=38#world',{waitUntil:'domcontentloaded'});
  await page.locator('[data-feature-start]').click();
  await page.waitForFunction(()=>globalThis.GaiaMapCategories?.buttons().length===71);
  await page.evaluate(()=>GaiaMapDemo.stop());
  const numbers = process.env.HISTORY_NUMBERS?.split(',').map(Number) || Array.from({length:41},(_,i)=>31+i);
  for (const number of numbers) {
   await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),number);
   await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),number);
   if (number < 70) {
    await page.waitForFunction(()=>GaiaMarineCod.getState().dataState==='ready');
    const def = await page.evaluate(()=>GaiaMarineCod.definition);
    const manifest = JSON.parse(fs.readFileSync(`data/${def.dataFile}`));
    const years = manifest.periods.map(p=>p.year);
    assert.equal(await page.locator('[data-cod-year]').getAttribute('min'),String(years[0]));
    assert.equal(await page.locator('[data-cod-year]').getAttribute('max'),String(years.at(-1)));
    for (const year of [...new Set([years[0],years[Math.floor(years.length/2)],years.at(-1)])]) {
     await page.locator('[data-cod-year]').fill(String(year));
     await page.locator('[data-cod-year]').dispatchEvent('input');
     await page.waitForFunction(y=>GaiaMarineCod.getState().year===y&&GaiaMarineCod.getState().dataState==='ready',year);
     const meta=manifest.periods.find(p=>p.year===year), period=manifest.schemaVersion===2?readAnnualPart(meta.file):meta;
     const point=period.stations.find(p=>Number.isFinite((p.cod||p.metrics?.[def.measurementKey]||p.measurement)?.value));
     assert.equal(await page.locator('#gaia-marine-cod-canvas').getAttribute('data-cod-point-count'),String(period.stations.length));
     await page.selectOption('[data-cod-prefecture]',point.prefCode);
     await page.selectOption('[data-cod-station]',point.id);
     await page.waitForFunction(()=>!document.querySelector('[data-cod-analysis]').disabled);
     const actual=await page.evaluate(()=>GaiaMarineCod.getStatisticsDataset());
     assert(actual?.rows.length>0,`${number}/${year} analysis`);
     const reading=point.cod||point.metrics?.[def.measurementKey]||point.measurement;
     assert.equal(await page.locator('[data-cod-value]').textContent(),`${reading.text} ${def.unit}`);
     if (number>=65&&number<=67) {
      assert.equal(actual.periodStart,year);assert.equal(actual.periodEnd,year);
      assert(actual.title.includes(`${year}年度`));
      await page.locator('[data-cod-records]').click();
      assert((await page.locator('#gaia-record-detail [data-record-kicker]').textContent()).includes(String(year)));
      await page.locator('[data-record-close]').click();
     } else {
      const expected=years.flatMap(y=>{
       // History comes from the same selected shard, no all-year browser fetch.
       const shard=manifest.historyShards?.[[...Buffer.from(point.id)].reduce((n,b)=>n+b,0)%64];
       const p=shard?readAnnualPart(shard.file)[point.id]?.[y]:manifest.periods.find(p=>p.year===y).stations.find(p=>p.id===point.id);
       const v=p?.cod||p?.measurement;
       return Number.isFinite(v?.value)?[{year:y,value:v.value}]:[];
      });
      assert.deepEqual(actual.rows.map(r=>({year:r.year,value:r.value})),expected);
     }
     report.checks.push({width,number,year,stations:period.stations.length,selectedId:point.id,analysisRows:actual.rows.length});
     if (year===years[0]&&[31,38,44,54,65,68,69].includes(number)) await page.screenshot({path:path.join(out,`${width}-${number}-oldest.png`)});
    }
    // Home/End are real keyboard operations, including non-contiguous years.
    if ([38,56,69].includes(number)) {
     await page.locator('[data-cod-year]').focus();await page.locator('[data-cod-year]').press('Home');
     await page.waitForFunction(y=>GaiaMarineCod.getState().year===y&&GaiaMarineCod.getState().dataState==='ready',years[0]);
     await page.locator('[data-cod-year]').press('ArrowRight');
     await page.waitForFunction(y=>GaiaMarineCod.getState().year===y&&GaiaMarineCod.getState().dataState==='ready',years[1]);
     await page.locator('[data-cod-year]').press('End');
     await page.waitForFunction(y=>GaiaMarineCod.getState().year===y&&GaiaMarineCod.getState().dataState==='ready',years.at(-1));
    }
   } else {
    await page.waitForFunction(()=>GaiaFoodExhibits.getState().dataState==='ready');
    const source=JSON.parse(fs.readFileSync(number===70?'data/fao-food-balances.json':'data/fao-food-security.json'));
    for (const series of source.series) {
     await page.selectOption('[data-food-series]',series.id);
     await page.selectOption('[data-food-country]','392');
     for (const period of [series.periods[0],series.periods[Math.floor(series.periods.length/2)],series.periods.at(-1)]) {
      const statusAtChange = await page.evaluate(key=>{GaiaFoodExhibits.setPeriod(key);return document.querySelector('[data-food-status]').textContent;},period.key);
      const row=period.rows.find(r=>r[0]==='392'), value=foodValue(number===70?'food-balances':'food-security',row);
      assert(statusAtChange.includes(foodRowSource(number===70?'food-balances':'food-security',row).label), 'Source status matches the selected period in the same render');
      assert.equal(await page.locator('[data-food-value]').textContent(),Number.isFinite(value)?`${foodFormat(value)} %`:'算出・数値なし');
      if(row?.[2]==='MAFF_DERIVED'||row?.[7]?.source?.id==='MAFF') assert((await page.locator('[data-food-quality]').textContent()).includes('農水省'));
      if(row?.[7]?.source?.id==='FBSH') assert((await page.locator('[data-food-quality]').textContent()).includes('旧方式'));
      report.checks.push({width,number,series:series.id,period:period.key,japanValue:value});
     }
    }
    await page.screenshot({path:path.join(out,`${width}-${number}-japan.png`)});
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,`${width}/${number} horizontal overflow`);
   console.log('PASS browser',width,number);
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);
 report.status='passed';
} catch(error) {
 report.status='failed';report.failure=error.stack;
 if(page) await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
 throw error;
} finally {
 fs.writeFileSync(path.join(out,process.env.HISTORY_REPORT||'report.json'),JSON.stringify(report,null,2));
 await browser.close();
}
