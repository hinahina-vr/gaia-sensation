import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir='artifacts/terms-icon-20260913';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await page.route('https://**',r=>r.abort());
  await page.goto('http://127.0.0.1:4492/#world-28');
  await page.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
  await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
  await page.locator('#japan-close').click();
  const button=page.locator('#intro-terms-open');
  await button.scrollIntoViewIfNeeded();
  assert.equal(await button.locator('svg').count(),1);
  assert(!(await button.textContent()).includes('§'));
  await button.screenshot({path:`${dir}/button-${width}.png`});
  await button.locator('svg').click();
  assert(await page.locator('#site-terms').evaluate(n=>n.open));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#site-terms').evaluate(n=>n.open),false);
  assert(await button.evaluate(n=>n===document.activeElement));
  await page.keyboard.press('Enter');
  assert(await page.locator('#site-terms').evaluate(n=>n.open));
  await page.locator('[data-terms-close]').click();
  await page.close();
 }
 console.log('PASS terms document/check icon at 1440 and 390; SVG click, keyboard opening, Escape and focus return');
} finally {await browser.close();}
