import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const phase=process.env.GAIA_POLISH_PHASE||'after';
const modes=JSON.parse(process.env.GAIA_POLISH_MODES||'[75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100]');
const width=Number(process.env.GAIA_POLISH_WIDTH)||1440,height=width<900?844:900;
const out=`artifacts/motion-polish-20261028/${phase}-${width}`;
fs.mkdirSync(out,{recursive:true});
const previous=fs.existsSync(out+'/report.json')?JSON.parse(fs.readFileSync(out+'/report.json')):null;
const report={phase,width,checks:(previous?.checks||[]).filter(c=>!modes.includes(c.number)),errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,reducedMotion:'reduce'});
await context.route('https://**',r=>r.abort());
await context.addInitScript(()=>{
 sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');
 const get=HTMLCanvasElement.prototype.getContext;
 globalThis.__surfaceContexts=[];globalThis.__surfaceCanvases=[];
 HTMLCanvasElement.prototype.getContext=function(kind,...args){const ctx=get.call(this,kind,...args);if(!__surfaceCanvases.includes(this))__surfaceCanvases.push(this);if(kind==='webgl2'&&ctx&&!__surfaceContexts.includes(ctx))__surfaceContexts.push(ctx);return ctx;};
});
const page=await context.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(120000);
page.on('pageerror',e=>report.errors.push(e.message));
const ready=n=>page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number')?.textContent)===n&&globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas')?.dataset.climateArrival==='complete'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running',n);
const settled=()=>page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear===String(GaiaClimateHistory.getState().year)&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
const counters=s=>Object.fromEntries(['builds','baseBuilds','maskBuilds','uploads','textureCount','labelBuilds'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));
try{
 await page.goto((process.env.GAIA_BASE_URL||'http://127.0.0.1:4492')+'/world.html#world-'+modes[0],{waitUntil:'domcontentloaded'});
 for(const number of modes){
  await page.emulateMedia({reducedMotion:'reduce'});
  if(number!==modes[0])await page.evaluate(n=>location.hash='#world-'+n,number);
  await ready(number);await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaClimateHistory.setPlayback(false)});await settled();await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(200);
  const before=await page.evaluate(()=>({state:GaiaClimateHistory.getState(),render:GaiaClimateHistory.getRenderState(),rows:GaiaClimateHistory.getStatisticsDataset().rows}));
  assert.equal(before.render.engine,'webgl2',JSON.stringify(before.render));
  const fixed=await page.evaluate(()=>({draws:GaiaClimateHistory.getRenderState().draws,paint:GaiaClimateHistory.getRenderState().paintCount}));
  await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>({draws:GaiaClimateHistory.getRenderState().draws,paint:GaiaClimateHistory.getRenderState().paintCount})),fixed,'reduced motion must stay still');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(250);
  const a=await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas');globalThis.__polishPixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return GaiaClimateHistory.getRenderState()});
  await page.waitForTimeout(1200);
  const moving=await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let changed=0;for(let i=0;i<p.length;i+=16)if(Math.abs(p[i]-__polishPixels[i])+Math.abs(p[i+1]-__polishPixels[i+1])+Math.abs(p[i+2]-__polishPixels[i+2])>4)changed++;return {changed,render:GaiaClimateHistory.getRenderState(),width:document.documentElement.scrollWidth}});
  if(phase==='after')assert(moving.changed>0,`No motion: ${number}`);
  assert.deepEqual(counters(moving.render),counters(a),'steady animation must reuse observation textures and geometry');assert(moving.width<=width);
  if(phase==='after'&&width===1440&&[89,91].includes(number)){
   const land=await page.evaluate(()=>{
    const c=__surfaceCanvases.find(c=>c.dataset.geographicAtlasMask===GaiaClimateHistory.getState().id),v=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset;
    const scale=v.width/360*Number(d.earthZoom),x=(v.width-360*scale)/2+Number(d.earthOffsetX),y=(v.height-180*scale)/2+Number(d.earthOffsetY),ctx=c.getContext('2d');
    return [[0,-80],[30,-80],[90,-80]].map(([lon,lat])=>{const px=(x+((lon+390)%360)*scale)*c.width/v.width,py=(y+(90-lat)*scale)*c.height/v.height;ctx.save();ctx.resetTransform();const inside=ctx.isPointInPath(GaiaMapObservationAdapter.getCountryPath('ATA'),lon+180,90-lat,'evenodd');ctx.restore();return inside&&px>=0&&px<c.width&&py>=0&&py<c.height?ctx.getImageData(Math.floor(px),Math.floor(py),1,1).data[3]:null});
   });
   assert(land.some(a=>a!==null),'Antarctic land samples must be on screen');assert(land.filter(a=>a!==null).every(a=>a===0),'Ocean effect must not cover Antarctica: '+JSON.stringify(land));
  }
  await page.screenshot({path:`${out}/${number}.png`});
  // Exercise the real range input, then restore the original year for comparison.
  const slider=page.locator('[data-climate-year]');
  if(phase==='after'){
   await slider.focus();await page.keyboard.press('ArrowLeft');await settled();
   const year=await page.evaluate(()=>GaiaClimateHistory.getState().year);assert.notEqual(year,before.state.year);
   await page.evaluate(year=>GaiaClimateHistory.setYear(year),before.state.year);await settled();
   assert.deepEqual(await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset().rows),before.rows,'visual lighting must not alter analysis data');
  }
  if(phase==='after'&&width===1440&&number===75){
   await page.evaluate(()=>{const gl=__surfaceContexts.find(g=>g.canvas.width===720&&g.canvas.height===360);__polishLoss=gl.getExtension('WEBGL_lose_context');__polishLoss.loseContext()});
   await page.waitForFunction(()=>GaiaClimateHistory.getRenderState().engine==='canvas2d');
   await page.evaluate(()=>__polishLoss.restoreContext());await page.waitForFunction(()=>GaiaClimateHistory.getRenderState().engine==='webgl2');
   assert.deepEqual(await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset().rows),before.rows);
  }
  report.checks.push({number,engine:moving.render.engine,pixelsChanged:moving.changed,year:before.state.year,reducedMotion:true,cachedObservationUploads:true,render:moving.render});
  fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(`PASS ${phase} ${number} ${width}: ${moving.changed} changed samples`);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));fs.writeFileSync(`${out}/report-${modes[0]}-${modes.at(-1)}.json`,JSON.stringify(report,null,2));await browser.close();}
