import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const stage=process.env.GAIA_WATER_STAGE||'after',out=path.resolve(process.env.GAIA_WATER_OUT||`artifacts/water-storage-gis-20261022/${stage}`);fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Local installed Chrome and real bundled NASA data. Mobile emulation; no production or physical device check.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const [width,height]of JSON.parse(process.env.GAIA_WATER_SIZES||'[[1920,1080],[1440,900],[1366,768],[390,844],[320,568]]')){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<901,hasTouch:width<901});await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**/*',r=>r.abort());
  await context.addInitScript(()=>{
    sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');
    window.__waterLabels=[];const fill=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){if(/(?: cm|欠測)$/.test(text)&&window.__waterLabels.length<2000)window.__waterLabels.push({text,x,y,alpha:this.globalAlpha});return fill.call(this,text,x,y,...args);};
  });
  page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-75`);
  await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>GaiaModeEntryGuide.close('map',{restoreFocus:false}));
  await page.waitForFunction(()=>!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');
  await page.evaluate(()=>GaiaMapPlayback.stop());await page.screenshot({path:path.join(out,`${width}-75.png`)});
  if(stage!=='before'){
    const poiEvidence=await page.evaluate(()=>({markers:GaiaClimateHistory.getWaterState().markers,drawn:window.__waterLabels}));
    assert(poiEvidence.markers.length>0);
    assert(poiEvidence.drawn.some(d=>d.alpha>0&&d.alpha<1),'Actual Canvas labels fade in before settling');
    for(const p of poiEvidence.markers){assert.equal(p.alpha,1);assert(poiEvidence.drawn.some(d=>d.text===p.text&&d.x===p.x&&d.y===p.y+25&&d.alpha===1),'Actual Canvas label matches the POI data');}
    report.checks.push({width,regionalPoiLabels:poiEvidence.markers.map(({id,value,text,rgb})=>({id,value,text,rgb}))});
    if(width<901){
      const clearance=await page.evaluate(()=>{const p=GaiaClimateHistory.getWaterState().markers.find(p=>p.id===GaiaClimateHistory.getState().selectedId),rect=GaiaMapObservationAdapter.getViewportRect(),legend=document.querySelector('.gaia-climate-legend').getBoundingClientRect(),drawer=document.querySelector('#map-responsive-data'),readout=document.querySelector('.gaia-climate-readout');return{labelTop:p.y+rect.top-32,labelBottom:p.y+rect.top+28,legendBottom:legend.bottom,controlsTop:(drawer.checkVisibility({visibilityProperty:true})?drawer:readout).getBoundingClientRect().top};});
      assert(clearance.labelTop>clearance.legendBottom,'Selected POI name clears the legend');assert(clearance.labelBottom<clearance.controlsTop,'Selected value clears the controls');report.checks.push({width,clearance});
    }
    if(width===1440){
      const before=await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count');await page.waitForTimeout(400);
      assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count'),before,'Settled POIs do not keep repainting');
      const india=poiEvidence.markers.find(p=>p.id==='india');assert(india);
      await page.mouse.click(india.x,india.y);await page.waitForFunction(()=>GaiaClimateHistory.getState().selectedId==='india'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
      assert.equal(await page.locator('[data-climate-value]').textContent(),'-16.2 cm');
      await page.locator('[data-climate-overview]').click();await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
      report.checks.push({width,actualRegionalPoiClick:true,idleCached:true});
    }
    const controls=async()=>{if(!await page.locator('[data-climate-year]').isVisible())await page.locator('#map-responsive-data > summary').click();};
    const closeControls=async()=>{const drawer=page.locator('#map-responsive-data');if(await drawer.isVisible()&&await drawer.getAttribute('open')!==null)await drawer.locator(':scope > summary').click();};
    const stable=()=>page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&Number(document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear)===GaiaClimateHistory.getState().year&&GaiaClimateHistory.getWaterState().textureYear===GaiaClimateHistory.getState().year);
    const pixel=await page.evaluate(()=>{
      const rect=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset,s=Math.max(.1,rect.width>=901?rect.width/360:Math.max(rect.width/360,rect.height/180))*Number(d.earthZoom),ox=(rect.width-360*s)/2+Number(d.earthOffsetX),oy=(rect.height-180*s)/2+Number(d.earthOffsetY);
      // Search visible genuine source cells; this probes the rendered map, not a
      // setter. The actual click below must select the same delivered cell.
      for(let lat=15.25;lat<38;lat+=1)for(let lon=72.25;lon<95;lon+=1){const x=rect.left+ox+((lon+30+360)%360)*s,y=rect.top+oy+(90-lat)*s;if(x<70||x>rect.width-16||y<170||y>rect.height-180)continue;if(document.elementFromPoint(x,y)?.closest('button,select,.gaia-climate-legend,.gaia-climate-readout,#map-responsive-data'))continue;const hit=GaiaClimateHistory.findPoiAt(x,y,'mouse');if(hit?.record.id.startsWith('cell-'))return{x,y,id:hit.record.id};}return null;
    });assert(pixel,`No unblocked land cell at ${width}`);
    if(width<901)await page.touchscreen.tap(pixel.x,pixel.y);else await page.mouse.click(pixel.x,pixel.y);
    await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,pixel.id);
    const first=await page.evaluate(()=>({state:GaiaClimateHistory.getWaterState(),dataset:GaiaClimateHistory.getStatisticsDataset(),row:document.querySelector('[data-climate-value]').textContent}));
    assert.equal(first.state.engine,'webgl2');assert.equal(first.dataset.rows.length,19);assert.equal(first.dataset.missingCount,3);
    const {decodeWaterGrid,waterCellById,waterCellRegion}=await import('../src/exploration/water-storage-grid.js');
    const grid=decodeWaterGrid(JSON.parse(fs.readFileSync('data/atlas-history/waterstore-grid.json'))),cell=waterCellById(grid,pixel.id),values=waterCellRegion(grid,cell).years;
    assert.deepEqual(first.dataset.rows.map(r=>r.value),values.filter(r=>r.value!==null).map(r=>r.value));
    await controls();await page.locator('[data-climate-year]').fill('2024');await closeControls();await stable();
    assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().selectedId),pixel.id);
    const expected=values.find(r=>r.year===2024).value.toLocaleString('ja-JP',{maximumFractionDigits:1});assert.equal(await page.locator('[data-climate-value]').textContent(),`${expected} cm`);
    await page.screenshot({path:path.join(out,`${width}-75-cell.png`)});
    await controls();await page.locator('[data-climate-year]').fill('2018');await closeControls();await stable();assert.equal(await page.locator('[data-climate-value]').textContent(),'欠測');
    assert((await page.evaluate(()=>GaiaClimateHistory.getWaterState().markers)).every(p=>!p.valid&&p.text==='欠測'));
    await controls();await page.locator('[data-climate-year]').fill('2016');await closeControls();await stable();
    const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,rect:(()=>{const r=document.querySelector('.gaia-climate-legend').getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right};})()}));assert(size.scroll<=size.width+1);if(width<901)assert(size.rect.bottom<height-185);
    if(width===1440){
      const count=await page.evaluate(()=>GaiaClimateHistory.getWaterState().textureCount);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>GaiaClimateHistory.getWaterState().textureCount),count);
      const oldZoom=Number(await page.locator('#japan-overlay').getAttribute('data-earth-zoom'));await page.mouse.move(pixel.x,pixel.y);await page.mouse.wheel(0,-180);await page.waitForTimeout(300);assert(Number(await page.locator('#japan-overlay').getAttribute('data-earth-zoom'))>oldZoom);
      const state=await page.locator('#japan-overlay').getAttribute('data-earth-offset-x');await page.mouse.move(pixel.x,pixel.y);await page.mouse.down();await page.mouse.move(pixel.x+70,pixel.y+35,{steps:10});await page.mouse.up();await page.waitForTimeout(200);assert.notEqual(await page.locator('#japan-overlay').getAttribute('data-earth-offset-x'),state);
      assert.equal(await page.evaluate(()=>GaiaClimateHistory.getWaterState().textureCount),count,'Pan/zoom reuses year texture');
      await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
      const original=await page.evaluate(()=>GaiaStatisticsLab.run('summary'));assert.equal(original.stats.n,19);
      await page.locator('#gaia-statistics-menu-toggle').click();if(await page.locator('.gaia-statistics-data-options').getAttribute('open')===null)await page.locator('.gaia-statistics-data-options summary').click();await page.locator('#gaia-statistics-view-save').click();const saved=await page.locator('#gaia-statistics-saved-view').inputValue();
      await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-76`);
      const onSealevel=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().id==='sealevel'&&GaiaClimateHistory.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro'));
      // A hash-only goto retains the document. Wait for the destination, check
      // release, then genuinely reload to test persistent saved-cell recovery.
      await onSealevel();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getWaterState().texturePixels),0);
      await page.reload();await onSealevel();await page.evaluate(()=>GaiaMapPlayback.stop());
      assert.equal(await page.evaluate(()=>GaiaClimateHistory.getWaterState().texturePixels),0);await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
      await page.locator('#gaia-statistics-menu-toggle').click();if(await page.locator('.gaia-statistics-data-options').getAttribute('open')===null)await page.locator('.gaia-statistics-data-options summary').click();await page.locator('#gaia-statistics-saved-view').selectOption(saved);await page.locator('#gaia-statistics-view-apply').click();await page.waitForFunction(id=>GaiaStatisticsLab.getState().datasetId===id&&GaiaStatisticsLab.getState().analysisReady,first.dataset.id);
      const restored=await page.evaluate(()=>GaiaStatisticsLab.run('summary'));assert.equal(restored.stats.mean,original.stats.mean);report.checks.push({savedCellRestored:first.dataset.id,n:restored.stats.n,mean:restored.stats.mean});
    }
    assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);
    report.checks.push({width,actualClick:pixel,cellValueMatchesSource:true,sameCellAcrossYears:true,missing2018:true,renderer:first.state.engine});
  }
  report.checks.push({width,height,stage});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
