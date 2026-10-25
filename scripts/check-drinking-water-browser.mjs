import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const out=path.resolve(process.env.GAIA_DRINKING_OUT||'artifacts/drinking-water-20261023/after');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',browser:browser.version(),scope:'Local real source snapshots, external requests blocked; mobile touch emulation, not physical phones',checks:[],errors:[]};let page;
try{
  const sizes=process.env.GAIA_DRINKING_SIZES?JSON.parse(process.env.GAIA_DRINKING_SIZES):[[1440,900],[1920,1080],[1366,768],[390,844],[320,568]];
  for(const [width,height]of sizes){
    const mobile=width<=900,context=await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});
    await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
    await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__drinkingIntro=[];
      const sample=()=>{const i=document.querySelector('#map-data-intro'),c=document.querySelector('#gaia-climate-canvas');if(i&&!i.hidden&&i.dataset.exhibitNumber==='78'&&__drinkingIntro.length<1500)__drinkingIntro.push({opacity:Number(getComputedStyle(i).opacity),shown:c?.checkVisibility({visibilityProperty:true})});requestAnimationFrame(sample);};requestAnimationFrame(sample);
    });
    page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));const requests=[];page.on('request',r=>{if(r.url().includes('/data/atlas-history/'))requests.push(r.url());});
    await page.goto(process.env.GAIA_BASE_URL);await page.waitForTimeout(500);assert.equal(requests.length,0);
    await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-78`);
    await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>{GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});
    if(width===390){await page.waitForFunction(()=>!document.querySelector('#map-data-intro').hidden);await page.waitForTimeout(250);await page.touchscreen.tap(180,450);}
    const stable=async()=>{await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear===String(GaiaClimateHistory.getState().year)&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');await page.waitForTimeout(120);};
    await stable();const result={width,height};report.checks.push(result);
    if(process.env.GAIA_DRINKING_STAGE==='before'){await page.screenshot({path:path.join(out,`${width}-78-gap.png`)});await context.close();continue;}
    const frames=await page.evaluate(()=>__drinkingIntro);assert(frames.length>2&&!frames.some(f=>f.shown));assert(frames.at(-1).opacity<.01);result.fullIntroFade=true;
    assert.equal(await page.locator('[data-drinking-country]').textContent(),'インド');assert.equal(await page.locator('[data-drinking-rate="urban"]').textContent(),'77.7%');assert.equal(await page.locator('[data-drinking-rate="rural"]').textContent(),'55.6%');assert.equal(await page.locator('[data-climate-value]').textContent(),'＋22.1 pt');
    const layout=await page.locator('.gaia-climate-legend').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,overflow:e.scrollWidth>e.clientWidth+1,documentOverflow:document.documentElement.scrollWidth-innerWidth};});assert(layout.left>=0&&layout.right<=width&&!layout.overflow&&layout.documentOverflow<=1,JSON.stringify(layout));result.layout=layout;
    assert(await page.locator('.gaia-climate-primary').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    assert(await page.locator('.drinking-chart-labels').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=9));result.unscaledChartLabels=true;
    const readings=await page.evaluate(()=>GaiaClimateHistory.getRenderState().drinkingReadings);
    const selectedReading=readings.find(p=>p.selected);assert(selectedReading,'selected country reading is visible');assert.equal(selectedReading.id,'IND');assert.equal(selectedReading.urban,77.6777);assert.equal(selectedReading.rural,55.5564);
    for(const p of readings){assert(p.alpha===1&&p.bounds.left>=0&&p.bounds.right<=width&&p.bounds.top>=0&&p.bounds.bottom<=height);}
    const blocked=await page.evaluate(()=>{
      const r=document.querySelector('#gaia-climate-canvas').getBoundingClientRect(),marks=GaiaClimateHistory.getRenderState().drinkingReadings;
      const obstacles=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-toolbar')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(e=>{const b=e.getBoundingClientRect();return{left:b.left-r.left,right:b.right-r.left,top:b.top-r.top,bottom:b.bottom-r.top};});
      return marks.filter(p=>obstacles.some(b=>p.bounds.left<b.right&&p.bounds.right>b.left&&p.bounds.top<b.bottom&&p.bounds.bottom>b.top));
    });assert.deepEqual(blocked,[],'canvas readings clear actual mobile toolbar and panels');
    assert.equal(await page.locator('.drinking-axis-high').textContent(),'100%');assert((await page.locator('[data-drinking-chart]').getAttribute('aria-label')).includes('都市77.7%、農村55.6%'));result.comparisonReadings=readings;
    const point=await page.evaluate(()=>{const p=GaiaMapObservationAdapter.getCountryGeometry().countries.find(s=>s.iso3==='IND'),r=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset,s=(r.width>=901?r.width/360:Math.max(r.width/360,r.height/180))*Number(d.earthZoom),x=r.left+(r.width-360*s)/2+Number(d.earthOffsetX)+((p.lon+390)%360)*s,y=r.top+(r.height-180*s)/2+Number(d.earthOffsetY)+(90-p.lat)*s;return{x,y,hit:GaiaClimateHistory.findPoiAt(x,y,'touch')?.record.id,blocked:!!document.elementFromPoint(x,y)?.closest('button,select,.gaia-climate-legend,.gaia-climate-readout,#map-responsive-data')};});
    assert.equal(point.hit,'IND');assert(!point.blocked,JSON.stringify(point));
    await page.evaluate(()=>GaiaClimateHistory.selectPoint('BGD',{focus:false}));await stable();if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>GaiaClimateHistory.getState().selectedId==='IND');await stable();result.realCountryTap=true;
    await page.screenshot({path:path.join(out,`${width}-78-gap.png`)});
    if(!mobile){const neighbor=(await page.evaluate(()=>GaiaClimateHistory.getRenderState().drinkingReadings)).find(p=>!p.selected&&Number.isFinite(p.value));assert(neighbor);const r=await page.locator('#gaia-climate-canvas').boundingBox();await page.mouse.click(r.x+(neighbor.bounds.left+neighbor.bounds.right)/2,r.y+(neighbor.bounds.top+neighbor.bounds.bottom)/2);await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,neighbor.id);await stable();await page.evaluate(()=>GaiaClimateHistory.selectPoint('IND'));await stable();result.neighborReadingClick=true;}
    const paints=await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count');await page.waitForTimeout(500);assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count'),paints);result.idleCached=true;
    const stats=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert.equal(stats.id,'climate-drinking-IND-gap');assert.equal(stats.rows.find(r=>r.year===2016).y,22.1213);assert.deepEqual(await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),stats.id),stats);result.derivedStatsRestored=true;
    const chart=await page.locator('[data-drinking-chart]').boundingBox(),x=chart.x+chart.width*(42+5*22)/600,y=chart.y+chart.height*.5;if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2005);await stable();await page.locator('[data-drinking-chart]').focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2006);await stable();result.chartTapAndKeyboard=true;
    const drawer=page.locator('#map-responsive-data');if(await drawer.isVisible()&&await drawer.getAttribute('open')===null)await drawer.locator(':scope > summary').click();
    await page.locator('[data-climate-year]').fill('2024');await stable();assert.equal(await page.locator('[data-climate-value]').textContent(),'＋10.3 pt');await page.locator('[data-climate-year]').fill('2016');await stable();
    if(await drawer.getAttribute('open')!==null)await drawer.locator(':scope > summary').click();
    await page.locator('[data-drinking-mode="national"]').click();await stable();assert.equal(await page.locator('[data-climate-value]').textContent(),'62.9 %');await page.screenshot({path:path.join(out,`${width}-78-national.png`)});await page.locator('[data-drinking-mode="gap"]').click();await stable();result.yearAndModeFade=true;
    await page.evaluate(()=>GaiaClimateHistory.selectPoint('BGD'));await stable();assert.equal(await page.locator('[data-drinking-gap]').textContent(),'農村が 13.2 pt 高い');assert.equal(await page.locator('[data-climate-value]').textContent(),'-13.2 pt');await page.screenshot({path:path.join(out,`${width}-78-rural-higher.png`)});result.negativeGap=true;
    await page.evaluate(()=>GaiaClimateHistory.selectPoint('USA'));await stable();assert.equal(await page.locator('[data-drinking-rate="rural"]').textContent(),'欠測');assert.equal(await page.locator('[data-climate-value]').textContent(),'欠測');assert(await page.locator('[data-climate-analysis]').isDisabled());result.missingPair=true;
    await page.evaluate(()=>GaiaClimateHistory.selectPoint('IND'));await stable();
    if(width===1440){
      await page.locator('[data-climate-source]').click();await page.locator('#japan-data-panel').waitFor({state:'visible'});assert((await page.locator('#japan-data-panel').textContent()).includes('都市人口・農村人口'));
      for(const code of ['SH.H2O.SMDW.UR.ZS','SH.H2O.SMDW.RU.ZS'])assert(await page.locator(`#japan-data-panel a[href="https://data.worldbank.org/indicator/${code}"]`).isVisible());
      await page.locator('#japan-data-close').click();
      await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady&&GaiaStatisticsLab.getState().datasetId==='climate-drinking-IND-gap');assert.equal(Number(await page.locator('#gaia-statistics-kpis').getAttribute('data-used-rows')),25);
      await page.locator('#gaia-statistics-menu-toggle').click();const options=page.locator('.gaia-statistics-data-options');if(await options.getAttribute('open')===null)await options.locator('summary').click();await page.locator('#gaia-statistics-view-save').click();const saved=await page.locator('#gaia-statistics-saved-view').inputValue();await page.locator('#gaia-statistics-record-filter').fill('no-matching-drinking-record');await page.locator('#gaia-statistics-saved-view').selectOption(saved);await page.locator('#gaia-statistics-view-apply').click();assert.equal(await page.locator('#gaia-statistics-record-filter').inputValue(),'');await page.locator('#gaia-statistics-menu-close').click();await page.locator('#gaia-statistics-close').click();result.actualSourceAnalysisAndSave=true;
    }
    if(width===320){await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-drinking-mode="national"]').click();await stable();result.reducedMotion=true;}
    await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='sanitation'&&GaiaClimateHistory.getState().dataState==='ready');await stable();assert(!await page.locator('[data-drinking-panel]').isVisible());assert.equal(await page.evaluate(()=>GaiaClimateHistory.getDrinkingState().comparisonReady),false);
    await page.locator('[data-map-stable-step="-1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='drinking'&&GaiaClimateHistory.getState().dataState==='ready');await stable();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getDrinkingState().mode),'gap');result.exitAndReturn=true;
    if(width===1440){
      await page.reload();await stable();await page.evaluate(()=>GaiaMapPlayback.stop());assert.deepEqual(await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),stats.id),stats);result.reloadRestore=true;
      await context.route('**/drinking-comparison.json?*',r=>r.abort());await page.reload();await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='error');await context.unroute('**/drinking-comparison.json?*');await page.locator('[data-climate-retry]').click();await stable();assert(await page.evaluate(()=>GaiaClimateHistory.getDrinkingState().comparisonReady));result.failedSourceRetry=true;
      await page.evaluate(()=>GaiaMapPlayback.stop());await page.locator('#gaia-map-playback-toggle').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2017);await page.locator('#gaia-map-playback-toggle').click();result.autoplay=true;
    }
    assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);console.log(`PASS drinking ${width}x${height}`);await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed()){await page.screenshot({path:path.join(out,'failure.png')});report.state=await page.evaluate(()=>({state:globalThis.GaiaClimateHistory?.getState(),canvas:document.querySelector('#gaia-climate-canvas')?.dataset}));}throw e;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
