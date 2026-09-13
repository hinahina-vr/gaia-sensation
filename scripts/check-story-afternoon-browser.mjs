import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before=process.argv.includes('--before');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/story-afternoon-2026-09-11/${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const report={status:'running',base,before,checks:[],errors:[],missing:[],hashes:{},environment:'Installed headless Chrome, actual target story assets, isolated story save fixtures then native input. Mobile viewport/touch emulation, not a physical device. External services blocked; production CSP applied to local navigation; HTTPS targets retain actual server headers.'};
for(const file of ['novel-story-data.js','novel-back-half-cues.js','novel-mode.js','gaia-mode-loader.js','index.html'])report.hashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const cases=before?[['festival_concept_001','9:20'],['gx_experience_001','9:45']]:[
  ['festival_concept_001','13:00'],['map_mode01_001','13:20'],['gx_experience_001','13:25'],
  ['esp32_pitch_001','13:33'],['esp32_pitch_016a','13:33'],['circle_invitation_001','13:40'],
  ['welcome_chat_004','13:47','13:46'],['welcome_chat_040','13:47','14:05'],
  ['welcome_chat_075','17:10'],['welcome_chat_081','17:10','17:41'],['welcome_chat_new_024','17:10','17:43'],
];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
  for(const [name,width,height] of [['pc',1440,900],['mobile',390,844]]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900,reducedMotion:'reduce'});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',route=>new URL(route.request().url()).origin===new URL(base).origin?route.fallback():route.abort());
    await context.addInitScript(()=>{
      localStorage.setItem('gaia-senseware-bgm-muted','true');
      localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:true}));
    });
    page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
    const activate=selector=>width<900?page.locator(selector).tap():page.locator(selector).click();
    await page.goto(base+'/story',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.GaiaNovel&&document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
    for(const [stepId,clock,chatTime] of cases) {
      await page.evaluate(id=>{
        const state=GaiaNovel.getState();state.stepId=id;state.clear=false;
        state.metCharacters={amane:true,mizuha:true,sakuya:true};
        localStorage.setItem(GaiaNovel.storageKey,JSON.stringify(state));
      },stepId);
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(id=>document.querySelector('#novel-layer')?.dataset.stepId===id&&document.querySelector('#novel-layer')?.dataset.entryTransition==='visible',stepId);
      await page.locator('#gaia-boot').waitFor({state:'hidden'});
      await page.waitForTimeout(350);
      const heading=await page.locator('#novel-location').evaluate(e=>{
        const r=e.getBoundingClientRect();
        return {text:e.textContent,aria:e.getAttribute('aria-label'),left:r.left,right:r.right,width:r.width,scrollWidth:e.scrollWidth};
      });
      assert(heading.text.startsWith(clock+'｜'),`${name}/${stepId}: ${heading.text}`);
      assert(heading.left>=-1&&heading.right<=width+1&&heading.scrollWidth<=heading.width+1,'Clock heading must not be clipped');
      if(chatTime) {
        const row=page.locator('.novel-slack-post.is-new').last();
        await row.waitFor({state:'visible'});
        assert((await row.innerText()).includes(chatTime),`${stepId}: rendered chat must use the revised clock`);
      }
      if(stepId==='festival_concept_001'||stepId==='gx_experience_001'||stepId==='welcome_chat_081')await page.screenshot({path:path.join(output,`${name}-${stepId}.png`)});
      if(!before&&stepId==='gx_experience_001') {
        await activate('#novel-save-button');await activate('.novel-save-slot[data-slot-index="0"]');await activate('#novel-save-close');
        for(let n=0;n<12&&await page.locator('#novel-layer').getAttribute('data-step-id')===stepId;n++){
          await activate('#novel-dialogue');await page.waitForTimeout(120);
        }
        await activate('#novel-load-button');await activate('.novel-save-slot[data-slot-index="0"]');
        await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepId==='gx_experience_001'&&document.querySelector('#novel-layer')?.dataset.runtimeReveal==='revealed'&&document.querySelector('#novel-layer')?.getAttribute('aria-busy')!=='true'&&document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
        assert((await page.locator('#novel-location').textContent()).startsWith('13:25｜'));
        assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),stepId);
      }
      report.checks.push({name,stepId,clock,chatTime,heading,nativeSaveLoad:!before&&stepId==='gx_experience_001'});
    }
    if(!before) {
      await activate('#novel-log-button');await activate('#novel-log-view-script');
      const ready=page.waitForEvent('download');await activate('#novel-log-script-export');
      const file=path.join(output,`${name}-script.md`);await(await ready).saveAs(file);
      const text=fs.readFileSync(file,'utf8');
      for(const value of ['13:46','14:05','17:41','17:43'])assert(text.includes(value),'Exported metadata includes '+value);
      assert(!text.includes('"time": "10:06"'));
      report.checks.push({name,nativeFullScriptExport:true,file});
    }
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    await context.close();console.log('PASS '+name+(before?' morning reproduction':' afternoon clocks/save/load/export'));
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
