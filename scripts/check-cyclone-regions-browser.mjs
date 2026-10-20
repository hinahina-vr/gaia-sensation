import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import { regionalSummary } from '../src/exploration/cyclone-regional-model.js';
import { format } from '../src/exploration/climate-history-model.js';

const base=process.env.GAIA_BASE_URL, output=path.resolve('artifacts/cyclone-regions-20261018');
fs.mkdirSync(output,{recursive:true});
const data=JSON.parse(fs.readFileSync('data/climate-history/cyclone-regions.json'));
const report={sha:execFileSync('git',['--no-optional-locks','rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktree:'uncommitted changes',scope:'Local installed Chrome with production CSP; real saved NOAA records; desktop/mobile emulation. Data failure is simulated.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});report.browser=browser.version();let page;
const ready=()=>page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')&&!document.querySelector('#japan-layer').classList.contains('is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running',null,{timeout:60000});
try{
  for(const [width,height] of [[1440,900],[390,844],[320,568],[844,390]]){
    console.log(`Regional analysis: ${width} x ${height}`);
    const context=await browser.newContext({viewport:{width,height},isMobile:width<901,hasTouch:width<901,deviceScaleFactor:width<901?2:1});
    await enforceBrowserSecurity(context,base);await context.route('https://**',r=>r.abort());
    page=await context.newPage();page.setDefaultNavigationTimeout(120000);page.on('pageerror',e=>report.errors.push(e.message));
    const requests=[];page.on('request',r=>{if(/cyclone-regional|cyclone-regions/.test(r.url()))requests.push(r.url());});
    await page.goto(`${base}/world#world-72`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready',null,{timeout:60000});await page.evaluate(()=>GaiaMapPlayback.stop());await ready();
    assert.equal(requests.length,0,'Regional module and data should be demand-loaded');
    const drawer=page.locator('#map-responsive-data');
    if(width<901&&await drawer.locator(':scope > summary').isVisible()&&await drawer.getAttribute('open')===null)await drawer.locator(':scope > summary').click();
    const button=page.locator('[data-climate-regional]');await button.scrollIntoViewIfNeeded();
    if(width===1440)await page.route('**/cyclone-regions.json?*',r=>r.abort());
    await button.click();
    const dialog=page.locator('.gaia-cyclone-regions');await dialog.waitFor({state:'visible'});
    if(width===1440){
      await page.locator('[data-region-retry]').waitFor({state:'visible'});
      assert((await page.locator('[data-region-status]').textContent()).includes('読み込めません'));
      await page.unroute('**/cyclone-regions.json?*');await page.locator('[data-region-retry]').click();
      report.checks.push('Failed regional data request keeps map alive; actual retry recovers');
    }
    await page.locator('[data-region-content]').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-region-year]').inputValue(),'2016');
    assert.equal(await page.locator('[data-region-place]').inputValue(),'naha');
    assert.equal((await page.evaluate(()=>GaiaClimateHistory.getState())).playing,false);
    const geometry=await dialog.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,bodyScroll:el.querySelector('.gaia-cyclone-region-body').scrollWidth,bodyWidth:el.querySelector('.gaia-cyclone-region-body').clientWidth}));
    assert(geometry.rect.left>=0&&geometry.rect.right<=width&&geometry.rect.top>=0&&geometry.rect.bottom<=height,JSON.stringify(geometry));
    assert(geometry.scrollWidth<=geometry.clientWidth+1&&geometry.bodyScroll<=geometry.bodyWidth+1,JSON.stringify(geometry));
    await page.screenshot({path:path.join(output,`${width}-${height}.png`)});
    for(const region of width===1440?data.regions:[data.regions[4]]){
      await page.locator('[data-region-place]').selectOption(region.id);await page.locator('[data-region-year]').selectOption('2017');
      const expected=regionalSummary(region,2017);
      assert.equal(await page.locator('[data-region-count]').textContent(),`${expected.row.count}件`);
      assert.equal(await page.locator('[data-region-insight]').textContent(),expected.insight);
      assert.equal(await page.locator('[data-region-speed]').textContent(),expected.speed===null?'記録不足':`${format(expected.speed)} km/h`);
      assert.equal(await page.locator('[data-region-wind]').textContent(),expected.wind===null?'記録なし':`${format(expected.wind)} m/s`);
      assert.equal(await page.locator('[data-region-months] tr').count(),12);
      assert.equal(await page.locator('[data-region-decades] tr').count(),5);
    }
    const zeroRegion=data.regions.find(region=>region.years.some(row=>row.count===0));
    await page.locator('[data-region-place]').selectOption(zeroRegion.id);await page.locator('[data-region-year]').selectOption(String(zeroRegion.years.find(row=>row.count===0).year));
    assert.equal(await page.locator('[data-region-count]').textContent(),'0件');assert.equal(await page.locator('[data-region-wind]').textContent(),'記録なし');
    const method=dialog.locator('details > summary');await method.scrollIntoViewIfNeeded();await method.click();
    await page.locator('[data-region-source]').scrollIntoViewIfNeeded();assert(await page.locator('[data-region-source]').isVisible());
    const closeBounds=await page.locator('[data-region-close]').boundingBox();assert(closeBounds.y>=0&&closeBounds.y+closeBounds.height<=height);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await button.evaluate(el=>el===document.activeElement));
    await button.click();await page.locator('[data-region-content]').waitFor({state:'visible'});await page.locator('[data-region-close]').click();await dialog.waitFor({state:'hidden'});
    assert.equal(requests.filter(url=>url.includes('cyclone-regions.json')).length,width===1440?2:1,'Successful data reused on reopening');
    await page.goto(`${base}/world#world-73`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().id==='coral'&&GaiaClimateHistory.getState().dataState==='ready',null,{timeout:60000});await page.evaluate(()=>GaiaMapPlayback.stop());await ready();
    assert(await page.locator('[data-climate-regional]').isHidden());assert((await page.locator('[data-climate-insight]').textContent()).includes('64日'));
    report.checks.push({width,height,geometry,zeroCount:true,allRegions:width===1440,monthlyAndDecadeTables:true,scrollAndClose:true,focusRestored:true,lazyReuse:true,coralUnaffected:true});
    await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
