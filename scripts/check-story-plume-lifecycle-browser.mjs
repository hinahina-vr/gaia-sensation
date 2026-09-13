import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||'artifacts/story-opening-sea-plume-20260910/plume-lifecycle');
fs.mkdirSync(output,{recursive:true});
const report={status:'running',base,checks:[],errors:[],missing:[],environment:'Installed Chrome; actual WebGL pixels/context loss and native controls. GPU-unavailable case is explicitly injected; touch is viewport emulation.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
  for(const [name,width,height] of [['pc',1440,900],['mobile',390,844],['unavailable',390,844]]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
    await context.addInitScript(({unavailable})=>{
      sessionStorage.setItem('gaia:title-return-resume','1');
      if(unavailable) {
        const getContext=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(type,...args) {
          return this.classList.contains('gaia-story-prologue-plume')&&type==='webgl'?null:getContext.call(this,type,...args);
        };
      }
    },{unavailable:name==='unavailable'});
    page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    const activate=s=>width<900?page.locator(s).tap():page.locator(s).click();
    const enter=async()=>{
      await activate('#gaia-opening-route-story');
      await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor();
    };
    await enter();
    const state=()=>page.evaluate(()=>GaiaStoryPrologue.getState());
    const initial=await state();
    assert.equal(initial.plume.renderer,name==='unavailable'?'fallback':'webgl');
    assert.equal(initial.ambience,false,'Sound-off must not create audible waves');
    if(name!=='unavailable') {
      const pixels=()=>page.evaluate(async()=>{
        const canvas=document.querySelector('.gaia-story-prologue-plume');
        const gl=canvas.getContext('webgl');
        window.__testedPlumeCanvas=canvas; window.__testedPlumeContext=gl;
        let result;
        for(let attempt=0;attempt<30;attempt++) {
          await new Promise(resolve=>requestAnimationFrame(resolve));
          const data=new Uint8Array(canvas.width*canvas.height*4);
          gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
          let colored=0,min=255,max=0,checksum=0;
          for(let i=0;i<data.length;i+=4) {
            if(data[i+3]===0)continue;
            min=Math.min(min,data[i]);max=Math.max(max,data[i]);
            if(data[i]<245)colored++;
            checksum=(Math.imul(checksum,31)+data[i]+data[i+1]*3+data[i+2]*7)>>>0;
          }
          result={colored,min,max,checksum,error:gl.getError(),pixels:canvas.width*canvas.height};
          if(colored>100)return result;
        }
        return result;
      });
      const first=await pixels();
      assert.equal(first.error,0);assert(first.colored>100&&first.max-first.min>15,'WebGL must paint real sea-colored mist, not just expose a canvas');
      await page.waitForTimeout(900);
      const second=await pixels();
      assert.notEqual(first.checksum,second.checksum,'The actual mist pixels must move');
      await page.screenshot({path:path.join(output,name+'-plume.png')});
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForTimeout(150);
      const still=(await state()).plume.frames;
      await page.waitForTimeout(600);
      assert.equal((await state()).plume.frames,still,'Reduced motion must stop the render loop');
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.waitForTimeout(150);
      assert((await state()).plume.frames>still,'Motion preference changes must resume safely');
      await page.setViewportSize({width:width<900?844:1920,height:width<900?390:1080});
      await page.waitForTimeout(150);
      const resized=(await state()).plume;
      assert(resized.width*resized.height<=360000);
      await page.evaluate(()=>__testedPlumeContext.getExtension('WEBGL_lose_context').loseContext());
      await page.waitForFunction(()=>GaiaStoryPrologue.getState().plume.renderer==='fallback');
      assert.equal(await page.locator('.gaia-story-prologue-copy').evaluate(e=>getComputedStyle(e).textAlign),'center');
      await page.keyboard.press('Escape');
      await page.locator('#gaia-story-prologue').waitFor({state:'detached'});
      assert.equal((await state()).plume,null);
      assert.equal((await state()).ambience,false);
      assert.equal(await page.evaluate(()=>__testedPlumeCanvas.isConnected),false);
      assert.equal(await page.evaluate(()=>GaiaOpeningAudio.getState().duckGain),1);
      await enter();
      assert.equal((await state()).plume.renderer,'webgl','Re-entry must create a fresh working renderer');
      report.checks.push({name,first,second,resized,reducedMotionStopsFrames:true,contextLossFallback:true,cancelDisposes:true,reentry:true});
    }
    await activate('#gaia-story-prologue button:first-of-type');
    await page.waitForFunction(()=>!document.querySelector('#gaia-story-prologue')&&document.querySelector('#novel-layer')?.dataset.stepId==='festival_concept_001');
    assert.equal((await state()).plume,null);
    if(name==='unavailable')report.checks.push({name,renderer:'injected GPU unavailable → pure-white fallback',nativeSkipAndLanding:true});
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    await context.close(); console.log('PASS plume '+name);
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
} catch(error) {
  report.status='failed';report.failure=error.stack;
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;
} finally {
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();
}
