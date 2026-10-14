import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const production=process.argv.includes('--production');
const before=process.argv.includes('--before');
const base=production?'https://gaia-senseware.pages.dev':process.env.GAIA_BASE_URL;
const width=Number(process.env.GAIA_QA_WIDTH||3840),height=width<600?844:2088;
const output=path.resolve('artifacts/data-explore-crash-20261014',production?'production':before?'local-before':'local-after',String(width));
fs.mkdirSync(output,{recursive:true});
const report={base,width,height,scope:'Installed Chrome; actual title button; isolated E-drive temporary browser profile; mobile is emulated',errors:[],crashes:[],assets:[],events:[]};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<600,hasTouch:width<600,locale:'ja-JP',timezoneId:'Asia/Tokyo'});
await enforceBrowserSecurity(context,base);
await context.route(/^https?:\/\//,route=>new URL(route.request().url()).origin===base?route.fallback():route.abort());
await context.addInitScript(()=>{
  const probe=globalThis.__exploreProbe={longTasks:[],gl:[],heartbeat:0};
  globalThis.__documentIdentity=crypto.randomUUID();
  setInterval(()=>probe.heartbeat++,100);
  new PerformanceObserver(list=>{for(const e of list.getEntries())probe.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
  for(const Type of [WebGLRenderingContext,WebGL2RenderingContext])for(const name of ['compileShader','linkProgram','getProgramParameter','drawArrays']){
    const original=Type.prototype[name];let count=0;
    Type.prototype[name]=function(...args){const start=performance.now();const value=original.apply(this,args);const duration=performance.now()-start;if(++count<8||duration>100)probe.gl.push({name,duration,result:typeof value==='boolean'?value:null});return value;};
  }
});
const page=await context.newPage();page.setDefaultTimeout(45000);page.setDefaultNavigationTimeout(90000);
page.on('pageerror',error=>{report.errors.push(error.stack);save();});
page.on('crash',()=>{report.crashes.push('Renderer crashed');save();});
page.on('console',m=>{if(m.type()==='error'){report.events.push(m.text().slice(0,700));save();}});
page.on('response',async response=>{if(/\/(app|gaia-mode-loader|opening)\.js\?/.test(response.url())){const data=await response.body().catch(()=>null);report.assets.push({url:response.url(),status:response.status(),bytes:data?.length,hash:data?createHash('sha256').update(data).digest('hex'):null});save();}});
try{
  await page.goto(`${base}/?routeGuide=0`,{waitUntil:'domcontentloaded'});
  await page.locator('#gaia-opening-sound-off').click();
  await page.locator('#gaia-opening-skip').click();
  await page.waitForFunction(()=>document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
  await page.locator('#gaia-boot').waitFor({state:'hidden'});
  await page.screenshot({path:path.join(output,'before.png')});
  if(await page.locator('#gaia-opening-route-guide').isVisible())await page.keyboard.press('Escape');
  const documentBefore=await page.evaluate(()=>__documentIdentity);
  const started=Date.now();await page.locator('#gaia-opening-route-other').click();
  if(!production&&!before){await page.waitForURL(url=>url.pathname==='/world');assert.notEqual(await page.evaluate(()=>__documentIdentity),documentBefore,'Map must own a fresh document');}
  await page.waitForFunction(()=>['true','fallback'].includes(document.documentElement.dataset.gaiaAppReady)&&document.querySelector('#japan-layer')?.getAttribute('aria-hidden')==='false',null,{timeout:45000});
  await page.locator('#gaia-opening').waitFor({state:'hidden'});
  report.elapsedMs=Date.now()-started;
  await page.waitForTimeout(2500);
  await page.locator('[data-feature-start]').click();
  await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
  report.state=await page.evaluate(()=>({hash:location.hash,appReady:document.documentElement.dataset.gaiaAppReady,entryReady:document.documentElement.dataset.gaiaEntryReady,body:document.body.className,overlay:{...document.querySelector('#japan-overlay').dataset},probe:__exploreProbe}));
  await page.screenshot({path:path.join(output,'after.png')});
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.crashes,[]);
  if(!production&&!before){
    await page.locator('#japan-close').click();await page.waitForURL(url=>url.pathname==='/'&&url.hash==='#top');
    await page.locator('#intro-path-stage').waitFor({state:'visible'});report.menuReturn=true;
    if(await page.locator('#intro-entry-guide').isVisible())await page.keyboard.press('Escape');
    await page.locator('#intro-path-stage').screenshot({path:path.join(output,'menu.png')});
    await page.goBack();await page.waitForURL(url=>url.pathname==='/world');
    await page.waitForFunction(()=>document.documentElement.dataset.gaiaAppReady==='true'&&document.querySelector('#japan-layer')?.getAttribute('aria-hidden')==='false');report.browserBack=true;
    // Simulate the startup request failing, then exercise the actual Retry UI.
    await page.route('**/app.js?*',route=>route.abort());await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.gaia-map-entry-recovery button').waitFor({state:'visible'});
    await page.screenshot({path:path.join(output,'retry.png')});
    await page.unroute('**/app.js?*');await page.locator('.gaia-map-entry-recovery button').click();
    await page.waitForFunction(()=>document.documentElement.dataset.gaiaAppReady==='true'&&document.querySelector('#japan-layer')?.getAttribute('aria-hidden')==='false');
    await page.locator('#gaia-boot').waitFor({state:'hidden'});report.failedRequestRetry=true;
    report.shaderModes=[];
    for(let index=0;index<9;index++){
      await page.evaluate(index=>GaiaMapObservationAdapter.selectMode(index),index);
      await page.waitForFunction(index=>document.querySelector('#gaia-canvas').dataset.baseShaderState==='ready'&&document.querySelector('#gaia-canvas').dataset.baseShaderModes.split(',').map(Number).includes(index),index);
      await page.waitForTimeout(120);
      const state=await page.evaluate(()=>{const c=document.querySelector('#gaia-canvas');return {modes:c.dataset.baseShaderModes,bytes:Number(c.dataset.baseShaderBytes),cacheSize:Number(c.dataset.baseShaderCacheSize),error:c.getContext('webgl2').getError()};});
      assert.equal(state.error,0,'No WebGL uniform/binding errors');assert(state.modes.split(',').length<=2);assert(state.cacheSize<=3);report.shaderModes.push(state);
    }
    // Late compilation must not replace the latest selection.
    await page.evaluate(()=>{for(const i of [2,5,8,0])GaiaMapObservationAdapter.selectMode(i);});
    await page.waitForFunction(()=>document.querySelector('#gaia-canvas').dataset.baseShaderState==='ready'&&document.querySelector('#gaia-canvas').dataset.baseShaderModes.split(',').includes('0'));
    await page.waitForTimeout(1000);
    assert((await page.locator('#gaia-canvas').getAttribute('data-base-shader-modes')).split(',').includes('0'));
    report.rapidSelection=true;
    await page.goto(`${base}/world?mode=2#world-07`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.documentElement.dataset.gaiaAppReady==='true'&&document.querySelector('#japan-layer')?.getAttribute('aria-hidden')==='false');
    assert((await page.locator('#gaia-canvas').getAttribute('data-base-shader-modes')).split(',').includes('1'));
    report.legacyModeQuery=true;
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.crashes,[]);
  }
  report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;if(!page.isClosed()){await page.screenshot({path:path.join(output,'failure.png'),timeout:8000}).catch(()=>{});report.state=await page.evaluate(()=>({hash:location.hash,appReady:document.documentElement.dataset.gaiaAppReady,entryReady:document.documentElement.dataset.gaiaEntryReady,body:document.body.className,probe:__exploreProbe,error:document.querySelector('#gaia-story-entry-error')?.textContent})).catch(()=>null);}throw error;}
finally{save();await browser.close();console.log(JSON.stringify(report,null,2));}
