import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_AUDIT_BASE_URL||process.env.GAIA_BASE_URL,production=new URL(base).hostname==='gaia-senseware.pages.dev';
const out=path.resolve(`artifacts/quality-review-20261022/${production?'01-20-production-readonly':'01-20-native-entry'}`);fs.mkdirSync(out,{recursive:true});
const only=process.env.GAIA_AUDIT_ONLY?.split(',').map(Number);
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'Local Chrome, bundled snapshots, HTTPS blocked; emulated mobile. This capture inventory is NOT production verification or aesthetic approval.',views:[],errors:[]};
if(process.env.GAIA_AUDIT_RESUME==='1'&&fs.existsSync(path.join(out,'capture-report.json')))Object.assign(report,JSON.parse(fs.readFileSync(path.join(out,'capture-report.json'),'utf8')));
if(production){report.productionBuild=await fetch(`${base}/build-info.json`).then(r=>r.json());report.scope='Read-only published site in isolated Chrome; GET/HEAD/OPTIONS only. Provider responses are live or their own fallback. Emulated mobile. No push, deploy, rollback, saved analysis, or account writes.';}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  for(const [width,height] of [[1920,1080],[390,844]]) {
    const numbers=only||Array.from({length:20},(_,i)=>i+1);
    const first=numbers.find(n=>only||!report.views.some(v=>v.width===width&&v.number===n));
    if(!first)continue;
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**/*',r=>production&&['GET','HEAD','OPTIONS'].includes(r.request().method())&&!/google-analytics|googletagmanager/.test(r.request().url())?r.continue():r.abort());
    await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
    const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(`${base}/world.html#world-${String(first).padStart(2,'0')}`);
    await page.waitForFunction(()=>document.documentElement.dataset.gaiaAppReady==='true');
    await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
    // App-ready can precede the first title. Observe the explanation before
    // waiting for its end so a cold start cannot be mistaken for a finished intro.
    await page.waitForFunction(()=>{const e=document.querySelector('#map-data-intro');return e&&!e.hidden;});
    for(const number of numbers.filter(n=>n>=first)) {
      if(number>first)await page.locator('[data-map-stable-step="1"]').click();
      await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n,number);
      await page.waitForFunction(()=>!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro'));
      await page.waitForTimeout(1600);
      const stem=`${width}-${String(number).padStart(2,'0')}`;
      await page.screenshot({path:path.join(out,`${stem}.png`)});
      const details=await page.evaluate(()=>({title:document.querySelector('#japan-title').textContent,overflow:document.documentElement.scrollWidth-innerWidth,canvas:[...document.querySelectorAll('#japan-map canvas')].map(e=>({id:e.id,width:e.width,height:e.height,visible:e.checkVisibility({visibilityProperty:true}),state:{...e.dataset}}))}));
      if([1,2,4,7,10,15].includes(number)) {
        await page.waitForTimeout(700);await page.screenshot({path:path.join(out,`${stem}-motion-1.png`)});
        await page.waitForTimeout(1400);await page.screenshot({path:path.join(out,`${stem}-motion-2.png`)});
      }
      report.views=report.views.filter(v=>v.width!==width||v.number!==number);
      report.views.push({width,height,number,...details});console.log(`CAPTURE ${stem}`);
      fs.writeFileSync(path.join(out,'capture-report.json'),JSON.stringify(report,null,2));
    }
    report.errors.push(...await page.evaluate(()=>window.__securityViolations));await context.close();
  }
  report.completed=true;
} catch(error) {report.failure=error.stack;throw error;}
finally {fs.writeFileSync(path.join(out,'capture-report.json'),JSON.stringify(report,null,2));await browser.close();}
