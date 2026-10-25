import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {recordCoralMotion as recordBrowserMotion} from './lib/record-coral-motion.mjs';
import {countrySourceId} from '../src/exploration/country-source-ids.js';
const out=path.resolve('artifacts/water-stress-polish-20261023/motion');fs.mkdirSync(out,{recursive:true});
const data=JSON.parse(fs.readFileSync('data/atlas-history/waterstress.json'));
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Local actual snapshots and recorded installed Chrome frames. External requests blocked.',errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__stressPaints=[];
    const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(s,...args){if(s==='110.5%'&&__stressPaints.length<300)__stressPaints.push(this.globalAlpha);return fill.call(this,s,...args);};
  });
  page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  const stable=async()=>{await page.waitForTimeout(100);await page.waitForFunction(()=>GaiaClimateHistory.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(120);};
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-81`);await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>GaiaMapPlayback.stop());await stable();
  const fade=await page.evaluate(()=>__stressPaints);assert(fade.some(a=>a>0&&a<.8)&&fade.includes(1));report.actualCanvasFade=fade;
  const geometryIds=new Set((await page.evaluate(()=>GaiaMapObservationAdapter.getCountryGeometry().countries.map(s=>s.iso3))).map(countrySourceId));
  const expected=data.regions.filter(r=>geometryIds.has(r.id)&&r.years.find(y=>y.year===2016)?.value>100).map(r=>r.id).sort();assert.deepEqual((await page.evaluate(()=>GaiaClimateHistory.getRenderState().stressHatched)).sort(),expected);report.hatchMatchesSource=expected;
  if(process.env.GAIA_FFMPEG){const capture=recordBrowserMotion(page,path.join(out,'81-years.mp4'),8);for(const year of [2000,2008,2016,2022,2016]){await page.locator('[data-climate-year]').fill(String(year));await stable();await page.waitForTimeout(750);}report.video=await capture;}
  await page.screenshot({path:path.join(out,'1440-81-balance.png')});
  const legend=page.locator('.gaia-climate-legend'),before=await legend.boundingBox();await page.mouse.move(before.x+45,before.y+18);await page.mouse.down();await page.mouse.move(before.x-380+45,before.y+18+45,{steps:16});await page.mouse.up();await stable();assert(Math.abs(before.x-(await legend.boundingBox()).x)>200);
  const blocked=await page.evaluate(()=>{const r=document.querySelector('#gaia-climate-canvas').getBoundingClientRect(),l=document.querySelector('.gaia-climate-legend').getBoundingClientRect();return GaiaClimateHistory.getRenderState().stressMarks.filter(p=>p.bounds.left+r.left<l.right&&p.bounds.right+r.left>l.left&&p.bounds.top+r.top<l.bottom&&p.bounds.bottom+r.top>l.top);});assert.deepEqual(blocked,[]);report.legendDragClearance=true;
  await page.screenshot({path:path.join(out,'1440-81-legend-moved.png')});const moved=await legend.boundingBox();await page.mouse.move(moved.x+45,moved.y+18);await page.mouse.down();await page.mouse.move(before.x+45,before.y+18,{steps:16});await page.mouse.up();await stable();
  await page.locator('[data-climate-point]').selectOption('KWT');await page.locator('[data-climate-year]').fill('2022');await stable();
  const high=await page.evaluate(()=>GaiaClimateHistory.getRenderState().stressMarks.find(p=>p.selected));assert.equal(high.value,3850.5);assert.equal(high.max,5000);assert(Math.abs(high.withdrawal/high.resource-38.505)<1e-12);report.extremeRatio=high;await page.screenshot({path:path.join(out,'1440-81-extreme.png')});
  for(const id of ['SSD','PSE']){
    await page.locator('[data-climate-point]').selectOption(id);await page.locator('[data-climate-year]').fill('2016');await stable();
    const mark=await page.evaluate(()=>GaiaClimateHistory.getRenderState().stressMarks.find(p=>p.selected));assert.equal(mark?.id,id);assert.equal(mark.value,data.regions.find(r=>r.id===id).years.find(y=>y.year===2016).value);
    const hit=await page.evaluate(id=>{const p=GaiaClimateHistory.getRenderState().stressMarks.find(p=>p.id===id),r=document.querySelector('#gaia-climate-canvas').getBoundingClientRect();for(const dy of [0,-2,2,-5,5])for(const dx of [0,-2,2,-5,5]){const x=r.left+p.anchor.x+dx,y=r.top+p.anchor.y+dy;if(GaiaClimateHistory.findPoiAt(x,y,'mouse')?.record.id===id&&!document.elementFromPoint(x,y)?.closest('button,select,.gaia-climate-legend,.gaia-climate-readout'))return{x,y};}return null;},id);assert(hit,`${id} retains its own geographic hit target`);
    await page.evaluate(()=>GaiaClimateHistory.selectPoint('EGY',{focus:false}));await stable();await page.mouse.click(hit.x,hit.y);await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,id);await stable();(report.geographicAliasClicks??=[]).push({id,hit});
  }
  await page.locator('[data-climate-point]').selectOption('ISR');await page.locator('[data-climate-year]').fill('2022');await stable();
  const missing=await page.evaluate(()=>GaiaClimateHistory.getRenderState().stressMarks.find(p=>p.selected));assert.equal(missing.value,null);assert.equal(missing.withdrawal,null);assert(!(await page.evaluate(()=>GaiaClimateHistory.getRenderState().stressHatched)).includes('ISR'));assert.equal(await page.locator('[data-stress-value]').textContent(),'欠測');report.missing=missing;await page.screenshot({path:path.join(out,'1440-81-missing.png')});
  const paints=await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count');await page.waitForTimeout(500);assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count'),paints);report.idleCached=true;
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')});throw e;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
