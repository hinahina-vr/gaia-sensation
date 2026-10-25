import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {recordCoralMotion as recordBrowserMotion} from './lib/record-coral-motion.mjs';
const out=path.resolve('artifacts/drinking-polish-20261023/motion');fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Local installed Chrome. Actual bundled data and browser frames; external requests blocked.',errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__drinkingPaints=[];
    const fill=CanvasRenderingContext2D.prototype.fillText;
    // The map is first painted into an offscreen backing canvas without an ID.
    CanvasRenderingContext2D.prototype.fillText=function(s,...args){if(s==='＋22.1 pt'&&__drinkingPaints.length<300)__drinkingPaints.push(this.globalAlpha);return fill.call(this,s,...args);};
  });
  const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  const stable=()=>page.waitForFunction(()=>GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-78`);await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>GaiaMapPlayback.stop());await stable();
  const fade=await page.evaluate(()=>__drinkingPaints);report.fadeSamples=fade;assert(fade.some(a=>a>0&&a<.8)&&fade.includes(1));report.actualCanvasFade=true;
  if(process.env.GAIA_FFMPEG){
    const capture=recordBrowserMotion(page,path.join(out,'78-years.mp4'),8);
    for(const year of [2000,2008,2016,2024,2016]){await page.locator('[data-climate-year]').fill(String(year));await stable();await page.waitForTimeout(850);}
    report.video=await capture;
  }
  await page.screenshot({path:path.join(out,'1440-78-comparison.png')});
  // The shared controller must still leave the new sea surface alive, then
  // release it when returning to the static national comparison.
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-76`);await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='sealevel'&&GaiaClimateHistory.getState().dataState==='ready');await page.evaluate(()=>GaiaMapPlayback.stop());await stable();
  const before=await page.evaluate(()=>GaiaClimateHistory.getSeaState());await page.waitForTimeout(500);const after=await page.evaluate(()=>GaiaClimateHistory.getSeaState());
  assert(after.surface.draws>before.surface.draws);assert.equal(after.stationsLoaded,492);assert(after.surface.landMasked);report.related76={engine:after.engine,stations:after.stationsLoaded,moving:true};
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-78`);await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='drinking'&&GaiaClimateHistory.getState().dataState==='ready');await page.evaluate(()=>GaiaMapPlayback.stop());await stable();
  assert.equal(await page.locator('[data-drinking-country]').textContent(),'インド');const paints=await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count');await page.waitForTimeout(500);assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count'),paints);report.return78IdleCached=true;
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;throw e;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
