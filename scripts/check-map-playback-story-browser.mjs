import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import '../novel-story-data.js';
const before=process.argv.includes('--before'),out=`artifacts/map-playback-20260912/story-${before?'before':'after'}`;fs.mkdirSync(out,{recursive:true});
const report={status:'running',checks:[],errors:[]};const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
try{
 for(const width of [1440,390]){
  const ctx=await browser.newContext({viewport:{width,height:width<900?844:900},reducedMotion:'no-preference'});
  await enforceBrowserSecurity(ctx,'http://127.0.0.1:4492');await ctx.route('https://**',r=>r.abort());
  await ctx.addInitScript(storyVersion=>{const progress={storyVersion,stepId:'map_mode01_004',reachedSceneIds:[],viewed:{},evesRoute:[],observationOrder:null,editorialChoice:null,reflectionIds:[],resultTone:null,demoInterest:'気候の長期変化',metCharacters:{mizuha:true,amane:true,sakuya:true},audio:{muted:true,volume:.37},readStepIds:[],clear:false,archivesUnlocked:false,sessionId:'map-transport-story-qa'};localStorage.setItem('gaiaSensewareNovel:progress',JSON.stringify(progress));localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:false}));},GAIA_NOVEL_STORY.storyVersion);
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:4492/#story',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('novel-mode-detour')&&globalThis.GaiaMapPlayback&&globalThis.GaiaMapObservationAdapter?.getState().signalReady);
  await page.waitForTimeout(1600);const first=await page.evaluate(()=>GaiaMapObservationAdapter.getState());await page.waitForTimeout(1800);const next=await page.evaluate(()=>GaiaMapObservationAdapter.getState());
  report.checks.push({width,first,next});await page.screenshot({path:`${out}/${width}-story.png`});
  if(!before){assert.equal(next.timelineHeld,false,'Full MAP transport must not pause the story-owned timeline');assert.notEqual(next.signalTimePosition,first.signalTimePosition);assert.equal(await page.locator('#gaia-map-playback-toggle').isVisible(),false);await page.locator('#story-map-modal-skip').click();await page.waitForFunction(()=>GaiaNovel.getState().stepId==='map_mode01_005'&&!document.body.classList.contains('novel-mode-detour'));}
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.status=before?'recorded':'passed';
}catch(error){report.failure=error.stack;report.status='failed';throw error;}finally{fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();}
