// 軸名の折返し後も、ヒストグラム・散布図とキーボードの記録参照が一致することを確認。
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const out=process.env.RESPONSIVE_CHART_OUTPUT||'artifacts/responsive-followup-20260913/chart-regression';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const results=[],errors=[];
try{for(const [width,height]of [[320,568],[844,390],[1920,1080]]){
 const c=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});await c.route('https://**',r=>r.abort());await c.addInitScript(()=>{if(location.protocol==='http:')localStorage.setItem('gaia:language:v1','en');});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 try{
 await p.goto('http://127.0.0.1:4492/#world-26');await p.locator('#gaia-boot').waitFor({state:'hidden'});await p.waitForFunction(()=>globalThis.GaiaMapPlayback?.getState().ready);if(width<=900){await p.locator('[data-mobile-sheet="tools"]').click();await p.locator('.map-mobile-action-card').filter({hasText:'Statistical analysis'}).first().click();}else await p.locator('[data-estat-analysis]').click();await p.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
 for(const method of ['summary','scatter']){
  await p.locator('#gaia-statistics-menu-toggle').click();await p.locator(`[data-method="${method}"]:visible`).click();await p.waitForFunction(m=>GaiaStatisticsLab.getState().methodId===m&&GaiaStatisticsLab.getState().analysisReady,method);await p.locator('[data-stat-view="chart"]').click();await p.waitForTimeout(500);
  const chart=p.locator('#gaia-statistics-canvas');await chart.focus();await chart.press('ArrowRight');await chart.press('Enter');await p.waitForTimeout(300);
  const state=await p.evaluate(()=>({selected:GaiaStatisticsLab.getState().selectedRecordId,axis:document.querySelector('#gaia-statistics-canvas').dataset.axisYLines,layout:document.querySelector('#gaia-statistics-canvas').dataset.observationLayout}));assert(state.selected,'keyboard opens a source record');await p.screenshot({path:`${out}/${width}-${method}.png`});results.push({width,height,method,passed:true,state});console.log('PASS chart',width,method);
 }
 }catch(e){results.push({width,passed:false,error:e.stack});await p.screenshot({path:`${out}/${width}-failure.png`});console.log('FAIL chart',width,e.message.slice(0,180));}finally{await c.close();}
}}finally{await browser.close();fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));}
if(errors.length||results.some(r=>!r.passed))process.exitCode=1;
