import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const inventory=process.argv.includes('--inventory'),out='artifacts/i18n/map-runtime';fs.mkdirSync(out,{recursive:true});
const runSuffix=process.env.QA_RUN_ID?'-'+process.env.QA_RUN_ID.replace(/[^a-zA-Z0-9-]/gu,''):'';
const numbers=(process.env.QA_NUMBERS||Array.from({length:71},(_,i)=>i+1).join(',')).split(',').map(Number);
const widths=(process.env.QA_WIDTHS||(inventory?'1440':'1440,390')).split(',').map(Number);
const languages=(process.env.QA_LANGUAGES||(inventory?'en':'en,zh-CN')).split(',');
const report={status:'running',scope:'Local Chrome with saved public data. Direct exhibit routes, public POI selectors and slider input. No live feed verification.',checks:[],errors:[]};
const pending=new Map(),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const width of widths)for(const language of languages){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390,reducedMotion:'reduce'});
  await context.route('https://**',r=>r.abort());
  await context.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
  await context.addInitScript(lang=>localStorage.setItem('gaia:language:v1',lang),language);
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:4492/#world-08');
  const scan=async label=>{
   await page.waitForTimeout(140);
   const rows=await page.evaluate(({language,inventory})=>{
    if(inventory)GaiaI18n.set('ja');
    const root=document.querySelector('#japan-layer'),strings=new Map();
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const visible=el=>el.checkVisibility()&&!el.closest('[hidden],[aria-hidden=true]');
    for(let n=walker.nextNode();n;n=walker.nextNode())if(visible(n.parentElement)&&!n.parentElement.closest('script,style,code,pre,input,textarea,[translate=no]')&&n.data.trim())strings.set(n.data.trim(),{selector:n.parentElement.id||n.parentElement.className?.baseVal||n.parentElement.className,read:()=>n.isConnected?n.data.trim():null});
    for(const el of root.querySelectorAll('[aria-label],[title]'))if(visible(el)&&!el.closest('[translate=no]'))for(const attr of ['aria-label','title'])if(el.getAttribute(attr))strings.set(el.getAttribute(attr),{selector:(el.id||el.className?.baseVal||el.className)+'@'+attr,read:()=>el.isConnected?el.getAttribute(attr):null});
    if(inventory)GaiaI18n.set(language);
    // Explicit bindings translate fields separately; inspect their actual final
    // attributes, not a synthetic dictionary lookup of the concatenated source.
    return [...strings].map(([source,row])=>({source,selector:row.selector,text:row.read()??GaiaI18n.t(source)})).filter(row=>(language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u:/[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(row.text));
   },{language,inventory});
   for(const row of rows)pending.set(row.source,{...row,label});
   if(!inventory)assert.deepEqual(rows,[],label);
  };
  for(const number of numbers){
   await page.evaluate(n=>{location.hash='#world-'+String(n).padStart(2,'0');},number);
   await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number')?.textContent)===n&&globalThis.GaiaMapPlayback?.getState().ready&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),number,{timeout:45000});
   if(number>=2&&number<=5)await page.waitForFunction(n=>GaiaPlanetSignals.getState().pointCount>0&&GaiaPlanetSignals.getState().id===GaiaPlanetSignals.definitions.find(d=>Number(d.number)===n).id,number,{timeout:45000});
   await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaModeEntryGuide?.close('map',{restoreFocus:false});});
   await scan(number+'-base');
   const poi=await page.evaluate(n=>{
    const g=globalThis,p=n===1?g.GaiaFirmsExhibit:n<=5?g.GaiaPlanetSignals:n<=14?g.GaiaMapObservationAdapter:n<=20?g.GaiaLiveExhibits:n<=30?g.GaiaEstatExhibits:n<=69?g.GaiaMarineCod:g.GaiaFoodExhibits;
    const points=p?.getCruisePoints?.()||p?.observationPoints||[];
    if(!points.length)return {count:0};
    const index=Math.floor(points.length/2),point=points[index];
    if(n>=15&&n<=20)p.selectObservationPoint(point.id);else p.selectCruisePoi?.(index);
    return {count:points.length,index,id:point?.id};
   },number);
   await page.waitForTimeout(900);
   await scan(number+'-poi');
   const timeline=await page.evaluate(n=>{
    const selector=n===1?'[data-firms-progress]':n<=5?null:n<=14?'.signal-console-map [data-signal-time]':n<=20?'#gaia-live-time':n<=30?'[data-estat-month]':n<=69?'[data-cod-year]':'[data-food-year]';
    const slider=selector&&document.querySelector('#japan-layer '+selector);
    if(!slider||slider.disabled)return null;
    slider.value=slider.min;slider.dispatchEvent(new Event('input',{bubbles:true}));
    return {selector,min:slider.min,max:slider.max};
   },number);
   if(timeline)await page.waitForFunction(()=>GaiaMapPlayback.getState().ready);
   await scan(number+'-time-min');
   if(timeline){await page.locator(timeline.selector).evaluate(el=>{el.value=el.max;el.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>GaiaMapPlayback.getState().ready);await scan(number+'-time-max');}
   if([1,8,13,17,21,26,31,33,45,57,70,71].includes(number))await page.screenshot({path:out+'/'+width+'-'+language+'-'+number+'.png'});
   report.checks.push({width,language,number,poi,timeline});console.log(width,language,number,'pending',pending.size);
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status=inventory?'inventory-complete':'passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{
 fs.writeFileSync(out+'/'+(inventory?'inventory':'report')+runSuffix+'.json',JSON.stringify(report,null,2));
 fs.writeFileSync(out+'/pending.json',JSON.stringify([...pending.values()],null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,pending:pending.size,failure:report.failure}));
}
