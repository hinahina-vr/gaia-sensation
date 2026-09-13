import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve('artifacts/map-unified-dock-20260912/numeric-reference');
fs.mkdirSync(output,{recursive:true});
const report={checks:[],errors:[],hashes:Object.fromEntries(['app.js','map-unified-dock.css'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const ctx=await browser.newContext({viewport:{width:3840,height:2160},reducedMotion:'reduce'});
 await enforceBrowserSecurity(ctx,base);await ctx.route('https://**',r=>r.abort());
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'/?exhibit=10#world',{waitUntil:'domcontentloaded'});
 await page.locator('[data-feature-start]').click();await page.evaluate(()=>GaiaMapDemo.stop());
 await page.waitForFunction(()=>document.querySelector('[data-map-dock-year]')?.textContent==='1945');
 const timeline=page.locator('.signal-console-map [data-signal-time]');
 await timeline.focus();await timeline.press('Home');
 // The existing 0–100 range advances by percentage, not one year per key.
 for(let i=0;i<7;i++)await timeline.press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('[data-map-dock-year]')?.textContent==='1950');
 const value=page.locator('.signal-console-map .signal-value-primary');
 assert.match(await value.textContent(),/^102\.5\s*Mt CO₂$/);
 await page.locator('.signal-console-map .has-dock-metric').screenshot({path:path.join(output,'102.5-tight.png')});
 await page.locator('.map-command-dock').screenshot({path:path.join(output,'10-dock.png')});
 report.checks.push({exhibit:10,year:1950,value:await value.textContent(),tracking:await value.evaluate(e=>getComputedStyle(e).letterSpacing)});
 for(const n of [15,20,21]){
  await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);
  await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);
  const action=page.locator('.gaia-map-action--analysis:visible');
  assert.equal(await action.isDisabled(),n<21,'Existing realtime analysis restriction is preserved');
  report.checks.push({exhibit:n,analysisDisabled:await action.isDisabled()});
 }
 await page.locator('.gaia-map-action--analysis:visible').click();
 await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
 assert.equal(await page.locator('#gaia-statistics-export-csv, #gaia-statistics-export-json, #gaia-statistics-export-png').count(),0);
 await page.screenshot({path:path.join(output,'21-analysis.png')});
 report.checks.push({annualAnalysis:await page.evaluate(()=>GaiaStatisticsLab.getState()),exportControls:0});
 assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
 assert.deepEqual(report.errors,[]);report.status='passed';
 console.log('PASS exact reference: Japan 1950, 102.5 Mt CO₂; live analysis restriction and 21 analysis preserved.');
}catch(e){report.status='failed';report.failure=e.stack;throw e;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
