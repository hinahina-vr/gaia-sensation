import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import '../novel-story-data.js';
const before = process.argv.includes('--before');
const out = path.resolve(`artifacts/character-transition-fade-20260912/${before?'before':'after'}`);
fs.mkdirSync(out,{recursive:true});
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report = {checks:[],status:'running'};
try {
  for(const [width,reduced] of [[1440,false],[390,false],[1440,true]]) {
    const context = await browser.newContext({viewport:{width,height:900},reducedMotion:reduced?'reduce':'no-preference'});
    await enforceBrowserSecurity(context,'http://127.0.0.1:4492');
    await context.route('https://**',route=>route.abort());
    await context.addInitScript(version=>{
      localStorage.setItem('gaiaSensewareNovel:progress',JSON.stringify({storyVersion:version,stepId:'circle_invitation_new_023',
        readStepIds:['circle_invitation_new_023'],reachedSceneIds:['circle_invitation'],viewed:{},evesRoute:[],
        metCharacters:{amane:true,mizuha:true,sakuya:true},audio:{muted:true,volume:0},clear:false,archivesUnlocked:false}));
      localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:false}));
    },GAIA_NOVEL_STORY.storyVersion);
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4492/#story');
    await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.runtimeReveal==='revealed'
      && document.querySelector('#novel-text').dataset.revealState==='complete');
    await page.locator('#gaia-boot').waitFor({state:'hidden'});
    await page.evaluate(()=>{
      window.fadeFrames=[];
      const sample=()=>{
        const layer=document.querySelector('#novel-layer');
        const cast=document.querySelector('.novel-cast');
        const figure=document.querySelector('#novel-character-minamo');
        window.fadeFrames.push({time:performance.now(),step:layer.dataset.stepId,phase:layer.dataset.backgroundTransitionPhase,
          cast:Number(getComputedStyle(cast).opacity),figure:Number(getComputedStyle(figure).opacity),visibility:getComputedStyle(cast).visibility});
        window.fadeRaf=requestAnimationFrame(sample);
      }; sample();
    });
    for(let i=0;i<5;i++) {
      if(await page.locator('#novel-layer').getAttribute('data-step-id')==='circle_invitation_068') break;
      const box=await page.locator('#novel-text').boundingBox();
      await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
      await page.waitForTimeout(400);
    }
    await page.waitForFunction(()=>document.querySelector('#novel-layer').dataset.stepId==='circle_invitation_068'
      && document.querySelector('#novel-layer').dataset.backgroundTransitionPhase==='complete');
    await page.waitForTimeout(200);
    await page.screenshot({path:path.join(out,`${width}-${reduced?'reduced':'motion'}-entering.png`)});
    await page.waitForTimeout(650);
    const frames=await page.evaluate(()=>{cancelAnimationFrame(window.fadeRaf);return window.fadeFrames;});
    const entrance=frames.filter(f=>f.step==='circle_invitation_068'&&f.phase==='complete'&&f.visibility==='visible');
    const intermediate=entrance.filter(f=>f.cast*f.figure>0.02&&f.cast*f.figure<0.98);
    assert(entrance.length>5);
    if(before || reduced) assert.equal(intermediate.length,0,'Immediate presentation for baseline or reduced motion');
    else assert(intermediate.length>=5,'Entrance must have multiple intermediate opacity frames');
    assert(entrance.at(-1).cast*entrance.at(-1).figure>0.99);
    await page.screenshot({path:path.join(out,`${width}-settled.png`)});
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    report.checks.push({width,reduced,intermediateFrames:intermediate.length,frames});
    await context.close(); console.log('PASS',width,intermediate.length);
  }
  report.status='passed';
} finally {
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)); await browser.close();
}
