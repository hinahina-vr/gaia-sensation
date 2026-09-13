import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const before=process.argv.includes('--before');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4485';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/annual-title-poi-2026-09-09/${before?'motion-before':'motion-after'}`);
fs.mkdirSync(output,{recursive:true});
const report={before,status:'running',environment:'Local Chrome; actual bundled source observations, external requests blocked. Desktop/touch emulation, not physical phones or production.',sha256:Object.fromEntries(['src/exploration/marine-cod-exhibit.js','src/exploration/annual-poi-arrival.js','marine-cod-exhibit.css','map-chapter-navigation.css','gaia-mode-loader.js','src/exploration/index.js','index.html'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
try {
 for(const width of (process.env.ARRIVAL_WIDTHS?.split(',').map(Number)||[1440,390])) for(const reduced of (before?[false]:[false,true])) {
  const context=await browser.newContext({viewport:{width,height:width<=900?844:900},hasTouch:width<=900,isMobile:width<=900,reducedMotion:reduced?'reduce':'no-preference'});
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
  await context.route('https://**',r=>r.abort());
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/?exhibit=31#world',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>globalThis.GaiaMapDemo&&globalThis.GaiaMarineCod?.getState().count>0);
  await page.evaluate(()=>GaiaMapDemo.stop());
  await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')&&document.querySelector('#japan-overlay').dataset.viewAnimation==='idle');
  for(const number of (process.env.ARRIVAL_NUMBERS?.split(',').map(Number)||(before?[38]:[38,63,31]))) {
   const label=`${width}-${reduced?'reduced':'motion'}-${number}`;
   await page.evaluate(number=>{
    const state=globalThis.__arrivalProbe={frames:[],stop:false,started:performance.now()};
    function sample(){
     const c=document.querySelector('#gaia-marine-cod-canvas'),d=document.querySelector('#japan-overlay').dataset;
     const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
     let ink=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)ink++;
     const css=getComputedStyle(c);const hidden=css.visibility==='hidden'||css.display==='none';
     state.frames.push({at:performance.now(),number:Number(GaiaMarineCod.definition.number),separator:document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),separatorOpacity:Number(getComputedStyle(document.querySelector('#map-title-transition')).opacity),separatorEnd:Number(d.titleSeparatorCompletedAt),ink,hidden,points:Number(c.dataset.codArrivalVisibleCount||c.dataset.codVisibleCount||0),state:c.dataset.codArrivalState,start:Number(c.dataset.codArrivalStartedAt),generation:c.dataset.codArrivalGeneration});
     if(!state.stop)setTimeout(sample,65);
    }
    GaiaMapCategories.buttons().find(b=>Number(b.textContent)===number).click();setTimeout(sample,0);
   },number);
   await page.waitForFunction(n=>Number(GaiaMarineCod.definition.number)===n&&GaiaMarineCod.getState().count>0&&!document.querySelector('[data-cod-controls]').disabled,number);
   await page.waitForFunction(()=>__arrivalProbe.frames.some(f=>f.separator&&f.at-__arrivalProbe.started>600));
   await page.screenshot({path:path.join(output,`${label}-separator.png`)});
   await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
   if(!before&&!reduced) {
    await page.waitForFunction(()=>document.querySelector('#gaia-marine-cod-canvas').dataset.codArrivalState==='running');
    await page.waitForTimeout(number===38?400:600);
    await page.screenshot({path:path.join(output,`${label}-arriving.png`)});
   }
   await page.waitForTimeout(before?700:reduced?400:2800);
   const frames=await page.evaluate(()=>{__arrivalProbe.stop=true;return __arrivalProbe.frames;});
   const current=frames.filter(f=>f.number===number),during=current.filter(f=>f.separator),first=current.find(f=>!f.hidden&&f.ink>0),last=current.at(-1);
   const row={label,duringMaxInk:Math.max(...during.map(f=>f.hidden?0:f.ink)),first,last,frames};report.checks.push(row);
   if(before)assert(row.duringMaxInk>0,'Baseline reproduces points during separator');
   else {
    assert(during.length>0&&during.every(f=>f.hidden||f.ink===0),label+': no points under separator');
    assert(first&&!first.separator&&first.separatorOpacity===0,label+': first point after separator disappears');
    assert(last.points>0&&last.state==='complete',label+': all visible points eventually arrive');
    if(!reduced) {const counts=new Set(current.filter(f=>!f.separator&&f.ink>0).map(f=>f.points));assert(counts.size>=3,label+': staggered point counts');}
    else assert(!current.some(f=>f.state==='running'),label+': reduced motion has no bouncing stage');
   }
   await page.screenshot({path:path.join(output,`${label}-complete.png`)});
   console.log(`${before?'BASELINE':'PASS'} ${label}: under separator ${row.duringMaxInk}px; final ${last.points} points`);
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status=before?'reproduced':'passed';
} catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
