import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const stage=process.env.GAIA_LAKE_STAGE||'after';
const out=path.resolve(process.env.GAIA_LAKE_OUT||`artifacts/lake-gis-20261022/${stage}`);fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Local installed Chrome; real bundled water classifications; external requests blocked. Phone is emulated, not physical hardware.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const [width,height] of JSON.parse(process.env.GAIA_LAKE_SIZES||'[[1440,900],[390,844],[320,568]]')){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900});
  await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**/*',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
  page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-74`);
  await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');
  await page.evaluate(()=>GaiaModeEntryGuide.close('map',{restoreFocus:false}));
  await page.waitForFunction(()=>document.querySelector('#japan-layer').classList.contains('is-lake-detail')&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
  await page.evaluate(()=>GaiaMapPlayback.stop());await page.waitForTimeout(800);
  await page.screenshot({path:path.join(out,`${width}-74.png`)});
  if(stage!=='before'){
   const controls=async()=>{if(!await page.locator('[data-climate-year]').isVisible())await page.locator('#map-responsive-data > summary').click();};
   const closeControls=async()=>{const drawer=page.locator('#map-responsive-data');if(await drawer.isVisible()&&await drawer.getAttribute('open')!==null)await drawer.locator(':scope > summary').click();};
   const stable=()=>page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&GaiaClimateHistory.getLakeState().referenceReady);
   await stable();
   assert(Number(await page.locator('#japan-overlay').getAttribute('data-earth-zoom'))>8);
   assert.equal(await page.locator('#japan-overlay').evaluate(e=>getComputedStyle(e).opacity),'1');
   const boxes=await page.evaluate(()=>Object.fromEntries(['.gaia-climate-legend','#gaia-map-zoom-controls','.gaia-lake-view'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,{left:r.left,top:r.top,right:r.right,bottom:r.bottom}];})));
   const a=boxes['.gaia-climate-legend'],b=boxes['#gaia-map-zoom-controls'];
   assert(!(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top),'Legend must not overlap zoom controls');
   if(width===1440){
    // Inspect the actual rendered canvas at source-confirmed dry/missing
    // corners. A uniform alpha-18 footprint was visible here before the fix.
    const background=await page.evaluate(async()=>{
     const d=await(await fetch('./data/surface-water/lakes.json')).json(),region=d.regions.find(r=>r.id==='urmia');
     const read=async year=>{const image=new Image();image.src=`./data/surface-water/${region.years.find(r=>r.year===year).image}`;await image.decode();
      const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
      return{width:c.width,height:c.height,pixels:ctx.getImageData(0,0,c.width,c.height).data};};
     const current=await read(2010),reference=await read(2000),canvas=document.querySelector('.gaia-lake-view canvas'),ctx=canvas.getContext('2d');
     const r=GaiaClimateHistory.getLakeState().raster,box=canvas.getBoundingClientRect(),ratio=canvas.width/box.width,samples=[];
     const dry=(source,u,v)=>{const x=Math.floor(u*source.width),y=Math.floor(v*source.height);
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
       const red=source.pixels[((y+dy)*source.width+x+dx)*4];if(red===63||red===138)return false;
      }return true;};
     for(const u of [.02,.04,.96,.98])for(const v of [.02,.04,.96,.98]){
      if(!dry(current,u,v)||!dry(reference,u,v))continue;
      const x=(r.x+r.width*u)*ratio,y=(r.y+r.height*v)*ratio;
      if(x<0||y<0||x>=canvas.width||y>=canvas.height)continue;
      samples.push({u,v,alpha:ctx.getImageData(Math.floor(x),Math.floor(y),1,1).data[3]});
     }return samples;
    });
    assert(background.length>=4,'Need visible source-confirmed non-water corners');
    assert(background.every(p=>p.alpha<=12),`Raster corners must blend into map: ${JSON.stringify(background)}`);
    report.checks.push({width,transparentRasterCorners:background});
   }
   const location=await page.evaluate(()=>{const r=GaiaClimateHistory.getLakeState().raster,m=document.querySelector('#japan-map').getBoundingClientRect();return{x:m.left+r.x+r.width*.5,y:m.top+r.y+r.height*.3};});
   if(width<900)await page.touchscreen.tap(location.x,location.y);else await page.mouse.click(location.x,location.y);
   await page.waitForFunction(()=>!!GaiaClimateHistory.getLakeState().sample);
   const first=await page.evaluate(()=>GaiaClimateHistory.getLakeState().sample);
   assert.equal(first.year,2010);assert(first.referenceLabel);
   await page.locator('[data-lake-compare]').click();assert.equal(await page.locator('[data-lake-compare]').getAttribute('aria-pressed'),'false');
   await page.locator('[data-lake-compare]').click();assert.equal(await page.locator('[data-lake-compare]').getAttribute('aria-pressed'),'true');
   await controls();await page.locator('[data-climate-year]').fill('2015');await closeControls();
   await page.waitForFunction(()=>document.querySelector('.gaia-lake-view').dataset.renderedYear==='2015'&&document.querySelector('.gaia-lake-view').dataset.fade==='complete');
   const second=await page.evaluate(()=>GaiaClimateHistory.getLakeState().sample);
   assert.equal(second.year,2015);assert.equal(second.lon,first.lon);assert.equal(second.lat,first.lat);
   // Read the shipped PNG independently at that geographic position. No mock
   // station or fixture: the map's actual tap must return this source class.
   const expected=await page.evaluate(async s=>{
     const d=await (await fetch('./data/surface-water/lakes.json')).json(),r=d.regions.find(r=>r.id==='urmia'),row=r.years.find(y=>y.year===s.year);
     const img=new Image();img.src=`./data/surface-water/${row.image}`;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
     const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const [w,south,e,n]=r.bounds,x=Math.floor((s.lon-w)/(e-w)*img.width),y=Math.floor((n-s.lat)/(n-south)*img.height),red=ctx.getImageData(x,y,1,1).data[0];
     return red===63?'通年水域':red===138?'季節的水域':red===12?'水域外':'観測なし';
   },second);
   assert.equal(second.label,expected);report.checks.push({width,actualTap:first,samePositionNextYear:second,sourceClassVerified:true});
   await page.mouse.move(width-8,height-8);await page.screenshot({path:path.join(out,`${width}-74-compare.png`)});
   if(width===1440){
     const old=await page.evaluate(()=>GaiaClimateHistory.getLakeState().raster);
     await page.mouse.move(location.x,location.y);await page.mouse.down();await page.mouse.move(location.x+90,location.y+20,{steps:12});await page.mouse.up();await page.waitForTimeout(200);
     const moved=await page.evaluate(()=>GaiaClimateHistory.getLakeState().raster);assert(Math.abs(moved.x-old.x-90)<3);assert(Math.abs(moved.y-old.y-20)<3);
     await page.mouse.wheel(0,-160);await page.waitForTimeout(300);
     assert((await page.evaluate(()=>GaiaClimateHistory.getLakeState().raster.width))>moved.width);
     report.checks.push({width,panAndWheel:true});
   }
   await controls();await page.locator('[data-climate-overview]').click();await closeControls();await stable();
   assert.equal(await page.locator('#japan-layer').evaluate(e=>e.classList.contains('is-lake-detail')),false);
   if(width===1440)await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateVisibleCount==='3');
   await page.screenshot({path:path.join(out,`${width}-overview.png`)});
   for(const lake of ['great-salt','poopo']){
     await controls();await page.locator('[data-climate-point]').selectOption(lake);await closeControls();
     await page.waitForFunction(id=>document.querySelector('.gaia-lake-view').dataset.region===id&&GaiaClimateHistory.getLakeState().referenceReady,lake);await stable();
     await page.screenshot({path:path.join(out,`${width}-${lake}.png`)});
   }
   if(width===1440){
     await page.mouse.move(width-8,height-8);await page.waitForTimeout(600);
     const before=await page.evaluate(()=>GaiaClimateHistory.getLakeState().paintCount);await page.waitForTimeout(350);
     assert.equal(await page.evaluate(()=>GaiaClimateHistory.getLakeState().paintCount),before,'Idle lake must reuse the last painted frame');
     await page.locator('#gaia-map-zoom-reset').click();await stable();
     await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-lake-detail')&&document.querySelector('#gaia-climate-canvas').dataset.climateVisibleCount==='3');
     // Real world-map marker selection, not only the dropdown path.
     const point=await page.evaluate(async()=>{const {earthBaseScale,earthLongitudeToMapX}=await import('./src/exploration/world-projection.js?v=gaia-japan-center-1');const r=document.querySelector('#japan-map').getBoundingClientRect(),d=document.querySelector('#japan-overlay').dataset,s=earthBaseScale(r)*Number(d.earthZoom);return{x:r.left+(r.width-360*s)/2+Number(d.earthOffsetX)+earthLongitudeToMapX(-112.5)*s,y:r.top+(r.height-180*s)/2+Number(d.earthOffsetY)+(90-41.2)*s};});
     report.checks.push(await page.evaluate(p=>({worldPick:p,target:document.elementFromPoint(p.x,p.y)?.outerHTML.slice(0,180),hit:GaiaClimateHistory.findPoiAt(p.x,p.y,'mouse'),rect:GaiaMapObservationAdapter.getViewportRect()}),point));
     await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>GaiaClimateHistory.getState().selectedId==='great-salt');await stable();
     report.checks.push({idleRepaint:false,resetAndWorldPoiSelection:true});
   }
   report.checks.push({width,referenceToggle:true,overview:true,allThreeLakeCameras:true});
  }
  report.checks.push({width,height,stage});
  assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);await context.close();console.log('LAKE',stage,width);
 }
 report.status='passed';assert.deepEqual(report.errors,[]);
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
