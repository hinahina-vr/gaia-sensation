import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const stage=process.env.GAIA_ELECTRICITY_STAGE||'after';
const out=path.resolve(process.env.GAIA_ELECTRICITY_OUT||'artifacts/electricity-access-20261022/after');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',browser:browser.version(),scope:'Local real snapshots; external requests blocked; touch emulation, not a physical phone',checks:[],errors:[]};
try{
  const sizes=process.env.GAIA_ELECTRICITY_SIZES?JSON.parse(process.env.GAIA_ELECTRICITY_SIZES):[[1440,900],[1920,1080],[1366,768],[390,844],[320,568]];
  for(const [width,height]of sizes){
    const mobile=width<=900,context=await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});
    await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
    await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__electricityIntro=[];
      window.__electricityLabels=[];const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){if(/(?:%| pt|欠測)$/.test(text)&&__electricityLabels.length<5000)__electricityLabels.push({text,x,y,alpha:this.globalAlpha});return fill.call(this,text,x,y,...args);};
      const capture=()=>{const i=document.querySelector('#map-data-intro'),c=document.querySelector('#gaia-climate-canvas');if(i&&!i.hidden&&i.dataset.exhibitNumber==='77'&&__electricityIntro.length<1500)__electricityIntro.push({opacity:Number(getComputedStyle(i).opacity),shown:c?.checkVisibility({visibilityProperty:true})});requestAnimationFrame(capture);};requestAnimationFrame(capture);
    });
    const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
    const requests=[];page.on('request',r=>{if(r.url().includes('/data/atlas-history/'))requests.push(r.url());});
    await page.goto(process.env.GAIA_BASE_URL);await page.waitForTimeout(500);assert.equal(requests.length,0);
    await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-77`);
    await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>{GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});
    if(width===390){await page.waitForFunction(()=>!document.querySelector('#map-data-intro').hidden);await page.waitForTimeout(250);await page.touchscreen.tap(200,450);}
    const stable=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear===String(GaiaClimateHistory.getState().year)&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
    await stable();await page.waitForTimeout(150);await page.screenshot({path:path.join(out,`${width}-77-access.png`)});
    const result={width,height};report.checks.push(result);
    if(stage==='before'){await context.close();continue;}
    assert.equal(await page.locator('[data-electricity-country]').textContent(),'ケニア');assert.equal(await page.locator('[data-electricity-value]').textContent(),'53.1%');assert.equal(await page.locator('[data-electricity-change]').textContent(),'＋37.9 pt');assert.equal(await page.locator('[data-electricity-region-value]').textContent(),'43.8%');
    const reading=await page.evaluate(()=>{
      const marks=GaiaClimateHistory.getRenderState().electricityLabels,selected=marks.find(p=>p.selected),rect=document.querySelector('#gaia-climate-canvas').getBoundingClientRect();
      const blockers=[...document.querySelectorAll('#map-stable-navigation,.japan-heading,.gaia-climate-legend,#gaia-map-zoom-controls,.gaia-climate-readout,#map-responsive-data,#map-mobile-bottom')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(e=>{const r=e.getBoundingClientRect();return {left:r.left-rect.left,right:r.right-rect.left,top:r.top-rect.top,bottom:r.bottom-rect.top};});
      return {marks,selected,blocked:selected&&blockers.some(b=>selected.bounds.left<b.right&&selected.bounds.right>b.left&&selected.bounds.top<b.bottom&&selected.bounds.bottom>b.top)};
    });
    assert.equal(reading.selected?.id,'KEN',JSON.stringify(reading));assert.equal(reading.selected.text,'53.1%');assert.equal(reading.selected.baseline,15.2);assert.equal(reading.selected.alpha,1);assert(!reading.blocked,JSON.stringify(reading));if(!mobile)assert(reading.marks.length>3);result.countryReadings=reading;
    const drawn=await page.evaluate(()=>__electricityLabels);assert(drawn.some(p=>p.text==='53.1%'&&p.alpha>0&&p.alpha<.8),'Actual selected label fades in');assert(reading.marks.every(p=>drawn.some(t=>t.text===p.text&&t.alpha===1)),'All reported labels were drawn');result.actualCanvasFade=true;
    const frames=await page.evaluate(()=>__electricityIntro);assert(frames.length>2);assert(!frames.some(f=>f.shown));assert(frames.at(-1).opacity<.01);result.fullIntroFade=true;
    const layout=await page.locator('.gaia-climate-legend').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,overflow:e.scrollWidth>e.clientWidth+1,documentOverflow:document.documentElement.scrollWidth-innerWidth};});assert(layout.left>=0&&layout.right<=width&&!layout.overflow&&layout.documentOverflow<=1,JSON.stringify(layout));if(mobile)assert(layout.bottom<height-170,JSON.stringify(layout));result.layout=layout;
    if(!mobile){const dock=await page.locator('.gaia-climate-readout').boundingBox();assert(layout.bottom<dock.y,'Legend must clear bottom controls');}
    const countryPoint=await page.evaluate(()=>{
      const p=GaiaMapObservationAdapter.getCountryGeometry().countries.find(s=>s.iso3==='KEN'),r=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset,s=(r.width>=901?r.width/360:Math.max(r.width/360,r.height/180))*Number(d.earthZoom),x=r.left+(r.width-360*s)/2+Number(d.earthOffsetX)+((p.lon+390)%360)*s,y=r.top+(r.height-180*s)/2+Number(d.earthOffsetY)+(90-p.lat)*s;
      return{x,y,hit:GaiaClimateHistory.findPoiAt(x,y,'touch')?.record.id,blocked:!!document.elementFromPoint(x,y)?.closest('button,select,.gaia-climate-legend,.gaia-climate-readout,#map-responsive-data'),viewport:{width:r.width,height:r.height,top:r.top},map:document.querySelector('#japan-map').getBoundingClientRect().toJSON(),legend:document.querySelector('.gaia-climate-legend').getBoundingClientRect().toJSON(),drawer:document.querySelector('#map-responsive-data').getBoundingClientRect().toJSON(),view:{...d}};
    });assert.equal(countryPoint.hit,'KEN');assert(!countryPoint.blocked,JSON.stringify(countryPoint));
    await page.evaluate(()=>GaiaClimateHistory.selectPoint('IND',{focus:false}));await stable();
    if(mobile)await page.touchscreen.tap(countryPoint.x,countryPoint.y);else await page.mouse.click(countryPoint.x,countryPoint.y);
    await page.waitForFunction(()=>GaiaClimateHistory.getState().selectedId==='KEN');await stable();await page.waitForTimeout(150);result.realCountryTap=true;
    if(width===1440){
      const target=await page.evaluate(()=>{const p=GaiaClimateHistory.getRenderState().electricityLabels.find(p=>!p.selected),r=document.querySelector('#gaia-climate-canvas').getBoundingClientRect();return {id:p.id,x:r.left+(p.bounds.left+p.bounds.right)/2,y:r.top+(p.bounds.top+p.bounds.bottom)/2};});
      await page.mouse.click(target.x,target.y);await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,target.id);await stable();
      await page.locator('[data-electricity-country-id="KEN"]').click();await stable();result.neighborLabelClick=target.id;
      const countBefore=await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count');await page.locator('.gaia-climate-legend').focus();await page.keyboard.press('ArrowLeft');await page.waitForFunction(n=>document.querySelector('#gaia-climate-canvas').dataset.climatePaintCount!==n,countBefore);result.legendMovementRepaints=true;
      await page.locator('.electricity-heading').dblclick();await stable();await page.waitForTimeout(150);
    }
    const count=await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count');await page.waitForTimeout(600);assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count'),count);result.idleCached=true;
    await page.locator('[data-electricity-mode="change"]').click();await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='running');await stable();assert.equal(await page.locator('[data-climate-value]').textContent(),'＋37.9 pt');assert.equal(await page.locator('[data-climate-value] .gaia-climate-unit').getAttribute('title'),'ポイント');
    assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().electricityLabels.find(p=>p.selected)?.text),'＋37.9 pt');
    assert(await page.locator('.gaia-climate-primary').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Metric and unit must fit their own column');
    const stats=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert.equal(stats.id,'climate-electricity-KEN-change');assert.deepEqual(await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),stats.id),stats);result.derivedStatisticsRestored=true;
    const chart=await page.locator('[data-electricity-chart]').boundingBox();const cx=chart.x+chart.width*(40+548*(2005-2000)/24)/600,cy=chart.y+chart.height*.5;
    if(mobile)await page.touchscreen.tap(cx,cy);else await page.mouse.click(cx,cy);await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2005);await stable();result.chartYearTap=true;
    await page.locator('[data-electricity-chart]').focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2006);await stable();result.chartKeyboard=true;
    const drawer=page.locator('#map-responsive-data');if(await drawer.isVisible()&&await drawer.getAttribute('open')===null)await drawer.locator(':scope > summary').click();
    await page.locator('[data-climate-year]').fill('2024');await stable();assert.equal(await page.locator('[data-electricity-value]').textContent(),'77%');assert.equal(await page.locator('[data-climate-value]').textContent(),'＋61.8 pt');
    await page.locator('[data-climate-year]').fill('2016');await stable();if(await drawer.getAttribute('open')!==null)await drawer.locator(':scope > summary').click();
    await page.screenshot({path:path.join(out,`${width}-77-change.png`)});result.yearCrossfade=true;
    if(width===1440){
      await page.locator('[data-climate-source]').click();await page.locator('#japan-data-panel').waitFor({state:'visible'});assert((await page.locator('#japan-data-panel').textContent()).includes('同じWDI保存版'));await page.locator('#japan-data-close').click();
      await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady&&GaiaStatisticsLab.getState().datasetId==='climate-electricity-KEN-change');assert.equal(Number(await page.locator('#gaia-statistics-kpis').getAttribute('data-used-rows')),25);await page.locator('#gaia-statistics-close').click();result.actualSourceAndStatistics=true;
      await page.locator('[data-climate-analysis]').click();await page.waitForFunction(()=>GaiaStatisticsLab.getState().analysisReady);
      await page.locator('#gaia-statistics-menu-toggle').click();const options=page.locator('.gaia-statistics-data-options');if(await options.getAttribute('open')===null)await options.locator('summary').click();
      await page.locator('#gaia-statistics-view-save').click();const saved=await page.locator('#gaia-statistics-saved-view').inputValue();
      await page.locator('#gaia-statistics-record-filter').fill('no-matching-electricity-record');await page.locator('#gaia-statistics-saved-view').selectOption(saved);await page.locator('#gaia-statistics-view-apply').click();assert.equal(await page.locator('#gaia-statistics-record-filter').inputValue(),'');
      await page.locator('#gaia-statistics-menu-close').click();await page.locator('#gaia-statistics-close').click();result.savedViewApplied=true;
      await page.locator('[data-electricity-country-id="IND"]').click();await stable();assert.equal(await page.locator('[data-electricity-country]').textContent(),'インド');assert.equal(await page.locator('[data-electricity-region]').textContent(),'南アジア');
    }
    await page.locator('[data-electricity-mode="access"]').click();await stable();
    if(width===1440){
      await page.locator('[data-climate-point]').selectOption('LBR');await stable();await page.locator('[data-climate-year]').fill('2000');await stable();
      assert.equal(await page.locator('[data-electricity-value]').textContent(),'欠測');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().electricityLabels.find(p=>p.selected)?.text),'欠測');
      await page.locator('[data-climate-year]').fill('2016');await stable();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().electricityLabels.find(p=>p.selected)?.baseline),null);
      await page.locator('[data-electricity-mode="change"]').click();await stable();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getRenderState().electricityLabels.find(p=>p.selected)?.text),'欠測');result.missingBaselineAndYear=true;
      await page.locator('[data-electricity-country-id="KEN"]').click();await stable();await page.locator('[data-electricity-mode="access"]').click();await stable();await page.locator('[data-climate-overview]').click();await stable();await page.screenshot({path:path.join(out,`${width}-77-world.png`)});
    }
    if(width===320){await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-electricity-mode="change"]').click();await stable();assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-year-fade'),'complete');result.reducedMotion=true;}
    await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='drinking'&&GaiaClimateHistory.getState().dataState==='ready');await stable();assert(!await page.locator('[data-electricity-panel]').isVisible());assert.equal(await page.evaluate(()=>GaiaClimateHistory.getElectricityState().comparisonReady),false);
    await page.locator('[data-map-stable-step="-1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='electricity'&&GaiaClimateHistory.getState().dataState==='ready');await stable();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getElectricityState().mode),'access');result.entryExitReset=true;
    if(width===1440){
      await page.reload();await stable();await page.evaluate(()=>GaiaMapPlayback.stop());
      assert.deepEqual(await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),stats.id),stats);result.reloadRestored=true;
      await context.route('**/electricity-comparison.json?*',r=>r.abort());await page.reload();await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='error');
      await context.unroute('**/electricity-comparison.json?*');await page.locator('[data-climate-retry]').click();await stable();assert.equal(await page.evaluate(()=>GaiaClimateHistory.getElectricityState().comparisonReady),true);result.failedComparisonRetry=true;
      await page.evaluate(()=>GaiaMapPlayback.stop());await page.locator('#gaia-map-playback-toggle').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2017);await page.locator('#gaia-map-playback-toggle').click();result.autoplay=true;
    }
    assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);
    console.log(`PASS electricity ${width}x${height}`);await context.close();
  }assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;throw error;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
