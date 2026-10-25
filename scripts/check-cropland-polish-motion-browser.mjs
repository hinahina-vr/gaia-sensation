import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {recordCoralMotion as recordBrowserMotion} from './lib/record-coral-motion.mjs';
const out=path.resolve('artifacts/cropland-polish-20261023/motion');fs.mkdirSync(out,{recursive:true});
const data=JSON.parse(fs.readFileSync('data/atlas-history/cropland.json'));
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Local actual snapshots and recorded installed Chrome frames; external requests blocked',errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__cropPaints=[];
    const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(s,...args){if(s==='＋4.3 pt'&&__cropPaints.length<300)__cropPaints.push(this.globalAlpha);return fill.call(this,s,...args);};
  });
  page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  const stable=async()=>{await page.waitForTimeout(100);await page.waitForFunction(()=>GaiaClimateHistory.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(120);};
  const selected=()=>page.evaluate(()=>GaiaClimateHistory.getRenderState().croplandComparisons.find(p=>p.selected));
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-82`);await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>GaiaMapPlayback.stop());await stable();
  const fade=await page.evaluate(()=>__cropPaints);assert(fade.some(a=>a>0&&a<.8)&&fade.includes(1));report.actualCanvasFade=fade;
  if(process.env.GAIA_FFMPEG){const capture=recordBrowserMotion(page,path.join(out,'82-years.mp4'),8);for(const year of [2000,2008,2016,2024,2016]){await page.locator('[data-climate-year]').fill(String(year));await stable();await page.waitForTimeout(750);}report.video=await capture;}
  await page.screenshot({path:path.join(out,'1440-82-comparison.png')});
  const legend=page.locator('.gaia-climate-legend'),before=await legend.boundingBox();await page.mouse.move(before.x+45,before.y+18);await page.mouse.down();await page.mouse.move(before.x-380+45,before.y+18+45,{steps:16});await page.mouse.up();await stable();assert(Math.abs(before.x-(await legend.boundingBox()).x)>200);
  const blocked=await page.evaluate(()=>{const r=document.querySelector('#gaia-climate-canvas').getBoundingClientRect(),l=document.querySelector('.gaia-climate-legend').getBoundingClientRect();return GaiaClimateHistory.getRenderState().croplandComparisons.filter(p=>p.bounds.left+r.left<l.right&&p.bounds.right+r.left>l.left&&p.bounds.top+r.top<l.bottom&&p.bounds.bottom+r.top>l.top);});assert.deepEqual(blocked,[]);assert(await selected());report.legendDragClearance=true;
  await page.screenshot({path:path.join(out,'1440-82-legend-moved.png')});const moved=await legend.boundingBox();await page.mouse.move(moved.x+45,moved.y+18);await page.mouse.down();await page.mouse.move(before.x+45,before.y+18,{steps:16});await page.mouse.up();await stable();
  for(const [id,year] of [['GMB',2024],['LTU',2003],['BGD',2016]]){
    await page.locator('[data-climate-point]').selectOption(id);await page.locator('[data-climate-year]').fill(String(year));await stable();const p=await selected(),r=data.regions.find(r=>r.id===id),value=r.years.find(r=>r.year===year).value,base=r.years.find(r=>r.year===2000).value;
    assert.equal(p?.id,id);assert.equal(p.basePosition,base/100);assert.equal(p.currentPosition,value/100);assert.equal(p.change,Math.round((value-base)*10000)/10000);assert(p.currentPosition>=0&&p.currentPosition<=1);(report.commonScale??=[]).push({id,year,reading:p});await page.screenshot({path:path.join(out,`1440-82-${id}.png`)});
  }
  for(const id of ['SSD','PSE']){
    await page.locator('[data-climate-point]').selectOption(id);await page.locator('[data-climate-year]').fill('2016');await stable();
    const p=await selected();assert.equal(p?.id,id);assert.equal(p.value,data.regions.find(r=>r.id===id).years.find(y=>y.year===2016).value);
    const hit=await page.evaluate(id=>{const p=GaiaClimateHistory.getRenderState().croplandComparisons.find(p=>p.id===id),r=document.querySelector('#gaia-climate-canvas').getBoundingClientRect();for(const dy of [0,-2,2,-5,5])for(const dx of [0,-2,2,-5,5]){const x=r.left+p.anchor.x+dx,y=r.top+p.anchor.y+dy;if(GaiaClimateHistory.findPoiAt(x,y,'mouse')?.record.id===id&&!document.elementFromPoint(x,y)?.closest('button,select,.gaia-climate-legend,.gaia-climate-readout'))return{x,y};}return null;},id);assert(hit,`${id} geographic target`);
    await page.evaluate(()=>GaiaClimateHistory.selectPoint('ETH',{focus:false}));await stable();await page.mouse.click(hit.x,hit.y);await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,id);await stable();(report.geographicAliasClicks??=[]).push({id,hit});
  }
  await page.locator('[data-climate-point]').selectOption('SSD');await stable();const missingBase=await selected();assert.equal(missingBase.change,null);assert.equal(missingBase.basePosition,null);assert(missingBase.currentPosition>0);
  await page.locator('[data-cropland-mode="share"]').click();await stable();assert.equal((await selected()).mode,'share');assert.equal((await selected()).value,missingBase.value);report.missingBase=missingBase;await page.screenshot({path:path.join(out,'1440-82-missing-base.png')});
  await page.locator('[data-climate-point]').selectOption('NIC');await page.locator('[data-climate-year]').fill('2024');await stable();const missing=await selected();assert.equal(missing.currentPosition,null);assert(missing.basePosition>0);report.missingCurrent=missing;await page.screenshot({path:path.join(out,'1440-82-missing-current.png')});
  const paints=await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count');await page.waitForTimeout(500);assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count'),paints);report.idleCached=true;
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')});throw e;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
