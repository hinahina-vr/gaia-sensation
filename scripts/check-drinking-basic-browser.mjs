import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {chromium} from 'playwright-core';
const out='artifacts/drinking-basic-20261026/verification',base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';fs.mkdirSync(out,{recursive:true});
const sources={basic:JSON.parse(fs.readFileSync('data/atlas-history/drinking-basic.json')),safe:JSON.parse(fs.readFileSync('data/atlas-history/drinking.json'))};
const report={baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{for(const[width,height,cpu]of[[1440,900,false],[390,844,false],[320,740,true]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<901,hasTouch:width<901});await context.route('https://**',r=>r.abort());await context.addInitScript(cpu=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){if(cpu&&t==='webgl2'&&this.dataset.drinkingMotion)return null;return get.call(this,t,...args)}},cpu);
 page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().id==='drinking'&&GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
 const settled=()=>page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear===String(GaiaClimateHistory.getState().year));
 await page.goto(base+'/world.html#world-78');await ready();await page.evaluate(()=>GaiaMapPlayback.stop());assert.equal(await page.evaluate(()=>GaiaClimateHistory.getDrinkingState().mode),'basic');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().engine),cpu?'unavailable':'webgl2');
 await page.evaluate(()=>GaiaClimateHistory.setYear(2024));await settled();
 for(const service of ['basic','safe']){
  await page.locator(`[data-drinking-service="${service}"]`).click();await page.evaluate(()=>GaiaClimateHistory.selectPoint('IND'));await ready();await settled();
  for(const gap of [false,true]){
   const mode=service==='basic'?gap?'basic-gap':'basic':gap?'gap':'national';await page.locator(`button[data-drinking-mode="${mode}"]`).click();await settled();
   assert.equal(await page.evaluate(()=>GaiaClimateHistory.getDrinkingState().mode),mode);
   const dataset=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset()),suffix=service==='basic'?gap?'-basic-gap':'-basic':gap?'-gap':'';assert.equal(dataset.id,'climate-drinking-IND'+suffix);
   assert.deepEqual((await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),dataset.id)).rows.map(r=>r.value),dataset.rows.map(r=>r.value));
   if(!gap)assert.deepEqual(dataset.rows.map(r=>r.value),sources[service].regions.find(r=>r.id==='IND').years.filter(r=>Number.isFinite(r.value)).map(r=>r.value));
   const info=await page.evaluate(()=>GaiaClimateHistory.getSourceInfo());assert.equal(info.datasets.length,gap?2:1);assert(info.datasets.every(d=>d.url.includes(service==='basic'?'BASW':'SMDW')));
   const labels=await page.locator('[data-drinking-chart]').getAttribute('aria-label');assert(labels.includes(service==='basic'?'基本サービス':'安全に管理'));
   await page.screenshot({path:`${out}/${width}-${mode}.png`});
  }
 }
 // Actual map selection of China, then service fallback and return, keeps identity.
 await page.locator('[data-drinking-service="basic"]').click();await page.evaluate(()=>GaiaClimateHistory.selectPoint('CHN'));await ready();await settled();
 assert.notEqual(await page.locator('[data-climate-value]').textContent(),'欠測');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getDrinkingState().mode),'basic-gap');
 await page.locator('[data-drinking-service="safe"]').click();await settled();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().selectedId),'CHN');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getDrinkingState().mode),'national');assert.equal(await page.locator('[data-climate-value]').textContent(),'欠測');assert(await page.locator('[data-climate-analysis]').isDisabled());
 await page.locator('[data-drinking-service="basic"]').click();await settled();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getDrinkingState().mode),'basic');assert.match(await page.locator('[data-drinking-national]').textContent(),/96.1/);assert.equal(await page.locator('[data-climate-analysis]').isDisabled(),false);assert.match(await page.locator('[data-climate-status]').textContent(),/202か国/);
 const target=await page.evaluate(()=>{for(let y=190;y<innerHeight-75;y+=8)for(let x=60;x<innerWidth-12;x+=8){const e=document.elementFromPoint(x,y);if(e&&!e.closest('button,select,input,summary,.gaia-climate-legend,.gaia-climate-readout,#map-responsive-data,#map-mobile-bottom')&&GaiaClimateHistory.findPoiAt(x,y,'touch')?.record.id==='CHN')return{x,y}}});assert(target);
 await page.evaluate(()=>GaiaClimateHistory.selectPoint('MNG',{focus:false}));await settled();if(width<901)await page.touchscreen.tap(target.x,target.y);else await page.mouse.click(target.x,target.y);await page.waitForFunction(()=>GaiaClimateHistory.getState().selectedId==='CHN');await ready();await settled();
 if(width===1440){await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);assert.equal(await page.evaluate(()=>GaiaStatisticsLab.getState().datasetId),'climate-drinking-CHN-basic');await page.locator('#gaia-statistics-close').click();await page.locator('[data-climate-source]').click();await page.locator('#japan-data-panel').waitFor({state:'visible'});assert(await page.locator('#japan-data-panel a[href*="SH.H2O.BASW.ZS"]').count()>0);await page.locator('#japan-data-close').click()}
 await page.screenshot({path:`${out}/${width}-china-basic.png`});
 // Same-level fallback when a selected country's urban/rural pair is unpublished.
 await page.evaluate(()=>GaiaClimateHistory.selectPoint('JPN'));await ready();await settled();assert(await page.locator('button[data-drinking-mode="basic-gap"]').isDisabled());
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>GaiaClimateHistory.setYear(2016));await settled();await page.waitForTimeout(300);const count=await page.evaluate(()=>GaiaClimateHistory.getRenderState().paintCount);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().paintCount),count);
 const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,legend:document.querySelector('.gaia-climate-legend').getBoundingClientRect().toJSON()}));assert.equal(layout.scroll,width);assert(layout.legend.left>=0&&layout.legend.right<=width+1);
 await page.evaluate(()=>location.hash='#world-79');await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='sanitation'&&GaiaClimateHistory.getState().dataState==='ready');await page.evaluate(()=>location.hash='#world-78');await ready();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getDrinkingState().mode),'basic');
 report.checks.push({width,height,cpu,fourModes:true,exactNationalData:true,restoration:true,sourceSwitch:true,chinaSelectable:true,safeMissingPreserved:true,analysisDialog:width===1440,reentryDefaultBasic:true,reducedMotion:true,layout});console.log('PASS drinking basic',width);await context.close();
 }assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
