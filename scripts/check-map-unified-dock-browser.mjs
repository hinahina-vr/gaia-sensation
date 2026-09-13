import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {createHash} from 'node:crypto';
import {formatJapaneseNumber} from '../src/shared/number-format.js';
const before=process.argv.includes('--before');
const finalSmoke=Boolean(process.env.GAIA_FINAL_SMOKE);
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(`artifacts/map-unified-dock-20260912/${before?'before':finalSmoke?'final-smoke':'after'}`);
fs.mkdirSync(output,{recursive:true});
const report={before,checks:[],errors:[],hashes:{},scope:'Installed Chrome under actual local app and production CSP, real provider saved data. Desktop/mobile emulation, not physical-device or production verification.'};
for(const f of ['app.js','map-unified-dock.css','src/exploration/index.js','src/exploration/live-exhibits.js','src/exploration/live-data.js','src/exploration/live-timeline.js','sensor-platform/src/prefecture-field.ts','data/live-prefecture-fallback-v1.json','gaia-mode-loader.js','index.html','_worker.js'])report.hashes[f]=createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
 for(const [width,height] of before?[[1440,900],[3840,2160],[390,844]]:finalSmoke?[[1440,900],[390,844],[844,390]]:process.env.GAIA_FOCUSED?[[1440,900],[1024,768],[390,844]]:[[1440,900],[3840,2160],[1024,768],[390,844],[320,568],[844,390]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<901,isMobile:width<901,reducedMotion:'reduce'});
  await enforceBrowserSecurity(context,base);
  await context.route('https://**',r=>r.abort());
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/?exhibit=21#world',{waitUntil:'domcontentloaded'});
  await page.locator('[data-feature-start]').click();await page.evaluate(()=>GaiaMapDemo.stop());
  const numbers=before?[21,6,14,15,20]:finalSmoke?[21,6,16,20]:[21,...(width===1440||width===390?Array.from({length:15},(_,i)=>i+6):[6,10,14,15,16,20])];
  const type=selector=>page.locator(selector).first().evaluate(e=>{const s=getComputedStyle(e);return {family:s.fontFamily,size:s.fontSize,weight:s.fontWeight};});
  let titleType,numberType,valueType;
  for(const n of numbers){
   await page.waitForFunction(()=>globalThis.GaiaMapCategories?.buttons().length===71);
   await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);
   await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);
   await page.waitForTimeout(220);
   const dock=page.locator(n>=21?'.gaia-estat-readout':n>=15?'.gaia-live-exhibit-readout':'.map-command-dock');
   const metrics=await dock.evaluate(el=>Array.from(el.querySelectorAll('p,strong,b,span,input,button,small,label')).filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>{const s=getComputedStyle(e);return {tag:e.tagName,class:e.className,id:e.id,text:e.textContent.slice(0,80),font:s.font,fontSize:s.fontSize,letterSpacing:s.letterSpacing,appearance:s.appearance,box:e.getBoundingClientRect().toJSON()};}));
   await page.screenshot({path:path.join(output,`${width}-${n}.png`)});
   report.checks.push({width,height,n,metrics});
   if(!before){
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
    if(n===21){valueType=await type('.gaia-estat-primary > strong');if(width>900){titleType=await type('.gaia-estat-chapter strong');numberType=await type('.gaia-estat-chapter b');}}
    if(n<21&&width>900){
     assert.deepEqual(await type(n<15?'[data-map-dock-title]':'[data-live-deck-title]'),titleType,`${n}: title matches 21`);
     assert.deepEqual(await type(n<15?'[data-map-dock-number]':'[data-live-deck-number]'),numberType,`${n}: number matches 21`);
    }
    if(n<21&&n!==12)assert.deepEqual(await type(n<15?'.signal-console-map .signal-value-primary':'[data-live-exhibit-value]'),valueType,`${n}: primary value matches 21`);
    if(n<21&&n!==12){
     const metric=page.locator(n<15?'.signal-console-map .signal-value-primary':'[data-live-exhibit-value]');
     const tracking=await metric.evaluate(e=>{
      const s=getComputedStyle(e),unit=e.querySelector('small');
      return {em:parseFloat(s.letterSpacing)/parseFloat(s.fontSize),unit:unit?getComputedStyle(unit).letterSpacing:null};
     });
     assert(Math.abs(tracking.em+.06)<.001,`${n}: digits use compact tracking`);
     if(tracking.unit!==null)assert.equal(tracking.unit,'normal'===tracking.unit?'normal':'0px',`${n}: unit keeps normal tracking`);
     if(n===10||n===16)await metric.screenshot({path:path.join(output,`${width}-${n}-numeric.png`)});
    }
    const slider=page.locator(n===21?'[data-estat-time]':n>=15?'#gaia-live-time':'.signal-console-map [data-signal-time]').first();
    if(n>=15&&n<=20){
     await page.waitForFunction(()=>!document.querySelector('#gaia-live-time').disabled);
     const key=await page.evaluate(n=>GaiaLiveExhibits.definitions.find(e=>Number(e.number)===n).key,n);
     const times=await page.evaluate(key=>GaiaLiveData.getPeriods(key),key);assert.equal(times.length,24);
     await slider.focus();await slider.press('Home');
     assert.equal(await page.evaluate(()=>GaiaLiveData.getSelectedTime()),times[0]);
     const state=await page.evaluate(key=>GaiaLiveData.getState().measurements[key],key);
     assert.equal(state.observedAt,times[0]);
     assert.equal(await page.locator('[data-live-exhibit-value]').textContent(),`${formatJapaneseNumber(state.value,key==='weatherPrecipitation'?2:1)} ${state.unit}`);
     assert.equal(await page.locator('.gaia-live-exhibit-readout').getAttribute('data-selected-time'),times[0]);
     const field=await page.evaluate(()=>GaiaLiveData.getWindField());assert(field.points.every(p=>p.observedAt===times[0]));
     await page.screenshot({path:path.join(output,`${width}-${n}-oldest.png`)});
     await slider.press('ArrowRight');assert.equal(await page.evaluate(()=>GaiaLiveData.getSelectedTime()),times[1]);
     await slider.press('End');assert.equal(await page.evaluate(()=>GaiaLiveData.getSelectedTime()),null);
     const geometry=await slider.evaluate(e=>{const r=e.getBoundingClientRect(),parent=e.closest('.gaia-live-exhibit-readout').getBoundingClientRect();return {r:r.toJSON(),parent:parent.toJSON(),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e};});
     assert(geometry.hit,`${width}/${n}: slider hit target`);
     assert(geometry.r.left>=0&&geometry.r.right<=width&&geometry.r.bottom<=geometry.parent.bottom,`${width}/${n}: slider fits`);
    }else if(n<15){
     if(await slider.isVisible()&&await slider.isEnabled()){
      await slider.focus();await slider.press('Home');const a=await slider.inputValue();await slider.press('End');assert.notEqual(await slider.inputValue(),a,`${n}: original time navigation retained`);
     }
    }
   }
  }
  if(!before)assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
  await context.close();console.log(`CAPTURE ${width}`);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
