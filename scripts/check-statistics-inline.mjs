import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const output='artifacts/statistics-inline-20260913';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.route('https://**',r=>r.abort());
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.goto('http://127.0.0.1:4492/#world-21',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>globalThis.GaiaEstatExhibits?.getStatisticsDataset(),null,{timeout:60000});
await page.locator('#gaia-boot').waitFor({state:'hidden'});
await page.evaluate(()=>GaiaModeLoader.load('statistics'));
await page.waitForFunction(()=>globalThis.GaiaStatisticsLab);
await page.evaluate(()=>{GaiaModeEntryGuide?.close('map',{restoreFocus:false});GaiaStatisticsLab.open({dataset:GaiaEstatExhibits.getStatisticsDataset()});});
await page.waitForFunction(()=>document.querySelector('#gaia-statistics-status')?.textContent==='解析済み');
await page.waitForTimeout(500);
const shell=page.locator('.gaia-statistics-shell');
const bounds=await shell.boundingBox();
assert.equal(await shell.evaluate(n=>getComputedStyle(n).opacity),'1');
assert.equal(await page.locator('.gaia-statistics-kicker').count(),0);
assert.equal(await page.locator('#gaia-statistics-title').textContent(),'データサイエンスラボ統計分析×AIで見えてくる、新たな地平。');
await page.screenshot({path:`${output}/chart.png`});
for (const selector of ['#gaia-statistics-ai-open', '#gaia-statistics-ai-open span', '.gaia-statistics-view-tabs button']) {
 const control=page.locator(selector).first(); await control.hover();
 assert.equal(await control.evaluate(n=>getComputedStyle(n).cursor),'pointer',`Clickable cursor: ${selector}`);
}
await page.locator('#gaia-statistics-ai-open').focus();
assert.notEqual(await page.locator('#gaia-statistics-ai-open').evaluate(n=>getComputedStyle(n).outlineStyle),'none');
const pickerHit=await page.locator('.gaia-statistics-prefecture').evaluate(n=>{const r=n.getBoundingClientRect();return [ [r.x+8,r.y+8],[r.right-8,r.bottom-8] ].every(([x,y])=>document.elementFromPoint(x,y)?.tagName==='SELECT');});
assert(pickerHit,'Entire prefecture card is the native select hit area');
assert.equal(await page.locator('.gaia-statistics-prefecture select option').count(),47);
assert.equal(await page.locator('#gaia-statistics-ai-open svg').count(),1);
const yearLabels=JSON.parse(await page.locator('#gaia-statistics-canvas').getAttribute('data-rendered-x-tick-labels'));
assert(yearLabels.every(label=>/^\d{4}$/.test(label)),'Calendar years have no commas');
const chartBox=await page.locator('#gaia-statistics-visual').boundingBox(),pickerBox=await page.locator('.gaia-statistics-prefecture').boundingBox();
assert(pickerBox.x>chartBox.x+chartBox.width/2 && pickerBox.y>=chartBox.y && pickerBox.y+pickerBox.height<chartBox.y+110,'Picker inside chart upper right');
await page.locator('.gaia-statistics-prefecture select').selectOption('10');
await page.waitForTimeout(500);
for(const view of ['findings','values','records','insights','chart']) {
 await page.locator(`[data-stat-view="${view}"]`).click();await page.waitForTimeout(150);
 const box=await shell.boundingBox();assert(Object.keys(bounds).every(k=>Math.abs(box[k]-bounds[k])<1),`Frame changed: ${view}`);
 if(view!=='chart') {
  const panel=page.locator(`#stat-panel-${view}`);
  const style=await panel.evaluate(n=>({padding:parseFloat(getComputedStyle(n).paddingTop),background:getComputedStyle(n).backgroundColor}));
  assert(style.padding>=16);assert.equal(style.background,'rgb(220, 233, 237)');
  await page.screenshot({path:`${output}/${view}.png`});
 }
 if(view==='insights') {
   assert.equal(await page.locator('.gaia-statistics-insight[data-kind="limitations"]').count(),0);
   assert.equal(await page.locator('.gaia-statistics-insight > p').first().evaluate(n=>getComputedStyle(n).color),'rgb(56, 102, 120)');
   await page.screenshot({path:`${output}/insights.png`});
 }
}
await page.locator('#gaia-statistics-ai-open').click();
await page.waitForTimeout(250);
assert.equal(await page.locator('#gaia-statistics-ai-dialog').getAttribute('role'),'tabpanel');
assert.equal(await page.locator('[data-ai-close]').count(),0);
await page.screenshot({path:`${output}/ai.png`});
console.log(await page.locator('#gaia-statistics-ai-dialog').evaluate(n=>({bounds:n.getBoundingClientRect().toJSON(),scroll:n.scrollHeight,client:n.clientHeight,form:n.querySelector('form').getBoundingClientRect().toJSON()})));
await page.locator('[data-ai-prompt="change"]').click();
await page.route('https://openrouter.ai/**',r=>r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({choices:[{message:{content:'## 要点\nUI回帰テストの**模擬回答**です。\n- 根拠を確認\n<img src=x onerror=alert(1)>'}}]})}));
page.on('dialog',d=>d.accept());
await page.locator('#gaia-statistics-ai-connection-title').click();
assert(await page.locator('.gaia-statistics-ai-connection').evaluate(n=>n.scrollHeight<=n.clientHeight+2),'Connection has no inner scroll');
await page.locator('[name="apiKey"]').fill('qa-not-a-real-key');
await page.locator('#gaia-statistics-ai-form [type="submit"]').click();
await page.waitForFunction(()=>document.querySelector('[data-ai-answer]').dataset.state==='complete');
assert.match(await page.locator('[data-ai-answer]').textContent(),/模擬回答/);
assert.equal(await page.locator('[data-ai-answer] h4').textContent(),'要点');
assert.equal(await page.locator('[data-ai-answer] strong').textContent(),'模擬回答');
assert.equal(await page.locator('[data-ai-answer] li').count(),1);
assert.equal(await page.locator('[data-ai-answer] img').count(),0);
await page.locator('[data-ai-font-plus]').click();
assert.equal(await page.locator('[data-ai-answer]').evaluate(n=>getComputedStyle(n).fontSize),'18px');
assert.equal(await page.evaluate(()=>localStorage.getItem('gaia:ai-answer-font')),'18');
await page.locator('[data-ai-font-minus]').click();
assert.equal(await page.locator('[data-ai-answer]').evaluate(n=>getComputedStyle(n).fontSize),'16px');
await page.locator('[data-ai-clear]').click();
assert.equal(await page.locator('[name="apiKey"]').inputValue(),'');
await page.route('https://openrouter.ai/**',async r=>{await new Promise(resolve=>setTimeout(resolve,700));await r.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'late'}}]})}).catch(()=>{});});
await page.locator('[name="apiKey"]').fill('qa-cancel-not-a-real-key');
await page.locator('#gaia-statistics-ai-form [type="submit"]').click();
await page.locator('[data-ai-cancel]').click();
await page.waitForTimeout(900);
assert.match(await page.locator('[data-ai-answer]').textContent(),/送信を中止/);
await page.keyboard.press('Escape');
assert.equal(await page.locator('#gaia-statistics-ai-dialog').isVisible(),false);
console.log('PASS stable frame, 47 prefectures, inline AI, presets and Escape');
for (const [width,height] of [[1366,768],[390,844],[844,390]]) {
 await page.setViewportSize({width,height});await page.waitForTimeout(500);
 await page.locator('#gaia-statistics-ai-open').click();await page.waitForTimeout(200);
 await page.screenshot({path:`${output}/ai-${width}.png`});
 const outer=await shell.boundingBox();assert(outer.x>=0&&outer.y>=0&&outer.x+outer.width<=width+1&&outer.y+outer.height<=height+1);
 await page.locator('#gaia-statistics-ai-form [type="submit"]').click({trial:true});
 await page.keyboard.press('Escape');
}
await page.setViewportSize({width:1440,height:900});
for(const lang of ['en','zh-CN']) {
 await page.evaluate(lang=>GaiaI18n.set(lang),lang);
 await page.locator('#gaia-statistics-ai-open').click();await page.waitForTimeout(200);
 await page.locator('#gaia-statistics-ai-form [type="submit"]').click({trial:true});
 await page.screenshot({path:`${output}/ai-${lang}.png`});await page.keyboard.press('Escape');
}
console.log('PASS mocked response, cancellation, key clearing, desktop/mobile layouts and EN/ZH');
await page.emulateMedia({reducedMotion:'reduce'});
assert.equal(await page.locator('#gaia-statistics-ai-open').evaluate(n=>getComputedStyle(n).animationName),'none');
fs.writeFileSync(`${output}/verification.json`,JSON.stringify({date:new Date().toISOString(),browser:browser.version(),status:'PASS',viewports:[[1440,900],[1366,768],[390,844],[844,390]],languages:['ja','en','zh-CN'],ai:'Mock response only; no paid API',files:Object.fromEntries(['index.html','gaia-mode-loader.js','statistics-lab.js','statistics-ai.js','statistics-inline.css'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))},null,2));
}finally{await browser.close();}
