import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/map-guide-api-note-20260912';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:4492/#earth');
 const card=page.locator('#gaia-mode-entry-guide[data-mode="map"] .gaia-feature-card').nth(2);
 await card.waitFor({state:'visible'});
 const lines=(await card.locator('.gaia-feature-card-copy > span').textContent()).split('\n');
 assert.equal(lines.length,3);assert.equal(lines[2],'※ AIへの質問には、ご自身のAPIキーが必要です。');
 assert(!(await page.locator('[data-feature-note]').isVisible()));
 await card.scrollIntoViewIfNeeded();await card.screenshot({path:`${out}/${width}.png`});
 console.log(`PASS ${width}: third copy line and hidden note band`);await page.close();
}}finally{await browser.close();}
