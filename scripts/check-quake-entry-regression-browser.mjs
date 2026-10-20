import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const output = path.resolve(process.env.GAIA_ENTRY_REGRESSION_OUTPUT || 'artifacts/quake-first-view-20261020/entry-regression');
fs.mkdirSync(output,{recursive:true});
const report = { environment:'Local Chrome, synthetic fixed provider responses; mobile emulation', checks:[], errors:[] };
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
try {
  for (const [width,height] of [[1920,1080],[390,844]]) {
    const context = await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900});
    await context.addInitScript(() => localStorage.setItem('gaia-senseware-bgm-muted','true'));
    await context.route('https://**/*',route => {
      const url = new URL(route.request().url());
      if (url.hostname==='earthquake.usgs.gov') return route.fulfill({json:{metadata:{generated:1792465200000},features:[
        {id:'test-direct-entry',properties:{mag:5.6,time:1792461600000,place:'Direct-entry test epicenter'},
          geometry:{coordinates:[138,3,24]}},
      ]}});
      if (url.hostname.includes('open-meteo.com')) return route.fulfill({json:
        (url.searchParams.get('latitude')||'0').split(',').map(()=>({current:{time:'2026-10-20T03:00',
          wind_speed_10m:7,wind_direction_10m:270,surface_pressure:1012,cloud_cover:42,shortwave_radiation:300}}))});
      return route.abort();
    });
    page=await context.newPage();
    page.on('pageerror',error=>report.errors.push({width,message:error.message}));
    await page.goto(`${process.env.GAIA_BASE_URL}/world#world-02`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#gaia-planet-signals-canvas')?.dataset.planetQuakeStyle==='magnitude-recency');
    await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.titleSeparatorState==='complete'
      && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro'));
    assert.equal(await page.locator('#gaia-mode-entry-guide').isVisible(),false,'Exhibit deep links keep their direct-entry behavior');
    if (width>900) await page.locator('[data-planet-epicenter]').click();
    else {
      await page.locator('[data-mobile-sheet="tools"]').click();
      await page.getByRole('button',{name:'最大の震源へ',exact:true}).last().click();
    }
    await page.waitForTimeout(1000);
    await page.screenshot({path:path.join(output,`${width}-direct-maximum.png`)});
    assert.equal(await page.locator('#gaia-planet-signals-canvas').getAttribute('data-planet-focused-epicenter'),'test-direct-entry');
    await page.evaluate(()=>GaiaPlanetSignals.select(0));
    await page.waitForFunction(()=>document.querySelector('.gaia-planet-atmosphere-canvas').dataset.fieldState==='ready');
    await page.waitForFunction(()=>document.querySelector('#gaia-planet-signals-canvas').dataset.planetArrivalPhase==='settled');
    await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')
      && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro'));
    const target=await page.evaluate(()=>{
      const rect=document.querySelector('#japan-map').getBoundingClientRect(), overlay=document.querySelector('#japan-overlay');
      const scale=(rect.width>=901?rect.width/360:Math.max(rect.width/360,rect.height/180))*Number(overlay.dataset.earthZoom||1);
      return GaiaPlanetSignals.getCruisePoints().map((p,index)=>({...p,index,
        x:rect.left+(rect.width-360*scale)/2+Number(overlay.dataset.earthOffsetX||0)+((p.lon-150+540)%360)*scale,
        y:rect.top+(rect.height-180*scale)/2+Number(overlay.dataset.earthOffsetY||0)+(90-p.lat)*scale}))
        .find(p=>p.x>innerWidth*.3&&p.x<innerWidth*.6&&p.y>innerHeight*.35&&p.y<innerHeight*.55);
    });
    assert(target);
    if(width<900)await page.touchscreen.tap(target.x,target.y);else await page.mouse.click(target.x,target.y);
    await page.waitForFunction(()=>document.querySelector('#gaia-planet-signals-canvas').dataset.planetWindCue==='direction');
    await page.locator('.japan-poi-wind-direction').waitFor({state:'visible'});
    assert.equal(context.pages().length,1,'Wind POI opens without accidental source navigation');
    assert((await page.locator('#japan-poi-card').innerText()).includes('西から'));
    assert.equal(await page.locator('.japan-poi-time-label').count(),0,'Earthquake time label does not leak into wind');
    await page.screenshot({path:path.join(output,`${width}-wind-selection.png`)});
    // Keyboard activation is never swallowed by the pointer click-through guard.
    await page.locator('#japan-poi-source').focus();
    const popupPromise=context.waitForEvent('page');
    await page.keyboard.press('Enter');
    const popup=await popupPromise;
    await popup.waitForLoadState('domcontentloaded').catch(()=>{});
    assert(popup.url().includes('open-meteo.com'));
    await popup.close();
    await page.locator('#japan-poi-close').click();
    await page.mouse.move(0,0);
    await page.waitForFunction(()=>document.querySelector('#gaia-planet-signals-canvas').dataset.planetWindCue==='none');
    report.checks.push({width,height,directEntry:'02',maximum:'passed',windSelection:'passed',intentionalKeyboardSource:'passed'});
    await context.close();
  }
  assert.deepEqual(report.errors,[]);
  report.status='passed';
}catch(error){
  report.status='failed';report.failure=error.stack;process.exitCode=1;
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}finally{
  await browser.close();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
