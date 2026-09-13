import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import fs from 'node:fs';
fs.mkdirSync('artifacts/entry-experience-20260912',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.goto('http://127.0.0.1:4492/#earth');
 const highlights=page.locator('[data-entry-title-skip]');await highlights.waitFor({state:'visible'});
 assert.equal(await highlights.getAttribute('aria-label'),'体験する');
 assert.equal(await highlights.locator('.entry-highlight-label').textContent(),'体験する');
 assert.equal(await highlights.locator('.entry-highlight-kicker').textContent(),'EXPERIENCE');
 assert.equal(await highlights.locator('.entry-highlight-orbit circle').count(),0);
 await highlights.screenshot({path:`artifacts/entry-experience-20260912/${width}.png`});
 const running=()=>page.locator('#japan-layer').evaluate(e=>e.classList.contains('is-map-title-transitioning'));
 await page.waitForTimeout(1000);assert(!(await running()),'separator behind entry title');
 await highlights.click();const start=page.locator('[data-feature-start]');await start.waitFor({state:'visible'});
 await page.waitForTimeout(1000);assert(!(await running()),'separator behind popup');
 await start.click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 await page.waitForFunction(()=>document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
 console.log(`PASS ${width}: separator waits for title and feature popup`);await page.close();
}}finally{await browser.close();}
