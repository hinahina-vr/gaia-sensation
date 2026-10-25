import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const stage=process.env.GAIA_EARTH_STAGE||'after';
const base=process.env.GAIA_BASE_URL;
const lastNumber=Number(process.env.GAIA_EARTH_LAST||5);
const firstNumber=Number(process.env.GAIA_EARTH_FIRST||1);
const root=path.resolve('artifacts/map-earth-insights-01-10-20261025');
const out=path.join(root,stage);fs.mkdirSync(out,{recursive:true});
const baseline=path.join(root,'before/report.json');
const before=stage==='before'||!fs.existsSync(baseline)?null:JSON.parse(fs.readFileSync(baseline));
const report={stage,scope:'Local installed Chrome. 01–03/05 use deterministic API-format fixtures; 04 and 06–10 use real bundled records. Touch is emulated, not a physical device. No production/live-provider verification.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
try{
 for(const [width,height] of [[1440,1000],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<901,isMobile:width<901,reducedMotion:'reduce'});
  let responseGeneration=0;const saved=[];
  await enforceBrowserSecurity(context,base);await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
  for(const host of ['api.open-meteo.com','air-quality-api.open-meteo.com'])await context.route('https://'+host+'/**',route=>{
   const latitudes=new URL(route.request().url()).searchParams.get('latitude').split(',');
   const rows=latitudes.map(lat=>{const i=Math.round((Number(lat)+90)*2);return {current:{time:'2026-10-25T03:00',wind_speed_10m:1+(i*7)%20+responseGeneration*50,wind_direction_10m:(i*31)%360,surface_pressure:1000+i%4,cloud_cover:50+i%6,shortwave_radiation:100+(i%13)*70,pm2_5:4+(i%18)*2,aerosol_optical_depth:.02+(17-i%18)*.02,temperature_2m:25,precipitation:0,relative_humidity_2m:65}};});
   return route.fulfill({json:rows.length===1?rows[0]:rows});
  });
  await context.route('https://earthquake.usgs.gov/**',r=>r.fulfill({json:{type:'FeatureCollection',metadata:{generated:Date.parse('2026-10-25T03:00Z')},features:Array.from({length:12},(_,i)=>({type:'Feature',id:'earth-summary-quake-'+i,geometry:{type:'Point',coordinates:[130+i,30+i,5+i*20]},properties:{mag:4+i%3/10,place:'検証用震源',time:Date.parse('2026-10-25T03:00Z')-i*3600000}}))}}));
  page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/world.html#world-'+String(firstNumber).padStart(2,'0'));
  await page.waitForFunction(()=>globalThis.GaiaMapPlayback&&globalThis.GaiaModeEntryGuide);
  await page.evaluate(()=>{GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});
  for(let n=firstNumber;n<=lastNumber;n++){
   await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number')?.textContent)===n&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro'),n);
   await page.evaluate(()=>GaiaMapPlayback.stop());
   const action=n<=5?(n===4?'[data-firms-analysis]':'[data-planet-analysis]'):'#gaia-statistics-button';
   await page.waitForFunction(selector=>{const b=document.querySelector(selector);return b&&!b.disabled;},action);
   if(await page.locator(action).getAttribute('aria-disabled')==='true'){
    assert.equal(stage,'before','01–05 now expose analysis for actual observations');
    assert(n<=5,'Only realtime exhibits have an unavailable analysis entry');
    report.checks.push({width,height,number:n,analysisUnavailable:true});console.log('PASS unavailable',stage,width,n);
    if(n<lastNumber)await page.locator('[data-map-stable-step="1"]').click();continue;
   }
   if(width<901){await page.locator('[data-mobile-sheet="tools"]').click();await page.locator('#map-mobile-sheet').getByRole('button',{name:/統計分析/}).click();}
   else if(n>=6)await page.getByRole('button',{name:'現在の展示データを統計分析する',exact:true}).click();
   else await page.locator(action).click();
   await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().open&&GaiaStatisticsLab.getState().analysisReady&&document.querySelector('#gaia-statistics-status').textContent!=='計算中');
   await page.locator('[data-stat-view="chart"]').click();
   const takeaway=page.locator('#gaia-statistics-takeaway');await takeaway.scrollIntoViewIfNeeded();
   const scan=await page.evaluate(()=>{const r=GaiaStatisticsLab.run('discovery'),d=r.dataInsight;return{dataset:GaiaStatisticsLab.getState().datasetId,primary:d.primaryId,computed:d.computedInsight,stats:r.stats??null};});
   const text=await takeaway.innerText();
   if(stage!=='before'){
    assert.equal(scan.computed.audience,'earth-context',width+'/'+n);assert.match(text,/読み取れること/);assert.match(text,/地球との共創を考える視点/);
    assert(!/[0-9]/.test(text),'No fine numerical detail in summary: '+n+' '+text);
    assert(!/ではありません|輪郭|経営判断|重点対象|見積もります/.test(text));
    assert.equal(await page.locator('#gaia-statistics-takeaway-evidence').isVisible(),false);
    const prior=before?.checks.find(c=>c.width===width&&c.number===n);
    if(prior&&!prior.analysisUnavailable){assert.equal(scan.dataset,prior.dataset);assert.deepEqual(scan.computed.metrics,prior.computed.metrics,'Measured evidence unchanged');assert.deepEqual(scan.stats,prior.stats,'Underlying analysis unchanged');}
    if(n<=5)assert(scan.computed.metrics.some(([,value])=>Number.isFinite(value)),'New realtime analysis contains measured evidence');
    const meaning=page.locator('#gaia-statistics-takeaway-body section').nth(1);await meaning.scrollIntoViewIfNeeded();const bounds=await meaning.boundingBox();assert(bounds.y>=-1&&bounds.y+bounds.height<=height+1,'Meaning can be read within viewport');
    const overflow=await takeaway.evaluate(e=>e.scrollWidth-e.clientWidth);assert(overflow<=1);
    await page.locator('[data-stat-view="records"]').click();assert(await page.locator('#gaia-statistics-records-body tr').count()>0,'Source records remain accessible');await page.locator('[data-stat-view="chart"]').click();
   }
   if(n<=5||[6,9,10].includes(n))await page.screenshot({path:path.join(out,width+'-'+String(n).padStart(2,'0')+'.png')});
   if(stage!=='before'&&width===1440&&[1,4].includes(n)){
    const summary=await page.evaluate(()=>GaiaStatisticsLab.run('summary').stats);
    await page.locator('#gaia-statistics-menu-toggle').click();
    if(await page.locator('.gaia-statistics-data-options').getAttribute('open')===null)await page.locator('.gaia-statistics-data-options > summary').click();
    await page.locator('#gaia-statistics-view-save').click();const id=await page.locator('#gaia-statistics-saved-view').inputValue();assert(id);saved.push({id,dataset:scan.dataset,mean:summary.mean});
    await page.locator('#gaia-statistics-menu-close').click();
   }
   report.checks.push({width,height,number:n,...scan,text});console.log('PASS',stage,width,n,scan.dataset);
   await page.locator('#gaia-statistics-close').click();await page.locator('#gaia-statistics-lab').waitFor({state:'hidden'});
   if(n<lastNumber)await page.locator('[data-map-stable-step="1"]').click();
  }
  if(saved.length){
   responseGeneration=1;
   await page.evaluate(()=>{for(const key of Object.keys(sessionStorage))if(key.startsWith('gaia-planet-signals-v3:'))sessionStorage.removeItem(key);});
   await page.goto(base+'/world.html#world-01');await page.reload();await page.waitForFunction(()=>globalThis.GaiaPlanetSignals?.getStatisticsDataset());await page.evaluate(()=>{GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});
   await page.locator('[data-planet-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
   const currentMean=await page.evaluate(()=>GaiaStatisticsLab.run('summary').stats.mean);assert.notEqual(currentMean,saved[0].mean,'Later provider response differs');
   await page.locator('#gaia-statistics-menu-toggle').click();if(await page.locator('.gaia-statistics-data-options').getAttribute('open')===null)await page.locator('.gaia-statistics-data-options > summary').click();
   for(const view of saved){
    await page.locator('#gaia-statistics-saved-view').selectOption(view.id);await page.locator('#gaia-statistics-view-apply').click();
    await page.waitForFunction(id=>GaiaStatisticsLab.getState().datasetId===id&&GaiaStatisticsLab.getState().analysisReady,view.dataset);
    assert.equal(await page.evaluate(()=>GaiaStatisticsLab.run('summary').stats.mean),view.mean,'Original observation set restored');
   }
   report.checks.push({width,observationSnapshotsRestored:saved.map(v=>v.dataset),laterResponseKeptSeparate:true});
   const offline=route=>route.abort();await context.route('https://api.open-meteo.com/**',offline);
   await page.evaluate(()=>{for(const key of Object.keys(sessionStorage))if(key.startsWith('gaia-planet-signals-v3:'))sessionStorage.removeItem(key);});
   await page.reload();await page.waitForFunction(()=>globalThis.GaiaPlanetSignals?.getState().sourceState==='SAVED VALUES');
   assert.equal(await page.evaluate(()=>GaiaPlanetSignals.getStatisticsDataset()),null,'Generated reference values excluded');assert(await page.locator('[data-planet-analysis]').isDisabled());
   await context.unroute('https://api.open-meteo.com/**',offline);await page.reload();await page.waitForFunction(()=>globalThis.GaiaPlanetSignals?.getStatisticsDataset());assert.equal(await page.locator('[data-planet-analysis]').isDisabled(),false);
   report.checks.push({width,generatedReferenceExcluded:true,reloadRecovery:true});
   for(const number of [1,4]){
    const action=number===1?'[data-planet-analysis]':'[data-firms-analysis]';
    await page.goto(base+'/world.html#world-'+String(number).padStart(2,'0'));await page.reload();
    await page.waitForFunction(selector=>{const b=document.querySelector(selector);return b&&!b.disabled;},action);
    await page.evaluate(()=>{GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});
    const delayed=async route=>{await new Promise(resolve=>setTimeout(resolve,1000));await route.continue();};
    await context.route('**/statistics-lab.js?*',delayed);
    await page.waitForFunction(()=>!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro'));await page.locator(action).evaluate(b=>{b.click();b.click();});await page.locator('[data-map-stable-step="1"]').click();
    await page.waitForFunction(()=>GaiaModeLoader.isLoaded('statistics'));
    assert.equal(await page.evaluate(()=>GaiaStatisticsLab.getState().open),false,'Late/duplicate click cannot open a different exhibit');
    await context.unroute('**/statistics-lab.js?*',delayed);
    report.checks.push({width,number,lateAnalysisAfterNavigationBlocked:true});
   }
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=e.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length}));}
