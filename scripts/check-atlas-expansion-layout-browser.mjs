import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL,out=path.resolve(process.env.GAIA_ATLAS_OUT||'artifacts/atlas-expansion-20261022/layout-final');
fs.mkdirSync(out,{recursive:true});
const report={scope:'Final glyph-label and seasonal-diagram layout; actual local Chrome; mobile emulation',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
  for(const [width,height]of [[1920,1080],[1366,768],[390,844],[320,568]]){
    const mobile=width<900,context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
    await enforceBrowserSecurity(context,base);await context.route('https://**/*',r=>r.abort());
    await context.addInitScript(()=>{
      sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__intro=[];window.__names=[];
      const text=CanvasRenderingContext2D.prototype.strokeText;
      CanvasRenderingContext2D.prototype.strokeText=function(s,x,y,...rest){if(s==='アイスランド')window.__names.push({s,x,y,width:this.measureText(s).width,font:this.font});return text.call(this,s,x,y,...rest);};
      const sample=()=>{const i=document.querySelector('#map-data-intro'),c=document.querySelector('#gaia-climate-canvas');if(i&&!i.hidden)window.__intro.push({number:i.dataset.exhibitNumber,opacity:+getComputedStyle(i).opacity,visible:c?.checkVisibility({visibilityProperty:true})||false,playing:globalThis.GaiaMapPlayback?.getState().playing||false});requestAnimationFrame(sample);};requestAnimationFrame(sample);
    });
    page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
    for(const number of process.env.GAIA_ATLAS_NUMBERS?JSON.parse(process.env.GAIA_ATLAS_NUMBERS):mobile?[81,89,90]:[81,86,89,90]){
      await page.goto(`${base}/world.html#world-${number}`,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(id=>globalThis.GaiaClimateHistory?.getState().id===id,{81:'waterstress',86:'urban',89:'seaice',90:'snowcover'}[number]);
      if(width===320){await page.waitForFunction(n=>{const i=document.querySelector('#map-data-intro');return i&&!i.hidden&&+i.dataset.exhibitNumber===n&&+getComputedStyle(i).opacity>.95;},number);await page.touchscreen.tap(width*.5,height*.45);}
      await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');await page.evaluate(()=>GaiaMapPlayback.stop());
      const intro=await page.evaluate(n=>window.__intro.filter(i=>+i.number===n),number);assert(intro.length>2);assert(!intro.some(i=>i.visible||i.playing));assert(intro.at(-1).opacity<.01);
      if(number<89&&!mobile){
        await page.locator('[data-climate-point]').selectOption('ISL');await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(450);
        await page.locator('[data-climate-overview]').click();await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(450);
        const label=await page.evaluate(()=>window.__names.at(-1));assert(label,'Selected country label drawn');assert(label.x-label.width/2>=0&&label.x+label.width/2<=width&&label.y>=20&&label.y<height-100,'Label inside viewport');
        const blocked=await page.evaluate(label=>[...document.querySelectorAll('#map-stable-navigation,.japan-heading,#gaia-map-zoom-controls')].filter(e=>e.checkVisibility({visibilityProperty:true})).some(e=>{const r=e.getBoundingClientRect();return label.x+label.width/2>r.left&&label.x-label.width/2<r.right&&label.y>r.top&&label.y-20<r.bottom;}),label);assert(!blocked,'Selected-country name not under navigation or zoom');
      }
      if(number>=89){
        const hidden=await page.evaluate(()=>{const found=new Set();for(const e of document.querySelectorAll('.gaia-climate-legend,#map-scope-note')){if(!e.checkVisibility({visibilityProperty:true}))continue;const b=e.getBoundingClientRect();for(let x=b.left+4;x<b.right;x+=10)for(let y=b.top+4;y<b.bottom;y+=10){const p=GaiaClimateHistory.findPoiAt(x,y,'mouse');if(p)found.add(p.record.id);}}return [...found];});assert.deepEqual(hidden,[],`${number}/${width}: diagram obscured by legend`);
        if(number===90)assert((await page.locator('[data-climate-detail]').textContent()).includes('扇'));
      }
      await page.screenshot({path:path.join(out,`${width}x${height}-${number}.png`)});report.checks.push({number,width,height,fullFade:true,tap:width===320,layout:true});console.log(`PASS final layout ${width}/${number}`);
    }
    assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')});throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,errors:report.errors}));}
