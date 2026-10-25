import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL,out=path.resolve(process.env.GAIA_WATER_LIFECYCLE_OUT||'artifacts/water-storage-gis-20261022/lifecycle');fs.mkdirSync(out,{recursive:true});
const report={scope:'Local Chrome, actual data and controls; explicit network/context-loss failure injection',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
const settled=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&(GaiaClimateHistory.getState().id!=='waterstore'||document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'));
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});await enforceBrowserSecurity(context,base);await context.route('https://**/*',r=>r.abort());
 await context.addInitScript(()=>{
   sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');
   const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){const ctx=get.call(this,kind,...args);if(kind==='webgl2'&&this.width===720&&this.height===360)window.__waterGl=ctx;return ctx;};
   window.__waterIntro=[];const observe=()=>{const i=document.querySelector('#map-data-intro'),c=document.querySelector('#gaia-climate-canvas');if(i&&!i.hidden&&i.dataset.exhibitNumber==='75')window.__waterIntro.push({opacity:+getComputedStyle(i).opacity,visible:c?.checkVisibility({visibilityProperty:true})});requestAnimationFrame(observe);};requestAnimationFrame(observe);
 });
 page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
 const requests=[];page.on('request',r=>{if(r.url().includes('waterstore-grid'))requests.push(r.url());});
 await page.goto(base);await page.waitForTimeout(700);assert.equal(requests.length,0);
 await context.route('**/waterstore-grid.json?*',r=>r.abort());await page.goto(`${base}/world.html#world-75`);await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='error');
 await context.unroute('**/waterstore-grid.json?*');await page.locator('[data-climate-retry]').click();await page.locator('#map-data-intro').waitFor({state:'visible'});await page.mouse.click(700,400);await settled();await page.evaluate(()=>GaiaMapPlayback.stop());
 const intro=await page.evaluate(()=>__waterIntro);assert(intro.some(s=>s.opacity>0&&s.opacity<1));assert(!intro.some(s=>s.opacity>0.01&&s.visible));report.checks.push('Title requests no grid; failed grid retries; tap completes full intro fade before raster appears');
 // Check the softened display pixels at positive/negative locations across
 // the map cut. Selected source values are verified separately in the GIS test.
 const verifyPixels=async()=>page.evaluate(async()=>{
   const {decodeWaterGrid,waterCell,waterRgba}=await import('./src/exploration/water-storage-grid.js?v=water-gis-20261022');const {waterDisplayField}=await import('./src/exploration/water-storage-field.js?v=water-smooth-20261023');const grid=decodeWaterGrid(await(await fetch('./data/atlas-history/waterstore-grid.json')).json());
   const rect=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset,s=rect.width/360*Number(d.earthZoom),ox=(rect.width-360*s)/2+Number(d.earthOffsetX),oy=(rect.height-180*s)/2+Number(d.earthOffsetY),canvas=document.querySelector('#gaia-climate-canvas'),ratio=canvas.width/rect.width,ctx=canvas.getContext('2d');
   const year=GaiaClimateHistory.getState().year,yi=grid.years.indexOf(year),field=waterDisplayField(grid,year);
   // Resampling blends nearby texels. Compare GPU output with a CPU colour
   // raster resampled by the browser at this camera, not with one centre texel.
   const source=document.createElement('canvas');source.width=720;source.height=360;const sc=source.getContext('2d'),image=sc.createImageData(720,360);
   for(let i=0;i<field.length;i++)if(field[i]<90000)image.data.set(waterRgba(field[i]>80000?null:field[i]),i*4);sc.putImageData(image,0,0);
   const reference=document.createElement('canvas');reference.width=canvas.width;reference.height=canvas.height;const rc=reference.getContext('2d');rc.setTransform(ratio,0,0,ratio,0,0);rc.imageSmoothingEnabled=true;rc.imageSmoothingQuality='high';
   for(let copy=-1;copy<=1;copy++){const x=ox+copy*360*s;rc.drawImage(source,300,0,420,360,x,oy,210*s,180*s);rc.drawImage(source,0,0,300,360,x+210*s,oy,150*s,180*s);}
   // Keep raster probes outside the POI glyphs and their signed-value labels.
   return [[88.25,22.25],[-52.25,-11.25],[28.25,-12.25],[120.25,-24.25]].map(([lon,lat])=>{const cell=waterCell(grid,lon,lat),raw=grid.series[cell.series][yi],value=field[cell.y*grid.width+cell.x],x=Math.floor((ox+((lon+390)%360)*s)*ratio),y=Math.floor((oy+(90-lat)*s)*ratio);return{lon,lat,sourceValue:raw===null?null:raw*grid.scale,displayValue:value>80000?null:value,expected:[...rc.getImageData(x,y,1,1).data],actual:[...ctx.getImageData(x,y,1,1).data]};});
 });
 const gpuPixels=await verifyPixels();for(const p of gpuPixels)for(let i=0;i<4;i++)assert(Math.abs(p.actual[i]-p.expected[i])<5,JSON.stringify(p));
 const loss=await page.evaluate(()=>{window.__waterLoss=window.__waterGl.getExtension('WEBGL_lose_context');__waterLoss.loseContext();return !!__waterLoss;});assert(loss);await page.waitForFunction(()=>GaiaClimateHistory.getWaterState().engine==='canvas2d');
 const fallbackPixels=await verifyPixels();for(const p of fallbackPixels)for(let i=0;i<4;i++)assert(Math.abs(p.actual[i]-p.expected[i])<5,JSON.stringify(p));await page.screenshot({path:path.join(out,'fallback.png')});
 await page.evaluate(()=>__waterLoss.restoreContext());await page.waitForFunction(()=>GaiaClimateHistory.getWaterState().engine==='webgl2');report.checks.push({gpuDisplayPixels:gpuPixels,fallbackDisplayPixels:fallbackPixels,contextRestored:true});
 for(const y of [2024,2018,2016]){
   await page.locator('[data-climate-year]').fill(String(y));await page.waitForFunction(y=>GaiaClimateHistory.getWaterState().textureYear===y&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete',y);
   const pixels=await verifyPixels();for(const p of pixels)for(let i=0;i<4;i++)assert(Math.abs(p.actual[i]-p.expected[i])<5,JSON.stringify({year:y,...p}));report.checks.push({year:y,smoothedDisplayPixels:pixels});
 }
 await page.locator('[data-climate-point]').selectOption('india');await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().selectedId),'india');
 await page.locator('[data-climate-year]').fill('2024');await page.locator('[data-climate-year]').fill('2008');await page.locator('[data-climate-year]').fill('2016');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2016'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
 await page.locator('#gaia-map-playback-toggle').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2017);await page.locator('#gaia-map-playback-toggle').click();
 await page.locator('#gaia-map-cruise-toggle').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2003);await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2004);await page.locator('#gaia-map-cruise-toggle').click();report.checks.push('Regional zoom; rapid scrub; autoplay and cruising year advancement');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-climate-year]').fill('2024');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2024');assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-year-fade'),'complete');
 await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='sealevel'&&GaiaClimateHistory.getState().dataState==='ready');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getWaterState().texturePixels),0);report.checks.push('Reduced motion; next to 76 frees raster');
 // New document clears cache. Slow real response must not resurrect 75.
 await context.route('**/waterstore-grid.json?*',async r=>{await new Promise(resolve=>setTimeout(resolve,900));await r.continue();});await page.goto(`${base}/world.html#world-76`);await settled();
 await page.evaluate(()=>{void GaiaClimateHistory.select('waterstore');void GaiaClimateHistory.select('sealevel');});await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().id),'sealevel');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getWaterState().texturePixels),0);
 report.checks.push('Late grid response leaves the new exhibition intact');assert.deepEqual(report.errors,[]);assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);report.status='passed';await context.close();
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
