import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL,out=path.resolve('artifacts/atlas-history-20261022/gauge-clearance');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={scope:'Actual local Chrome; basin-gauge overlap regression; mobile emulation',checks:[],errors:[]};
let page;
try {
  for(const [width,height] of [[1920,1080],[1366,768],[390,844],[320,568]]){
    const mobile=width<900,context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
    await enforceBrowserSecurity(context,base);await context.route('https://**/*',r=>r.abort());
    await context.addInitScript(()=>{
      sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__gaugeIntro=[];
      const sample=()=>{const i=document.querySelector('#map-data-intro'),c=document.querySelector('#gaia-climate-canvas');if(i&&!i.hidden&&i.dataset.exhibitNumber==='76')window.__gaugeIntro.push({opacity:+getComputedStyle(i).opacity,visible:c?.checkVisibility({visibilityProperty:true})||false,playing:globalThis.GaiaMapPlayback?.getState().playing||false});requestAnimationFrame(sample);};requestAnimationFrame(sample);
    });
    page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(`${base}/world.html#world-76`);
    if(width===320){await page.waitForFunction(()=>{const e=document.querySelector('#map-data-intro');return !e.hidden&&e.dataset.exhibitNumber==='76'&&+getComputedStyle(e).opacity>.95;});await page.touchscreen.tap(width*.5,height*.5);}
    await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');
    await page.evaluate(()=>GaiaMapPlayback.stop());
    const intro=await page.evaluate(()=>window.__gaugeIntro);assert(intro.length>2);assert(!intro.some(f=>f.visible||f.playing));assert(intro.at(-1).opacity<.01);
    if(mobile&&await page.locator('#map-responsive-data > summary').isVisible()&&await page.locator('#map-responsive-data').getAttribute('open')===null)await page.locator('#map-responsive-data > summary').tap();
    await page.locator('[data-climate-point]').selectOption('atl');
    await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(650);
    if(!mobile){await page.locator('[data-climate-overview]').click();await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(450);}
    for(const year of [2016,2024]){
      await page.locator('[data-climate-year]').fill(String(year));await page.waitForFunction(y=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear===String(y)&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete',year);
      const overlaps=await page.evaluate(()=>{
        const hits=[];for(const e of document.querySelectorAll('.gaia-climate-legend,#map-scope-note')){if(!e.checkVisibility({visibilityProperty:true}))continue;const r=e.getBoundingClientRect();for(let x=r.left+4;x<r.right;x+=8)for(let y=r.top+4;y<r.bottom;y+=8){const hit=GaiaClimateHistory.findPoiAt(x,y,'mouse');if(hit)hits.push(hit.record.id);}}return [...new Set(hits)];
      });assert.deepEqual(overlaps,[],`${width}/${year}: gauge hidden by legend`);
      report.checks.push({width,height,year,noGaugeBehindLegend:true,fullIntroFade:true,tapIntro:width===320});
    }
    if(mobile&&await page.locator('#map-responsive-data > summary').isVisible()&&await page.locator('#map-responsive-data').getAttribute('open')!==null)await page.locator('#map-responsive-data > summary').tap();
    await page.screenshot({path:path.join(out,`${width}x${height}-76.png`)});
    assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);await context.close();console.log(`PASS gauge ${width}x${height}`);
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')});throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
