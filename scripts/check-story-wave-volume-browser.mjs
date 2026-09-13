import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before');
const expectedSurfGain = before ? 0.5 : 0.25;
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/story-section-entry-2026-09-11/audio-${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const report={status:'running',base,before,checks:[],errors:[],hashes:{},environment:'Installed Chrome, native title click, real procedural Web Audio. Local targets receive production CSP; HTTPS targets retain actual server headers. Passive analyser taps compare surf source and final output at the same audio clock; no fake audio or autoplay bypass. This is measured playback, not subjective speaker listening.'};
for(const file of ['story-prologue.js','opening-audio.js','index.html'])report.hashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try{
  for(const width of (before?[1440]:[1440,390])){
    const context=await browser.newContext({viewport:{width,height:width<900?844:900},isMobile:width<900,hasTouch:width<900});
    await enforceBrowserSecurity(context,base);await context.route('https://**',r=>new URL(r.request().url()).origin===new URL(base).origin?r.fallback():r.abort());
    await context.addInitScript(()=>{
      sessionStorage.setItem('gaia:title-return-resume','1');
      localStorage.setItem('gaia-senseware-bgm-volume','.1');
      localStorage.setItem('gaia-senseware-bgm-muted','false');
      window.__waveTaps={};
      const connect=AudioNode.prototype.connect;
      AudioNode.prototype.connect=function(destination,...args){
        const result=connect.call(this,destination,...args);
        const tap=node=>{const a=node.context.createAnalyser();a.fftSize=8192;connect.call(node,a);return a;};
        if(this instanceof BiquadFilterNode&&this.type==='highpass'&&this.frequency.value===65){__waveTaps.source=tap(this);__waveTaps.sourceDestination=destination;}
        if(this instanceof GainNode&&destination===this.context.destination){__waveTaps.output=tap(this);__waveTaps.context=this.context;}
        return result;
      };
    });
    page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    const activate=s=>width<900?page.locator(s).tap():page.locator(s).click();
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#gaia-opening-route-story').waitFor();
    await activate('#gaia-audio-toggle');await activate('#gaia-audio-toggle');
    await page.waitForFunction(()=>GaiaOpeningAudio.getPlaybackState().outputVolume>.0999);
    if(width<900){await page.locator('#gaia-opening-route-guide.is-visible').waitFor();await page.keyboard.press('Escape');await page.locator('#gaia-opening-route-guide').waitFor({state:'hidden'});}
    await activate('#gaia-opening-route-story');await page.waitForFunction(()=>window.GaiaStoryPrologue?.getState().waveFade===1&&__waveTaps.source&&__waveTaps.output);
    const samples=await page.evaluate(async()=>{
      const rms=a=>{const values=new Float32Array(a.fftSize);a.getFloatTimeDomainData(values);return Math.sqrt(values.reduce((s,x)=>s+x*x,0)/values.length);};
      const result=[];
      for(let i=0;i<12;i++){
        const input=rms(__waveTaps.source),output=rms(__waveTaps.output);
        result.push({input,output,ratio:output/input,audio:GaiaOpeningAudio.getState(),prologue:GaiaStoryPrologue.getState(),sourceDestinationGain:__waveTaps.sourceDestination.gain.value});
        await new Promise(resolve=>setTimeout(resolve,80));
      }
      return result;
    });
    for(const sample of samples){
      assert(sample.input>.001&&sample.output>.00001,'Real surf must produce measurable PCM');
      const expected=sample.audio.volume*sample.audio.mixGain*.85*expectedSurfGain;
      assert(Math.abs(sample.ratio-expected)<expected*.08,`Surf output ratio ${sample.ratio} differs from ${expected}`);
      assert.equal(sample.sourceDestinationGain,expectedSurfGain,'Only the surf branch must be halved again; preserve the master');
    }
    const preference=await page.evaluate(()=>localStorage.getItem('gaia-senseware-bgm-volume'));
    await page.evaluate(()=>GaiaOpeningAudio.setMuted(true));await page.waitForTimeout(550);
    const muted=await page.evaluate(()=>{const a=__waveTaps.output,v=new Float32Array(a.fftSize);a.getFloatTimeDomainData(v);return {peak:Math.max(...v.map(Math.abs)),gain:GaiaStoryPrologue.getState().ambienceGain};});
    assert.equal(muted.gain,0);assert(muted.peak<.00001);
    await page.evaluate(()=>GaiaOpeningAudio.setMuted(false));await page.waitForTimeout(550);
    assert((await page.evaluate(()=>GaiaStoryPrologue.getState().ambienceGain))>0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('gaia-senseware-bgm-volume')),preference,'Surf mix must not change user volume');
    await activate('#gaia-story-prologue button:last-of-type');
    await page.waitForFunction(()=>!document.querySelector('#gaia-story-prologue')&&__waveTaps.context.state==='closed');
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    report.checks.push({width,samples,muted,cancelClosedContext:true,preferenceUnchanged:true});
    await context.close();console.log('PASS '+width+' wave '+(before?'baseline':'half-volume'));
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
