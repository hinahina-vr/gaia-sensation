import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const out=path.resolve(process.env.GAIA_LAKE_MOTION_OUT||'artifacts/surface-water-motion-20261022');fs.mkdirSync(out,{recursive:true});
const report={scope:'Local real bundled data, normal and reduced motion. Screenshots are actual Chrome frames. Emulated touch, not a physical phone or production.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  for(const [width,height,motion] of [[1920,1080,'no-preference'],[390,844,'no-preference'],[320,568,'reduce']]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900,reducedMotion:motion});
    await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**/*',r=>r.abort());
    await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');window.__motion=[];
      const tick=()=>{const l=document.querySelector('#japan-layer'),c=document.querySelector('#gaia-climate-canvas'),f=document.querySelector('.gaia-lake-view');if(l?.dataset.climateExhibit==='lakes'&&c&&f){window.__motion.push({t:performance.now(),intro:l.matches('.is-map-title-transitioning,.is-map-data-intro'),arrival:c.dataset.climateArrival,detail:l.classList.contains('is-lake-detail'),visible:f.checkVisibility({visibilityProperty:true}),opacity:getComputedStyle(f).opacity});if(window.__motion.length>900)window.__motion.shift();}requestAnimationFrame(tick);};requestAnimationFrame(tick);});
    const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
    const controls = async () => { if(!await page.locator('[data-climate-year]').isVisible()) await page.locator('#map-responsive-data > summary').tap(); };
    const closeControls = async () => { const e=page.locator('#map-responsive-data');if(await e.isVisible()&&await e.getAttribute('open')!==null)await e.locator(':scope > summary').tap(); };
    await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-74`);
    await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');
    await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
    if(width===390){await page.waitForFunction(()=>{const d=document.querySelector('#map-data-intro');return !d.hidden&&Number(getComputedStyle(d).opacity)>.95;});await page.touchscreen.tap(width*.6,height*.5);}
    if(motion!=='reduce') {
      await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='running');
      await page.screenshot({path:path.join(out,`${width}-arrival.png`)});
    }
    await page.waitForFunction(()=>document.querySelector('#japan-layer').classList.contains('is-lake-detail'));
    await page.evaluate(()=>GaiaMapPlayback.stop());
    await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(200);await page.screenshot({path:path.join(out,`${width}-detail.png`)});
    const frames=await page.evaluate(()=>window.__motion);
    assert(!frames.some(f=>f.intro&&f.visible),'No lake expansion over the intro');
    const first=frames.findIndex(f=>f.detail);assert(first>0);
    assert(frames.slice(0,first).some(f=>!f.intro&&!f.detail),'Map is visible before expansion');
    assert.equal(frames[first].arrival,'complete');
    const alpha=()=>page.locator('.gaia-lake-images canvas').evaluate(e=>{const p=e.getContext('2d').getImageData(0,0,e.width,e.height).data;let n=0;for(let i=3;i<p.length;i+=4)n+=p[i];return n;});
    const oldAlpha=await alpha();
    await controls();
    await page.locator('[data-climate-year]').fill('2000');
    await page.waitForFunction(()=>document.querySelector('.gaia-lake-view').dataset.renderedYear==='2000');
    await page.waitForTimeout(130);const middle=await alpha();await page.screenshot({path:path.join(out,`${width}-year-blend.png`)});
    await page.waitForTimeout(450);const newAlpha=await alpha();
    assert(middle>=Math.min(oldAlpha,newAlpha)*.99&&middle<=Math.max(oldAlpha,newAlpha)*1.01,'No dark midpoint or double-bright year blend');
    await page.locator('[data-climate-overview]').click();
    await closeControls();
    await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-lake-detail')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
    await page.waitForTimeout(650);
    assert.equal(await page.locator('#japan-overlay').evaluate(e=>Number(getComputedStyle(e).opacity)),1);
    await page.screenshot({path:path.join(out,`${width}-overview.png`)});
    await controls();
    await page.locator('[data-climate-overview]').click();
    await page.waitForFunction(()=>!document.querySelector('.gaia-lake-view').hidden);
    await page.locator('[data-climate-point]').selectOption('poopo');
    await page.waitForFunction(()=>document.querySelector('.gaia-lake-view').dataset.region==='poopo'&&document.querySelector('[data-lake-image-status]').dataset.state==='ready');
    report.checks.push({width,height,motion,tap:width===390,frames,oldAlpha,middle,newAlpha,returnAndReopen:true});
    assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);await context.close();console.log(`MOTION PASS ${width}`);
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,'motion-report.json'),JSON.stringify(report,null,2));await browser.close();}
