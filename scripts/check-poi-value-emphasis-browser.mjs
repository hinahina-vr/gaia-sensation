import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {readAnnualPart} from './lib/annual-snapshot.mjs';
const before=process.argv.includes('--before'),base='http://127.0.0.1:4492';
const widths=process.argv.find(a=>a.startsWith('--widths='))?.split('=')[1].split(',').map(Number) || (before?[1440]:[1440,3840,901,390]);
const out=path.resolve('artifacts/poi-value-emphasis-20260912',before?'before':'after');fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],scope:'Actual local Chrome; original source observations, no live-service evidence.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
try{
 for(const width of widths){
  const mobile=width<901,context=await browser.newContext({viewport:{width,height:width>=2400?2160:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  await enforceBrowserSecurity(context,base);await context.route('https://**',r=>r.abort());page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/?exhibit=35#world',{waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();await page.waitForFunction(()=>globalThis.GaiaMarineCod?.getState().dataState==='ready');await page.evaluate(()=>GaiaMapDemo.stop());
  const source=JSON.parse(fs.readFileSync('data/japan-river-do.json')),point=readAnnualPart(source.periods.at(-1).file).stations.find(p=>p.id==='1401758');assert.equal(point.measurement.value,10);
  await page.selectOption('[data-cod-prefecture]',point.prefCode);await page.selectOption('[data-cod-station]',point.id);
  await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
  const xy=await page.evaluate(p=>{
   GaiaMapObservationAdapter.closePoi();GaiaMapObservationAdapter.focusEarthLocation({lon:p.lon,lat:p.lat,zoom:16,targetX:.5,targetY:.42,durationMs:0});
   const r=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset;
   const s=(r.width>=901?r.width/360:Math.max(r.width/360,r.height/180))*Number(d.earthZoom);
   return {x:r.left+(r.width-360*s)/2+Number(d.earthOffsetX)+((p.lon-150+540)%360)*s,y:r.top+(r.height-180*s)/2+Number(d.earthOffsetY)+(90-p.lat)*s};
  },point);
  await page.waitForTimeout(150);
  if(mobile){await page.touchscreen.tap(xy.x,xy.y);assert.equal(await page.locator('#japan-poi-preview').evaluate(n=>getComputedStyle(n).display),'none');assert.equal(await page.locator('[data-cod-value]').textContent(),'10 mg/L');report.checks.push({width,touch:'No stuck hover tooltip; source value preserved'});await context.close();continue;}
  await page.mouse.move(xy.x,xy.y);const card=page.locator('#japan-poi-preview');await page.waitForFunction(()=>document.querySelector('#japan-poi-preview').getAttribute('aria-hidden')==='false');
  await card.evaluate(async n=>Promise.all(n.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
  assert((await page.locator('#japan-poi-preview-title').textContent()).includes('湖流入前'));
  const sizes=await card.evaluate(n=>{const value=n.querySelector('.poi-preview-number'),meta=n.querySelector('#japan-poi-preview-meta'),title=n.querySelector('#japan-poi-preview-title'),labels=n.querySelector('.poi-preview-reading-labels');const v=value?.getBoundingClientRect(),l=labels?.getBoundingClientRect();return{value:value?.textContent,valueSize:parseFloat(getComputedStyle(value||meta).fontSize),titleSize:parseFloat(getComputedStyle(title).fontSize),metaSize:parseFloat(getComputedStyle(meta).fontSize),rect:n.getBoundingClientRect().toJSON(),overflow:meta.scrollWidth-meta.clientWidth,horizontal:!!v&&!!l&&v.left>=l.right&&Math.abs((v.top+v.bottom-l.top-l.bottom)/2)<2};});
  if(before)assert(sizes.valueSize<sizes.titleSize);else{assert.equal(sizes.value,'10');assert(sizes.valueSize>=56&&sizes.valueSize>=sizes.metaSize*4);assert(sizes.overflow<=1);assert(sizes.rect.left>=0&&sizes.rect.right<=width+1);assert(sizes.horizontal,'Year/metric on the left, large value aligned to their right');assert(sizes.rect.height<110,'No three-row vertical stack');}
  await card.screenshot({path:path.join(out,`${width}-35-card.png`)});await page.screenshot({path:path.join(out,`${width}-35-screen.png`)});
  await page.mouse.click(xy.x,xy.y);assert.equal(await page.locator('[data-cod-value]').textContent(),'10 mg/L');
  report.checks.push({width,pointId:point.id,...sizes});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
