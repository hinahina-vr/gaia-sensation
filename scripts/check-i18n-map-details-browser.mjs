import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/i18n/map-details';fs.mkdirSync(out,{recursive:true});
const inventory=process.argv.includes('--inventory');
const report={status:'running',scope:'Local Chrome and bundled public observations. Native pointer/touch POI activation and native record dialogs; no live-provider claim.',checks:[],pending:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
const scan=async(label,selector='#japan-layer')=>{
 await page.waitForTimeout(200);
 const rows=await page.locator(selector).evaluate((root,language)=>{
  const result=[],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let n=walker.nextNode();n;n=walker.nextNode()){
   const el=n.parentElement;if(!el.checkVisibility()||el.closest('script,style,pre,code,input,textarea,[translate=no],[hidden],[aria-hidden=true]'))continue;
   let text=n.data.trim();
   // Only exact, explicitly identified source fields are original data, not UI prose.
   if(el.dataset.sourceName)text=text.replace(el.dataset.sourceName,'');
   if(el.dataset.sourceId)text=text.replace(el.dataset.sourceId,'');
   if((language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u:/[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(text))result.push({text,selector:el.id||el.className||el.tagName});
  }
  for(const el of root.querySelectorAll('[aria-label],[title],[placeholder]')){
   if(!el.checkVisibility()||el.closest('[translate=no],[hidden],[aria-hidden=true]'))continue;
   for(const attr of ['aria-label','title','placeholder']){
    const text=el.getAttribute(attr)||'';
    if((language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u:/[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(text))result.push({text,selector:(el.id||el.tagName)+'@'+attr});
   }
  }
  return result;
 },await page.evaluate(()=>GaiaI18n.get()));
 report.pending.push(...rows.map(row=>({label,...row})));if(!inventory)assert.deepEqual(rows,[],label);
};
try{
 for(const width of (process.env.QA_WIDTHS||'1440,390').split(',').map(Number))for(const language of (process.env.QA_LANGUAGES||(inventory?'en':'en,zh-CN')).split(',')){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390,reducedMotion:'reduce'});
  await context.route('https://**',r=>r.abort());
  await context.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
  await context.addInitScript(lang=>localStorage.setItem('gaia:language:v1',lang),language);
  await context.addInitScript(()=>{
   globalThis.__qaCanvasTexts=new Set();
   const native=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(text,...args){
    if(this.canvas.closest('#japan-layer'))globalThis.__qaCanvasTexts.add(String(text));
    return native.call(this,text,...args);
   };
  });
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:4492/#world-08');
  for(const number of (process.env.QA_NUMBERS||'1,2,3,4,5,6,7,8,9,10,11,12,13,14,31,65,68').split(',').map(Number)){
   await page.evaluate(n=>{location.hash='#world-'+String(n).padStart(2,'0');},number);
   await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number')?.textContent)===n&&globalThis.GaiaMapPlayback?.getState().ready&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),number,{timeout:45000});
   if(number<=5)await page.waitForFunction(n=>n===1?GaiaFirmsExhibit.getState().pointCount>0:GaiaPlanetSignals.getState().pointCount>0&&Number(GaiaPlanetSignals.getSourceInfo()?.number)===n,number,{timeout:45000});
   await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaModeEntryGuide?.close('map',{restoreFocus:false});GaiaMapObservationAdapter.closePoi();});
   await page.evaluate(()=>__qaCanvasTexts.clear());
   const point=await page.evaluate(async n=>{
    if(n===1){const slider=document.querySelector('[data-firms-progress]');slider.value=slider.max;slider.dispatchEvent(new Event('input',{bubbles:true}));return (await (await fetch('/data/firms-active-fire-snapshot.json')).json()).points.find(p=>p.lat>0&&p.lon>0);}
    if(n<=5)return GaiaPlanetSignals.getCruisePoints().find(p=>p.lat>0&&p.lon>0)||GaiaPlanetSignals.getCruisePoints()[0];
    if(n>=31){const points=GaiaMarineCod.getCruisePoints();const p=points[Math.floor(points.length/2)];GaiaMarineCod.selectStation(p.id,{focus:false});return p;}
    if(n===6)return {lon:0,lat:0};
    const modes=(await GaiaMapObservationAdapter.waitSignalsReady()).modes;
    const ids=['breathing-earth','blue-circulation','forest-cloud-engine','nothing-is-waste','anthropocene-scar','rhythm-of-disaster','three-ecologies','earth-organ','population-tide'];
    const mode=modes.find(m=>m.id===ids[n-6]),s=mode.signals;
    const key=({7:'currents',8:'precipitation',9:'countryWaste',10:'emissions',11:'globalEvents',12:'pairedCountries',13:'current',14:'population'})[n];
    let rows=s[key];
    if(!rows)throw new Error('Missing source rows '+n+' '+JSON.stringify(Object.keys(s)));
    if(n===10||n===14){const years=[...new Set(rows.map(r=>r.year))].sort((a,b)=>a-b);GaiaMapObservationAdapter.setSignalTime(99.999);rows=rows.filter(r=>r.year===years.at(-1));}
    if(n===11){const years=[...new Set(rows.map(r=>String(r.occurredAt).slice(0,4)))].sort();GaiaMapObservationAdapter.setSignalTime(99.999);rows=rows.filter(r=>String(r.occurredAt).slice(0,4)===years.at(-1));}
    const p=rows.find(r=>r.iso3==='DEU')||rows[Math.floor(rows.length/2)];
    return {...p,lon:p.lon??p.longitude,lat:p.lat??p.latitude};
   },number);
   assert(Number.isFinite(point.lon)&&Number.isFinite(point.lat),'Actual observation coordinates '+number);
   if(number>=6&&number<=14)await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.plotRevealState==='complete');
   await page.waitForTimeout(1200);
   await page.evaluate(({point,number})=>{
    GaiaMapPlayback.stop();const r=GaiaMapObservationAdapter.getViewportRect();
    let target={targetX:.5,targetY:.42};
    outer:for(const y of [.42,.3,.6,.7,.2])for(const x of [.5,.7,.3,.8,.2]){
     const el=document.elementFromPoint(r.left+r.width*x,r.top+r.height*y);
     if(el?.matches('canvas,#japan-map')){target={targetX:x,targetY:y};break outer;}
    }
    GaiaMapObservationAdapter.focusEarthLocation({lon:point.lon,lat:point.lat,zoom:number>=31?96:5,...target,durationMs:0});
   },{point,number});
   await page.waitForTimeout(900);
   const xy=await page.evaluate(p=>{
    const r=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset;
    const s=(r.width>=901?r.width/360:Math.max(r.width/360,r.height/180))*Number(d.earthZoom);
    return {x:r.left+r.width/2+Number(d.earthOffsetX)+(((p.lon-Number(d.earthCenterLongitude)+540)%360)-180)*s,y:r.top+r.height/2+Number(d.earthOffsetY)-p.lat*s};
   },point);
   report.lastTarget={number,point,xy,target:await page.evaluate(xy=>document.elementFromPoint(xy.x,xy.y)?.outerHTML.slice(0,400),xy)};
   if(width===390)await page.touchscreen.tap(xy.x,xy.y);else {await page.mouse.move(xy.x,xy.y);await page.waitForTimeout(100);await page.mouse.click(xy.x,xy.y);}
   // Annual observations pin into their own readout; other POIs open the real card.
   if(number===12)await page.waitForFunction(iso=>document.querySelector('#ecologies-exhibit').dataset.selected===iso,point.iso3,{timeout:7000});
   else if(number<31)await page.locator('#japan-poi-card').waitFor({state:'visible',timeout:7000});
   else assert.equal(await page.locator('.gaia-marine-cod-readout').getAttribute('data-cod-selected-station'),point.id);
   await scan(width+'-'+language+'-'+number+'-poi');
   const canvasPending=await page.evaluate(language=>[...__qaCanvasTexts].filter(t=>(language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u:/[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(t)),language);
   report.pending.push(...canvasPending.map(text=>({label:width+'-'+language+'-'+number+'-canvas',text})));
   if(!inventory)assert.deepEqual(canvasPending,[],number+' actual canvas text');
   await page.screenshot({path:out+'/'+width+'-'+language+'-'+number+'.png'});
   if(number>=31&&await page.locator('[data-cod-records]').evaluate(el=>!el.hidden&&!el.disabled)){
    // Mobile tools forwards to the same record button; the native DOM click here
    // tests the provider's dialog, independent of the separately tested tool sheet.
    await page.locator('[data-cod-records]').evaluate(el=>el.click());
    await page.locator('#gaia-record-detail').waitFor({state:'visible'});
    await scan(width+'-'+language+'-'+number+'-records','#gaia-record-detail');
    const records=await page.locator('[data-record-list] li').count();assert(records>0);
    const code=await page.locator('[data-record-list] li small').first().textContent();
    await page.locator('[data-record-search]').fill(code.match(/\S+$/u)[0]);
    assert(await page.locator('[data-record-list] li').count()>0);
    await page.locator('[data-record-close]').click();
   }
   report.checks.push({width,language,number,point:{id:point.id,lon:point.lon,lat:point.lat}});console.log(width,language,number,'pending',report.pending.length);
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status=inventory?'inventory-complete':'passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(out+'/'+(inventory?'inventory':'report')+(process.env.QA_RUN_ID?'-'+process.env.QA_RUN_ID:'')+'.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,pending:report.pending,failure:report.failure}));}
