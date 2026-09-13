import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const out='artifacts/map12-dock'; fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report=[];
try { for(const width of [1440,2560,390]) {
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:4492/?exhibit=12#world');
 await page.locator('[data-feature-start]').click();
 await page.waitForFunction(()=>document.querySelector('#japan-layer').classList.contains('is-ecologies-exhibit'));
 await page.waitForTimeout(8000);
 const consoleVisible=await page.locator('.map-command-dock .signal-console-map').isVisible();
 report.push({width,consoleVisible});
 await page.screenshot({path:`${out}/${process.env.QA_BEFORE?'before':'after'}-${width}.png`});
 if(!process.env.QA_BEFORE && width>900) assert(consoleVisible,'Country metrics and slider remain visible after ecology activation');
 if(!process.env.QA_BEFORE && width>900) {
  const slider=page.locator('.signal-console-map input[type="range"]').first();
  await slider.fill('25');
  assert.equal(await slider.inputValue(),'25','Manual country slider remains usable');
 }
 await page.close();
} fs.writeFileSync(`${out}/${process.env.QA_BEFORE?'before':'after'}.json`,JSON.stringify(report,null,2)); console.log(report);
} finally {await browser.close();}
