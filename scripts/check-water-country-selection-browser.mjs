import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {execFileSync} from 'node:child_process';
const out='artifacts/water-country-selection-20261026',before=process.env.GAIA_SELECTION_BASELINE==='1',base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';fs.mkdirSync(out,{recursive:true});
const report={baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',before,checks:[],errors:[]};const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{for(const [width,height]of(before?[[1440,900]]:[[1440,900],[390,844],[320,740]])){
 const context=await browser.newContext({viewport:{width,height},hasTouch:width<901,isMobile:width<901,reducedMotion:'reduce'});await context.route('https://**',r=>r.abort());await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true')});page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'/world.html#world-78');
 for(const [number,id]of[[78,'drinking'],[79,'sanitation']]){
  const country=number===78?{id:'CHN',name:'中国',lon:105,lat:35}:{id:'IRN',name:'イラン',lon:54,lat:32};
  await page.evaluate(n=>location.hash='#world-'+n,number);await page.waitForFunction(id=>globalThis.GaiaClimateHistory?.getState().id===id&&GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete',id);await page.evaluate(()=>GaiaMapPlayback.stop());if(!before&&number===78)await page.locator('[data-drinking-service="safe"]').click();
  await page.evaluate(p=>GaiaMapObservationAdapter.focusEarthLocation({...p,zoom:2.5,targetX:.48,targetY:.56,durationMs:0,label:'qa-missing-country'}),country);await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(250);
  const point=await page.evaluate(p=>{const rect=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset,s=(rect.width>=901?rect.width/360:Math.max(rect.width/360,rect.height/180))*Number(d.earthZoom);return{x:rect.left+(rect.width-360*s)/2+Number(d.earthOffsetX)+((p.lon+390)%360)*s,y:rect.top+(rect.height-180*s)/2+Number(d.earthOffsetY)+(90-p.lat)*s}},country);
  const hit=await page.evaluate(p=>GaiaClimateHistory.findPoiAt(p.x,p.y,'touch')?.record.id,point);
  if(before){assert.equal(hit,undefined);const selected=await page.evaluate(()=>GaiaClimateHistory.getState().selectedId);await page.mouse.click(point.x,point.y);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().selectedId),selected);report.checks.push({number,width,country:country.id,bug:'Country polygon cannot be selected because it has no primary data record'});await page.screenshot({path:`${out}/before-${number}.png`});continue}
  assert.equal(hit,country.id);
  // Close observation controls if a compact viewport left them expanded.
  const drawer=page.locator('#map-responsive-data');if(await drawer.isVisible()&&await drawer.getAttribute('open')!==null)await drawer.locator(':scope > summary').click();
  const target=await page.evaluate(id=>{for(let y=190;y<innerHeight-75;y+=8)for(let x=60;x<innerWidth-12;x+=8){const e=document.elementFromPoint(x,y);if(e&&!e.closest('button,select,input,summary,.gaia-climate-legend,.gaia-climate-readout,#map-responsive-data,#map-mobile-bottom')&&GaiaClimateHistory.findPoiAt(x,y,'touch')?.record.id===id)return{x,y}}},country.id);assert(target);
  if(width<901)await page.touchscreen.tap(target.x,target.y);else await page.mouse.click(target.x,target.y);
  await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,country.id);await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');
  assert.equal(await page.locator('[data-climate-value]').textContent(),'欠測');assert.equal(await page.locator(`[data-${id}-country]`).textContent(),country.name);assert(await page.locator('[data-climate-analysis]').isDisabled());
  await page.waitForFunction(id=>GaiaClimateHistory.getRenderState().drinkingReadings.some(r=>r.id===id&&r.selected),country.id);assert.equal(await page.locator(`[data-climate-point] option[value="${country.id}"]`).count(),1);
  const statistics=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert(!statistics||statistics.rows.length===0);
  await page.evaluate(()=>GaiaClimateHistory.setYear(2024));await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2024&&GaiaClimateHistory.getState().dataState==='ready');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().selectedId),country.id);assert.equal(await page.locator('[data-climate-value]').textContent(),'欠測');
  await page.screenshot({path:`${out}/after-${number}-${width}.png`});
  // Existing countries still have source values; absence is not converted to zero.
  await page.evaluate(()=>GaiaClimateHistory.selectPoint('IND'));await page.waitForFunction(()=>GaiaClimateHistory.getState().selectedId==='IND');assert.notEqual(await page.locator('[data-climate-value]').textContent(),'欠測');
  report.checks.push({number,width,mouseOrTouch:true,missingSelected:true,yearPersists:true,emptyAnalysisDisabled:true,knownCountryPreserved:true});console.log('PASS water country selection',number,width);
 }await context.close();
 }assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e}finally{fs.writeFileSync(out+'/'+(before?'before.json':'after.json'),JSON.stringify(report,null,2));await browser.close()}
