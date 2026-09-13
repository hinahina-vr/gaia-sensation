import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/sound-rail-balance-20260912/${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const report={status:'running',before,base,checks:[],errors:[],hashes:{},scope:'Real Chrome/CSP, all 12 native keyboard-focus targets and final canvas pixels. Reduced motion for repeatable final-frame geometry; normal motion is checked separately. Viewport emulation, not physical hardware.'};
for(const f of ['sound-mode.css','sound-constellation.js','sound-mode.js','gaia-mode-loader.js','index.html'])report.hashes[f]=createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try{
  const context=await browser.newContext({reducedMotion:'reduce'});await enforceBrowserSecurity(context,base);
  await context.route('https://**',r=>new URL(r.request().url()).origin===new URL(base).origin?r.fallback():r.abort());
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/#sound',{waitUntil:'domcontentloaded'});await page.locator('#sound-layer.is-open').waitFor();await page.locator('#gaia-boot').waitFor({state:'hidden'});
  const keys=await page.locator('[data-sound-track]').evaluateAll(es=>es.map(e=>e.dataset.soundTrack));
  for(const [width,height] of [[3840,2160],[1920,1080],[1440,900],[1024,768],[921,900]]){
    await page.setViewportSize({width,height});await page.locator('#sound-close').focus();await page.waitForTimeout(550);
    await page.locator('.sound-track-panel').screenshot({path:path.join(output,`${width}-idle.png`)});
    const samples=[];
    for(const key of keys){
      await page.locator(`[data-sound-track="${key}"]`).focus();await page.locator(`[data-sound-track="${key}"].is-morph-settled`).waitFor();await page.waitForTimeout(520);
      const sample=await page.locator(`[data-sound-track="${key}"]`).evaluate(b=>{
        const rect=e=>e.getBoundingClientRect().toJSON(),canvas=b.querySelector('canvas'),box=rect(canvas),glyph=rect(b.querySelector('.sound-track-constellation'));
        const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>160){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
        const sx=box.width/canvas.width,sy=box.height/canvas.height;
        const ink={left:box.left+minX*sx,right:box.left+(maxX+1)*sx,top:box.top+minY*sy,bottom:box.top+(maxY+1)*sy,height:(maxY-minY+1)*sy};
        return {key:b.dataset.soundTrack,button:rect(b),canvas:box,glyph,number:rect(b.querySelector('.sound-track-index')),ink,centerOffset:(ink.top+ink.bottom-glyph.top-glyph.bottom)/2,panelOverflow:document.querySelector('.sound-track-panel').scrollWidth-document.querySelector('.sound-track-panel').clientWidth,railHeight:document.querySelector('.sound-track-panel').getBoundingClientRect().height};
      });
      assert(Math.abs(sample.railHeight-Math.min(160,Math.max(96,width*.065)))<1,'The compressed rail height must stay unchanged');
      assert(sample.ink.height>0&&sample.button.width>=43&&sample.button.height>=44&&sample.panelOverflow<=1);
      if(!before){
        assert(Math.abs(sample.centerOffset)<3,`${width} ${key}: title floats away from icon row (${sample.centerOffset}px)`);
        assert(sample.ink.top>=sample.button.top&&sample.ink.bottom+5<=sample.number.top,'Title ink must have clear space above its number');
        assert(sample.ink.left>=sample.button.left+5&&sample.ink.right<=sample.button.right-5,'Title must have horizontal breathing room');
      }
      if(['firstlight','snowafter','moonreopen','senseware'].includes(key))await page.locator('.sound-track-panel').screenshot({path:path.join(output,`${width}-${key}.png`)});
      samples.push(sample);
    }
    if(!before&&width>=1440)assert(Math.max(...samples.map(s=>s.ink.height))-Math.min(...samples.map(s=>s.ink.height))<=5,'English and Japanese title sizes must be consistent');
    report.checks.push({width,height,samples});console.log(`${width}: all 12 measured; center offset ${Math.max(...samples.map(s=>Math.abs(s.centerOffset))).toFixed(2)}px`);
  }
  if(before)assert(report.checks.some(c=>c.samples.some(s=>Math.abs(s.centerOffset)>6)),'Baseline must reproduce the reported vertical imbalance');
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
