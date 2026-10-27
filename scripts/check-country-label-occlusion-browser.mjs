import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const out='artifacts/country-label-occlusion-20261027';fs.mkdirSync(out,{recursive:true});
const phase=process.env.GAIA_LABEL_PHASE||'after',checks=[];
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{for(const [width,height] of [[1440,900],[390,844]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<901,hasTouch:width<901});await context.route('https://**',r=>r.abort());
 await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true')});
 const page=await context.newPage();await page.emulateMedia({reducedMotion:'reduce'});page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const number of (phase==='before'?[78]:[78,79,80])){
  await page.goto(`http://127.0.0.1:4492/world.html#world-${number}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(number=>globalThis.GaiaClimateHistory?.getState().id===({78:'drinking',79:'sanitation',80:'foresthistory'})[number]&&GaiaClimateHistory.getState().dataState==='ready'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete',number);await page.evaluate(()=>GaiaMapPlayback.stop());
  if(number===78)await page.locator('[data-drinking-service="basic"]').click();
  await page.evaluate(()=>GaiaClimateHistory.selectPoint('IND'));await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.evaluate(()=>GaiaClimateHistory.setYear(2004));
  await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2004'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete'&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');await page.waitForTimeout(500);
  const result=await page.evaluate(()=>{const s=GaiaClimateHistory.getRenderState(),p=s.drinkingReadings.find(p=>p.selected),c=document.querySelector('#gaia-climate-canvas'),r=c.getBoundingClientRect(),scale=c.width/r.width,b=p.bounds;const x=Math.ceil((b.left+6)*scale),y=Math.ceil((b.top+4)*scale),w=Math.floor((b.right-b.left-30)*scale),h=Math.floor((b.bottom-b.top>40?58:25)*scale),pixels=c.getContext('2d').getImageData(x,y,w,h).data;let bright=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>155&&pixels[i+1]>190&&pixels[i+2]>190)bright++;return{bounds:b,bright,selected:GaiaClimateHistory.getState().selectedId,texts:s.textLayer.texts,engine:s.engine}});
  assert.equal(result.selected,'IND');assert(result.texts>0);if(phase==='after'&&number===78)assert.equal(result.bright,0,JSON.stringify({number,width,...result}));
  await page.screenshot({path:`${out}/${phase}-${number}-${width}.png`});checks.push({number,width,...result});
 }
 assert.deepEqual(errors,[]);await context.close();
}fs.writeFileSync(`${out}/${phase}.json`,JSON.stringify({status:'passed',checks},null,2));console.log(JSON.stringify({phase,checks}));}finally{await browser.close()}
