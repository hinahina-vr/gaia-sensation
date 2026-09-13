import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before=process.argv.includes('--before');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/sound-slim-unlocked-20260911/${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const keys=['opening','story','windowlight','firstlight','foldedwind','snowfire','snowafter','moonbook','senseware','moonreopen','ending','trueend'];
const report={status:'running',base,before,checks:[],errors:[],missing:[],hashes:{},environment:'Installed Chrome, production CSP, native controls, real audio playback and PCM analysis. Fresh storage except the explicit partial-history compatibility fixture, cleared again before playback. Viewport emulation, not physical devices or human listening.'};
for(const file of ['sound-mode.js','sound-mode.css','sound-constellation.js','gaia-mode-loader.js','index.html'])report.hashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
const heard=()=>page.evaluate(()=>GaiaOpeningAudio.getHeardTracks());
const state=()=>page.evaluate(()=>GaiaOpeningAudio.getPlaybackState());
try{
  for(const width of [3840,1440,390,320]){
    const context=await browser.newContext({viewport:{width,height:width===3840?2160:width===1440?900:844},hasTouch:width<500,isMobile:width<500});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',r=>new URL(r.request().url()).origin===new URL(base).origin?r.fallback():r.abort());
    page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
    const open=async()=>{if(page.url()===base+'/#sound')await page.reload({waitUntil:'domcontentloaded'});else await page.goto(base+'/#sound',{waitUntil:'domcontentloaded'});await page.locator('#sound-layer.is-open').waitFor();await page.locator('#gaia-boot').waitFor({state:'hidden'});};
    const activate=selector=>width<500?page.locator(selector).tap():page.locator(selector).click();
    await open();
    const fresh=await page.evaluate(()=>({disabled:document.querySelectorAll('[data-sound-track]:disabled').length,height:document.querySelector('.sound-track-panel').getBoundingClientRect().height,titles:[...document.querySelectorAll('.sound-track-name')].map(e=>e.textContent)}));
    assert.deepEqual(await heard(),[],'Availability must not fabricate listening history');
    assert.equal(fresh.disabled,before?12:0);
    await page.screenshot({path:path.join(output,`${width}-fresh.png`)});
    if(before){
      const partial=keys.filter(k=>!['firstlight','foldedwind','snowfire','snowafter','moonbook'].includes(k));
      await page.evaluate(tracks=>localStorage.setItem('gaia-senseware-heard-tracks:v1',JSON.stringify({version:1,tracks})),partial);
      await open();assert.equal(await page.locator('[data-sound-track]:disabled').count(),5);
      await page.screenshot({path:path.join(output,`${width}-partial-history.png`)});
      report.checks.push({width,fresh,partialHistoryLocks:5});await context.close();continue;
    }
    assert(fresh.titles.every(t=>t&&!/未解放|未使用曲/.test(t)));
    const partial=keys.filter(k=>!['firstlight','foldedwind','snowfire','snowafter','moonbook'].includes(k));
    await page.evaluate(tracks=>localStorage.setItem('gaia-senseware-heard-tracks:v1',JSON.stringify({version:1,tracks})),partial);
    await open();assert.equal(await page.locator('[data-sound-track]:disabled').count(),0);assert.deepEqual((await heard()).sort(),partial.sort());
    await page.screenshot({path:path.join(output,`${width}-partial-history.png`)});
    await page.evaluate(()=>localStorage.removeItem('gaia-senseware-heard-tracks:v1'));await open();assert.deepEqual(await heard(),[]);
    const samples=[];
    for(const key of keys){
      await activate(`[data-sound-track="${key}"]`);
      await page.waitForFunction(key=>{const s=GaiaOpeningAudio.getPlaybackState();return s.track===key&&s.playing&&!s.muted&&s.currentTime>.15&&s.duration>5&&s.outputVolume>0;},key);
      await page.waitForFunction(key=>document.querySelector('.sound-now-playing')?.dataset.track===key&&document.querySelector('.sound-cover-art img')?.naturalWidth>0,key);
      await page.evaluate(()=>GaiaOpeningAudio.enableAnalysis());
      await page.waitForFunction(()=>GaiaOpeningAudio.getAnalysisFrame().rms>0.0001);
      await page.waitForFunction(key=>GaiaOpeningAudio.hasTrackBeenHeard(key),key);
      samples.push({key,...await state()});
    }
    assert.deepEqual((await heard()).sort(),[...keys].sort());
    // Existing transport mutes/resumes output; it does not freeze the audio clock.
    await activate('#sound-play');await page.waitForFunction(()=>GaiaOpeningAudio.getPlaybackState().muted&&GaiaOpeningAudio.getPlaybackState().outputVolume===0);
    await activate('#sound-play');await page.waitForFunction(()=>GaiaOpeningAudio.getPlaybackState().playing&&!GaiaOpeningAudio.getPlaybackState().muted&&GaiaOpeningAudio.getPlaybackState().outputVolume>0);
    await page.locator('#sound-progress').press('Home');await page.locator('#sound-progress').press('ArrowRight');
    await page.waitForFunction(()=>GaiaOpeningAudio.getPlaybackState().currentTime<5);
    await page.locator('#sound-volume').press('Home');await page.waitForFunction(()=>GaiaOpeningAudio.getPlaybackState().outputVolume===0);
    await page.locator('#sound-volume').press('ArrowRight');await page.waitForFunction(()=>GaiaOpeningAudio.getPlaybackState().volume>0);
    await open();assert.equal(await page.locator('[data-sound-track]:disabled').count(),0);assert.equal((await heard()).length,12);
    await page.evaluate(()=>localStorage.clear());await open();assert.equal(await page.locator('[data-sound-track]:disabled').count(),0);assert.deepEqual(await heard(),[]);
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    report.checks.push({width,fresh,partialHistoryAvailable:true,samples,transportMuteResume:true,nativeSeek:true,nativeVolume:true,reloadAndClearedStorage:true});
    await context.close();console.log(`PASS ${width}: all 12 available, native playback and PCM, controls, fresh/persisted/cleared storage`);
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
