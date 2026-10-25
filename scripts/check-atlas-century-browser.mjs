import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {ATLAS_CENTURY_EXHIBITS} from '../src/exploration/atlas-century-model.js';
const defs=ATLAS_CENTURY_EXHIBITS.filter(d=>+d.number>=Number(process.env.GAIA_ATLAS_FROM||91)&&+d.number<=Number(process.env.GAIA_ATLAS_TO||100));
const out=path.resolve(process.env.GAIA_ATLAS_OUT||'artifacts/atlas-century-20261022'),base=process.env.GAIA_BASE_URL;fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',environment:'Installed Chrome headless, real local snapshots, external requests blocked; mobile emulation',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
const settled=async()=>{await page.waitForFunction(()=>GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');await page.evaluate(()=>GaiaMapPlayback.stop());};
try{
  const sizes=JSON.parse(process.env.GAIA_ATLAS_SIZES||'[[1920,1080],[1366,768],[390,844],[320,568]]');
  for(const [width,height]of sizes){
    const mobile=width<=900,context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});await enforceBrowserSecurity(context,base);await context.route('https://**/*',r=>r.abort());
    await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__intro=[];const tick=()=>{const i=document.querySelector('#map-data-intro'),c=document.querySelector('#gaia-climate-canvas');if(i&&!i.hidden&&+i.dataset.exhibitNumber>=91)__intro.push({number:i.dataset.exhibitNumber,opacity:+getComputedStyle(i).opacity,visible:c?.checkVisibility({visibilityProperty:true}),playing:globalThis.GaiaMapPlayback?.getState().playing});requestAnimationFrame(tick);};requestAnimationFrame(tick);});
    page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));const requests=[];page.on('request',r=>{if(r.url().includes('/data/atlas-history/'))requests.push(r.url());});
    await page.goto(base);await page.waitForTimeout(200);assert.equal(requests.length,0,'No atlas data on title');
    await page.goto(`${base}/world.html#world-${defs[0].number}`);await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));await settled();assert.equal(await page.evaluate(()=>GaiaMapCategories.buttons().length),100);
    for(const d of defs){
      if(d!==defs[0]){await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(id=>GaiaClimateHistory.getState().id===id,d.id);await settled();}
      assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().year),2016);assert(await page.locator('#gaia-climate-canvas').isVisible());
      const render=await page.evaluate(()=>GaiaClimateHistory.getRenderState());assert.equal(render.engine,'webgl2',JSON.stringify(render));assert.equal(render.contexts,1);assert(render.glyphs>0,`${d.number} actual glyphs`);assert(render.width*render.height<=1810000);
      for(const b of render.diagramBounds||[])assert(b.left>=-1&&b.right<=width+1&&b.top>=-1&&b.bottom<=height+1,`${d.number} diagram clipping: ${JSON.stringify(b)}`);
      const intro=await page.evaluate(n=>__intro.filter(r=>r.number===n),d.number);assert(intro.length>2);assert(!intro.some(r=>r.visible||r.playing));assert(intro.at(-1).opacity<.01);
      await page.screenshot({path:path.join(out,`${width}x${height}-${d.number}.png`)});
      // Real year control; the common fade must finish before the cached state.
      if(mobile&&await page.locator('#map-responsive-data').isVisible()&&await page.locator('#map-responsive-data').getAttribute('open')===null)await page.locator('#map-responsive-data > summary').tap();
      const alternate=d.start===2005?2006:2005;await page.locator('[data-climate-year]').fill(String(alternate));await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='running');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
      assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().year),alternate);
      // A real finite, uncensored series for analysis, including Japan's censored hunger case.
      const payload=JSON.parse(fs.readFileSync(`data/atlas-history/${d.id}.json`));const region=payload.regions.find(r=>r.years.filter(y=>Number.isFinite(y.value)&&!y.censored).length>=12);
      assert(region);await page.locator('[data-climate-point]').selectOption(region.id);await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(500);
      const stats=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert(stats.rows.length>=12);assert.deepEqual(await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),stats.id),stats);
      await page.locator('[data-climate-year]').fill('2016');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
      if(mobile&&await page.locator('#map-responsive-data').isVisible()&&await page.locator('#map-responsive-data').getAttribute('open')!==null)await page.locator('#map-responsive-data > summary').tap();
      const action=async name=>{if(mobile){await page.locator('[data-mobile-sheet="tools"]').tap();await page.getByRole('button',{name:name==='source'?'データの出典':'統計分析',exact:true}).last().tap();}else await page.locator(`[data-climate-${name}]`).click();};
      await action('source');await page.locator('#japan-data-panel').waitFor({state:'visible'});assert((await page.locator('#japan-data-panel').textContent()).includes(d.metric));await page.locator('#japan-data-close').click();
      await action('analysis');await page.waitForFunction(id=>globalThis.GaiaStatisticsLab?.getState().analysisReady&&GaiaStatisticsLab.getState().datasetId===id,stats.id);assert.equal(Number(await page.locator('#gaia-statistics-kpis').getAttribute('data-used-rows')),stats.rows.length);await page.locator('#gaia-statistics-close').click();
      await page.waitForTimeout(500);const count=await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count');await page.waitForTimeout(250);assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count'),count);
      const layout=await page.evaluate(()=>Object.fromEntries(['.gaia-climate-readout','.gaia-climate-legend','#map-mobile-bottom'].filter(s=>document.querySelector(s)?.checkVisibility({visibilityProperty:true})).map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return[s,{left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:e.scrollWidth>e.clientWidth+1}];})));
      for(const [selector,r]of Object.entries(layout)){assert(r.left>=-1&&r.right<=width+1&&r.top>=-1&&r.bottom<=height+1,`${d.number} ${selector}: ${JSON.stringify(r)}`);assert(!r.overflow);}
      report.checks.push({number:d.number,width,height,render,layout,introFade:true,yearCrossfade:true,statsRows:stats.rows.length,sourcePanel:true,idleCached:true});console.log('PASS',width,height,d.number);
    }
    if(defs.at(-1).number==='100'){await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>document.querySelector('#japan-mode-number').textContent.trim()==='01');assert(!(await page.locator('#gaia-climate-canvas').isVisible()));await page.locator('[data-map-stable-step="-1"]').click();await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='refugees');await settled();}
    assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed()){report.state=await page.evaluate(()=>({state:globalThis.GaiaClimateHistory?.getState(),render:globalThis.GaiaClimateHistory?.getRenderState(),canvas:{...document.querySelector('#gaia-climate-canvas')?.dataset}}));await page.screenshot({path:path.join(out,'failure.png')});}throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(report.status,report.checks.length);}
