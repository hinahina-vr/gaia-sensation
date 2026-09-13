import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import '../novel-story-data.js';
const steps=GAIA_NOVEL_STORY.scenes.flatMap(scene=>scene.steps);
const minutes=time=>time.split(':').reduce((h,m)=>Number(h)*60+Number(m));
let previous=minutes('13:00'), maxJump=0;
for(const step of steps) {
  const now=minutes(step.displayTime);
  assert(now>=previous,step.id+': clock reversed');
  maxJump=Math.max(maxJump,now-previous); assert(now-previous<=10,step.id+': abrupt clock jump');
  if(step.time) assert.equal(step.time,step.displayTime,step.id+': message/header mismatch');
  previous=now;
}
const expected={festival_concept_001:'13:00',map_mode01_001:'13:40',gx_experience_001:'14:20',esp32_pitch_001:'15:00',
  circle_invitation_001:'15:30',welcome_chat_004:'15:40',welcome_chat_040:'15:59',welcome_chat_047:'16:00',
  welcome_chat_064:'16:30',welcome_chat_075:'17:10',welcome_chat_081:'17:41'};
for(const [id,time] of Object.entries(expected)) assert.equal(steps.find(s=>s.id===id).displayTime,time,id);
const output=path.resolve('artifacts/closing-clock-20260912');fs.mkdirSync(output,{recursive:true});
const report={status:'running',stepCount:steps.length,maxJump,checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  for(const width of [1440,390]) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',acceptDownloads:true});
    await enforceBrowserSecurity(context,'http://127.0.0.1:4492');
    await context.route('https://**',r=>r.abort());
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto('http://127.0.0.1:4492/');
    for(const [id,time] of Object.entries(expected)) {
      const index=steps.findIndex(s=>s.id===id);
      await page.evaluate(({step,read,version})=>{
        localStorage.setItem('gaiaSensewareNovel:progress',JSON.stringify({storyVersion:version,stepId:step.id,readStepIds:read,
          reachedSceneIds:[step.sceneId],viewed:{},evesRoute:[],metCharacters:{amane:true,mizuha:true,sakuya:true},audio:{muted:true,volume:0},clear:false,archivesUnlocked:false}));
        localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:true}));
      },{step:steps[index],read:steps.slice(0,index+1).map(s=>s.id),version:GAIA_NOVEL_STORY.storyVersion});
      await page.goto('http://127.0.0.1:4492/#story'); await page.reload();
      await page.waitForFunction(id=>document.querySelector('#novel-layer')?.dataset.stepId===id
        && document.querySelector('#novel-layer').dataset.runtimeReveal==='revealed'
        && document.querySelector('#novel-layer').dataset.entryTransition==='visible',id);
      await page.locator('#gaia-boot').waitFor({state:'hidden'});
      assert.equal(await page.locator('[data-temporal-heading-unit="time"]').textContent(),time);
      assert.equal(await page.locator('#novel-layer').getAttribute('data-story-time'),time);
      if(['welcome_chat_047','circle_invitation_001','welcome_chat_081'].includes(id)) {
        await page.waitForTimeout(500);
        await page.screenshot({path:path.join(output,`${width}-${id}.png`)});
      }
      if (id==='welcome_chat_047') {
        await page.locator('#novel-save-button').click();
        await page.locator('.novel-save-slot[data-slot-index="0"]').click();
        await page.locator('#novel-save-close').click();
        const box=await page.locator('#novel-text').boundingBox();
        await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
        await page.locator('#novel-load-button').click();
        await page.locator('.novel-save-slot[data-slot-index="0"]').click();
        await page.waitForFunction(()=>document.querySelector('#novel-layer').dataset.stepId==='welcome_chat_047'
          && document.querySelector('#novel-layer').dataset.runtimeReveal==='revealed');
        assert.equal(await page.locator('[data-temporal-heading-unit="time"]').textContent(),'16:00');
        await page.locator('#novel-log-button').click(); await page.keyboard.type('ruu');
        const pending=page.waitForEvent('download');
        await page.locator('#novel-log-script-export').click();
        const downloaded=await pending, destination=path.join(output,`${width}-script.md`);
        await downloaded.saveAs(destination);
        const markdown=fs.readFileSync(destination,'utf8');
        assert(markdown.includes('"displayTime": "16:00"') && markdown.includes('15:59') && markdown.includes('17:41'));
      }
      report.checks.push({width,id,time});
    }
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    await context.close();console.log('PASS clocks',width);
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
} finally {fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
