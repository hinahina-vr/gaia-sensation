import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {decodeTides} from '../src/exploration/sea-level-stations.js';
const data=decodeTides(JSON.parse(fs.readFileSync('data/atlas-history/sealevel-stations.json'))),station=data.regions.find(r=>r.id==='tide-134');
const stage=process.env.GAIA_SEA_STAGE||'after',out=path.resolve(process.env.GAIA_SEA_OUT||'artifacts/sea-level-gis-20261022/after');fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Local installed Chrome, actual bundled source records; touch/mobile emulation, not physical device or production.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const [width,height]of JSON.parse(process.env.GAIA_SEA_SIZES||'[[1920,1080],[1440,900],[1366,768],[390,844],[320,568]]')){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<901,isMobile:width<901});await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**/*',r=>r.abort());
  await context.addInitScript(()=>{
    sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');
    window.__seaLabels=[];const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){if(/(?: mm|欠測)$/.test(text)&&window.__seaLabels.length<2500)window.__seaLabels.push({text,x,y,alpha:this.globalAlpha});return fill.call(this,text,x,y,...args);};
  });
  page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().id==='sealevel'&&GaiaClimateHistory.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');
  const stable=()=>page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&Number(document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear)===GaiaClimateHistory.getState().year);
  const controls=async()=>{if(!await page.locator('[data-climate-year]').isVisible())await page.locator('#map-responsive-data > summary').click();};
  const closeControls=async()=>{const drawer=page.locator('#map-responsive-data');if(await drawer.isVisible()&&await drawer.getAttribute('open')!==null)await drawer.locator(':scope > summary').click();};
  const year=async y=>{await controls();await page.locator('[data-climate-year]').fill(String(y));await closeControls();await stable();};
  const choose=async id=>{await controls();await page.locator('[data-climate-point]').selectOption(id);await closeControls();await stable();};
  const action=async name=>{if(width<901){await page.locator('[data-mobile-sheet="tools"]').tap();await page.getByRole('button',{name:name==='source'?'データの出典':'統計分析',exact:true}).last().tap();}else await page.locator(`[data-climate-${name}]`).click();};
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-76`);await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>GaiaModeEntryGuide.close('map',{restoreFocus:false}));await ready();await page.evaluate(()=>GaiaMapPlayback.stop());await stable();
  assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().selectedId),'tide-134');
  assert.equal(await page.evaluate(()=>GaiaClimateHistory.getSeaState().stationsLoaded),492);
  assert.equal(await page.locator('[data-climate-value]').textContent(),'184 mm');
  await page.screenshot({path:path.join(out,`${width}-76-overview.png`)});
  if(stage==='before'){report.checks.push({width,height,stage});await context.close();continue;}
  const labels=await page.evaluate(()=>({readings:GaiaClimateHistory.getSeaState().readings,drawn:__seaLabels}));
  assert(labels.drawn.some(d=>d.alpha>0&&d.alpha<.8),'Actual drawn labels fade in');
  const selectedLabel=labels.readings.find(p=>p.id==='tide-134');assert.equal(selectedLabel.text,'+184 mm');
  for(const r of labels.readings)assert(labels.drawn.some(d=>d.text===r.text&&d.x===r.tx&&d.y===r.valueY),'Real Canvas draws source-backed label');
  // Make a different station the active record, then click the genuine KUSHIMOTO
  // coordinates. The hit-test result is evidence; it is never used as a setter.
  await choose('tide-134');
  const pixel=await page.evaluate(p=>{
    const r=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset,s=(r.width>=901?r.width/360:Math.max(r.width/360,r.height/180))*Number(d.earthZoom),ox=(r.width-360*s)/2+Number(d.earthOffsetX),oy=(r.height-180*s)/2+Number(d.earthOffsetY);
    const x=r.left+ox+((p.lon+390)%360)*s,y=r.top+oy+(90-p.lat)*s-184/15;
    return{x,y,hit:GaiaClimateHistory.findPoiAt(x,y,'mouse')?.record.id,element:document.elementFromPoint(x,y)?.tagName,blocked:!!document.elementFromPoint(x,y)?.closest('button,select,.gaia-climate-legend,.gaia-climate-readout,#map-responsive-data'),legendBottom:document.querySelector('.gaia-climate-legend').getBoundingClientRect().bottom};
  },station);
  assert.equal(pixel.hit,'tide-134',JSON.stringify(pixel));
  assert(!pixel.blocked,`Chosen coastal point is behind UI: ${JSON.stringify(pixel)}`);if(width<901)assert(pixel.y>pixel.legendBottom+10,JSON.stringify(pixel));
  await page.evaluate(()=>GaiaClimateHistory.selectPoint('tide-5',{focus:false}));await stable();
  if(width<901)await page.touchscreen.tap(pixel.x,pixel.y);else await page.mouse.click(pixel.x,pixel.y);
  await page.waitForFunction(()=>GaiaClimateHistory.getState().selectedId==='tide-134');
  await year(2024);assert.equal(await page.locator('[data-climate-value]').textContent(),'204 mm');
  assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().selectedId),'tide-134');
  const coastLabel=await page.evaluate(()=>{const label=GaiaClimateHistory.getSeaState().readings.find(p=>p.id==='tide-134'),rect=GaiaMapObservationAdapter.getViewportRect();return{...label,legendBottom:document.querySelector('.gaia-climate-legend').getBoundingClientRect().bottom,screenTop:rect.top+label.top};});
  assert.equal(coastLabel.text,'+204 mm');assert(coastLabel.left>=0&&coastLabel.right<=width);if(width<901)assert(coastLabel.screenTop>coastLabel.legendBottom,'Full coastal reading clears legend');
  await page.screenshot({path:path.join(out,`${width}-76-coast.png`)});
  await year(2023);assert.equal(await page.locator('[data-climate-value]').textContent(),'欠測');assert.match(await page.locator('[data-sea-note]').textContent(),/欠日/);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getSeaState().readings.find(p=>p.id==='tide-134').text),'欠測');
  await year(2016);
  const stats=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert.equal(stats.id,'climate-sealevel-tide-134');assert.deepEqual(stats.rows.map(r=>r.value),station.years.filter(r=>Number.isFinite(r.value)).map(r=>r.value));
  const layout=await page.evaluate(()=>{const r=document.querySelector('.gaia-climate-legend').getBoundingClientRect();return{scroll:document.documentElement.scrollWidth,width:innerWidth,left:r.left,right:r.right,bottom:r.bottom};});assert(layout.scroll<=width+1&&layout.left>=0&&layout.right<=width);if(width<901)assert(layout.bottom<height-170,JSON.stringify(layout));
  await action('source');await page.locator('#japan-data-panel').waitFor({state:'visible'});assert.match(await page.locator('#japan-data-panel').textContent(),/PSMSL/);assert.match(await page.locator('#japan-data-panel').textContent(),/NOAA/);await page.locator('#japan-data-close').click();
  await action('analysis');await page.waitForFunction(id=>globalThis.GaiaStatisticsLab?.getState().analysisReady&&GaiaStatisticsLab.getState().datasetId===id,stats.id);assert.equal(Number(await page.locator('#gaia-statistics-kpis').getAttribute('data-used-rows')),stats.rows.length);
  if(width===1440){
    const original=await page.evaluate(()=>GaiaStatisticsLab.run('summary'));
    await page.locator('#gaia-statistics-menu-toggle').click();if(await page.locator('.gaia-statistics-data-options').getAttribute('open')===null)await page.locator('.gaia-statistics-data-options summary').click();await page.locator('#gaia-statistics-view-save').click();const saved=await page.locator('#gaia-statistics-saved-view').inputValue();
    await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-77`);await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='electricity'&&GaiaClimateHistory.getState().dataState==='ready');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getSeaState().stationsLoaded),0);
    await page.reload();await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().id==='electricity'&&GaiaClimateHistory.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro'));await page.evaluate(()=>GaiaMapPlayback.stop());
    await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);await page.locator('#gaia-statistics-menu-toggle').click();if(await page.locator('.gaia-statistics-data-options').getAttribute('open')===null)await page.locator('.gaia-statistics-data-options summary').click();await page.locator('#gaia-statistics-saved-view').selectOption(saved);await page.locator('#gaia-statistics-view-apply').click();await page.waitForFunction(id=>GaiaStatisticsLab.getState().analysisReady&&GaiaStatisticsLab.getState().datasetId===id,stats.id);
    const restored=await page.evaluate(()=>GaiaStatisticsLab.run('summary'));assert.equal(restored.stats.mean,original.stats.mean);report.checks.push({savedRecordRestored:stats.id,n:restored.stats.n,mean:restored.stats.mean});
  }
  if(await page.locator('#gaia-statistics-menu-close').isVisible())await page.locator('#gaia-statistics-menu-close').click();
  await page.locator('#gaia-statistics-close').click();
  if(width===1440){await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-76`);await ready();await page.evaluate(()=>GaiaMapPlayback.stop());}
  await choose('pac');await year(2016);const satellite=JSON.parse(fs.readFileSync('data/atlas-history/sealevel.json')).regions.find(r=>r.id==='pac').years.find(r=>r.year===2016);assert.equal(await page.locator('[data-climate-value]').textContent(),`${satellite.value.toLocaleString('ja-JP',{maximumFractionDigits:1})} mm`);assert.match(await page.locator('[data-climate-metric]').textContent(),/衛星/);
  const satelliteLabel=await page.evaluate(()=>GaiaClimateHistory.getSeaState().readings.find(p=>p.id==='pac'));assert.equal(satelliteLabel.value,satellite.value);assert.equal(satelliteLabel.text,'+70.4 mm');
  await page.screenshot({path:path.join(out,`${width}-76-satellite.png`)});
  if(width<901){
    const clearance=await page.evaluate(()=>{const p=GaiaClimateHistory.getSeaState().readings.find(p=>p.id==='pac'),r=GaiaMapObservationAdapter.getViewportRect(),drawer=document.querySelector('#map-responsive-data'),readout=document.querySelector('.gaia-climate-readout');return{top:p.valueY-58+r.top,bottom:p.valueY+4+r.top,legend:document.querySelector('.gaia-climate-legend').getBoundingClientRect().bottom,controls:(drawer.checkVisibility({visibilityProperty:true})?drawer:readout).getBoundingClientRect().top};});
    assert(clearance.top>clearance.legend,'Satellite label clears legend');assert(clearance.bottom<clearance.controls,'Satellite value clears controls');report.checks.push({width,satelliteClearance:clearance});
  }
  await choose('tide-134');
  // The camera's final frame may land between the layer's 24 Hz paint ticks.
  await page.waitForTimeout(150);const before=await page.evaluate(()=>GaiaClimateHistory.getSeaState());await page.waitForTimeout(400);const after=await page.evaluate(()=>GaiaClimateHistory.getSeaState());assert.equal(after.marksPaintCount,before.marksPaintCount,'Idle coast marks cached while the sea moves');assert(after.surface.draws>before.surface.draws,'Ocean surface continues moving');assert(after.surface.landMasked);
  assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);
  report.checks.push({width,height,actualCoastalClick:pixel,layout,coastLabel,satelliteLabel,stationValuesMatch:true,missing2023:true,satellitePreserved:true,sourcePanel:true,analysisRows:stats.rows.length,idleCached:true});console.log(`PASS coast ${width}`);await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
