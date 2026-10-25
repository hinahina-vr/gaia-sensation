// Read-only visual inventory. Does not change application sources or source data.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const out=path.resolve('artifacts/gis-baseline-review-20261022');
fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',scope:'01–70 visual and spatial-interaction inventory, local installed Chrome 1440×900, bundled snapshots, external requests blocked. Title animation accelerated only for traversal; explanation dismissed by actual mouse click; data arrival unmodified. Not production or timing/performance certification.',views:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  for(let start=1;start<=70;start+=10){
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);
    await context.route('https://**/*',r=>r.abort());
    await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
    const page=await context.newPage();page.setDefaultTimeout(45000);
    page.on('pageerror',e=>report.errors.push({number:report.current,message:e.message}));
    await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-${String(start).padStart(2,'0')}`);
    await page.waitForFunction(()=>document.documentElement.dataset.gaiaAppReady==='true');
    await page.evaluate(()=>{GaiaModeEntryGuide?.close('map',{restoreFocus:false});setInterval(()=>document.querySelector('#map-title-transition')?.getAnimations({subtree:true}).filter(a=>a.animationName?.startsWith('map-title')).forEach(a=>{a.playbackRate=30;}),30);});
    for(let number=start;number<start+10;number++){
      report.current=number;
      if(number>start)await page.locator('[data-map-stable-step="1"]').click();
      await page.waitForFunction(n=>{const e=document.querySelector('#map-data-intro');return e&&!e.hidden&&+e.dataset.exhibitNumber===n;},number);
      await page.waitForTimeout(400);await page.mouse.click(800,450);
      await page.waitForFunction(()=>!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro'));
      await page.waitForTimeout(3100);
      await page.evaluate(()=>GaiaMapPlayback.stop());
      await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
      await page.evaluate(()=>document.fonts.ready);
      const details=await page.evaluate(()=>({title:document.querySelector('#japan-title').textContent,
        text:document.querySelector('#japan-layer').innerText.slice(-13000),
        providers:Object.fromEntries(['GaiaMarineCod','GaiaEstatExhibits','GaiaLiveExhibits','GaiaPlanetSignals','GaiaFirmsExhibit','GaiaFoodExhibits'].filter(k=>globalThis[k]?.getState).map(k=>[k,globalThis[k].getState()])),
        canvases:[...document.querySelectorAll('#japan-map canvas')].filter(c=>c.checkVisibility({visibilityProperty:true})).map(c=>({id:c.id,state:{...c.dataset}}))}));
      await page.screenshot({path:path.join(out,`${String(number).padStart(2,'0')}.jpg`),type:'jpeg',quality:78});
      report.views.push({number,...details});
      fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
      console.log(`REVIEW ${number}: ${details.title}`);
    }
    await context.close();
    const sheet=await browser.newPage({viewport:{width:1600,height:900}});
    const cards=report.views.filter(v=>v.number>=start).map(v=>`<figure><figcaption>${String(v.number).padStart(2,'0')} ${v.title}</figcaption><img src="data:image/jpeg;base64,${fs.readFileSync(path.join(out,`${String(v.number).padStart(2,'0')}.jpg`)).toString('base64')}"></figure>`);
    await sheet.setContent(`<style>body{margin:0;padding:10px;background:#071219;color:#d2f4ef;font:18px sans-serif;display:grid;grid-template-columns:repeat(2,1fr);gap:10px}figure{margin:0}figcaption{padding:7px}img{width:100%;display:block}</style>${cards.join('')}`);
    await sheet.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
    await sheet.screenshot({path:path.join(out,`gallery-${start}-${start+9}.jpg`),type:'jpeg',quality:85,fullPage:true});await sheet.close();
  }
  report.completed=true;
}catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
