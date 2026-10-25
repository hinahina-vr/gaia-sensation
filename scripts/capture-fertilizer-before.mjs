import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const out=path.resolve('artifacts/fertilizer-84-20261025/before');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
for(const [width,height] of [[1440,900],[390,844]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,deviceScaleFactor:1});
 await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
 await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
 const page=await context.newPage();page.setDefaultTimeout(60000);
 await page.goto(process.env.GAIA_BASE_URL+'/world.html#world-84');
 await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');
 await page.evaluate(()=>{GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});
 await page.waitForFunction(()=>!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');
 await page.screenshot({path:path.join(out,width+'-84.png')});console.log('baseline '+width);await context.close();
}
}finally{await browser.close();}
