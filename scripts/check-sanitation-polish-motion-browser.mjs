import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {recordCoralMotion as recordBrowserMotion} from './lib/record-coral-motion.mjs';
const out=path.resolve('artifacts/sanitation-polish-20261023/motion');fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Local installed Chrome. Bundled official observations and actual browser frames; external requests blocked.',errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__sanitationPaints=[];
    const fill=CanvasRenderingContext2D.prototype.fillText;
    // The map is rendered through a backing canvas without an element ID.
    CanvasRenderingContext2D.prototype.fillText=function(s,...args){if(s==='44.9%'&&__sanitationPaints.length<300)__sanitationPaints.push(this.globalAlpha);return fill.call(this,s,...args);};
  });
  const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  // Mode changes schedule the next 24fps map paint; the previous frame can
  // still say "complete" until that paint starts the new crossfade.
  const stable=async()=>{await page.waitForTimeout(100);await page.waitForFunction(()=>GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(120);};
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-79`);await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>GaiaMapPlayback.stop());await stable();
  const fade=await page.evaluate(()=>__sanitationPaints);report.fadeSamples=fade;assert(fade.some(a=>a>0&&a<.8)&&fade.includes(1));report.actualCanvasFade=true;
  if(process.env.GAIA_FFMPEG){
    const capture=recordBrowserMotion(page,path.join(out,'79-years.mp4'),8);
    for(const year of [2000,2008,2016,2024,2016]){await page.locator('[data-climate-year]').fill(String(year));await stable();await page.waitForTimeout(850);}
    report.video=await capture;
  }
  await page.screenshot({path:path.join(out,'1440-79-composition.png')});
  // Move the real legend into the former selected composition's space.
  const legend=page.locator('.gaia-climate-legend'),before=await legend.boundingBox();
  await page.mouse.move(before.x+40,before.y+18);await page.mouse.down();await page.mouse.move(before.x-370+40,before.y+90+18,{steps:16});await page.mouse.up();await stable();
  const after=await legend.boundingBox();assert(Math.abs(before.x-after.x)>200);
  const blocked=await page.evaluate(()=>{const r=document.querySelector('#gaia-climate-canvas').getBoundingClientRect(),l=document.querySelector('.gaia-climate-legend').getBoundingClientRect();return GaiaClimateHistory.getRenderState().sanitationMarks.filter(p=>p.bounds.left+r.left<l.right&&p.bounds.right+r.left>l.left&&p.bounds.top+r.top<l.bottom&&p.bounds.bottom+r.top>l.top);});assert.deepEqual(blocked,[]);report.legendDragClearance=true;
  await page.screenshot({path:path.join(out,'1440-79-legend-moved.png')});
  await page.locator('[data-climate-point]').selectOption('ARG');await stable();await page.locator('[data-sanitation-mode="open"]').click();await stable();
  const missing=await page.evaluate(()=>GaiaClimateHistory.getRenderState().sanitationMarks.find(p=>p.selected));assert.equal(missing.id,'ARG');assert.equal(missing.value,null);assert.deepEqual(missing.segments,[]);assert.equal(await page.locator('[data-climate-value]').textContent(),'欠測');report.missingComposition=missing;
  await page.screenshot({path:path.join(out,'1440-79-missing.png')});
  await page.locator('[data-climate-point]').selectOption('IND');await page.locator('[data-sanitation-mode="safe"]').click();await stable();
  const paints=await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count');await page.waitForTimeout(500);assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count'),paints);report.idleCached=true;
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;throw e;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
