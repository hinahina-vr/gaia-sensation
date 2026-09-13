import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import '../novel-story-data.js';
import '../true-end-data.js';

const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||'artifacts/story-reading-breaks-2026-09-11/lifecycle');
fs.mkdirSync(output,{recursive:true});
const report={status:'running',base,checks:[],errors:[],missing:[],hashes:{},environment:'Installed headless Chrome; real target assets; production CSP on localhost, actual server headers on HTTPS; external services blocked. Native keyboard/pointer input, real typewriter time. OS reduced-motion emulation is changed to enter the ending quickly, then disabled for animation checks. Viewport emulation is not a physical device.'};
for(const file of ['dialogue-typography.js','novel-mode.js','true-end-mode.js','true-end-data.js','true-end.css','gaia-mode-loader.js','index.html'])report.hashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
const glyphFrame=(ending)=>{
  const root=document.querySelector(ending?'.true-end-shell':'#novel-layer');
  const text=root.querySelector(ending?'.true-end-message':'#novel-text');
  const glyphs=[...text.querySelectorAll(ending?'.true-end-reveal-glyph':'.novel-reveal-glyph')].map((g,index)=>({index,text:g.textContent,visible:getComputedStyle(g).visibility==='visible',x:g.getBoundingClientRect().x,y:g.getBoundingClientRect().y}));
  return {id:ending?root.dataset.step:root.dataset.stepId,page:ending?root.dataset.messagePage:text.dataset.pageIndex,aria:text.getAttribute('aria-label'),text:text.textContent,glyphs,clipX:text.scrollWidth-text.clientWidth,clipY:text.scrollHeight-text.clientHeight};
};
const stable=(first,second)=>{
  assert.equal(first.id,second.id);assert.equal(first.page,second.page);assert.equal(first.aria,second.aria);
  assert(first.glyphs.some(g=>g.visible)&&first.glyphs.some(g=>!g.visible),'Partial reveal must contain both visible and hidden glyphs');
  assert(second.glyphs.filter(g=>g.visible).length>first.glyphs.filter(g=>g.visible).length,'Typewriter must progress');
  for(const g of first.glyphs){assert(Math.abs(g.x-second.glyphs[g.index].x)<.5&&Math.abs(g.y-second.glyphs[g.index].y)<.5,'Glyphs must not rewrap during reveal');}
};
try{
  for(const width of [1440,390]){
    const height=width<900?844:900;
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900,reducedMotion:'no-preference'});
    await enforceBrowserSecurity(context,base);await context.route('https://**',r=>new URL(r.request().url()).origin===new URL(base).origin?r.fallback():r.abort());
    await context.addInitScript(version=>{
      localStorage.setItem('gaia-senseware-bgm-muted','true');
      if(!localStorage.getItem('gaiaSensewareNovel:progress')){
        localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:80,reducedMotion:false}));
        localStorage.setItem('gaiaSensewareNovel:progress',JSON.stringify({storyVersion:version,stepId:'esp32_pitch_016',reachedSceneIds:[],viewed:{},metCharacters:{mizuha:true,amane:true,sakuya:true},evesRoute:[],reflectionIds:[],readStepIds:[],clear:false,archivesUnlocked:false,audio:{muted:true,volume:0}}));
      }
    },GAIA_NOVEL_STORY.storyVersion);
    page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
    const activate=s=>width<900?page.locator(s).tap():page.locator(s).click();
    await page.goto(base+'/story',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.entryTransition==='visible'&&Number(document.querySelector('#novel-text')?.dataset.revealCount)>=2&&document.querySelector('#novel-text')?.dataset.revealState==='running');
    const mainFirst=await page.evaluate(glyphFrame,false);await page.waitForTimeout(190);const mainNext=await page.evaluate(glyphFrame,false);stable(mainFirst,mainNext);
    await page.screenshot({path:path.join(output,width+'-main-typing.png')});
    await page.locator('#gaia-boot').waitFor({state:'hidden'});
    await activate('#novel-dialogue');await page.waitForFunction(()=>document.querySelector('#novel-text')?.dataset.revealState==='complete');
    assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'esp32_pitch_016');
    // AUTO must advance the next page/step without another dialogue click.
    const beforeAuto=await page.evaluate(glyphFrame,false);await activate('#novel-auto-button');
    await page.waitForFunction(({id,page})=>document.querySelector('#novel-layer')?.dataset.stepId!==id||document.querySelector('#novel-text')?.dataset.pageIndex!==page,{id:beforeAuto.id,page:beforeAuto.page},{timeout:8000});
    await activate('#novel-auto-button');
    report.checks.push({width,mainStable:[mainFirst,mainNext],auto:true});

    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{const s=GaiaNovel.getState();s.stepId='welcome_chat_095';s.clear=false;localStorage.setItem(GaiaNovel.storageKey,JSON.stringify(s));});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.novel-staff-roll[data-phase="complete"] .novel-staff-roll-finale button').waitFor();
    await activate('.novel-staff-roll-finale button');
    await page.waitForFunction(()=>document.querySelector('.true-end-shell')?.dataset.entryPhase==='ready');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('.true-end-shell').focus();await page.keyboard.press('Space');
    await page.waitForFunction(()=>document.querySelector('.true-end-shell')?.dataset.step==='beyond_01_002'&&document.querySelectorAll('.true-end-reveal-glyph.is-visible').length>=2&&document.querySelector('.true-end-shell')?.classList.contains('is-revealing'));
    const first=await page.evaluate(glyphFrame,true);await page.waitForTimeout(160);const second=await page.evaluate(glyphFrame,true);stable(first,second);
    // Screenshots can outlast the first page's typewriter. Finish it with the
    // keyboard before taking a screenshot, so Enter cannot advance twice.
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>!document.querySelector('.true-end-shell')?.classList.contains('is-revealing'));
    assert.equal(await page.locator('.true-end-shell').getAttribute('data-step'),'beyond_01_002');
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.true-end-shell')?.dataset.messagePage?.startsWith('2/')&&document.querySelector('.true-end-shell')?.classList.contains('is-revealing'));
    const pageTwo=await page.evaluate(glyphFrame,true);
    await page.screenshot({path:path.join(output,width+'-ending-page-two.png')});
    const source=GAIA_TRUE_END_STORY.scenes.flatMap(s=>s.steps).find(s=>s.id==='beyond_01_002').text;
    const anchor=source.indexOf(pageTwo.aria);assert(anchor>0);
    await page.setViewportSize({width:320,height:568});
    await page.waitForFunction(()=>!document.querySelector('.true-end-shell')?.classList.contains('is-revealing'));
    await page.waitForTimeout(250);
    const narrow=await page.evaluate(glyphFrame,true),newAnchor=source.indexOf(narrow.aria);
    assert.equal(narrow.id,pageTwo.id);assert(newAnchor>=0&&newAnchor<=anchor&&newAnchor+narrow.aria.length>anchor,'Resize must retain the current reading position');
    assert(narrow.clipX<=1&&narrow.clipY<=1);
    await page.screenshot({path:path.join(output,width+'-ending-resized.png')});
    await page.setViewportSize({width,height});await page.waitForTimeout(300);
    const expanded=await page.evaluate(glyphFrame,true);assert.equal(expanded.id,pageTwo.id);assert(expanded.clipX<=1&&expanded.clipY<=1);
    report.checks.push({width,endingStable:[first,second],pageTwo,narrow,expanded,keyboard:true,resizeAnchor:true});
    // LOG must show the full source, independently of the dynamic display pages.
    await activate('.true-end-log-button');await activate('#novel-log-view-script');
    const download=page.waitForEvent('download');await activate('#novel-log-script-export');
    const file=path.join(output,width+'-script.md');await(await download).saveAs(file);assert(fs.readFileSync(file,'utf8').includes(source));await page.keyboard.press('Escape');
    // Native chapter skips reach the finale; then exercise teardown and return.
    await page.emulateMedia({reducedMotion:'reduce'});
    for(let n=0;n<3;n++){
      await activate('.true-end-skip-button');await page.waitForTimeout(120);
    }
    await page.locator('.true-end-finale').waitFor({state:'visible'});
    await activate('.true-end-finale button');
    await page.waitForFunction(()=>!document.querySelector('.true-end-shell')&&document.querySelector('#intro-layer')?.getAttribute('aria-hidden')==='false');
    await page.setViewportSize({width:width-10,height});await page.waitForTimeout(250);
    report.checks.push({width,export:file,nativeFinaleExit:true,resizeAfterDestroy:true});
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await context.close();console.log('PASS '+width+'px reading lifecycle');
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
