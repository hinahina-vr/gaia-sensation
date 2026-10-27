import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {chromium} from 'playwright-core';
const out='artifacts/drinking-motion-20261026';fs.mkdirSync(out,{recursive:true});const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const report={baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Installed local headless Chrome; real bundled drinking-water data and Natural Earth polygons; emulated phones; no production or live API verification.',checks:[],errors:[]};
const selectedWidth=Number(process.env.GAIA_DRINKING_WIDTH)||0;
if(selectedWidth&&fs.existsSync(out+'/report.json'))report.checks=JSON.parse(fs.readFileSync(out+'/report.json')).checks.filter(check=>check.width!==selectedWidth);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{for(const[width,height,cpu]of[[1440,900,false],[390,844,false],[320,740,true]].filter(c=>!selectedWidth||c[0]===selectedWidth)){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<901,hasTouch:width<901});await context.route('https://**',r=>r.abort());
 await context.addInitScript(cpu=>{
  sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');
  const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'&&this.dataset.drinkingMotion){if(cpu)return null;return window.__waterGL=get.call(this,type,...args)}return get.call(this,type,...args)};
 },cpu);
 page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().id==='drinking'&&GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&GaiaClimateHistory.getRenderState().paintCount>0);
 const settled=()=>page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear===String(GaiaClimateHistory.getState().year));
 await page.goto(base+'/world.html#world-78');await ready();await page.evaluate(()=>GaiaMapPlayback.stop());await page.locator('[data-drinking-service="safe"]').click();await settled();
 const start=await page.evaluate(()=>GaiaClimateHistory.getRenderState());assert.equal(start.engine,cpu?'unavailable':'webgl2');assert.equal(start.error,'');assert.equal(start.textLayer.engine,'svg');assert(start.width*start.height<=1002000);
 await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas');window.__waterPixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data});await page.waitForTimeout(1400);
 const motion=await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let changed=0,total=0;for(let i=0;i<pixels.length;i+=16){total++;if(Math.abs(pixels[i]-__waterPixels[i])+Math.abs(pixels[i+1]-__waterPixels[i+1])+Math.abs(pixels[i+2]-__waterPixels[i+2])>8)changed++}return{changed,total,state:GaiaClimateHistory.getRenderState()}});
 if(cpu){assert.equal(motion.state.draws,0);assert.equal(motion.changed,0)}else{assert(motion.changed>500,JSON.stringify(motion));assert(motion.state.draws>start.draws);assert.equal(motion.state.uploads,start.uploads);assert.equal(motion.state.builds,start.builds);assert.equal(motion.state.textLayer.updates,start.textLayer.updates)}
 await page.screenshot({path:`${out}/${width}-${cpu?'cpu':'gpu'}-national.png`});
 // Existing SVG labels still resolve to the same country while the water moves.
 const label=await page.evaluate(()=>GaiaClimateHistory.getRenderState().drinkingReadings.find(r=>r.selected));assert(label);
 const rect=await page.locator('#gaia-climate-canvas').boundingBox(),point={x:rect.x+label.anchor.x,y:rect.y+label.anchor.y};
 assert.equal(await page.evaluate(p=>GaiaClimateHistory.findPoiAt(p.x,p.y,'mouse')?.record.id,point),label.id);
 await page.evaluate(()=>GaiaClimateHistory.selectPoint('BGD',{focus:false}));await settled();
 const target=await page.evaluate(id=>{
  for(let y=190;y<innerHeight-70;y+=8)for(let x=60;x<innerWidth-12;x+=8){const element=document.elementFromPoint(x,y);if(element&&!element.closest('button,select,input,summary,.gaia-climate-legend,.gaia-climate-readout,#map-responsive-data,#map-mobile-bottom')&&GaiaClimateHistory.findPoiAt(x,y,'touch')?.record.id===id)return{x,y}}
 },label.id);assert(target,'An unobscured country polygon remains selectable');
 if(width<901)await page.touchscreen.tap(target.x,target.y);else await page.mouse.click(target.x,target.y);await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,label.id);
 await page.evaluate(()=>GaiaClimateHistory.setYear(2024));await settled();assert.match(await page.locator('[data-drinking-national]').textContent(),/76.4/);
 await page.locator('button[data-drinking-mode="gap"]').click();await settled();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getDrinkingState().mode),'gap');const dataset=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert.equal(dataset.id,'climate-drinking-IND-gap');assert.equal((await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),dataset.id)).rows.length,dataset.rows.length);
 await page.screenshot({path:`${out}/${width}-${cpu?'cpu':'gpu'}-gap.png`});
 // Japan has genuine national data but no urban/rural pair: preserve fallback.
 await page.evaluate(()=>GaiaClimateHistory.selectPoint('JPN'));await ready();await settled();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getDrinkingState().mode),'national');assert.match(await page.locator('[data-drinking-national]').textContent(),/98.7/);assert(await page.locator('button[data-drinking-mode="gap"]').isDisabled());
 if(width===1440){
  const masks=await page.evaluate(()=>{
   const gl=__waterGL,canvas=gl.canvas,rect=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset,scale=rect.width/360*Number(d.earthZoom),x0=(rect.width-360*scale)/2+Number(d.earthOffsetX),y0=(rect.height-180*scale)/2+Number(d.earthOffsetY);
   const sample=(lon,lat)=>{const x=x0+((lon+390)%360)*scale,y=y0+(90-lat)*scale;if(x<0||y<0||x>=rect.width||y>=rect.height)return null;const p=new Uint8Array(4);gl.readPixels(Math.floor(x/rect.width*canvas.width),Math.floor((1-y/rect.height)*canvas.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p]};
   return {ocean:sample(150,15),missing:sample(127,40)};
  });assert(masks.ocean&&masks.missing);assert.equal(masks.ocean[3],0);assert.equal(masks.missing[3],0);report.checks.push({masks});
  await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);await page.locator('#gaia-statistics-close').click();
  await page.locator('[data-climate-source]').click();await page.locator('#japan-data-panel').waitFor({state:'visible'});await page.locator('#japan-data-close').click();
  await page.evaluate(()=>(window.__loseWater=__waterGL.getExtension('WEBGL_lose_context')).loseContext());await page.waitForFunction(()=>GaiaClimateHistory.getRenderState().engine==='lost');await page.evaluate(()=>GaiaClimateHistory.setYear(2016));await settled();assert.match(await page.locator('[data-drinking-national]').textContent(),/98.4/);
  await page.evaluate(()=>__loseWater.restoreContext());await page.waitForFunction(()=>GaiaClimateHistory.getRenderState().engine==='webgl2');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().contexts),1);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>GaiaClimateHistory.setYear(2024));await settled();await page.waitForTimeout(250);const frozen=await page.evaluate(()=>GaiaClimateHistory.getRenderState());await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().paintCount),frozen.paintCount);assert.equal(frozen.time,0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
 await page.evaluate(()=>GaiaClimateHistory.select('sanitation'));await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='sanitation'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getDrinkingState().width),1);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().engine),'canvas2d');
 await page.evaluate(()=>GaiaClimateHistory.select('drinking'));await ready();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().contexts),cpu?0:1);
 report.checks.push({width,height,cpu,engine:start.engine,pixels:motion.changed,textureReuse:true,nativeTextReuse:true,picking:true,years:true,gapAndNational:true,contextRecovery:width===1440,reducedMotion:true,cleanup:true});console.log('PASS drinking motion',width,cpu?'CPU':'GPU');await context.close();
 }assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
