import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const numbers=process.env.GAIA_GIS_NUMBERS?.split(',').map(Number)||[31,49,65,68];
const out=path.resolve(process.env.GAIA_GIS_OUT||'artifacts/gis-baseline-review-20261022/interactions');fs.mkdirSync(out,{recursive:true});
const report={scope:'Read-only local review with actual map clicks and native year/detail controls. Bundled source records, external services blocked; not production.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**/*',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
  const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-${numbers[0]}`);
  await page.waitForFunction(()=>document.documentElement.dataset.gaiaAppReady==='true');
  await page.evaluate(()=>{GaiaModeEntryGuide?.close('map',{restoreFocus:false});setInterval(()=>document.querySelector('#map-title-transition')?.getAnimations({subtree:true}).forEach(a=>{a.playbackRate=30;}),30);});
  for(const number of numbers){
    if(number!==numbers[0])await page.evaluate(n=>GaiaMapCategories.buttons().find(b=>+b.textContent.trim()===n).click(),number);
    await page.waitForFunction(n=>{const e=document.querySelector('#map-data-intro');return e&&!e.hidden&&+e.dataset.exhibitNumber===n;},number);
    await page.waitForTimeout(400);await page.mouse.click(800,450);
    await page.waitForFunction(()=>GaiaMarineCod.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro'));
    await page.waitForTimeout(3100);await page.evaluate(()=>GaiaMapPlayback.stop());
    const hit=await page.evaluate(async()=>{
      const {earthBaseScale,earthLongitudeToMapX}=await import('/src/exploration/world-projection.js?v=gaia-japan-center-1');
      const r=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset,s=earthBaseScale(r)*Math.max(1,+d.earthZoom||1);
      for(const p of GaiaMarineCod.getCruisePoints()){
        if(!Number.isFinite((p.cod||p.metrics?.[GaiaMarineCod.definition.measurementKey]||p.measurement)?.value))continue;
        const x=r.left+(r.width-360*s)/2+(+d.earthOffsetX||0)+earthLongitudeToMapX(p.lon)*s,y=r.top+(r.height-180*s)/2+(+d.earthOffsetY||0)+(90-p.lat)*s;
        const h=GaiaMarineCod.findPoiAt(x,y,'mouse');
        if(h&&y>220&&y<700&&x>300&&x<1000&&document.elementFromPoint(x,y)?.closest('#japan-map'))return {x,y,id:h.record.id,record:h.record};
      }
    });
    if(!hit){report.checks.push({number,noVisibleHit:true});continue;}
    await page.mouse.move(hit.x,hit.y);await page.waitForTimeout(500);await page.mouse.click(hit.x,hit.y);
    await page.waitForFunction(id=>GaiaMarineCod.getState().selectedId===id,hit.id);await page.waitForTimeout(1200);
    const selected=await page.evaluate(()=>({state:GaiaMarineCod.getState(),readout:document.querySelector('.gaia-marine-cod-readout')?.innerText,legend:document.querySelector('.gaia-marine-cod-legend')?.innerText,statistics:GaiaMarineCod.getStatisticsDataset()}));
    await page.screenshot({path:path.join(out,`${number}-selected.jpg`),type:'jpeg',quality:85});
    const check={number,hit,selected};
    if(number<60){
      const year=selected.state.year,next=year+1;await page.locator('[data-cod-year]').fill(String(next));
      await page.waitForFunction(y=>GaiaMarineCod.getState().year===y&&GaiaMarineCod.getState().dataState==='ready',next);await page.waitForTimeout(700);
      check.nextYear=await page.evaluate(()=>({state:GaiaMarineCod.getState(),place:document.querySelector('[data-cod-place]').textContent,value:document.querySelector('[data-cod-value]').textContent}));
    }else{
      await page.locator('[data-cod-records]').click();await page.locator('#gaia-record-detail').waitFor({state:'visible'});
      check.detail=await page.locator('#gaia-record-detail').innerText();await page.screenshot({path:path.join(out,`${number}-records.jpg`),type:'jpeg',quality:85});await page.locator('[data-record-close]').click();
    }
    report.checks.push(check);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(`SPATIAL ${number}: ${hit.record.title}`);
  }
  report.completed=true;await context.close();
}catch(e){report.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
