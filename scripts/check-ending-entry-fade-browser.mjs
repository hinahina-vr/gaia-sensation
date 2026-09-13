import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/ending-entry-fade-20260910/${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const report={status:'running',before,base,checks:[],errors:[],missing:[],hashes:{},environment:'Installed Chrome, isolated final-scene save. Only the unrelated credit scroll is fast-forwarded via its real animation.finish(); the requested button and entire blackout/reveal use native input and real time.'};
for(const file of ['novel-mode.js','novel-mode.css','true-end-mode.js','gaia-mode-loader.js','index.html'])report.hashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const version=Number(fs.readFileSync('novel-story-data.js','utf8').match(/"storyVersion":\s*(\d+)/)[1]);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
  for(const [name,width,height,reduced] of (before?[['pc',1440,900,false]]:[['pc',1440,900,false],['mobile',390,844,false],['reduced',390,844,true]])) {
    const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,reducedMotion:reduced?'reduce':'no-preference',acceptDownloads:true});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
    await context.addInitScript(({version,reduced})=>{
      localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:reduced}));
      if(!localStorage.getItem('gaiaSensewareNovel:progress')) {
        const progress={storyVersion:version,stepId:'welcome_chat_095',reachedSceneIds:['welcome_chat'],clear:false,archivesUnlocked:false,metCharacters:{amane:true,mizuha:true,sakuya:true},viewed:{},evesRoute:[],reflectionIds:[],readStepIds:[],audio:{muted:true,volume:.1}};
        localStorage.setItem('gaiaSensewareNovel:progress',JSON.stringify(progress));
        localStorage.setItem('gaiaSensewareNovel:manual-saves',JSON.stringify([{progress,savedAt:Date.now(),meta:{title:'Transition QA',excerpt:progress.stepId}}]));
      }
    },{version,reduced});
    page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
    const activate=s=>width<900?page.locator(s).tap():page.locator(s).click();
    await page.goto(base+'/story',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('.novel-staff-roll')&&document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
    if(!reduced)await page.evaluate(()=>{
      const shell=document.querySelector('.novel-staff-roll');
      const roll=shell.querySelector('.novel-staff-roll-track').getAnimations()[0];
      for(const animation of shell.getAnimations({subtree:true}))if(animation!==roll)animation.finish();
      roll.finish();
    });
    await page.locator('.novel-staff-roll[data-phase="complete"] .novel-staff-roll-finale button').waitFor();
    await page.screenshot({path:path.join(output,name+'-button.png')});
    const manual=await page.evaluate(()=>localStorage.getItem('gaiaSensewareNovel:manual-saves'));
    await page.evaluate(()=>{
      window.__entryFade=[];
      document.querySelector('.novel-staff-roll-finale button').addEventListener('click',()=>{
        const start=performance.now();
        const sample=()=>{
          const layer=document.querySelector('#novel-layer'),veil=layer.querySelector('.novel-staff-roll-transition-veil'),shell=layer.querySelector('.true-end-shell');
          const ui=shell?.querySelector('.true-end-interface');
          __entryFade.push({time:performance.now()-start,phase:layer.dataset.trueEndTransitionPhase,opacity:veil?Number(getComputedStyle(veil).opacity):0,animationMs:veil?parseFloat(getComputedStyle(veil).animationDuration)*1000:0,entryPhase:shell?.dataset.entryPhase,interfaceOpacity:ui?Number(getComputedStyle(ui).opacity):0,text:shell?.querySelector('.true-end-message')?.textContent||'',veilCount:layer.querySelectorAll('.novel-staff-roll-transition-veil').length});
          if(performance.now()-start<7000)requestAnimationFrame(sample);
        };requestAnimationFrame(sample);
      },{once:true});
    });
    await activate('.novel-staff-roll-finale button');
    if(!reduced) {
      await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.trueEndTransitionPhase==='revealing');
      await page.waitForTimeout(before?400:1100);
      await page.screenshot({path:path.join(output,name+'-mid-fade.png')});
    }
    await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.trueEndTransitionPhase==='complete'&&document.querySelector('.true-end-shell')?.dataset.entryPhase==='ready');
    await page.waitForTimeout(650);
    const trace=await page.evaluate(()=>__entryFade);
    const revealing=trace.filter(f=>f.phase==='revealing');
    const complete=trace.find(f=>f.phase==='complete');
    if(!reduced) {
      const expected=before?900:2700;
      assert(revealing.length>12);
      assert(revealing.every(f=>f.animationMs===expected));
      const measured=trace.find(f=>f.phase==='background').time-revealing[0].time;
      assert(Math.abs(measured-expected)<110,`Reveal duration ${measured} must be ${expected}`);
      assert(revealing.every((f,i)=>!i||f.opacity<=revealing[i-1].opacity+.002),'Black veil must fade smoothly');
      assert(revealing.some(f=>f.opacity>.1&&f.opacity<.9));
      assert(revealing.every(f=>f.entryPhase==='background'&&f.interfaceOpacity===0&&!f.text),'No dialogue may appear or type ahead of the reveal');
      report.checks.push({name,expected,measured,completeAt:complete.time,trace});
    } else {
      assert(complete.time<1500,'Reduced motion must retain its short entry');
      report.checks.push({name,reducedEntryMs:complete.time,trace});
    }
    assert(trace.every(f=>f.veilCount<=1));
    assert.equal(await page.locator('.novel-staff-roll-transition-veil').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('gaiaSensewareNovel:manual-saves')),manual);
    await page.screenshot({path:path.join(output,name+'-ready.png')});
    await activate('.true-end-log-button');
    const pending=page.waitForEvent('download');await activate('#novel-log-script-export');
    const download=await pending;const file=path.join(output,name+'-'+download.suggestedFilename());await download.saveAs(file);
    assert(fs.readFileSync(file,'utf8').includes('惑星の放課後'));
    await page.keyboard.press('Escape');
    await activate('.true-end-dialogue');
    assert.equal(await page.locator('.true-end-dialogue').isEnabled(),true);
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    await context.close();console.log('PASS '+name+' ending entry');
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
} catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally {fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
