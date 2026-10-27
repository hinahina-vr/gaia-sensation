import fs from 'node:fs';import assert from 'node:assert/strict';import vm from 'node:vm';import {chromium} from 'playwright-core';
const out='artifacts/local95-20261027',base='http://127.0.0.1:4492';fs.mkdirSync(out,{recursive:true});
const report={checks:process.env.GAIA_LOCAL95_CPU_ONLY&&fs.existsSync(out+'/report.json')?JSON.parse(fs.readFileSync(out+'/report.json')).checks.filter(c=>c.number&&!c.cpu):[],errors:[],scope:'Local installed Chrome. Phone viewport emulation, not physical hardware or production.'};
for(const [hostname,count] of [['127.0.0.1',100],['localhost',100],['[::1]',100],['gaia-senseware.pages.dev',100]]){
 const c=vm.createContext({location:{hostname},document:{querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},matchMedia:()=>({matches:true,addEventListener(){}}),MutationObserver:class{observe(){}},requestAnimationFrame(){}});
 vm.runInContext(fs.readFileSync('map-exhibit-categories.js','utf8'),c);vm.runInContext(fs.readFileSync('map-exhibit-route.js','utf8'),c);
 assert.equal(c.GaiaMapCategories.exhibitCount,count);assert.equal(c.GaiaMapRoute.hashForNumber(95),count>=95?'#world-95':null);assert.equal(c.GaiaMapRoute.hashForNumber(101),null);report.checks.push({hostname,count});
}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{for(const [width,cpu] of (process.env.GAIA_LOCAL95_CPU_ONLY?[[320,true]]:[[1440,false],[390,false],[320,true]])){
 const context=await browser.newContext({viewport:{width,height:width===320?740:1000},isMobile:width<900,hasTouch:width<900,reducedMotion:'reduce'});
 await context.route('https://**',r=>r.abort());await context.addInitScript(cpu=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');if(cpu){const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)&&(this.dataset.local90Glyphs||this.dataset.countryThemeMotion)?null:get.call(this,t,...a)}}},cpu);
 page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/world.html#world-91',{waitUntil:'domcontentloaded'});
 const ready=id=>page.waitForFunction(id=>globalThis.GaiaClimateHistory?.getState().id===id&&GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running',id);
 const settled=()=>page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear===String(GaiaClimateHistory.getState().year));
 for(const [number,id] of [[91,'oceanheat'],[92,'ozone'],[93,'glaciers'],[94,'volcanoes'],[95,'tsunamis']]){
  await page.evaluate(n=>location.hash='#world-'+n,number);await ready(id);await page.evaluate(()=>GaiaMapPlayback.stop());await settled();
  assert.equal(await page.evaluate(()=>GaiaMapCategories.exhibitCount),100);assert.equal(await page.evaluate(()=>GaiaMapCategories.buttons().length),100);assert(await page.evaluate(n=>!!GaiaMapDataIntro.entries[n],String(number)));
  const payload=JSON.parse(fs.readFileSync(`data/atlas-history/${id}.json`));
  const verify=async()=>{const ds=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset()),s=await page.evaluate(()=>GaiaClimateHistory.getState()),r=payload.regions.find(r=>r.id===s.selectedId);assert(r);assert.deepEqual(ds.rows.map(r=>r.value),r.years.filter(r=>Number.isFinite(r.value)).map(r=>r.value));assert.deepEqual((await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),ds.id)).rows.map(r=>r.value),ds.rows.map(r=>r.value));return ds};
  await verify();await page.locator('[data-climate-year]').fill('2020');await page.locator('[data-climate-year]').dispatchEvent('input');await settled();await verify();
  const render=await page.evaluate(()=>GaiaClimateHistory.getRenderState());assert.equal(render.engine,cpu?'unavailable':'webgl2',render.errorMessage);assert(render.textLayer.texts>0);
  if(!['volcanoes','tsunamis'].includes(id))assert(render.glyphs>0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  await page.screenshot({path:`${out}/${number}-${width}-${cpu?'cpu':'gpu'}.png`});
  if(width===1440){await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);await page.locator('#gaia-statistics-close').click();await page.locator('[data-climate-source]').click();await page.locator('#japan-data-panel').waitFor({state:'visible'});await page.locator('#japan-data-close').click();}
  const picker=page.locator('[data-climate-point]'),options=await picker.locator('option').evaluateAll(ns=>ns.map(n=>n.value)),selected=await picker.inputValue(),next=options.find(v=>v!==selected);
  if(next){await picker.selectOption(next);await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,next);await settled();await verify();}
  if(id==='ozone'){await page.locator('[data-climate-year]').fill('1995');await page.locator('[data-climate-year]').dispatchEvent('input');await settled();assert.match(await page.locator('[data-climate-value]').innerText(),/欠測/);}
  report.checks.push({number,width,cpu,engine:render.engine,sourceValues:true,restoration:true,yearSlider:true,selection:!!next,sourceAndAnalysis:width===1440});console.log('PASS',number,width,cpu?'cpu':'gpu');
 }
 if(!cpu){await page.locator('[data-map-stable-step="1"]').click();await ready('wateruse');await page.evaluate(()=>location.hash='#world-90');await ready('snowcover');await page.locator('[data-map-stable-step="1"]').click();await ready('oceanheat');await page.locator('[data-map-stable-step="-1"]').click();await ready('snowcover');await page.evaluate(()=>location.hash='#world-95');await ready('tsunamis');await page.reload({waitUntil:'domcontentloaded'});await ready('tsunamis');}
 await context.close();
}assert.deepEqual(report.errors,[]);report.status='passed';}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
