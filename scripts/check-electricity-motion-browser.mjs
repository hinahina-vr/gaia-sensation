import fs from'node:fs';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{chromium}from'playwright-core';
const out='artifacts/electricity-motion-20261027/final',base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';fs.mkdirSync(out,{recursive:true});
const source=JSON.parse(fs.readFileSync('data/atlas-history/electricity.json')),ken=source.regions.find(r=>r.id==='KEN');
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Local installed headless Chrome; desktop and mobile emulation. Real WDI source data and Natural Earth geometry. Actual WebGL pixel motion, controls and context recovery. No production test or deployment.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
const selectedWidth=Number(process.env.GAIA_ELECTRICITY_WIDTH)||0;
if(selectedWidth&&fs.existsSync(out+'/report.json'))report.checks=JSON.parse(fs.readFileSync(out+'/report.json')).checks.filter(c=>c.width!==selectedWidth);
try{for(const [width,height,cpu]of[[1440,900,false],[390,844,false],[320,740,true]].filter(c=>!selectedWidth||c[0]===selectedWidth)){
const context=await browser.newContext({viewport:{width,height},hasTouch:width<901,isMobile:width<901});await context.route('https://**',r=>r.abort());
await context.addInitScript(cpu=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');
 const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){if(t==='webgl2'&&this.dataset.electricityMotion){if(cpu)return null;const gl=get.call(this,t,...args);window.__electricityGL=gl;return gl}return get.call(this,t,...args)};
},cpu);
page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
const ready=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().id==='electricity'&&GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&GaiaClimateHistory.getRenderState().paintCount>0);
const settled=()=>page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear===String(GaiaClimateHistory.getState().year));
const controls=async()=>{if(!await page.locator('[data-climate-year]').isVisible())await page.locator('#map-responsive-data > summary').click()};
const close=async()=>{const d=page.locator('#map-responsive-data');if(await d.isVisible()&&await d.getAttribute('open')!==null)await d.locator(':scope > summary').click()};
const year=async y=>{await controls();await page.locator('[data-climate-year]').fill(String(y));await close();await settled()};
await page.goto(base+'/world.html#world-77');await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>GaiaMapPlayback.stop());await ready();await settled();
assert.equal(await page.evaluate(()=>GaiaMapCategories.exhibitCount),100);assert.equal(await page.evaluate(()=>GaiaMapRoute.hashForNumber(101)),null);
assert.equal(await page.locator('[data-electricity-value]').textContent(),'53.1%');assert.match(await page.locator('[data-electricity-region-value]').textContent(),/43.8/);
const start=await page.evaluate(()=>GaiaClimateHistory.getRenderState());assert.equal(start.engine,cpu?'unavailable':'webgl2');assert.equal(start.error,'');
assert.equal(start.labelLayer.engine,'svg');assert.equal(start.labelLayer.bitmapPixels,0);assert.equal(await page.locator('.gaia-electricity-labels').count(),1);
await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas');window.__pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data});await page.waitForTimeout(1100);
const motion=await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let changed=0,total=0;for(let i=0;i<d.length;i+=16){total++;if(Math.abs(d[i]-__pixels[i])+Math.abs(d[i+1]-__pixels[i+1])+Math.abs(d[i+2]-__pixels[i+2])>8)changed++}return{changed,total,state:GaiaClimateHistory.getRenderState()}});
if(!cpu){assert(motion.changed>500,JSON.stringify(motion));assert(motion.state.draws>start.draws);assert.equal(motion.state.uploads,start.uploads);assert.equal(motion.state.baseBuilds,start.baseBuilds);assert.equal(motion.state.labelBuilds,start.labelBuilds);assert.equal(motion.state.labelLayer.updates,start.labelLayer.updates)}else assert.equal(motion.state.draws,0);
await page.screenshot({path:out+'/'+width+'-'+(cpu?'cpu':'gpu')+'-2016.png'});
// A real country label remains selectable while the GPU animates underneath.
const label=await page.evaluate(()=>GaiaClimateHistory.getRenderState().electricityLabels.find(p=>p.id==='KEN'));assert(label,'Selected Kenya label must remain visible');
await page.evaluate(()=>GaiaClimateHistory.selectPoint('IND',{focus:false}));await page.waitForFunction(()=>GaiaClimateHistory.getState().selectedId==='IND');
const rect=await page.locator('#gaia-climate-canvas').boundingBox(),point={x:rect.x+(label.bounds.left+label.bounds.right)/2,y:rect.y+(label.bounds.top+label.bounds.bottom)/2};
// Select the same actual country polygon at its unchanged geographic anchor.
const hit=await page.evaluate(p=>GaiaClimateHistory.findPoiAt(p.x,p.y,'mouse')?.record.id,{x:rect.x+label.anchor.x,y:rect.y+label.anchor.y});assert.equal(hit,'KEN');
if(width<901)await page.touchscreen.tap(rect.x+label.anchor.x,rect.y+label.anchor.y);else await page.mouse.click(rect.x+label.anchor.x,rect.y+label.anchor.y);
await page.waitForFunction(()=>GaiaClimateHistory.getState().selectedId==='KEN');await ready();
await year(2024);assert.equal(await page.locator('[data-electricity-value]').textContent(),'77%');
assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().labelLayer.previousLabels),0);assert.match(await page.locator('.gaia-electricity-labels [data-electricity-label-generation="current"] [data-selected="true"]').textContent(),/77%/);
const access=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert.deepEqual(access.rows.map(r=>r.value),ken.years.filter(r=>Number.isFinite(r.value)).map(r=>r.value));
assert.equal((await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),access.id)).id,access.id);
await page.locator('[data-electricity-mode="change"]').click();await settled();assert.match(await page.locator('[data-climate-value]').textContent(),/61.8/);
const change=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert.equal(change.id,'climate-electricity-KEN-change');assert.equal((await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),change.id)).rows.at(-1).value,61.8);
await page.screenshot({path:out+'/'+width+'-'+(cpu?'cpu':'gpu')+'-change.png'});
if(width===1440){
 await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);assert.equal(await page.evaluate(()=>GaiaStatisticsLab.getState().datasetId),change.id);await page.locator('#gaia-statistics-close').click();
 await page.locator('[data-climate-source]').click();await page.locator('#japan-data-panel').waitFor({state:'visible'});assert.match(await page.locator('#japan-data-panel').textContent(),/World Bank/);await page.locator('#japan-data-close').click();
 await page.evaluate(()=>(window.__loseElectricity=__electricityGL.getExtension('WEBGL_lose_context')).loseContext());await page.waitForFunction(()=>GaiaClimateHistory.getRenderState().engine==='lost');await year(2016);assert.match(await page.locator('[data-electricity-value]').textContent(),/53.1/);
 await page.evaluate(()=>__loseElectricity.restoreContext());await page.waitForFunction(()=>GaiaClimateHistory.getRenderState().engine==='webgl2');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().contexts),1);
}
await page.emulateMedia({reducedMotion:'reduce'});await year(2024);await page.waitForTimeout(250);const frozen=await page.evaluate(()=>GaiaClimateHistory.getRenderState());await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().paintCount),frozen.paintCount);assert.equal(frozen.time,0);
const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,legend:document.querySelector('.gaia-climate-legend').getBoundingClientRect().toJSON(),labels:GaiaClimateHistory.getRenderState().electricityLabels}));assert(layout.scroll<=width+1);assert(layout.legend.left>=0&&layout.legend.right<=width+1);assert(layout.labels.some(p=>p.selected));
await page.evaluate(()=>GaiaClimateHistory.select('sealevel'));await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='sealevel'&&GaiaClimateHistory.getSeaState().surface.draws>0&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getElectricityState().width),1);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getSeaState().stationsLoaded),492);
assert.equal(await page.locator('.gaia-electricity-labels').count(),0);
await page.evaluate(()=>GaiaClimateHistory.select('electricity'));await ready();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().contexts),cpu?0:1);
report.checks.push({width,height,cpu,engine:start.engine,pixelMotion:{changed:motion.changed,total:motion.total},cachedTextures:true,picking:true,statistics:true,reducedMotion:true,cleanup:true,layout});console.log('PASS electricity',width,cpu?'CPU':'GPU');await context.close();
}assert.deepEqual(report.errors,[]);report.status='passed';}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
