import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4458';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Use the local sensor fixture server only');
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/feature-theme-20260912/${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const report={status:'running',base,before,checks:[],errors:[],hashes:{},scope:'Installed Chrome, actual guide runtime/images and production CSP. Local sensor/API fixture data, no real accounts or hardware. Native mouse/touch/keyboard, viewport emulation.'};
for(const f of ['mode-feature-intro.css','mode-entry-guide.js','gaia-mode-loader.js','index.html','sensors/index.html'])report.hashes[f]=createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try{
  for(const [width,height,reduced=false] of before?[[1440,900]]:[[1440,900],[3840,2160],[390,844],[320,568],[844,390],[1440,900,true]]){
    const palettes=[];
    for(const mode of ['map','sensor']){
      const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900,reducedMotion:reduced?'reduce':'no-preference'});
      await enforceBrowserSecurity(context,base);
      await context.route('https://**',r=>new URL(r.request().url()).origin===new URL(base).origin?r.fallback():r.abort());
      await context.route('**/api/live/v1/firms',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
      page=await context.newPage();page.on('pageerror',e=>report.errors.push(`${mode} ${width}: ${e.message}`));
      const activate=s=>width<900?page.locator(s).tap():page.locator(s).click();
      await page.goto(base+(mode==='map'?'/#world':'/sensors/#map'),{waitUntil:'domcontentloaded'});
      if(mode==='map'){
        await page.locator('#gaia-mode-entry-guide').waitFor();
        if(await page.locator('[data-entry-title-skip]').isVisible())await activate('[data-entry-title-skip]');
      }
      await page.locator('#gaia-mode-entry-guide[data-phase="features"].is-feature-ready').waitFor();
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('.gaia-feature-intro')).opacity==='1');
      await page.locator('.gaia-feature-intro img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));await page.waitForTimeout(500);
      const snapshot=await page.locator('.gaia-feature-intro').evaluate(panel=>{
        const rect=e=>e.getBoundingClientRect().toJSON(),s=getComputedStyle(panel),bg=getComputedStyle(panel,'::after');
        const color=q=>getComputedStyle(panel.querySelector(q)).color;
        const background=q=>getComputedStyle(panel.querySelector(q)).backgroundColor;
        return {box:rect(panel),opacity:s.opacity,background:s.backgroundImage,paintOpacity:bg.opacity,paintBackground:bg.backgroundImage,paintContent:bg.content,
          palette:{heading:color('h2'),copy:color('[data-feature-copy]'),cardHeading:color('h3'),cardBody:color('.gaia-feature-card-copy>span'),cards:[...panel.querySelectorAll('.gaia-feature-card')].map(e=>getComputedStyle(e).backgroundColor),note:color('.gaia-feature-note'),footer:background('.gaia-feature-footer'),guide:background('[data-feature-guide]'),start:getComputedStyle(panel.querySelector('[data-feature-start]')).backgroundImage},
          images:[...panel.querySelectorAll('img')].map(e=>({src:e.getAttribute('src'),width:e.naturalWidth,opacity:getComputedStyle(e).opacity})),
          visualBackgrounds:[...panel.querySelectorAll('.gaia-feature-visual.has-feature-art')].map(e=>getComputedStyle(e).backgroundColor),
          overflow:panel.querySelector('.gaia-feature-scroll').scrollWidth-panel.querySelector('.gaia-feature-scroll').clientWidth,
          controls:[...panel.querySelectorAll('button')].map(e=>{const b=rect(e);return {box:b,hit:e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};})};
      });
      assert.equal(snapshot.opacity,'1');assert.equal(snapshot.overflow,0);assert.equal(snapshot.images.length,3);assert(snapshot.images.every(x=>x.width>0&&x.opacity==='1'));
      assert(snapshot.controls.every(x=>x.hit&&x.box.width>=44&&x.box.height>=44));assert(snapshot.box.x>=0&&snapshot.box.y>=0&&snapshot.box.bottom<=height+1);
      if(!before){assert.equal(snapshot.paintOpacity,'0.8');assert.notEqual(snapshot.paintContent,'none');assert.equal(snapshot.palette.heading,'rgb(240, 251, 255)');assert(snapshot.visualBackgrounds.every(c=>c==='rgba(0, 0, 0, 0)'));}
      palettes.push(snapshot.palette);
      await page.screenshot({path:path.join(output,`${mode}-${width}${reduced?'-reduced':''}.png`)});
      const glints=[];
      if(!before&&width===1440){
        // The initial primary focus wraps through close, guide and primary.
        for(const target of ['[data-feature-close]','[data-feature-guide]','[data-feature-start]']){
          await page.keyboard.press('Tab');assert(await page.locator(target).evaluate(e=>e===document.activeElement));
          await page.waitForTimeout(250);
          const glow=await page.locator(target).evaluate(e=>{const p=getComputedStyle(e,'::after'),s=getComputedStyle(e);return {animation:p.animationName,iterations:p.animationIterationCount,opacity:Number(p.opacity),outline:s.outlineStyle,pointerEvents:p.pointerEvents};});
          assert.notEqual(glow.outline,'none');assert.equal(glow.pointerEvents,'none');
          if(reduced)assert.equal(glow.animation,'none');else {assert.equal(glow.animation,'gaia-feature-focus-glint');assert.equal(glow.iterations,'1');assert(glow.opacity>0);}
          // Locator screenshots wait for animation stability and miss this short glint.
          await page.screenshot({path:path.join(output,`${mode}-${target.slice(1,-1)}${reduced?'-reduced':''}-glint.png`),clip:await page.locator(target).boundingBox()});
          await page.waitForTimeout(750);assert.equal(await page.locator(target).evaluate(e=>Number(getComputedStyle(e,'::after').opacity)),0);
          glints.push(glow);
        }
        await page.locator('[data-feature-guide]').hover();await page.waitForTimeout(180);
        const hover=await page.locator('[data-feature-guide]').evaluate(e=>({animation:getComputedStyle(e,'::after').animationName,opacity:Number(getComputedStyle(e,'::after').opacity)}));
        assert(reduced?hover.animation==='none':hover.opacity>0);glints.push({hover});
        await page.mouse.move(0,0);
      }
      await page.locator('.gaia-feature-note').scrollIntoViewIfNeeded();
      await activate('[data-feature-guide]');await page.locator('.gaia-mode-entry-guide-card[data-positioned="true"]').waitFor();
      await activate('[data-mode-guide-next]');await page.waitForFunction(()=>document.querySelector('#gaia-mode-entry-guide')?.dataset.step==='2');
      await page.keyboard.press('Escape');await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
      const replay=async()=>{
        if(mode==='map'&&width<=900){
          await activate('[data-mobile-sheet="tools"]');
          await page.locator('#map-mobile-sheet').getByRole('button',{name:'地図ガイド',exact:true}).tap();
        }else await activate(`[data-gaia-mode-guide-replay="${mode}"]`);
        await page.locator('#gaia-mode-entry-guide[data-phase="features"].is-feature-ready').waitFor();
      };
      await replay();
      await activate('[data-feature-start]');await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
      await replay();
      await activate('[data-feature-close]');await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
      assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
      report.checks.push({mode,width,height,reduced,snapshot,glints,guideReplayStartClose:true});await context.close();console.log(`PASS ${mode} ${width}x${height}${reduced?' reduced':''}`);
    }
    if(before)assert.notDeepEqual(palettes[0],palettes[1]);else assert.deepEqual(palettes[0],palettes[1],'Both illustrated guides must use exactly the same palette');
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
