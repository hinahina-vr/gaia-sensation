import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {chromium} from 'playwright-core';
const out='artifacts/map-text-horizontal-20261026',base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';fs.mkdirSync(out,{recursive:true});
const files=['gaia-mode-loader.js','climate-history-exhibits.css','src/exploration/index.js','src/exploration/climate-history-exhibits.js','src/exploration/drinking-map-view.js','src/exploration/country-history-view.js','src/exploration/water-storage-view.js','src/exploration/sea-level-view.js','src/exploration/electricity-map-view.js','src/exploration/electricity-country-marks.js'];
const originals=new Map(files.map(file=>[file,execFileSync('git',['show','HEAD:'+file],{encoding:'utf8'})]));
const report={baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Cross-exhibit native text and label cleanup at 4K, high DPI and mobile. Reproduce the reported 78/India/2024 raster text before the fix.',checks:[],errors:[]};
const ids={74:'lakes',75:'waterstore',76:'sealevel',77:'electricity',78:'drinking',79:'sanitation',80:'foresthistory'};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const [width,height,dpr,before,numbers] of [[3840,2160,1,true,[78]],[3840,2160,1,false,[78,79,80,75,76,77,74]],[1920,1080,2,false,[78,79,80]],[390,844,3,false,[78,79,80]]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,hasTouch:width<901,isMobile:width<901,reducedMotion:'reduce'});await context.route('https://**',r=>r.abort());
  if(before)await context.route(base+'/**',r=>{const file=new URL(r.request().url()).pathname.slice(1);return originals.has(file)?r.fulfill({status:200,contentType:file.endsWith('.css')?'text/css':'text/javascript',body:originals.get(file)}):r.continue()});
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true')});page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/world.html#world-78');
  for(const number of numbers){
   await page.evaluate(n=>location.hash=`#world-${n}`,number);
   await page.waitForFunction(id=>globalThis.GaiaClimateHistory?.getState().id===id&&GaiaClimateHistory.getState().dataState==='ready',ids[number]);
   if(number===78&&!before)await page.locator('[data-drinking-service="safe"]').click();
   await page.evaluate(async n=>{GaiaMapPlayback.stop();if(n>=77){await GaiaClimateHistory.setYear(n===80?2023:2024);GaiaClimateHistory.selectPoint('IND');}if(n===74)GaiaClimateHistory.focusAll();},number);
   await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear===String(GaiaClimateHistory.getState().year)&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');
   const reading=await page.evaluate(()=>({state:GaiaClimateHistory.getState(),render:GaiaClimateHistory.getRenderState(),ratio:document.querySelector('#gaia-climate-canvas').width/document.querySelector('#gaia-climate-canvas').getBoundingClientRect().width,texts:[...document.querySelectorAll('.gaia-map-text-layer [data-map-text-generation=current] text,.gaia-electricity-labels [data-electricity-label-generation=current] text')].map(e=>({text:e.textContent,matrix:e.transform.baseVal.consolidate()?.matrix.a??1})),layers:document.querySelectorAll('.gaia-map-text-layer,.gaia-electricity-labels').length}));
   if(before){assert.equal(reading.texts.length,0);assert(reading.ratio<.5)}
   else{
    assert.equal(reading.layers,1,`Only the current text layer should remain: ${number}`);assert(reading.texts.length>0,`No native text in ${number}`);assert(reading.texts.every(t=>Math.abs(t.matrix-1)<.001));
    if(number===78){assert.equal(reading.state.selectedId,'IND');assert(reading.texts.some(t=>t.text==='76.4%'));}
    if(number>=77){const p=(reading.render.drinkingReadings||reading.render.electricityLabels).find(p=>p.selected);assert(p);const rect=await page.locator('#gaia-climate-canvas').boundingBox();assert.equal(await page.evaluate(p=>GaiaClimateHistory.findPoiAt(p.x,p.y,'mouse')?.record.id,{x:rect.x+(p.bounds.left+p.bounds.right)/2,y:rect.y+(p.bounds.top+p.bounds.bottom)/2}),'IND');}
   }
   const tag=`${before?'before':'after'}-${number}-${width}-dpr${dpr}`;await page.screenshot({path:`${out}/${tag}.png`});
   if(number===78&&width===3840){const p=reading.render.drinkingReadings.find(p=>p.selected),rect=await page.locator('#gaia-climate-canvas').boundingBox();await page.screenshot({path:`${out}/${tag}-india.png`,clip:{x:rect.x+p.bounds.left-12,y:rect.y+p.bounds.top-12,width:p.bounds.right-p.bounds.left+24,height:p.bounds.bottom-p.bounds.top+24}})}
   report.checks.push({number,width,height,dpr,before,ratio:reading.ratio,texts:reading.texts,layers:reading.layers,selected:reading.state.selectedId});console.log('PASS native text',tag);
  }
  await context.close();
 }assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
