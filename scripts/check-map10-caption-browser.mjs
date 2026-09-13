import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
fs.mkdirSync('artifacts/map10-caption',{recursive:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('https://**',r=>r.abort());await page.goto('http://127.0.0.1:4492/?exhibit=10#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 await page.waitForFunction(()=>/年の排出量/.test(document.querySelector('#japan-overlay').dataset.selectionLabelDetail||''));
 const text=await page.locator('#japan-overlay').getAttribute('data-selection-label-detail');
 assert.match(text,/^\d{4}年の排出量$/);
 await page.screenshot({path:`artifacts/map10-caption/${width}.png`});console.log('PASS',width,text);await page.close();
}}finally{await browser.close();}
