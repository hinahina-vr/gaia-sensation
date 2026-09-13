import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/i18n/statistics-reading';fs.mkdirSync(out,{recursive:true});
const report={status:'running',scope:'Local Chrome, actual exhibit 26 observations, desktop and touch emulation; no AI request sent.',checks:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try {
 for(const width of [1440,390])for(const language of ['en','zh-CN']) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390,reducedMotion:'reduce'});
  await context.route('https://**',r=>r.abort());
  await context.addInitScript(lang=>localStorage.setItem('gaia:language:v1',lang),language);
  page=await context.newPage();
  await page.goto('http://127.0.0.1:4492/#world-26');
  await page.waitForFunction(()=>window.GaiaMapPlayback?.getState().ready);
  await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaModeEntryGuide.close('map',{restoreFocus:false});});
  await page.waitForTimeout(500);
  // Native region focus reveals the real tooltip; layout must use translated text.
  const region=page.locator('.gaia-estat-prefecture-region[tabindex]').first();
  await region.focus();
  await page.waitForTimeout(300);
  const tooltip=await page.locator('.gaia-estat-prefecture-tooltip').evaluate(el=>({text:el.textContent,box:el.getBoundingClientRect().toJSON(),scroll:el.scrollWidth,width:el.clientWidth}));
  assert(tooltip.box.left>=0&&tooltip.box.right<=width+1,'Translated tooltip outside viewport');
  assert(tooltip.scroll<=tooltip.width+1,'Tooltip horizontal overflow');
  const timeline=await page.locator('.gaia-estat-timeline header').evaluate(el=>{
   const a=el.children[0].getBoundingClientRect(),b=el.children[1].getBoundingClientRect();
   return {text:el.textContent,overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top};
  });
  assert(!timeline.overlap,'Timeline labels overlap');
  await page.screenshot({path:`${out}/${width}-${language}-map-tooltip.png`});
  if(width===390){
   await page.locator('[data-mobile-sheet="tools"]').click();
   await page.locator('#map-mobile-sheet .map-mobile-action-card').filter({hasText:language==='en'?'Statistical analysis':'统计分析'}).first().click();
  }else await page.locator('[data-estat-analysis]').click();
  await page.waitForFunction(()=>window.GaiaStatisticsLab?.getState().analysisReady);
  await page.waitForTimeout(300);
  const views=[];
  for(const view of ['chart','findings','values','records','insights']){
   await page.locator(`[data-stat-view="${view}"]`).click();
   await page.waitForTimeout(250);
   const text=await page.locator('#gaia-statistics-lab').innerText();
   assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text),'Untranslated analysis '+view+': '+text);
   await page.screenshot({path:`${out}/${width}-${language}-${view}.png`});
   views.push({view,text});
  }
  const before=await page.evaluate(()=>GaiaStatisticsLab.getState());
  await page.evaluate(()=>GaiaI18n.set('ja'));
  const after=await page.evaluate(()=>GaiaStatisticsLab.getState());
  assert.equal(after.datasetId,before.datasetId);assert.equal(after.methodId,before.methodId);
  report.checks.push({width,language,tooltip,timeline,views});
  await context.close();
 }
 report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}
finally{fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
