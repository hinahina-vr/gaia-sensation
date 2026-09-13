import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
for(const width of [1440,390]) {
const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
await page.route('https://**',r=>r.abort());
await page.goto('http://127.0.0.1:4492/#world-28');
await page.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
await page.locator('#japan-close').click();
assert.equal(await page.locator('#intro-gx-feature').count(),0);
await page.locator('#intro-lp-scroll').click();
await page.waitForTimeout(100);
await page.locator('#intro-architecture-jump').click();
const sources=page.locator('#intro-open-data-exhibit');
await sources.locator('.data-glossary-header').evaluate(n=>n.scrollIntoView({block:'start'}));
assert(await sources.evaluate(n=>n.getBoundingClientRect().top<document.querySelector('.architecture-header').getBoundingClientRect().top),'Sources precede architecture');
const cards=sources.locator(':scope > .data-glossary-grid:not(.data-journey) .data-source-card');
assert.equal(await cards.count(),8);
assert.match(await cards.nth(2).textContent(),/総務省統計局.*人口移動/s);
assert.match(await cards.nth(3).textContent(),/環境省.*水質/s);
assert.equal(await cards.nth(3).locator('a').count(),1);
fs.mkdirSync('artifacts/source-order',{recursive:true});
await page.screenshot({path:`artifacts/source-order/header-${width}.png`});
await cards.nth(2).scrollIntoViewIfNeeded();
await page.screenshot({path:`artifacts/source-order/domestic-${width}.png`});
const copy=page.locator('.architecture-copy-grid');
await copy.evaluate(n=>n.scrollIntoView({block:'start'}));
assert(await copy.locator('li p').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=17));
assert(await copy.locator('strong').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=19));
assert(await copy.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'Reading copy has no horizontal overflow');
await page.screenshot({path:`artifacts/source-order/architecture-${width}.png`});
await page.close();
}
console.log('PASS sources first, eight provider cards, desktop/mobile actual output');
}finally{await browser.close();}
