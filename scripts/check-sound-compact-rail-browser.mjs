import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {seedHeardSoundArchive} from './sound-archive-fixture.mjs';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/sound-slim-rail-2026-09-11/${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const report={status:'running',base,before,checks:[],errors:[],missing:[],hashes:{},environment:'Installed Chrome, real target assets/layout and native focus/scroll. Local targets receive the production CSP; HTTPS targets retain actual server headers. Seeded listening history for geometry only; fresh availability and real audio are tested separately. Viewport emulation, not physical devices.'};
for(const file of ['sound-mode.js','sound-mode.css','sound-constellation.js','gaia-mode-loader.js','index.html'])report.hashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try{
  const context=await browser.newContext();await seedHeardSoundArchive(context);await enforceBrowserSecurity(context,base);await context.route('https://**',r=>new URL(r.request().url()).origin===new URL(base).origin?r.fallback():r.abort());
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
  await page.goto(base+'/#sound',{waitUntil:'domcontentloaded'});await page.locator('#sound-layer.is-open').waitFor();await page.locator('#gaia-boot').waitFor({state:'hidden'});
  for(const [width,height] of [[3840,2160],[1920,1080],[1440,900],[1024,768],[921,900],[920,900],[390,844],[320,568]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(450);
    const frame=await page.evaluate(()=>{
      const rail=document.querySelector('.sound-track-panel'),layout=document.querySelector('.sound-layout'),style=getComputedStyle(rail);
      const rect=e=>e.getBoundingClientRect().toJSON();
      return {rail:rect(rail),paddingTop:parseFloat(style.paddingTop),paddingBottom:parseFloat(style.paddingBottom),overflowX:layout.scrollWidth-layout.clientWidth,railOverflowY:rail.scrollHeight-rail.clientHeight,volume:rect(document.querySelector('.sound-volume')),chapters:[...document.querySelectorAll('.sound-track-chapters span')].map(e=>e.textContent),tracks:[...rail.querySelectorAll('[data-sound-track]')].map(e=>({id:e.dataset.soundTrack,box:rect(e),label:e.getAttribute('aria-label'),disabled:e.disabled}))};
    });
    assert.deepEqual(frame.chapters,[]);
    assert.equal(frame.tracks.length,12);assert(frame.tracks.every(t=>!t.disabled&&t.label&&t.box.height>=44),'Track hit areas and titles must remain intact');assert(frame.overflowX<=1);
    if(width>920){
      const expected=before?Math.min(256,Math.max(150,width*.12-24)):Math.min(160,Math.max(96,width*.065));
      assert(Math.abs(frame.rail.height-expected)<1,'Rail must follow the new 96–160px compact height');
      assert.equal(frame.paddingTop,8);assert.equal(frame.paddingBottom,8);
      assert(frame.railOverflowY<=1);assert(frame.rail.top>=frame.volume.bottom&&frame.rail.bottom<=height,'Player controls and rail must not overlap');
      await page.locator('.sound-track-panel').screenshot({path:path.join(output,width+'-rail.png')});
      for(const key of ['snowafter','story','firstlight']){
        await page.locator(`[data-sound-track="${key}"]`).focus();await page.locator(`[data-sound-track="${key}"].is-morph-settled`).waitFor();
        const focused=await page.locator('.sound-track-panel').evaluate(e=>{
          const b=e.querySelector('.is-morph-focus'),c=b?.querySelector('canvas'),n=b?.querySelector('.sound-track-index');
          const rect=x=>x?.getBoundingClientRect().toJSON();
          const pixels=c?.getContext('2d').getImageData(0,0,c.width,c.height).data;
          return {overflow:e.scrollWidth-e.clientWidth,focus:b?.dataset.soundTrack,button:rect(b),canvas:rect(c),number:rect(n),ink:pixels?.some((v,i)=>i%4===3&&v>0)};
        });
        assert(focused.overflow<=1);assert.equal(focused.focus,key);assert(focused.ink,'Morph title must actually render ink');
        assert(focused.canvas.top>=focused.button.top-1&&focused.canvas.bottom<=focused.number.top+1,'Title canvas must fit above its number');
        assert(focused.canvas.left>=focused.button.left-1&&focused.canvas.right<=focused.button.right+1,'Title canvas must not be clipped');
        await page.locator('.sound-track-panel').screenshot({path:path.join(output,`${width}-${key}-focused.png`)});
      }
      await page.locator('#sound-close').focus();
    }else{
      for(const track of frame.tracks){const button=page.locator(`[data-sound-track="${track.id}"]`);await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert(box.y>=0&&box.y+box.height<=height,'Every mobile track must remain scroll-reachable');}
      await page.screenshot({path:path.join(output,width+'-last-track.png')});
    }
    report.checks.push({width,height,...frame});
  }
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(`PASS sound rail ${before?'baseline':'compact'}: ${report.checks.length} viewports`);
