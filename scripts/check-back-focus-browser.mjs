import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
fs.mkdirSync('artifacts/back-focus',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('https://**',r=>r.abort());await page.goto('http://127.0.0.1:4492/?exhibit=17#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 const back=page.locator('#japan-close');await back.focus();
 const s=await back.evaluate(b=>({outline:getComputedStyle(b).outlineStyle,shadow:getComputedStyle(b).boxShadow}));
 assert.equal(s.outline,'none');assert(s.shadow.includes('inset'));
 await back.screenshot({path:`artifacts/back-focus/${width}.png`});console.log('PASS',width);await page.close();
}}finally{await browser.close();}
