import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
fs.mkdirSync('artifacts/map13-caption',{recursive:true});
try{for(const width of [1440,2560]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('https://**',r=>r.abort());await page.goto('http://127.0.0.1:4492/?exhibit=13#world');
 await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 const caption=page.locator('.signal-console-map [data-signal-act]');
 await caption.filter({hasText:'再生可能エネルギー発電割合'}).waitFor({state:'visible'});
 await page.waitForTimeout(8000);
 assert(await caption.isVisible());
 assert.match(await caption.textContent(),/再生可能エネルギー発電割合/);
 await page.screenshot({path:`artifacts/map13-caption/${width}.png`});console.log('PASS',width,await caption.textContent());await page.close();
}}finally{await browser.close();}
