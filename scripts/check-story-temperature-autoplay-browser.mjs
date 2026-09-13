import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/story-temperature-autoplay-2026-09-11/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, {recursive:true});
const report = {status:'running', base, before, checks:[], errors:[], missing:[], hashes:{}, environment:'Installed headless Chrome; desktop and touch/mobile viewport emulation; actual same-origin data and rendering, seeded preceding story save then native controls. External requests blocked; local navigation uses production CSP; HTTPS targets retain actual server headers.'};
for (const file of ['story-temperature.js','story-temperature.css','novel-mode.js','app.js','gaia-mode-loader.js','index.html']) {
  report.hashes[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
const scenarios = (before ? [['pc',1440,900],['mobile',390,844]] : [['pc',1440,900],['mobile',390,844],['small',320,568],['landscape',844,390],['reduced',390,844],['edge',1440,900]])
  .filter(([name]) => !only || only.split(',').includes(name));
assert(scenarios.length>0,'Select at least one known scenario');
try {
  for (const [name,width,height] of scenarios) {
    const context = await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900,reducedMotion:name==='reduced'?'reduce':'no-preference'});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',route=>new URL(route.request().url()).origin===new URL(base).origin?route.fallback():route.abort());
    await context.addInitScript(reduced=>{
      localStorage.setItem('gaia-senseware-bgm-muted','true');
      localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:reduced}));
    },name==='reduced'||name==='edge');
    page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
    const activate=selector=>width<900?page.locator(selector).tap():page.locator(selector).click();
    await page.goto(base+'/story',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.GaiaNovel&&document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
    await page.evaluate(()=>{
      const state=GaiaNovel.getState();state.stepId='map_mode01_022';state.clear=false;
      state.metCharacters={amane:true,mizuha:true,sakuya:true};
      localStorage.setItem(GaiaNovel.storageKey,JSON.stringify(state));
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepId==='map_mode01_022'&&document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
    await page.locator('#gaia-boot').waitFor({state:'hidden'});
    await activate('#novel-save-button');await activate('.novel-save-slot[data-slot-index="0"]');await activate('#novel-save-close');
    const enter=async()=>{
      for(let i=0;i<18&&await page.locator('#novel-layer').getAttribute('data-step-id')==='map_mode01_022';i++) {
        await activate('#novel-dialogue');await page.waitForTimeout(120);
      }
      await page.waitForFunction(()=>document.querySelector('.story-temperature')?.dataset.ready==='true');
    };
    const replay=async()=>{
      await activate('#novel-load-button');await activate('.novel-save-slot[data-slot-index="0"]');
      await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepId==='map_mode01_022'&&document.querySelector('#novel-layer')?.dataset.runtimeReveal==='revealed'&&document.querySelector('#novel-layer')?.getAttribute('aria-busy')!=='true'&&document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
      await enter();
    };
    const returned=async()=>{
      await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepId==='map_mode01_024'&&!document.body.dataset.novelInteractionState);
      await page.locator('#japan-layer').waitFor({state:'hidden'});
      assert.equal(await page.locator('.story-temperature').count(),0);
      assert.equal(await page.locator('#novel-dialogue').evaluate(e=>e===document.activeElement),true);
      await page.waitForTimeout(1800);
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_024','Completion must advance exactly once, not skip dialogue');
    };
    await enter();
    const slider=page.locator('[data-temperature-time]');
    const first=await slider.inputValue();
    if(before) {
      await page.waitForTimeout(1800);
      assert.equal(await slider.inputValue(),first,'Reproduce: no automatic year progression');
      await slider.press('End');await page.waitForTimeout(2200);
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_023','Reproduce: end of slider never returns');
      await page.screenshot({path:path.join(output,name+'-2025.png')});
      report.checks.push({name,reproduced:'Stationary timeline and no return at final year',first,final:await slider.inputValue()});
    } else if(name==='edge') {
      // Config-only reduced motion, without changing the OS media preference.
      await activate('[data-temperature-play]');await slider.press('Home');
      await page.evaluate(()=>{
        window.__temperatureTickTimes=[];
        window.addEventListener('gaia:story-map-interaction',e=>{if(e.detail?.year)__temperatureTickTimes.push(performance.now());});
      });
      await activate('[data-temperature-play]');
      await page.waitForFunction(()=>__temperatureTickTimes.length>=4);
      await activate('[data-temperature-play]');
      const ticks=await page.evaluate(()=>__temperatureTickTimes);
      assert(ticks.slice(1).every((t,i)=>t-ticks[i]>=380),'The in-app reduced-motion preference slows frame changes');
      // A stale completion from the earlier CO2 timeline must not close this phase.
      await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gaia:story-mode-auto-complete',{detail:{kind:'map01',view:'timeline_complete'}})));
      await page.waitForTimeout(1800);
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_023');
      // Native pointer capture: hold the final year longer than the return delay.
      let box=await slider.boundingBox();
      await page.mouse.move(box.x+box.width-2,box.y+box.height/2);await page.mouse.down();
      await page.waitForTimeout(2000);
      assert.equal(await slider.inputValue(),'2025');
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_023');
      await page.mouse.move(box.x+box.width*.6,box.y+box.height/2,{steps:5});await page.mouse.up();
      await page.waitForTimeout(1800);
      assert(Number(await slider.inputValue())<2025);
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_023');
      await activate('[data-temperature-play]');
      // Injected document visibility condition; this is not a physical tab/device test.
      await page.evaluate(()=>{
        Object.defineProperty(document,'hidden',{configurable:true,value:true});
        document.dispatchEvent(new Event('visibilitychange'));
      });
      const hiddenYear=await slider.inputValue();await page.waitForTimeout(1400);
      assert.equal(await slider.inputValue(),hiddenYear);
      await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
      await page.waitForFunction(y=>Number(document.querySelector('[data-temperature-time]').value)>Number(y),hiddenYear);
      await activate('[data-temperature-play]');
      await slider.press('End');
      await page.evaluate(()=>{
        Object.defineProperty(document,'hidden',{configurable:true,value:true});
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForTimeout(2000);
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_023');
      await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
      await returned();
      await page.screenshot({path:path.join(output,'edge-story-return.png')});
      report.checks.push({name,configReducedMotionIntervalsMs:ticks.slice(1).map((t,i)=>t-ticks[i]),staleCo2CompletionIgnored:true,nativePointerHoldAndBacktrack:true,injectedHiddenYear: hiddenYear,injectedVisibilityPausesPlaybackAndReturn:true});
    } else {
      const started=Date.now();
      await page.waitForFunction(start=>Number(document.querySelector('[data-temperature-time]')?.value)>Number(start),first);
      await activate('[data-temperature-play]');
      const held=await slider.inputValue();
      await page.waitForTimeout(1200);assert.equal(await slider.inputValue(),held,'Native pause holds the year');
      assert.equal(await page.locator('[data-temperature-play]').getAttribute('aria-pressed'),'false');
      const layout=await page.evaluate(()=>{
        const shell=document.querySelector('.story-temperature');
        const rect=selector=>{const r=shell.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right};};
        return {overflow:shell.scrollWidth-shell.clientWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth,canvas:rect('canvas'),slider:rect('[data-temperature-time]'),play:rect('[data-temperature-play]'),return:rect('[data-temperature-return]'),font:getComputedStyle(shell).fontFamily};
      });
      assert(layout.overflow<=1&&layout.pageOverflow<=1);
      for(const control of [layout.play,layout.return])assert(control.w>=44&&control.h>=44,'Touch controls have 44px targets');
      assert(layout.canvas.h>=100&&layout.canvas.bottom<=height&&layout.slider.bottom<=height,'Map and timeline are visible together');
      assert(layout.font.includes('Gothic')||layout.font.includes('Sans'),'UI uses the shared sans-serif typography');
      await page.screenshot({path:path.join(output,name+'-paused.png')});
      // Comparing years before the final one must not close the display.
      await slider.press('ArrowRight');await page.waitForTimeout(800);
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_023');
      await slider.press('Home');
      await activate('[data-temperature-play]');
      // Source reading suspends playback; closing it resumes, never catches up in a jump.
      await activate('.story-temperature-source summary');
      const readingYear=await slider.inputValue();await page.waitForTimeout(1300);
      assert.equal(await slider.inputValue(),readingYear);
      await page.locator('[data-temperature-retrieved]').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,name+'-source.png')});
      await activate('.story-temperature-source summary');
      await page.waitForFunction(year=>Number(document.querySelector('[data-temperature-time]')?.value)>Number(year),readingYear);
      // Real, unaccelerated autoplay: every annual frame through the last year.
      await page.evaluate(()=>{
        window.__temperatureYears=[];window.__temperatureCompletions=[];window.__temperatureExit=[];
        window.addEventListener('gaia:story-map-interaction',e=>{if(e.detail?.year)__temperatureYears.push(e.detail.year);});
        window.addEventListener('gaia:story-mode-auto-complete',e=>__temperatureCompletions.push(e.detail));
        const sample=()=>{
          const shell=document.querySelector('.story-temperature'),parent=document.querySelector('#japan-layer');
          __temperatureExit.push({hidden:parent.hidden,temperature:parent.classList.contains('is-story-temperature')});
          if(shell)requestAnimationFrame(sample);
        };requestAnimationFrame(sample);
      });
      await page.waitForFunction(()=>document.querySelector('.story-temperature')?.dataset.year==='2025',null,{timeout:45000});
      await page.screenshot({path:path.join(output,name+'-2025.png')});
      await returned();
      const auto=await page.evaluate(()=>({years:__temperatureYears,completions:__temperatureCompletions,exit:__temperatureExit}));
      assert(auto.years.length>50);assert.equal(auto.years.at(-1),2025);
      assert(auto.years.every((y,i)=>!i||y===auto.years[i-1]+1));
      assert.equal(auto.completions.length,1);assert.equal(auto.completions[0].phase,'temperature-anomaly');
      assert(auto.exit.every(f=>f.hidden||f.temperature),'No obsolete CO2 layer flashes on return');
      await page.screenshot({path:path.join(output,name+'-story-return.png')});
      // Native replay, keyboard seek and backtracking cancel a pending final-year return.
      await replay();await activate('[data-temperature-play]');
      await slider.press('End');await page.waitForTimeout(200);await slider.press('ArrowLeft');
      await page.waitForTimeout(1800);
      assert.equal(await slider.inputValue(),'2024');
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_023');
      await activate('[data-temperature-next]');await returned();
      // Pointer/touch at the end of the slider also completes while paused.
      await replay();await activate('[data-temperature-play]');
      const sb=await slider.boundingBox(),x=sb.x+sb.width-2,y=sb.y+sb.height/2;
      if(width<900)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
      assert.equal(await slider.inputValue(),'2025');await returned();
      // Replay starts cleanly after timers have fired; explicit return cancels them.
      await replay();assert(Number(await slider.inputValue())<1962);
      await activate('[data-temperature-return]');await returned();
      report.checks.push({name,first,held,layout,autoYears:auto.years,completionCount:auto.completions.length,elapsedMs:Date.now()-started,autoplay:true,pauseResume:true,sourceReadingPause:true,backtrackCancels:true,nativeNextCompletion:true,pointerEndCompletion:true,nativeSaveLoadReplay:true,skipNoDuplicate:true});
    }
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    await context.close();console.log('PASS '+name+(before?' reproduction':' autoplay + manual return'));
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
} catch(error) {
  report.status='failed';report.failure=error.stack;
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;
} finally {
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();
}
