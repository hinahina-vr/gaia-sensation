import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import '../novel-story-data.js';

const before=process.argv.includes('--before');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/story-section-entry-2026-09-11/${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const report={status:'running',base,before,checks:[],errors:[],missing:[],hashes:{},environment:'Installed Chrome; real target assets; external services blocked. Native click/tap/keyboard and real-time animation sampling. Local targets receive the production CSP; HTTPS targets retain actual server headers. Saved progress fixtures only position the story; viewport emulation is not a physical device.'};
for(const file of ['novel-mode.js','novel-mode.css','true-end-mode.js','true-end.css','story-prologue.js','index.html','gaia-mode-loader.js'])report.hashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
const frame=()=>{
  const layer=document.querySelector('#novel-layer'),shell=document.querySelector('.true-end-shell');
  const opacity=selector=>{const e=document.querySelector(selector);return e&&!e.hidden?Number(getComputedStyle(e).opacity):0;};
  const text=document.querySelector(shell?'.true-end-message':'#novel-text');
  return {time:performance.now(),id:shell?.dataset.step||layer?.dataset.stepId,type:layer?.dataset.stepType,section:shell?.dataset.sectionTransitionPhase,entry:layer?.dataset.sectionEntry||'',background:layer?.dataset.backgroundTransitionPhase,card:shell?Number(getComputedStyle(shell.querySelector('.true-end-scene-card')).opacity):opacity('#novel-chapter-card'),ui:opacity(shell?'.true-end-interface':'#novel-runtime'),controls:opacity(shell?'.true-end-log-button':'.novel-topbar'),audio:opacity('.gaia-audio-dock'),text:text?.textContent||'',reveal:text?.dataset.revealCount,clipX:text?text.scrollWidth-text.clientWidth:0,clipY:text?text.scrollHeight-text.clientHeight:0};
};
async function traceStart(){await page.evaluate(`(() => { const sample = ${String(frame)}; window.__sectionFrames=[]; window.__sectionSampler=setInterval(()=>__sectionFrames.push(sample()),16); })()`);}
async function traceStop(){return page.evaluate(()=>{clearInterval(__sectionSampler);return __sectionFrames;});}
const validate=(trace,ending,reduced)=>{
  const entry=trace.filter(f=>ending?f.section==='interface':f.entry==='revealing');
  if(before){assert(!entry.length,'Baseline already has the requested entry fade');return;}
  if(reduced){assert(!entry.length||entry.length<5,'Reduced motion must not wait for a long fade');return;}
  assert(entry.length>12,'Missing multi-frame section entry fade');
  assert(entry.some(f=>f.ui<.2),'UI must start nearly transparent');
  assert(entry.some(f=>f.ui>.2&&f.ui<.85),'UI must pass through partial opacity');
  assert(entry.some(f=>f.controls>.2&&f.controls<.85),'Controls must fade with the content');
  assert(entry.some(f=>f.audio>.2&&f.audio<.85),'Shared sound controls must fade with the content');
  assert(entry.some(f=>f.ui>.95),'Fade must approach fully visible');
  assert(entry.at(-1).time-entry[0].time>=950,'Entry fade must last about 1.1 seconds');
  assert(entry.every(f=>!['preloading','releasing'].includes(f.background)),'Entry must follow background release');
};
try{
  for(const [name,width,height,reduced] of (before?[['pc',1440,900,false]]:[['pc',1440,900,false],['mobile',390,844,false],['small',320,568,false],['reduced',390,844,true]])){
    const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,reducedMotion:reduced?'reduce':'no-preference',acceptDownloads:true});
    await enforceBrowserSecurity(context,base);await context.route('https://**',r=>new URL(r.request().url()).origin===new URL(base).origin?r.fallback():r.abort());
    await context.addInitScript(({version,reduced})=>{
      localStorage.setItem('gaia-senseware-bgm-muted','true');
      localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:100,reducedMotion:reduced}));
      if(!localStorage.getItem('gaiaSensewareNovel:progress'))localStorage.setItem('gaiaSensewareNovel:progress',JSON.stringify({storyVersion:version,stepId:'festival_concept_005',reachedSceneIds:[],readStepIds:[],metCharacters:{mizuha:true,amane:true,sakuya:true},viewed:{},evesRoute:[],reflectionIds:[],audio:{muted:true,volume:.1},clear:false,archivesUnlocked:false}));
    },{version:GAIA_NOVEL_STORY.storyVersion,reduced});
    page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
    const activate=s=>width<900?page.locator(s).tap():page.locator(s).click();
    await page.goto(base+'/story',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
    await page.locator('#gaia-boot').waitFor({state:'hidden'});
    await traceStart();await activate('#novel-close-button');
    await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepType==='section-separator');
    await page.screenshot({path:path.join(output,name+'-separator.png')});
    if(!before&&!reduced){
      await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.sectionEntry==='revealing');
      await page.waitForTimeout(220);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_001','Enter during fade must not skip the first message');
      await page.screenshot({path:path.join(output,name+'-main-mid-fade.png')});
    }
    await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepId==='map_mode01_001'&&document.querySelector('#novel-layer')?.dataset.stepType==='narration'&&document.querySelector('#novel-text')?.dataset.revealState==='complete'&&!document.querySelector('#novel-layer')?.dataset.sectionEntry);
    const trace=await traceStop();validate(trace,false,reduced);
    const completed=await page.evaluate(frame);assert.equal(completed.ui,1);assert.equal(completed.controls,1);assert(completed.clipX<=1&&completed.clipY<=1);
    await page.screenshot({path:path.join(output,name+'-main-ready.png')});
    report.checks.push({name,kind:'section-skip',trace,completed});
    if(!before){
      await activate('#novel-save-button');await activate('.novel-save-slot[data-slot-index="0"]');await activate('#novel-save-close');await page.locator('#novel-save-panel').waitFor({state:'hidden'});
      await activate('#novel-dialogue');await activate('#novel-load-button');await activate('.novel-save-slot[data-slot-index="0"]');
      // A repeated page can already have the saved step ID while LOAD is
      // still preparing its background. Wait for the actual runtime commit.
      await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepId==='map_mode01_001'&&document.querySelector('#novel-layer')?.dataset.runtimeReveal==='revealed'&&document.querySelector('#novel-layer')?.getAttribute('aria-busy')!=='true'&&document.querySelector('#novel-text')?.dataset.revealState==='complete');
      assert.equal(await page.locator('#novel-layer').getAttribute('data-section-entry'),null);
      await activate('#novel-log-button');await activate('#novel-log-view-script');const download=page.waitForEvent('download');await activate('#novel-log-script-export');
      const file=path.join(output,name+'-script.md');await(await download).saveAs(file);assert(fs.readFileSync(file,'utf8').includes(GAIA_NOVEL_STORY.scenes[1].steps[0].text));
      report.checks.push({name,kind:'save-load-export',passed:true});
      if(['pc','mobile'].includes(name)){
        // Resume the final sentence, then cross the scene boundary by reading
        // normally, rather than using the section-skip shortcut.
        await page.evaluate(()=>{const s=GaiaNovel.getState();s.stepId='festival_concept_076';localStorage.setItem(GaiaNovel.storageKey,JSON.stringify(s));});
        await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.entryTransition==='visible'&&document.querySelector('#novel-text')?.dataset.revealState==='complete');
        await traceStart();
        while(await page.locator('#novel-layer').getAttribute('data-step-id')==='festival_concept_076'){
          await activate('#novel-dialogue');await page.waitForTimeout(80);
          await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepId!=='festival_concept_076'||document.querySelector('#novel-text')?.dataset.revealState==='complete');
        }
        await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepType==='narration'&&document.querySelector('#novel-text')?.dataset.revealState==='complete'&&!document.querySelector('#novel-layer')?.dataset.sectionEntry);
        const natural=await traceStop();validate(natural,false,false);report.checks.push({name,kind:'natural-boundary',trace:natural});
        await activate('#novel-jump-button');await traceStart();await activate('.novel-jump-item[data-scene-id="esp32_pitch"]');
        await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepType==='section-separator'&&document.querySelector('#novel-layer')?.dataset.stepId==='esp32_pitch_001');
        await page.locator('#novel-layer').focus();await page.keyboard.press('Enter');
        await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepType!=='section-separator'&&document.querySelector('#novel-text')?.dataset.revealState==='complete'&&!document.querySelector('#novel-layer')?.dataset.sectionEntry);
        const jump=await traceStop();validate(jump,false,false);assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'esp32_pitch_001');
        const autoPage=await page.locator('#novel-text').getAttribute('data-page-index');
        await activate('#novel-auto-button');await page.waitForFunction(marker=>document.querySelector('#novel-layer')?.dataset.stepId!=='esp32_pitch_001'||document.querySelector('#novel-text')?.dataset.pageIndex!==marker,autoPage,{timeout:7000});await activate('#novel-auto-button');
        report.checks.push({name,kind:'jump-manual-card-dismiss-auto',trace:jump,passed:true});
      }
    }
    await page.evaluate(()=>{const s=GaiaNovel.getState();s.stepId='welcome_chat_095';s.clear=false;localStorage.setItem(GaiaNovel.storageKey,JSON.stringify(s));});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('.novel-staff-roll')&&document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
    if(!reduced)await page.evaluate(()=>{const shell=document.querySelector('.novel-staff-roll'),roll=shell.querySelector('.novel-staff-roll-track').getAnimations()[0];for(const a of shell.getAnimations({subtree:true}))if(a!==roll)a.finish();roll.finish();});
    await page.locator('.novel-staff-roll[data-phase="complete"] .novel-staff-roll-finale button').waitFor();
    await activate('.novel-staff-roll-finale button');await page.waitForFunction(()=>document.querySelector('.true-end-shell')?.dataset.entryPhase==='ready');
    await traceStart();await activate('.true-end-skip-button');
    if(!before&&!reduced){
      await page.waitForFunction(()=>document.querySelector('.true-end-shell')?.dataset.sectionTransitionPhase==='interface');
      await page.waitForTimeout(220);
      await page.keyboard.press('Enter');assert.equal(await page.locator('.true-end-shell').getAttribute('data-step'),'beyond_02_001');
      await page.screenshot({path:path.join(output,name+'-ending-mid-fade.png')});
    }
    await page.waitForFunction(()=>document.querySelector('.true-end-shell')?.dataset.step==='beyond_02_001'&&document.querySelector('.true-end-shell')?.dataset.sectionTransitionPhase==='idle'&&!document.querySelector('.true-end-shell')?.classList.contains('is-revealing'));
    const endingTrace=await traceStop();validate(endingTrace,true,reduced);
    const endingReady=await page.evaluate(frame);assert.equal(endingReady.ui,1);assert.equal(endingReady.controls,1);assert(endingReady.clipX<=1&&endingReady.clipY<=1);
    await page.screenshot({path:path.join(output,name+'-ending-ready.png')});report.checks.push({name,kind:'ending-section',trace:endingTrace,completed:endingReady});
    if(!before){
      assert(endingTrace.filter(f=>f.section==='reveal').every(f=>f.ui===0&&f.controls===0),'Future text/UI must not precede the background release');
      await traceStart();await activate('.true-end-skip-button');
      await page.waitForFunction(()=>document.querySelector('.true-end-shell')?.dataset.step==='beyond_03_001'&&document.querySelector('.true-end-shell')?.dataset.sectionTransitionPhase==='idle');
      const finalScene=await traceStop();validate(finalScene,true,reduced);report.checks.push({name,kind:'ending-final-section',trace:finalScene});
    }
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await context.close();console.log('PASS '+name+' section entry '+(before?'reproduction':'regression'));
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
