import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/analysis-short-note-20260912';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report=[];
try {
  for(const width of [1440,390]) {
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    await page.route('https://**',r=>r.abort());
    await page.goto('http://127.0.0.1:4492/?exhibit=31#world');
    await page.waitForFunction(()=>!!window.GaiaModeLoader);
    await page.waitForFunction(()=>!!window.GaiaMapObservationAdapter);
    await page.locator('[data-feature-start]').click();
    await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
    await page.evaluate(async()=>{GaiaMapDemo?.stop();await GaiaModeLoader.load('statistics');await GaiaStatisticsLab.open({datasetId:'rainfall'});});
    await page.waitForFunction(()=>window.GaiaStatisticsLab?.getState().analysisReady);
    await page.locator('.gaia-statistics-insights-panel').evaluate(e=>e.open=true);
    const card=page.locator('.gaia-statistics-insight[data-kind="limitations"]');
    const lines=await card.locator('li').allTextContents();
    assert.equal(lines.length,3);
    assert(lines.every(t=>t.length<35));
    assert(!lines.join('').includes('年度別ID'));
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({path:`${out}/${width}.png`});
    assert(await card.evaluate(e=>e.scrollWidth<=e.clientWidth));
    report.push({width,lines});
    await page.close();
  }
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
  console.log('PASS: three short statements, desktop/mobile rendering');
} finally {await browser.close();}
