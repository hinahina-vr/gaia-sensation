import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/story-temperature-2026-09-10/lifecycle');
fs.mkdirSync(output,{recursive:true});
const report={status:'running',checks:[],errors:[]};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
  for(const [name,width,height] of [['pc',1440,900],['mobile',390,844]]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',route=>route.abort());
    await context.addInitScript(()=> {
      localStorage.setItem('gaia-senseware-bgm-muted','true');
      localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:false}));
    });
    page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    const activate=selector=>width<900?page.locator(selector).tap():page.locator(selector).click();
    const at=async id=>page.waitForFunction(id=>document.querySelector('#novel-layer')?.dataset.stepId===id,id);
    await page.goto(base+'/story',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.GaiaNovel&&document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
    await page.evaluate(()=> {
      const s=GaiaNovel.getState();s.stepId='map_mode01_003';s.clear=false;
      s.metCharacters={amane:true,mizuha:true,sakuya:true};
      localStorage.setItem(GaiaNovel.storageKey,JSON.stringify(s));
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await at('map_mode01_003');
    await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
    await page.locator('#gaia-boot').waitFor({state:'hidden'});
    // Save through native controls before the original CO2 demo.
    await activate('#novel-save-button');await activate('.novel-save-slot[data-slot-index="0"]');await activate('#novel-save-close');
    const advanceTo=async id=> {
      for(let n=0;n<220 && await page.locator('#novel-layer').getAttribute('data-step-id')!==id;n++) {
        await activate('#novel-dialogue');await page.waitForTimeout(110);
      }
      await at(id);
    };
    await advanceTo('map_mode01_004');
    await page.waitForFunction(()=>document.querySelector('#japan-overlay')?.dataset.quantitativeLegendId==='co2-concentration');
    const initial=await page.locator('#japan-layer [data-signal-time]').first().inputValue();
    await page.waitForTimeout(1200);
    const moving=await page.locator('#japan-layer [data-signal-time]').first().inputValue();
    assert(Number(moving)>Number(initial));
    assert.equal(await page.locator('.story-temperature').count(),0);
    await page.screenshot({path:path.join(output,name+'-co2.png')});
    await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepId==='map_mode01_005',null,{timeout:25000});
    await page.locator('#japan-layer').waitFor({state:'hidden'});
    await advanceTo('map_mode01_023');
    await page.waitForFunction(()=>document.querySelector('.story-temperature')?.dataset.ready==='true');
    await page.locator('[data-temperature-time]').press('End');
    await page.reload({waitUntil:'domcontentloaded'});
    await at('map_mode01_023');
    await page.waitForFunction(()=>document.querySelector('.story-temperature')?.dataset.ready==='true');
    assert.equal(await page.locator('.story-temperature').count(),1,'Reload resumes interaction exactly once');
    assert.equal(await page.locator('[data-temperature-time]').inputValue(),'1958','Story position resumes; demo starts its comparison from the first year');
    await activate('[data-temperature-return]');
    await at('map_mode01_024');
    await page.locator('#japan-layer').waitFor({state:'hidden'});
    await activate('#novel-load-button');await activate('.novel-save-slot[data-slot-index="0"]');
    await at('map_mode01_003');
    await advanceTo('map_mode01_004');
    await page.waitForFunction(()=>!document.querySelector('#japan-layer')?.hidden&&document.querySelector('#japan-overlay')?.dataset.quantitativeLegendId==='co2-concentration');
    assert.equal(await page.locator('.story-temperature').count(),0);
    assert.equal(await page.locator('#japan-layer').evaluate(e=>e.classList.contains('is-story-temperature')),false);
    assert.equal(await page.locator('#japan-map').evaluate(e=>e.inert),false);
    await page.screenshot({path:path.join(output,name+'-co2-after-temperature.png')});
    await activate('#story-map-modal-skip');
    await at('map_mode01_005');
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    report.checks.push({name,initial,moving,co2AutoCompleted:true,nativeNarrativeToTemperature:true,reloadInteraction:true,nativeLoadBackToCo2:true});
    await context.close();console.log('PASS '+name+' lifecycle');
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
} catch(error) {
  report.status='failed';report.failure=error.stack;
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;
} finally {
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();
}
