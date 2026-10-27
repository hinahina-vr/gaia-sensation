import fs from 'node:fs';import assert from 'node:assert/strict';import vm from 'node:vm';import {chromium} from 'playwright-core';import {execFileSync} from 'node:child_process';
const out='artifacts/local85-20261026';fs.mkdirSync(out,{recursive:true});const report={baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',checks:[],errors:[]};
for(const [hostname,count]of[['127.0.0.1',100],['localhost',100],['gaia-senseware.pages.dev',100]]){
 const context=vm.createContext({location:{hostname},document:{querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},matchMedia:()=>({matches:true,addEventListener(){}}),MutationObserver:class{observe(){}},requestAnimationFrame(){}});
 vm.runInContext(fs.readFileSync('map-exhibit-categories.js','utf8'),context);vm.runInContext(fs.readFileSync('map-exhibit-route.js','utf8'),context);
 assert.equal(context.GaiaMapCategories.exhibitCount,count);assert.equal(context.GaiaMapRoute.hashForNumber(85),count>=85?'#world-85':null);assert.equal(context.GaiaMapRoute.hashForNumber(101),null);report.checks.push({hostname,count});
}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
try{for(const [width,height]of[[1440,900],[390,844]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<901,hasTouch:width<901,reducedMotion:'reduce'});await context.route('https://**',r=>r.abort());
 await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true')});page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'/world.html#world-81');
 const ids={81:'waterstress',82:'cropland',83:'yield',84:'fertilizer',85:'longevity'};
 const settle=n=>page.waitForFunction(id=>globalThis.GaiaClimateHistory?.getState().id===id&&GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete',ids[n]);
 await settle(81);assert.equal(await page.evaluate(()=>GaiaMapCategories.exhibitCount),100);assert.equal(await page.evaluate(()=>GaiaMapCategories.buttons().length),100);assert(await page.evaluate(()=>!!GaiaMapDataIntro.entries['85']));
 for(const n of [81,82,83,84,85]){
  if(n>81){await page.locator('[data-map-stable-step="1"]').click();await settle(n)}
  await page.evaluate(()=>GaiaMapPlayback.stop());
  assert.equal(new URL(page.url()).hash,`#world-${n}`);const panel=page.locator(`[data-${n===81?'stress':ids[n]}-panel]`);assert(await panel.isVisible());
  const prior=await page.evaluate(()=>GaiaClimateHistory.getState().year);await page.evaluate(y=>GaiaClimateHistory.setYear(y===2016?2017:2016),prior);await settle(n);
  await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear===String(GaiaClimateHistory.getState().year));
  const state=await page.evaluate(async()=>{const s=GaiaClimateHistory.getState(),r=GaiaClimateHistory.getRenderState(),dataset=GaiaClimateHistory.getStatisticsDataset(),restored=await GaiaClimateHistory.restoreStatisticsDataset(dataset.id);return{state:s,render:r,rows:dataset.rows.length,restored:restored.rows.length,texts:document.querySelectorAll('.gaia-map-text-layer text').length,scroll:document.documentElement.scrollWidth,width:innerWidth}});
  assert(state.texts>0);assert(state.rows>0);assert.equal(state.rows,state.restored);assert(state.scroll<=width+1);assert(state.render.drinkingReadings.length>0);
  if(n===82){assert((await page.locator('[data-climate-value]').textContent()).includes('ポイント'));await page.locator('[data-cropland-mode="share"]').click();assert((await page.locator('[data-climate-value]').textContent()).includes('%'));await page.locator('[data-cropland-mode="change"]').click();assert((await page.locator('[data-climate-value]').textContent()).includes('ポイント'));}
  if(n===85){await page.locator('[data-longevity-compare]').selectOption('IND');await page.waitForFunction(()=>GaiaClimateHistory.getRenderState().comparisonId==='IND');}
  await page.screenshot({path:`${out}/${n}-${width}.png`});report.checks.push({n,width,year:state.state.year,selectedId:state.state.selectedId,marks:state.render.drinkingReadings.length,texts:state.texts,rows:state.rows});console.log('PASS local exhibit',n,width);
 }
 await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>Number(document.querySelector('#japan-mode-number')?.textContent)===86);assert.equal(new URL(page.url()).hash,'#world-86');
 await page.evaluate(()=>location.hash='#world-80');await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().id==='foresthistory'&&GaiaClimateHistory.getState().dataState==='ready');await page.locator('[data-map-stable-step="1"]').click();await settle(81);
 await page.reload();await settle(81);await context.close();
 }assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
