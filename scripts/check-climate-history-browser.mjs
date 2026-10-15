import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL, output=path.resolve(process.env.GAIA_QA_OUTPUT_DIR || 'artifacts/climate-history-20261013');
fs.mkdirSync(output,{recursive:true});
const report={sha:execFileSync('git',['--no-optional-locks','rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktree:'uncommitted changes',scope:'Installed headless Chrome, actual local NOAA snapshots; desktop and emulated mobile, not production or physical phone.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});report.browser=browser.version();let page;
const ready=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')&&!document.querySelector('#japan-layer').classList.contains('is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running',null,{timeout:60000});
try{
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:width<900?844:900},isMobile:width<900,hasTouch:width<900,deviceScaleFactor:width<900?2:1});
    await enforceBrowserSecurity(context,base);await context.route('https://**',r=>r.abort());
    page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(120000);page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',message=>{if(message.text().startsWith('Climate snapshot unavailable'))console.log(message.text());});
    const fetched=[];page.on('request',r=>{if(r.url().includes('/climate-history/'))fetched.push(r.url());});
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);
    assert.equal(fetched.length,0,'New datasets must not load on the title page');
    for(const [number,id] of [[72,'cyclones'],[73,'coral']]){
      console.log(`Checking ${width}/${number}`);
      await page.goto(`${base}/#world-${number}`,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(id=>globalThis.GaiaClimateHistory?.getState().id===id&&['ready','error'].includes(GaiaClimateHistory.getState().dataState),id,{timeout:60000});
      assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().dataState),'ready');
      await page.evaluate(()=>GaiaMapPlayback.stop());await ready();
      assert.equal(await page.evaluate(()=>GaiaClimateHistory.getState().year),2016);
      await page.waitForFunction(()=>Number(document.querySelector('#gaia-climate-canvas').dataset.climateVisibleCount)>0);
      // Data readiness can precede the first rendered Natural Earth frame.
      // Capture the actual detailed base map, not its initial fallback polygons.
      await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.worldBoundaryLayer==='country'&&Number(document.querySelector('#japan-overlay').dataset.worldBoundaryRingCount)>400);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const bounds=await page.locator('.gaia-climate-readout').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:el.scrollWidth,width:el.clientWidth};});
      assert(bounds.left>=0&&bounds.right<=width+1&&bounds.scroll<=bounds.width+1,`Readout overflow ${JSON.stringify(bounds)}`);
      await page.screenshot({path:path.join(output,`${width}-${number}.png`)});
      const before=await page.evaluate(()=>({s:GaiaClimateHistory.getState(),value:document.querySelector('[data-climate-value]').textContent,insight:document.querySelector('[data-climate-insight]').textContent}));
      assert(before.insight.includes('2016'));
      await page.locator('[data-climate-year]').fill('2017');
      await page.waitForFunction(()=>GaiaClimateHistory.getState().year===2017&&GaiaClimateHistory.getState().dataState==='ready');
      await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2017');
      assert((await page.locator('[data-climate-insight]').textContent()).includes('2017'));
      const dataset=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert(dataset.rows.length>=35);
      const restored=await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),dataset.id);assert.deepEqual(restored,dataset);
      const action=async kind=>{
        if(width<900){await page.locator('[data-mobile-sheet="tools"]').tap();await page.getByRole('button',{name:kind==='source'?'データの出典':'統計分析',exact:true}).last().tap();}
        else await page.locator(`[data-climate-${kind}]`).click();
      };
      await action('source');await page.waitForFunction(()=>document.querySelector('#japan-layer').classList.contains('japan-data-open'));
      assert((await page.locator('#japan-data-panel').innerText()).includes('NOAA'));
      await page.locator('#japan-data-close').click();
      await action('analysis');
      await page.waitForFunction(id=>globalThis.GaiaStatisticsLab?.getState().analysisReady&&GaiaStatisticsLab.getState().datasetId===id,dataset.id);
      assert.equal(Number(await page.locator('#gaia-statistics-kpis').getAttribute('data-used-rows')),dataset.rows.length);
      await page.screenshot({path:path.join(output,`${width}-${number}-analysis.png`)});
      await page.locator('#gaia-statistics-menu-toggle').click();
      const options=page.locator('.gaia-statistics-data-options');if(await options.getAttribute('open')===null)await options.locator('summary').click();
      await page.locator('#gaia-statistics-view-save').click();const saved=await page.locator('#gaia-statistics-saved-view').inputValue();
      await page.locator('#gaia-statistics-record-filter').fill('no-matching-climate-record');
      await page.locator('#gaia-statistics-saved-view').selectOption(saved);await page.locator('#gaia-statistics-view-apply').click();
      assert.equal(await page.locator('#gaia-statistics-record-filter').inputValue(),'');
      await page.locator('#gaia-statistics-menu-close').click();await page.locator('#gaia-statistics-close').click();await page.locator('#gaia-statistics-lab').waitFor({state:'hidden'});
      if(width<900){await page.locator('[data-mobile-sheet="reading"]').tap();assert((await page.locator('#map-mobile-sheet').textContent()).includes('2017'));await page.screenshot({path:path.join(output,`${width}-${number}-reading.png`)});await page.locator('[data-mobile-sheet-close]').tap();}
      report.checks.push({width,number,bounds,before,statisticsRows:dataset.rows.length,restored:true,sourcePanel:true,analysisAndSavedView:true});
    }
    await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;if(page&&!page.isClosed()){await page.screenshot({path:path.join(output,'failure.png')});report.state=await page.evaluate(()=>({hash:location.hash,climate:globalThis.GaiaClimateHistory?.getState(),body:document.body.className,layer:document.querySelector('#japan-layer')?.className}));}throw error;}
finally{fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
