import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
const base='https://gaia-senseware.pages.dev',out=path.resolve('artifacts/quality-review-20261022/01-20-production-readonly');
fs.mkdirSync(out,{recursive:true});
const report={productionBuild:await fetch(`${base}/build-info.json`).then(r=>r.json()),scope:'Read-only published CSS and rendered metrics; no writes to the site.',checks:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await context.route('https://**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())&&!/google-analytics|googletagmanager/.test(r.request().url())?r.continue():r.abort());
  await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
  const page=await context.newPage();page.setDefaultTimeout(60000);
  for(const number of (process.env.GAIA_METRIC_NUMBERS||'06,08,10,14').split(',')) {
    await page.goto(`${base}/world.html#world-${number}`);
    await page.waitForFunction(n=>document.documentElement.dataset.gaiaAppReady==='true'&&document.querySelector('#japan-mode-number').textContent.trim()===n,number);
    await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
    await page.waitForFunction(()=>!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro'));
    await page.waitForTimeout(2500);await page.evaluate(()=>GaiaMapPlayback.stop());await page.waitForTimeout(900);
    const metric=await page.locator('[data-signal-value]').first().evaluate(e=>({text:e.textContent,html:e.innerHTML,font:getComputedStyle(e).fontSize,descendants:[...e.querySelectorAll('*')].map(c=>({tag:c.tagName,class:c.className,text:c.textContent,font:getComputedStyle(c).fontSize,rect:{width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height}}))}));
    await page.screenshot({path:path.join(out,`finding-${number}-390.png`)});
    report.checks.push({number,metric});console.log(JSON.stringify({number,metric}));
  }
}finally{fs.writeFileSync(path.join(out,'findings-metric-fonts.json'),JSON.stringify(report,null,2));await browser.close();}
