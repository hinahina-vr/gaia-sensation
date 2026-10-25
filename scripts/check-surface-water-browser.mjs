import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL, out=path.resolve(process.env.GAIA_SURFACE_WATER_OUT||'artifacts/surface-water-motion-20261022');
fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktree:'uncommitted changes',scope:'Local Chrome; real bundled JRC v1.0 data, external requests blocked. Mobile is emulated, not physical.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
const ready=()=>page.waitForFunction(()=>GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
const imageReady=year=>page.waitForFunction(y=>document.querySelector('.gaia-lake-view')?.dataset.renderedYear===String(y),year);
try {
  const viewports=[[1920,1080],[1366,768],[390,844],[320,740],[320,568]];
  for(const [width,height] of viewports.filter(([w,h])=>!process.env.GAIA_SURFACE_WATER_VIEWPORT||process.env.GAIA_SURFACE_WATER_VIEWPORT===`${w}x${h}`)){
    const mobile=width<900, context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
    await enforceBrowserSecurity(context,base);await context.route('https://**/*',r=>r.abort());
    await context.addInitScript(()=>{
      sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');
      window.__lakeIntro=[];
      const capture=()=>{
        const intro=document.querySelector('#map-data-intro'),figure=document.querySelector('.gaia-lake-view');
        if(intro&&!intro.hidden&&intro.dataset.exhibitNumber==='74'){
          const band=document.querySelector('#map-title-transition');
          window.__lakeIntro.push({opacity:Number(getComputedStyle(intro).opacity),band:Number(getComputedStyle(band).opacity),visible:figure?.checkVisibility({visibilityProperty:true})||false,playing:globalThis.GaiaMapPlayback?.getState().playing});
          if(window.__lakeIntro.length>500)window.__lakeIntro.shift();
        }
        requestAnimationFrame(capture);
      };requestAnimationFrame(capture);
    });
    page=await context.newPage();page.setDefaultTimeout(60000);
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.text().startsWith('Climate snapshot unavailable'))console.log(m.text());});
    const fetches=[];page.on('request',r=>{if(r.url().includes('/surface-water/'))fetches.push(r.url());});
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForTimeout(800);assert.equal(fetches.length,0,'No lake data on title');
    await page.goto(`${base}/world.html#world-74`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().id==='lakes'&&['ready','error'].includes(GaiaClimateHistory.getState().dataState));
    assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().dataState),'ready');
    await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaModeEntryGuide?.close('map',{restoreFocus:false});});
    const tapIntro=width===320&&height===740;
    if(tapIntro){
      await page.waitForFunction(()=>{const e=document.querySelector('#map-data-intro');return !e.hidden&&Number(getComputedStyle(e).opacity)>.95;});
      await page.touchscreen.tap(width*.6,height*.5);
    }
    await ready();await imageReady(2010);
    const intro=await page.evaluate(()=>window.__lakeIntro);
    assert(intro.length>=3);assert(!intro.some(f=>f.visible||f.playing),'Lake image/playback must wait for full intro fade');
    assert(intro.at(-1).opacity<.01&&intro.at(-1).band<.01,'Intro reaches transparent');
    assert.equal(await page.evaluate(()=>GaiaMapCategories.buttons().length),100);
    assert.equal(await page.locator('[data-climate-period]').textContent(),'2010年');
    const initialRequests=fetches.length;assert(initialRequests<=3,`Unbounded initial lake load: ${initialRequests}`);
    // Use the visible controls in the desktop/mobile dock.
    if(mobile&&await page.locator('#map-responsive-data').isVisible()&&await page.locator('#map-responsive-data').getAttribute('open')===null)await page.locator('#map-responsive-data > summary').tap();
    for(const id of ['great-salt','poopo','urmia']){
      await page.locator('[data-climate-point]').selectOption(id);
      await page.locator('[data-climate-year]').fill('2000');await imageReady(2000);
      await page.locator('[data-climate-year]').fill('2015');await imageReady(2015);
      assert((await page.locator('[data-climate-insight]').textContent()).includes('2015年'));
    }
    if(mobile&&await page.locator('#map-responsive-data').isVisible()&&await page.locator('#map-responsive-data').getAttribute('open')!==null)await page.locator('#map-responsive-data > summary').tap();
    await ready();await page.waitForTimeout(350);
    const boxes=await page.evaluate(()=>Object.fromEntries(['.gaia-lake-view','.gaia-lake-images','.gaia-climate-legend'].filter(s=>document.querySelector(s).checkVisibility()).map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return[s,{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,overflow:e.scrollWidth>e.clientWidth+1}];})));
    for(const [s,b] of Object.entries(boxes)){assert(b.x>=-1&&b.right<=width+1&&b.y>=0&&b.bottom<=height+1,`${s} out of viewport ${JSON.stringify(b)}`);assert(!b.overflow,`${s} horizontal overflow`);}
    const raster=await page.evaluate(()=>GaiaClimateHistory.getLakeState().raster);
    assert(raster.height>=(height<600?100:130),`Actual geographic footprint must remain readable: ${JSON.stringify(raster)}`);
    if(boxes['.gaia-climate-legend'])assert(raster.x+raster.width<=boxes['.gaia-climate-legend'].x||raster.y>=boxes['.gaia-climate-legend'].bottom-1,'Legend must not overlap the lake footprint');
    const zoom=await page.locator('#gaia-map-zoom-controls').boundingBox();
    if(zoom)assert.equal(await page.locator('#gaia-map-zoom-controls').isVisible(),true,'Registered lake retains map zoom controls');
    await page.screenshot({path:path.join(out,`${width}x${height}-74.png`)});
    const dataset=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());
    assert.deepEqual(await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),dataset.id),dataset);
    const action=async name=>{if(mobile){await page.locator('[data-mobile-sheet="tools"]').tap();await page.getByRole('button',{name:name==='source'?'データの出典':'統計分析',exact:true}).last().tap();}else await page.locator(`[data-climate-${name}]`).click();};
    await action('source');await page.locator('#japan-data-panel').waitFor({state:'visible'});
    assert.match(await page.locator('#japan-data-panel').textContent(),/EC JRC\/Google/i);
    await page.waitForFunction(()=>document.querySelector('#japan-data-panel').getBoundingClientRect().right<=innerWidth+1);
    await page.locator('#japan-data-close').click();
    await action('analysis');await page.waitForFunction(id=>globalThis.GaiaStatisticsLab?.getState().analysisReady&&GaiaStatisticsLab.getState().datasetId===id,dataset.id);
    assert.equal(Number(await page.locator('#gaia-statistics-kpis').getAttribute('data-used-rows')),dataset.rows.length);
    await page.screenshot({path:path.join(out,`${width}x${height}-74-analysis.png`)});
    await page.locator('#gaia-statistics-menu-toggle').click();
    const options=page.locator('.gaia-statistics-data-options');
    if(await options.getAttribute('open')===null)await options.locator('summary').click();
    await page.locator('#gaia-statistics-view-save').click();
    const saved=await page.locator('#gaia-statistics-saved-view').inputValue();assert(saved);
    await page.locator('#gaia-statistics-record-filter').fill('no-matching-water-year');
    await page.locator('#gaia-statistics-saved-view').selectOption(saved);await page.locator('#gaia-statistics-view-apply').click();
    await page.waitForFunction(()=>document.querySelector('#gaia-statistics-record-filter').value==='');
    assert.equal(await page.locator('#gaia-statistics-export-csv, #gaia-statistics-export-json, #gaia-statistics-export-png').count(),0,'Retired exports stay removed');
    await page.locator('#gaia-statistics-menu-close').click();
    await page.locator('#gaia-statistics-close').click();
    // Rapid year changes and a provider switch must not leave stale decoded images.
    await page.evaluate(()=>{for(const y of [1984,2000,2014,2007])void GaiaClimateHistory.setYear(y);});await imageReady(2007);await page.waitForTimeout(400);
    assert.equal(await page.locator('.gaia-lake-images canvas').count(),1);
    await page.locator('[data-map-stable-step="1"]').click();
    await page.waitForFunction(()=>document.querySelector('#japan-mode-number').textContent.trim()==='75');
    assert.equal(await page.locator('.gaia-lake-view').isVisible(),false);
    await page.locator('[data-map-stable-step="-1"]').click();await ready();await imageReady(2010);
    await page.evaluate(()=>GaiaMapCategories.buttons().find(b=>b.textContent.trim()==='73').click());await ready();
    assert.equal(await page.locator('.gaia-lake-view').isVisible(),false);assert.equal(await page.locator('.gaia-lake-images canvas').evaluate(e=>e.width),1);
    assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().year),2016);
    await page.evaluate(()=>GaiaMapCategories.buttons().find(b=>b.textContent.trim()==='72').click());await ready();
    assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().dataState),'ready');
    assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);
    report.checks.push({width,height,boxes,initialRequests,statisticsRows:dataset.rows.length,introFrameCount:intro.length,introFade:true,tapIntro,source:true,analysis:true,savedView:true,step74to75:true,allThreeLakes:true,yearChanges:true,staleImageCleanup:true,regression72and73:true});
    await context.close();console.log(`PASS ${width}x${height}`);
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')});throw error;}
finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
