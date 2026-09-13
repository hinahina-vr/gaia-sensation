import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='artifacts/source-intro-20260913';fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
for(const width of [1440,390]) {
 const c=await b.newContext({viewport:{width,height:900},reducedMotion:'reduce'});await c.route('https://**',r=>r.abort());const p=await c.newPage();
 await p.goto('http://127.0.0.1:4492/#world-01');await p.locator('#gaia-boot').waitFor({state:'hidden'});
 await p.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));await p.locator('#japan-close').click();
 const section=p.locator('#intro-open-data-exhibit');await section.locator('.data-glossary-header').evaluate(n=>n.scrollIntoView({block:'start'}));
 await p.waitForTimeout(400);await p.screenshot({path:`${out}/sources-${width}.png`});
 assert.equal(await section.locator(':scope > .data-glossary-grid:not(.data-journey) .data-source-card').count(),3);
 const overview=section.locator(':scope > .data-glossary-grid:not(.data-journey)');
 await overview.locator('article').first().evaluate(n=>n.scrollIntoView({block:'start'}));await p.screenshot({path:`${out}/providers-${width}.png`});
 const arrow=section.locator('[data-novel-open] b');assert.equal(await arrow.textContent(),'▶');
 await arrow.scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/story-link-${width}.png`});
 for(const lang of ['en','zh-CN']) {
  await p.evaluate(l=>GaiaI18n.set(l),lang);await section.scrollIntoViewIfNeeded();await p.waitForTimeout(200);
  const text=await section.locator(':scope > .data-glossary-grid:not(.data-journey)').textContent();assert(!text.includes('展示では'));assert(!text.includes('衛星による'));
 }
 await c.close();
}
const p=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});await p.route('https://**',r=>r.abort());
await p.goto('http://127.0.0.1:4492/#story');await p.waitForFunction(()=>!!window.GaiaNovel);await p.evaluate(()=>GaiaNovel.open(null,{autoStartFresh:true}));
await p.waitForFunction(()=>document.querySelector('#novel-text')?.dataset.revealState==='complete');await p.locator('#novel-jump-button').click();await p.locator('[data-scene-id="ending"].novel-jump-item').click();
await p.locator('#novel-layer.is-staff-roll').waitFor();
assert.deepEqual(await p.locator('[data-credit-role="DATA SOURCES"] .novel-staff-roll-credit-name').allTextContents(),['NASA / NOAA / JAXA','FAO / World Bank / Open-Meteo','気象庁 / 環境省 / 総務省  ほか']);
console.log('PASS: source overview, JA/EN/ZH, triangle link, exact staff-credit lines');
}finally{await b.close();}
