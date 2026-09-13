import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
fs.mkdirSync('artifacts/live-map-font',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('https://**',r=>r.abort());await page.goto('http://127.0.0.1:4492/?exhibit=2#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 const badge=page.locator('.gaia-planet-signals-readout .gaia-broadcast-badge');await badge.waitFor({state:'visible'});
 // Exercise LIVE styling in the actual map DOM without claiming a live API result.
 await badge.evaluate(b=>{b.dataset.broadcastState='live';b.textContent='LIVE';});
 const font=await badge.evaluate(b=>getComputedStyle(b).fontFamily);
 assert(font.startsWith('Arial'),font);
 await badge.screenshot({path:`artifacts/live-map-font/${width}.png`});console.log('PASS',width,font);await page.close();
}}finally{await browser.close();}
