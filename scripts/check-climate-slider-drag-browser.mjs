import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {chromium} from 'playwright-core';
const out='artifacts/climate-slider-drag-20261026',base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492',before=process.argv.includes('--before');fs.mkdirSync(out,{recursive:true});
const report={baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',before,scope:'Real held mouse drags and touch gestures, not programmatic range fills.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 const cases=before?[[77,1440,900,false]]:[[77,1440,900,false],[78,1440,900,false],[79,1440,900,false],[80,1440,900,false],[76,1440,900,false],[72,1440,900,false],[77,390,844,true]];
 for(const [number,width,height,touch] of cases){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:'reduce'});await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true')});
  page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${base}/world.html#world-${number}`);await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');await page.evaluate(()=>GaiaMapPlayback.stop());
  const slider=page.locator('[data-climate-year]');if(!await slider.isVisible())await page.locator('#map-responsive-data > summary').click();
  await slider.focus();await page.keyboard.press('Home');await page.waitForFunction(()=>GaiaClimateHistory.getState().dataState==='ready');
  const info=await slider.evaluate(e=>({min:Number(e.min),max:Number(e.max)}));
  await slider.evaluate(e=>{window.__sliderInputs=[];window.__sliderDisabled=0;e.addEventListener('input',()=>__sliderInputs.push(Number(e.value)));new MutationObserver(records=>{__sliderDisabled+=records.filter(r=>r.attributeName==='disabled').length}).observe(e.closest('fieldset'),{attributes:true})});
  const rect=await slider.boundingBox(),start={x:rect.x+10,y:rect.y+rect.height/2},samples=[];
  let cdp;if(touch){cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]})}else{await page.mouse.move(start.x,start.y);await page.mouse.down()}
  for(const fraction of [.2,.4,.6,.8,.95]){
   const point={x:rect.x+10+(rect.width-20)*fraction,y:start.y};
   if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});else await page.mouse.move(point.x,point.y,{steps:4});
   await page.waitForTimeout(25);samples.push(Number(await slider.inputValue()));
  }
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
  await page.waitForFunction(()=>GaiaClimateHistory.getState().dataState==='ready');
  const events=await page.evaluate(()=>({inputs:__sliderInputs,disabledChanges:__sliderDisabled,year:GaiaClimateHistory.getState().year}));
  if(before)report.reproduced=new Set(samples).size<3||events.disabledChanges>0;
  else{
   assert(new Set(samples).size>=3,`Continuous drag stalled: ${number} ${JSON.stringify(samples)}`);assert.equal(events.disabledChanges,0);
   assert(samples.at(-1)>=info.min+(info.max-info.min)*.85);assert.equal(events.year,samples.at(-1));
   await slider.focus();await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>GaiaClimateHistory.getState().dataState==='ready');assert.equal(Number(await slider.inputValue()),events.year-1);
  }
  await page.screenshot({path:`${out}/${before?'before':'after'}-${number}-${touch?'touch':'mouse'}.png`});
  report.checks.push({number,width,height,touch,...info,samples,...events});console.log('PASS drag',before?'before':'after',number,touch?'touch':'mouse',JSON.stringify(samples));await context.close();
 }if(before)assert.equal(report.reproduced,true);assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e}
finally{fs.writeFileSync(`${out}/${before?'before':'after'}.json`,JSON.stringify(report,null,2));await browser.close()}
