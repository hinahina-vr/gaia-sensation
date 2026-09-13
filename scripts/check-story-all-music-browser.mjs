import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||'artifacts/story-all-music-20260911');
fs.mkdirSync(output,{recursive:true});
const data={};vm.runInNewContext(fs.readFileSync('novel-story-data.js','utf8'),data);
const story=data.GAIA_NOVEL_STORY,steps=story.scenes.flatMap(s=>s.steps);
const cases=[
  ['gx_experience_001','snowfire','moonreopen'],
  ['esp32_pitch_001','firstlight','snowfire'],
  ['circle_invitation_001','foldedwind','firstlight'],
  ['welcome_chat_001','moonbook','foldedwind'],
  ['welcome_chat_021','senseware','moonbook'],
  ['welcome_chat_075','snowafter','senseware'],
];
// chatSurface is a transient setup cue that advances to its first readable line.
const resumeId=id=>id==='welcome_chat_001'?'welcome_chat_002':id;
for(const [id] of cases)assert(steps.some(s=>s.id===id),`Missing score cue: ${id}`);
const report={status:'running',base,checks:[],errors:[],missing:[],hashes:{},environment:'Installed Chrome, production CSP, isolated saved-position fixtures immediately before each cue, native dialogue/controls/save/load, real MP3 and PCM. Targeted boundary coverage, not a full uninterrupted reading or human listening test. OP/ending/Beyond cues are retained.'};
for(const file of ['novel-mode.js','opening-audio.js','novel-story-data.js','gaia-mode-loader.js','index.html'])report.hashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try{
  for(const [name,width,height] of [['pc',1440,900],['mobile',390,844]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<500,isMobile:width<500,acceptDownloads:true});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',r=>new URL(r.request().url()).origin===new URL(base).origin?r.fallback():r.abort());
    await context.addInitScript(()=>{
      const seed=sessionStorage.getItem('qa:story-music-seed');
      if(!seed)return;
      localStorage.setItem('gaiaSensewareNovel:progress',seed);
      localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:false}));
      localStorage.setItem('gaia-senseware-bgm-muted','true');localStorage.setItem('gaia-senseware-bgm-volume','0.23');
      sessionStorage.removeItem('gaia-senseware-bgm-navigation:v1');
      sessionStorage.removeItem('qa:story-music-seed');
    });
    page=await context.newPage();page.on('pageerror',e=>report.errors.push(`${name}: ${e.message}`));page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    const activate=s=>width<500?page.locator(s).tap():page.locator(s).click();
    const at=id=>page.waitForFunction(id=>document.querySelector('#novel-layer')?.dataset.stepId===id,id);
    const track=key=>page.waitForFunction(key=>GaiaOpeningAudio.getState().track===key,key);
    const playback=()=>page.evaluate(()=>GaiaOpeningAudio.getPlaybackState());
    const unmute=async()=>{
      if((await playback()).muted){
        if(!await page.locator('#gaia-audio-dock').evaluate(e=>e.classList.contains('is-expanded')))await activate('#gaia-audio-toggle');
        await activate('#gaia-audio-toggle');
      }
      await page.waitForFunction(()=>GaiaOpeningAudio.getPlaybackState().playing&&!GaiaOpeningAudio.getPlaybackState().muted);
    };
    const audible=async key=>{
      await track(key);await page.waitForFunction(()=>{const s=GaiaOpeningAudio.getPlaybackState();return s.playing&&s.outputVolume>.02&&s.currentTime>.3&&s.duration>5;});
      await page.evaluate(()=>GaiaOpeningAudio.enableAnalysis());await page.waitForFunction(()=>GaiaOpeningAudio.getAnalysisFrame().rms>.0001);
      return playback();
    };
    const advance=async id=>{
      for(let n=0;n<120;n++){
        if(await page.locator('#novel-layer').getAttribute('data-step-id')===id)return;
        if(!await page.locator('#novel-chapter-card').isVisible())await activate('#novel-dialogue');
        await page.waitForTimeout(120);
      }
      await at(id);
    };
    const samples=[];
    for(let i=0;i<cases.length;i++){
      const [id,key,previousKey]=cases[i],previous=steps[steps.findIndex(s=>s.id===id)-1];
      await page.evaluate(({storyVersion,stepId,reachedSceneIds})=>{
        sessionStorage.setItem('qa:story-music-seed',JSON.stringify({storyVersion,stepId,reachedSceneIds,viewed:{},evesRoute:[],reflectionIds:[],readStepIds:[],metCharacters:{amane:true,mizuha:true,sakuya:true},audio:{muted:true,volume:.23},clear:false,archivesUnlocked:false}));
      },{storyVersion:story.storyVersion,stepId:previous.id,reachedSceneIds:story.scenes.map(s=>s.id)});
      if(new URL(page.url()).pathname==='/story')await page.reload({waitUntil:'domcontentloaded'});else await page.goto(base+'/story',{waitUntil:'domcontentloaded'});
      await at(previous.id);await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');await page.locator('#gaia-boot').waitFor({state:'hidden'});
      await track(previousKey);await unmute();const outgoing=await audible(previousKey);
      await advance(id);const incoming=await audible(key);
      await at(resumeId(id));
      assert.equal(incoming.volume,.23);assert.equal(incoming.muted,false);
      if(i>=3){
        await activate('#novel-save-button');await activate(`.novel-save-slot[data-slot-index="${i-3}"]`);await activate('#novel-save-close');
      }
      await page.screenshot({path:path.join(output,`${name}-${key}.png`)});
      await page.reload({waitUntil:'domcontentloaded'});await at(resumeId(id));await track(key);await page.locator('#gaia-boot').waitFor({state:'hidden'});
      samples.push({id,resumeId:resumeId(id),previous:previous.id,outgoing,incoming,reloadTrack:(await playback()).track});
      console.log(`${name}: ${previous.id} -> ${id} / ${previousKey} -> ${key}, PCM and reload PASS`);
    }
    // Restore each of the three welcome-chat ranges, including backwards loads.
    const loads=[];
    for(let slot=0;slot<3;slot++){
      const [id,key]=cases[slot+3];
      await activate('#novel-load-button');await activate(`.novel-save-slot[data-slot-index="${slot}"]`);await at(resumeId(id));await track(key);await unmute();
      loads.push({id,...await audible(key)});
    }
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    report.checks.push({name,samples,loads});await context.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
