import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {ATLAS_EXHIBITS,atlasRow} from '../src/exploration/atlas-history-model.js';
const definitions=ATLAS_EXHIBITS.filter(d=>+d.number>=Number(process.env.GAIA_ATLAS_FROM||75)&&+d.number<=Number(process.env.GAIA_ATLAS_TO||90));
const base=process.env.GAIA_BASE_URL,out=path.resolve(process.env.GAIA_ATLAS_OUT||'artifacts/atlas-history-20261022');fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',environment:'Installed Chrome headless, local real snapshots, external network blocked, mobile emulation',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
const settled=async()=>{await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');await page.evaluate(()=>GaiaMapPlayback.stop());};
try{
  const sizes=process.env.GAIA_ATLAS_SIZES?JSON.parse(process.env.GAIA_ATLAS_SIZES):[[1920,1080],[1366,768],[390,844],[320,568]];
  for(const [width,height]of sizes){
    const mobile=width<=900,context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
    await enforceBrowserSecurity(context,base);await context.route('https://**/*',r=>r.abort());
    await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__atlasIntro=[];
      const sample=()=>{const l=document.querySelector('#japan-layer'),i=document.querySelector('#map-data-intro'),c=document.querySelector('#gaia-climate-canvas');if(i&&!i.hidden&&+i.dataset.exhibitNumber>=75){window.__atlasIntro.push({number:i.dataset.exhibitNumber,opacity:+getComputedStyle(i).opacity,visible:c?.checkVisibility({visibilityProperty:true}),playing:globalThis.GaiaMapPlayback?.getState().playing});if(window.__atlasIntro.length>2000)window.__atlasIntro.shift();}requestAnimationFrame(sample);};requestAnimationFrame(sample);
    });
    page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.text().startsWith('Climate snapshot unavailable'))console.log(m.text());});
    const requests=[];page.on('request',r=>{if(r.url().includes('/data/atlas-history/'))requests.push(r.url());});
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForTimeout(500);assert.equal(requests.length,0,'No new data on title');
    await page.goto(`${base}/world.html#world-${definitions[0].number}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(id=>globalThis.GaiaClimateHistory?.getState().id===id,definitions[0].id);await page.evaluate(()=>{GaiaModeEntryGuide?.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});
    await settled();assert.equal(await page.evaluate(()=>GaiaMapCategories.buttons().length),100);
    for(const d of definitions){
      if(d!==definitions[0]){await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(id=>GaiaClimateHistory.getState().id===id,d.id);await settled();}
      assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().year),2016);
      // Exhibits 80/82 open on the baseline difference. This generic source-
      // series check deliberately selects its published share before comparing.
      if(d.id==='cropland'){await page.locator('[data-cropland-mode="share"]').click();await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');}
      if(d.id==='foresthistory'){await page.locator('[data-forest-mode="share"]').click();await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');}
      assert.equal(await page.locator('#gaia-climate-canvas').isVisible(),true);
      const visible=Number(await page.locator('#gaia-climate-canvas').getAttribute('data-climate-visible-count'));assert(visible>0,`${d.number} no data marks`);
      if(d.visualReading){const gpu=await page.evaluate(()=>GaiaClimateHistory.getRenderState());assert.equal(gpu.engine,'webgl2',`${d.number} GPU shader compiled`);assert.equal(gpu.contexts,1,'One reused GPU context');assert(gpu.glyphs>0,'Actual data glyphs rendered');assert(gpu.width*gpu.height<=1810000,'Bounded GPU backing store');}
      const info=await page.evaluate(()=>GaiaClimateHistory.getSourceInfo());assert.equal(info.number,d.number);assert(info.datasets[0].attributionNote.length>90);
      const intro=await page.evaluate(n=>window.__atlasIntro.filter(i=>i.number===n),d.number);assert(intro.length>2,`No intro ${d.number}`);assert(!intro.some(i=>i.visible||i.playing),'No data/playback before full fade');assert(intro.at(-1).opacity<.01,'Full fade to zero');
      if(mobile&&await page.locator('#map-responsive-data').isVisible()&&await page.locator('#map-responsive-data').getAttribute('open')===null)await page.locator('#map-responsive-data > summary').tap();
      await page.locator('[data-climate-point]').selectOption(d.id==='sealevel'?'atl':{index:1});
      await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(650);
      const data=JSON.parse(fs.readFileSync(`data/atlas-history/${d.id}.json`)),chosen=await page.locator('[data-climate-point]').inputValue();
      await page.locator('[data-climate-year]').fill('2005');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='running');
      await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
      const row=atlasRow(data.regions.find(r=>r.id===chosen),2005,d.defaultMonth);
      const shown=await page.locator('[data-climate-value]').textContent();assert.equal(shown,Number.isFinite(row.value)?`${row.value.toLocaleString('ja-JP',{maximumFractionDigits:1})} ${d.unit}`:'欠測');
      await page.locator('[data-climate-year]').fill('2016');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2016'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
      if(d.monthly){
        await page.locator('[data-climate-basin]').selectOption('1');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
        assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().month),1);
        const january=atlasRow(data.regions.find(r=>r.id===chosen),2016,1);assert.equal(await page.locator('[data-climate-value]').textContent(),`${january.value.toLocaleString('ja-JP',{maximumFractionDigits:1})} ${d.unit}`);
        if(d.id==='seaice'){await page.locator('[data-climate-year]').fill('1988');assert.equal(await page.locator('[data-climate-value]').textContent(),'欠測');await page.locator('[data-climate-year]').fill('2016');}
        const monthly=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert(monthly.id.endsWith('-m01'));assert.deepEqual(await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),monthly.id),monthly);
        await page.locator('[data-climate-basin]').selectOption(String(d.defaultMonth));await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
      }
      const stats=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert(stats.rows.length>10);assert.deepEqual(await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),stats.id),stats);
      if(mobile&&await page.locator('#map-responsive-data').isVisible()&&await page.locator('#map-responsive-data').getAttribute('open')!==null)await page.locator('#map-responsive-data > summary').tap();
      await page.locator('[data-climate-overview]').evaluate(e=>e.click());await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(450);
      const layout=await page.evaluate(()=>Object.fromEntries(['.gaia-climate-readout','.gaia-climate-legend','#map-mobile-bottom'].filter(s=>document.querySelector(s)?.checkVisibility({visibilityProperty:true})).map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return [s,{x:r.x,y:r.y,right:r.right,bottom:r.bottom,overflow:e.scrollWidth>e.clientWidth+1}];})));
      for(const [s,r]of Object.entries(layout)){assert(r.x>=-1&&r.right<=width+1&&r.y>=-1&&r.bottom<=height+1,`${s} clipping ${width} ${JSON.stringify(r)}`);assert(!r.overflow,`${s} overflow ${width}`);}
      await page.screenshot({path:path.join(out,`${width}x${height}-${d.number}.png`)});
      const count=await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count');await page.waitForTimeout(300);assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count'),count,'Static layer is cached');
      // Actual source / statistics panels, not merely provider objects.
      const action=async name=>{if(mobile){await page.locator('[data-mobile-sheet="tools"]').tap();await page.getByRole('button',{name:name==='source'?'データの出典':'統計分析',exact:true}).last().tap();}else await page.locator(`[data-climate-${name}]`).click();};
      await action('source');await page.locator('#japan-data-panel').waitFor({state:'visible'});assert((await page.locator('#japan-data-panel').textContent()).includes(d.signalLabel));await page.locator('#japan-data-close').click();
      await action('analysis');await page.waitForFunction(id=>globalThis.GaiaStatisticsLab?.getState().analysisReady&&GaiaStatisticsLab.getState().datasetId===id,stats.id);assert.equal(Number(await page.locator('#gaia-statistics-kpis').getAttribute('data-used-rows')),stats.rows.length);
      await page.locator('#gaia-statistics-close').click();
      report.checks.push({number:d.number,width,height,visible,layout,source:true,analysisRows:stats.rows.length,restoreDataset:true,introFade:true,yearCrossfade:true,idleCached:true});console.log(`PASS ${width}x${height} ${d.number}`);
    }
    await page.evaluate(()=>{location.hash='#world-100';});await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='refugees');await settled();
    await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>document.querySelector('#japan-mode-number').textContent.trim()==='01');assert.equal(await page.locator('#gaia-climate-canvas').isVisible(),false);
    await page.locator('[data-map-stable-step="-1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='refugees');await settled();
    assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed()){report.state=await page.evaluate(()=>({state:globalThis.GaiaClimateHistory?.getState(),canvas:{...document.querySelector('#gaia-climate-canvas')?.dataset},view:{...document.querySelector('#japan-overlay')?.dataset}}));await page.screenshot({path:path.join(out,'failure.png')});}throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));for(const width of new Set(report.checks.map(c=>c.width)))fs.writeFileSync(path.join(out,`report-${width}.json`),JSON.stringify({...report,checks:report.checks.filter(c=>c.width===width)},null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,errors:report.errors}));}
