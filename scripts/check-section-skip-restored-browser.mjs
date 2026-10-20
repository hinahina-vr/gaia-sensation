import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before=process.env.GAIA_BEFORE==='1';
const normal=process.env.GAIA_NORMAL_MOTION==='1';
const out=`artifacts/section-skip-restored-20261019/${before?'before':normal?'normal-motion':'after'}`;
fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'SHA + uncommitted changes',before,checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const boxesOverlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
let page;
try{
 for(const width of normal?[1440]:before?[1440,390]:[1920,1440,390,320,844]){
  const mobile=width<=844;
  const context=await browser.newContext({viewport:{width,height:width===844?390:width===320?568:900},hasTouch:mobile,reducedMotion:normal?'no-preference':'reduce'});
  await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(process.env.GAIA_BASE_URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!globalThis.GaiaModeLoader);
  await page.evaluate(async normal=>{
   await GaiaModeLoader.load('story');
   const progress={storyVersion:GAIA_NOVEL_STORY.storyVersion,stepId:'festival_concept_005',reachedSceneIds:['festival_concept'],viewed:{},metCharacters:{mizuha:true,amane:true,sakuya:true},evesRoute:[],observationOrder:'LOCAL_FIRST',editorialChoice:null,reflectionIds:[],resultTone:null,demoInterest:'',audio:{muted:true,volume:0},readStepIds:[],clear:false,archivesUnlocked:false,sessionId:'section-skip-restored-qa'};
   localStorage.setItem('gaiaSensewareNovel:progress',JSON.stringify(progress));
   localStorage.setItem('gaiaSensewareNovel:manual-saves',JSON.stringify([{progress,savedAt:Date.now(),meta:{title:'QA',excerpt:progress.stepId}}]));
   localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:!normal}));
   localStorage.setItem('gaia:language:v1','ja');
  },normal);
  await page.goto(`${process.env.GAIA_BASE_URL}/story`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepId==='festival_concept_005'&&document.querySelector('#novel-layer')?.dataset.entryTransition==='visible',null,{timeout:60000});
  await page.locator('#gaia-boot').waitFor({state:'hidden'});
  await page.evaluate(()=>document.fonts.ready);
  const button=page.locator('#novel-close-button');
  await button.waitFor({state:'visible'});
  const scan=async()=>({skip:await button.boundingBox(),home:await page.locator('#novel-home-button').boundingBox(),audio:await page.locator('#gaia-audio-dock').boundingBox()});
  const original=await scan();
  await page.screenshot({path:`${out}/${width}-story.png`});
  console.log(`${width}: ${JSON.stringify(original)}`);
  const row={width,...original};report.checks.push(row);
  if(!before){
   assert(original.skip.x+original.skip.width/2>width/2&&original.skip.y<80,'Section skip is in the upper-right');
   assert(!boxesOverlap(original.skip,original.home)&&!boxesOverlap(original.skip,original.audio),'Skip must not cover return/audio');
   assert(original.skip.height>=44&&original.skip.width>=44);
   assert.equal(await button.getAttribute('data-control-mode'),'skip');
   assert(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Real click target is reachable');
   await page.locator('#gaia-audio-toggle').click();
   await page.waitForFunction(()=>document.querySelector('#gaia-audio-dock').classList.contains('is-expanded'));
   const expanded=await scan();assert(!boxesOverlap(expanded.skip,expanded.audio),'Expanded audio must not cover skip');
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#gaia-audio-dock').classList.contains('is-expanded'));
   const targets=['map_mode01_001','gx_experience_001','esp32_pitch_001','circle_invitation_001','welcome_chat_001'];
   for(const target of targets){
    await page.waitForFunction(()=>{
     const layer=document.querySelector('#novel-layer');
     return !layer.classList.contains('is-background-transitioning')&&!layer.dataset.sectionEntry&&layer.dataset.stepType!=='section-separator';
    },null,{timeout:20000});
    await page.waitForFunction(()=>!document.querySelector('#novel-close-button').disabled);
    console.log(`skip ${width} -> ${target}`);
    if(mobile)await button.tap();else {await button.focus();await page.keyboard.press('Enter');}
    await page.waitForFunction(id=>GaiaNovel.getState().stepId===id,target,{timeout:15000});
    assert.equal(await page.locator('#novel-layer').getAttribute('aria-hidden'),'false');
   }
   row.targets=targets;
   await page.waitForFunction(()=>{const layer=document.querySelector('#novel-layer');return !layer.classList.contains('is-background-transitioning')&&!layer.dataset.sectionEntry&&layer.dataset.stepType!=='section-separator';},null,{timeout:20000});
   await page.waitForFunction(()=>!document.querySelector('#novel-close-button').disabled);
   await button.click();
   await page.locator('#novel-layer.is-staff-roll').waitFor({state:'visible'});
   assert.equal(await button.isVisible(),false,'No duplicate section skip on credits');
   row.ending=true;
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;if(page&&!page.isClosed())await page.screenshot({path:`${out}/failure.png`});throw error;}
finally{fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
