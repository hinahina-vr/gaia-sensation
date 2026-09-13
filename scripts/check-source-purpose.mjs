import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await page.route('https://**',r=>r.abort());
await page.goto('http://127.0.0.1:4492/#world-28');
await page.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
await page.waitForFunction(()=>globalThis.GaiaEstatExhibits?.getStatisticsDataset(),null,{timeout:60000});
await page.locator('.gaia-map-action--source:visible').first().click();
await page.locator('#japan-data-panel').waitFor({state:'visible'});
await page.waitForTimeout(300);
assert.equal(await page.locator('.source-use-card').count(),5);
assert.match(await page.locator('.source-purpose-heading').textContent(),/表示・分析に使うデータ/);
assert.match(await page.locator('.map-base-sources').textContent(),/背景地図のタイル画像/);
assert.match(await page.locator('#data-ledger-sources').textContent(),/日照/);
fs.mkdirSync('artifacts/source-purpose',{recursive:true});
await page.locator('#japan-data-panel').screenshot({path:'artifacts/source-purpose/panel.png'});
await page.locator('#japan-data-close').click();
console.log('PASS real source button, analytical source, five purpose cards, close');
} finally {await browser.close();}
